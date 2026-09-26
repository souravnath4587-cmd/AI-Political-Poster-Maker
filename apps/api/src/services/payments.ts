import {
  PLAN_DURATION_DAYS,
  PLAN_PRICE_BDT,
  type PaidPlan,
  type PaymentDto,
  type PaymentResult,
  type UserPlan,
} from '@app/shared';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';
import { Payment, type PaymentDoc } from '../models/Payment';
import { effectivePlan, User, type UserDoc } from '../models/User';
import { BKASH_OK, getBkash, type BkashClient, type BkashPayment } from './bkash';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS = PLAN_DURATION_DAYS * DAY_MS;

/** Where bKash sends the browser after payment (through the web app's /api rewrite). */
export const BKASH_CALLBACK_PATH = '/api/payments/bkash/callback';

export interface PlanChange {
  plan: UserPlan;
  /** null = no end date (kept for admin-given plans). */
  expiresAt: Date | null;
}

/**
 * The user's plan after buying `bought`:
 * - free or expired → `bought` for 30 days from now;
 * - the same plan → 30 days added to the current end date;
 * - pro → premium: premium for 30 days from now, plus the unused pro time scaled by price;
 * - premium → pro: refused while premium lasts (PLAN_DOWNGRADE_BLOCKED);
 * - an admin-given plan without an end date can't be bought again (PLAN_ALREADY_ACTIVE).
 *
 * With `strict: false` (the payment already went through) nothing is refused: a pro payment
 * during premium becomes extra premium days, and a plan without an end date is kept.
 */
export function planAfterPurchase(
  user: Pick<UserDoc, 'plan' | 'planExpiresAt'>,
  bought: PaidPlan,
  now: Date = new Date(),
  { strict = true }: { strict?: boolean } = {},
): PlanChange {
  const current = effectivePlan(user, now);
  const end = user.planExpiresAt;
  const at = (ms: number) => new Date(ms);

  if (current === 'free') return { plan: bought, expiresAt: at(now.getTime() + PERIOD_MS) };

  if (current === 'premium' && bought === 'pro') {
    if (strict) {
      throw new HttpError(409, 'PLAN_DOWNGRADE_BLOCKED', 'Premium is active; Pro would be less');
    }
    const credit = (PERIOD_MS * PLAN_PRICE_BDT.pro) / PLAN_PRICE_BDT.premium;
    return { plan: 'premium', expiresAt: end ? at(end.getTime() + credit) : null };
  }

  if (!end) {
    if (current === bought) {
      if (strict) throw new HttpError(409, 'PLAN_ALREADY_ACTIVE', 'This plan has no end date');
      return { plan: current, expiresAt: null };
    }
    // Permanent pro upgrading to premium: premium for one period, no credit to give.
    return { plan: bought, expiresAt: at(now.getTime() + PERIOD_MS) };
  }

  if (current === bought) return { plan: bought, expiresAt: at(end.getTime() + PERIOD_MS) };

  // pro → premium: unused pro time is worth less per day than premium time.
  const unused = Math.max(0, end.getTime() - now.getTime());
  const credit = (unused * PLAN_PRICE_BDT.pro) / PLAN_PRICE_BDT.premium;
  return { plan: 'premium', expiresAt: at(now.getTime() + PERIOD_MS + credit) };
}

function requireBkash(): BkashClient {
  const client = getBkash();
  if (!client) throw new HttpError(503, 'PAYMENTS_UNAVAILABLE', 'Payments are not configured');
  return client;
}

/** Starts a bKash payment for `plan`; returns bKash's payment page URL. */
export async function startPurchase(user: UserDoc, plan: PaidPlan): Promise<string> {
  const client = requireBkash();
  planAfterPurchase(user, plan); // throws if this purchase isn't allowed

  const amountBdt = PLAN_PRICE_BDT[plan];
  const payment = new Payment({ userId: user._id, plan, amountBdt, invoiceNumber: 'pending' });
  payment.invoiceNumber = `PM${payment._id.toString()}`;
  await payment.save();

  let created: BkashPayment | null = null;
  try {
    created = await client.createPayment({
      amountBdt,
      invoiceNumber: payment.invoiceNumber,
      payerReference: user.phone.replace(/^\+88/, ''),
      callbackURL: `${env.APP_ORIGIN}${BKASH_CALLBACK_PATH}`,
    });
  } catch {
    // Logged by the client.
  }

  if (!created || created.statusCode !== BKASH_OK || !created.paymentID || !created.bkashURL) {
    payment.status = 'failed';
    payment.failureCode = created?.statusCode ?? 'CREATE_UNREACHABLE';
    await payment.save();
    throw new HttpError(502, 'PAYMENT_FAILED', 'bKash could not start the payment');
  }

  payment.bkashPaymentId = created.paymentID;
  await payment.save();
  logger.info({ paymentId: payment._id.toString(), plan }, 'bKash payment started');
  return created.bkashURL;
}

/** Execute, or if that fails or is inconclusive, ask bKash for the payment's state. */
async function settle(client: BkashClient, paymentID: string): Promise<BkashPayment | null> {
  try {
    const executed = await client.executePayment(paymentID);
    if (executed.statusCode === BKASH_OK) return executed;
  } catch {
    // Fall through to the status query.
  }
  try {
    return await client.queryPayment(paymentID);
  } catch {
    return null;
  }
}

function isPaid(result: BkashPayment | null, payment: PaymentDoc): boolean {
  return (
    result !== null &&
    result.statusCode === BKASH_OK &&
    result.transactionStatus === 'Completed' &&
    Number(result.amount) === payment.amountBdt &&
    (result.currency ?? 'BDT') === 'BDT' &&
    (!result.merchantInvoiceNumber || result.merchantInvoiceNumber === payment.invoiceNumber)
  );
}

const RESULT_OF: Record<string, PaymentResult> = {
  completed: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
  pending: 'pending',
  processing: 'pending',
};

/**
 * Handles bKash's redirect back (`?paymentID=…&status=success|failure|cancel`). The payment is
 * only trusted after bKash confirms it server-side; the query string alone proves nothing.
 */
export async function completeFromCallback(
  paymentID: string,
  status: string,
): Promise<PaymentResult> {
  const existing = await Payment.findOne({ bkashPaymentId: paymentID }).lean<PaymentDoc>();
  if (!existing) return 'failed';

  // Claim it: only one callback (a refresh, a double redirect) gets to settle it.
  const payment = await Payment.findOneAndUpdate(
    { _id: existing._id, status: 'pending' },
    { $set: { status: 'processing' } },
    { returnDocument: 'after' },
  ).lean<PaymentDoc>();
  if (!payment) return RESULT_OF[existing.status] ?? 'failed';

  const finish = (fields: Partial<PaymentDoc>) =>
    Payment.updateOne({ _id: payment._id }, { $set: fields });

  if (status !== 'success') {
    const cancelled = status === 'cancel';
    await finish({
      status: cancelled ? 'cancelled' : 'failed',
      failureCode: cancelled ? null : `CALLBACK_${status.toUpperCase().slice(0, 20)}`,
    });
    return cancelled ? 'cancelled' : 'failed';
  }

  const client = getBkash();
  const result = client ? await settle(client, paymentID) : null;
  if (!result || !isPaid(result, payment)) {
    await finish({
      status: 'failed',
      failureCode:
        result?.statusCode === BKASH_OK ? 'NOT_COMPLETED' : (result?.statusCode ?? 'UNREACHABLE'),
    });
    logger.warn(
      {
        paymentId: payment._id.toString(),
        statusCode: result?.statusCode,
        transactionStatus: result?.transactionStatus,
      },
      'bKash payment not completed',
    );
    return 'failed';
  }

  const user = await User.findById(payment.userId).lean<UserDoc>();
  const now = new Date();
  const change = user
    ? planAfterPurchase(user, payment.plan as PaidPlan, now, { strict: false })
    : null;
  if (user && change) {
    await User.updateOne({ _id: user._id }, { plan: change.plan, planExpiresAt: change.expiresAt });
  }
  await finish({
    status: 'completed',
    trxId: result.trxID ?? null,
    planExpiresAt: change?.expiresAt ?? null,
    completedAt: now,
  });
  logger.info(
    { paymentId: payment._id.toString(), plan: change?.plan, trxID: result.trxID },
    'bKash payment completed',
  );
  return 'success';
}

export function toPaymentDto(p: PaymentDoc & { createdAt: Date }): PaymentDto {
  return {
    id: p._id.toString(),
    plan: p.plan as PaidPlan,
    amountBdt: p.amountBdt,
    status: p.status as PaymentDto['status'],
    trxId: p.trxId ?? null,
    planExpiresAt: p.planExpiresAt ? p.planExpiresAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../test/db';
import type * as BkashModule from '../services/bkash';

// bKash is faked: each test decides what it answers. null = not configured.
const bkash = {
  createPayment: vi.fn(),
  executePayment: vi.fn(),
  queryPayment: vi.fn(),
};
let configured = true;
vi.mock('../services/bkash', async (importActual) => ({
  ...(await importActual<typeof BkashModule>()),
  getBkash: () => (configured ? bkash : null),
}));

const { createApp } = await import('../app');
const { Payment } = await import('../models/Payment');
const { User } = await import('../models/User');
const { planAfterPurchase } = await import('../services/payments');

useTestDb();
const app = createApp();

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-26T12:00:00Z');
const inDays = (days: number, from = now) => new Date(from.getTime() + days * DAY);

beforeEach(() => {
  configured = true;
  for (const fn of Object.values(bkash)) fn.mockReset();
  bkash.createPayment.mockImplementation(async () => ({
    statusCode: '0000',
    paymentID: `TR${Math.random().toString(36).slice(2, 10)}`,
    bkashURL: 'https://sandbox.payment.bkash.com/?paymentId=x',
  }));
});

async function login() {
  const phone = '01712345678';
  const { body } = await request(app).post('/api/auth/otp/request').send({ phone });
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/otp/verify')
    .send({ phone, code: body.devCode, acceptTerms: true })
    .expect(200);
  return { agent, userId: res.body.user.id as string };
}

/** Starts a payment and returns the paymentID bKash (the fake) gave it. */
async function start(agent: request.Agent, plan: 'pro' | 'premium') {
  await agent.post('/api/payments/bkash').send({ plan }).expect(201);
  const created = bkash.createPayment.mock.results.at(-1)!.value as Promise<{ paymentID: string }>;
  return (await created).paymentID;
}

/** Makes bKash confirm the payment with the stored amount and invoice. */
async function bkashConfirms(paymentID: string, overrides: Record<string, string> = {}) {
  const payment = await Payment.findOne({ bkashPaymentId: paymentID }).lean();
  bkash.executePayment.mockResolvedValue({
    statusCode: '0000',
    paymentID,
    trxID: 'BFK123XYZ',
    transactionStatus: 'Completed',
    amount: String(payment!.amountBdt),
    currency: 'BDT',
    merchantInvoiceNumber: payment!.invoiceNumber,
    ...overrides,
  });
}

const callback = (paymentID: string, status = 'success') =>
  request(app).get('/api/payments/bkash/callback').query({ paymentID, status });

describe('planAfterPurchase', () => {
  const user = (plan: 'free' | 'pro' | 'premium', planExpiresAt: Date | null = null) => ({
    plan,
    planExpiresAt,
  });

  it('gives a free or expired user the plan for 30 days from now', () => {
    expect(planAfterPurchase(user('free'), 'pro', now)).toEqual({
      plan: 'pro',
      expiresAt: inDays(30),
    });
    expect(planAfterPurchase(user('pro', inDays(-1)), 'premium', now)).toEqual({
      plan: 'premium',
      expiresAt: inDays(30),
    });
  });

  it('adds 30 days to the current end date when buying the same plan', () => {
    expect(planAfterPurchase(user('pro', inDays(10)), 'pro', now).expiresAt).toEqual(inDays(40));
  });

  it('credits unused pro days, scaled by price, when upgrading to premium', () => {
    // 15 pro days × 100/150 = 10 premium days.
    expect(planAfterPurchase(user('pro', inDays(15)), 'premium', now)).toEqual({
      plan: 'premium',
      expiresAt: inDays(40),
    });
  });

  it('refuses pro while premium lasts, and a second purchase of a plan without an end date', () => {
    expect(() => planAfterPurchase(user('premium', inDays(5)), 'pro', now)).toThrow(
      expect.objectContaining({ code: 'PLAN_DOWNGRADE_BLOCKED', status: 409 }),
    );
    expect(() => planAfterPurchase(user('pro', null), 'pro', now)).toThrow(
      expect.objectContaining({ code: 'PLAN_ALREADY_ACTIVE' }),
    );
  });

  it('once paid, never refuses: pro during premium becomes extra premium days', () => {
    expect(planAfterPurchase(user('premium', inDays(5)), 'pro', now, { strict: false })).toEqual({
      plan: 'premium',
      expiresAt: inDays(25),
    });
  });
});

describe('bKash payments', () => {
  it('starts a payment with the server-side price and the callback URL', async () => {
    const { agent, userId } = await login();
    const res = await agent.post('/api/payments/bkash').send({ plan: 'premium', amount: 1 });
    expect(res.status).toBe(201);
    expect(res.body.bkashURL).toMatch(/^https:\/\/sandbox\.payment\.bkash\.com/);

    const input = bkash.createPayment.mock.calls[0]![0];
    expect(input).toMatchObject({
      amountBdt: 150,
      payerReference: '01712345678',
      callbackURL: 'http://localhost:3000/api/payments/bkash/callback',
    });
    const payment = await Payment.findOne({ userId }).lean();
    expect(payment).toMatchObject({ plan: 'premium', amountBdt: 150, status: 'pending' });
    expect(input.invoiceNumber).toBe(payment!.invoiceNumber);
  });

  it('gives the plan after bKash confirms, and sends the user back to /plans', async () => {
    const { agent, userId } = await login();
    const paymentID = await start(agent, 'pro');
    await bkashConfirms(paymentID);

    const res = await callback(paymentID);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/plans?payment=success');

    const user = await User.findById(userId).lean();
    expect(user!.plan).toBe('pro');
    const days = (user!.planExpiresAt!.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    expect((await agent.get('/api/auth/me')).body.user.plan).toBe('pro');

    const history = await agent.get('/api/payments/me').expect(200);
    expect(history.body.payments).toEqual([
      expect.objectContaining({
        plan: 'pro',
        amountBdt: 100,
        status: 'completed',
        trxId: 'BFK123XYZ',
      }),
    ]);
  });

  it('applies the plan only once when the callback repeats', async () => {
    const { agent, userId } = await login();
    const paymentID = await start(agent, 'pro');
    await bkashConfirms(paymentID);

    await Promise.all([callback(paymentID), callback(paymentID), callback(paymentID)]);
    const again = await callback(paymentID);
    expect(again.headers.location).toMatch(/payment=success$/);

    expect(bkash.executePayment).toHaveBeenCalledTimes(1);
    const days =
      ((await User.findById(userId).lean())!.planExpiresAt!.getTime() - Date.now()) / DAY;
    expect(days).toBeLessThanOrEqual(30);
  });

  it('leaves the plan alone when the user cancels or bKash reports a failure', async () => {
    const { agent, userId } = await login();
    const cancelled = await start(agent, 'pro');
    expect((await callback(cancelled, 'cancel')).headers.location).toMatch(/payment=cancelled$/);
    const failed = await start(agent, 'pro');
    expect((await callback(failed, 'failure')).headers.location).toMatch(/payment=failed$/);

    expect(bkash.executePayment).not.toHaveBeenCalled();
    expect((await User.findById(userId).lean())!.plan).toBe('free');
    expect((await Payment.find({ userId }).lean()).map((p) => p.status).sort()).toEqual([
      'cancelled',
      'failed',
    ]);
  });

  it('does not trust status=success alone: wrong amount or an unfinished payment fails', async () => {
    const { agent, userId } = await login();
    const wrongAmount = await start(agent, 'premium');
    await bkashConfirms(wrongAmount, { amount: '1' });
    expect((await callback(wrongAmount)).headers.location).toMatch(/payment=failed$/);

    const unfinished = await start(agent, 'premium');
    bkash.executePayment.mockResolvedValue({
      statusCode: '2056',
      statusMessage: 'Invalid Payment State',
    });
    bkash.queryPayment.mockResolvedValue({ statusCode: '0000', transactionStatus: 'Initiated' });
    expect((await callback(unfinished)).headers.location).toMatch(/payment=failed$/);

    expect((await User.findById(userId).lean())!.plan).toBe('free');
  });

  it('asks bKash for the status when execute times out', async () => {
    const { agent, userId } = await login();
    const paymentID = await start(agent, 'pro');
    const payment = await Payment.findOne({ bkashPaymentId: paymentID }).lean();
    bkash.executePayment.mockRejectedValue(new Error('timeout'));
    bkash.queryPayment.mockResolvedValue({
      statusCode: '0000',
      transactionStatus: 'Completed',
      trxID: 'BFK999',
      amount: '100.00',
      currency: 'BDT',
      merchantInvoiceNumber: payment!.invoiceNumber,
    });

    expect((await callback(paymentID)).headers.location).toMatch(/payment=success$/);
    expect((await User.findById(userId).lean())!.plan).toBe('pro');
  });

  it('refuses pro while premium is active, and unknown payment ids', async () => {
    const { agent, userId } = await login();
    await User.updateOne(
      { _id: userId },
      { plan: 'premium', planExpiresAt: inDays(10, new Date()) },
    );
    const res = await agent.post('/api/payments/bkash').send({ plan: 'pro' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAN_DOWNGRADE_BLOCKED');

    expect((await callback('TR-unknown')).headers.location).toMatch(/payment=failed$/);
  });

  it('answers 503 when bKash is not configured, and 401 without a session', async () => {
    const { agent } = await login();
    configured = false;
    const res = await agent.post('/api/payments/bkash').send({ plan: 'pro' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENTS_UNAVAILABLE');

    await request(app).post('/api/payments/bkash').send({ plan: 'pro' }).expect(401);
  });

  it('marks the payment failed when bKash will not create it', async () => {
    const { agent, userId } = await login();
    bkash.createPayment.mockResolvedValueOnce({
      statusCode: '2001',
      statusMessage: 'Invalid App Key',
    });
    const res = await agent.post('/api/payments/bkash').send({ plan: 'pro' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PAYMENT_FAILED');
    expect(await Payment.findOne({ userId }).lean()).toMatchObject({
      status: 'failed',
      failureCode: '2001',
    });
  });
});

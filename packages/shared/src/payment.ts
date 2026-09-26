import { z } from 'zod';

/** One payment buys this many days of a paid plan (no auto-renew). */
export const PLAN_DURATION_DAYS = 30;

export const paidPlanSchema = z.enum(['pro', 'premium']);
export type PaidPlan = z.infer<typeof paidPlanSchema>;

/** POST /api/payments/bkash */
export const purchasePlanSchema = z.object({ plan: paidPlanSchema });
export type PurchasePlanInput = z.input<typeof purchasePlanSchema>;

export interface StartPaymentResponse {
  /** bKash's payment page; the browser goes there next. */
  bkashURL: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/** Where the bKash callback sends the user back to: /plans?payment=<result>. */
export type PaymentResult = 'success' | 'failed' | 'cancelled' | 'pending';

export interface PaymentDto {
  id: string;
  plan: PaidPlan;
  amountBdt: number;
  status: PaymentStatus;
  /** bKash transaction id, once completed. */
  trxId: string | null;
  /** The plan's end date this payment gave. */
  planExpiresAt: string | null;
  createdAt: string;
}

export interface PaymentsResponse {
  payments: PaymentDto[];
}

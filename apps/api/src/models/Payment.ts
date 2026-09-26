import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { paidPlanSchema } from '@app/shared';

/**
 * One bKash payment for a paid plan. `pending` until bKash calls back; `processing` while the
 * callback executes it (claimed with a conditional update, so a plan is never applied twice).
 */
const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: paidPlanSchema.options, required: true },
    /** Taken from PLAN_PRICE_BDT when the payment starts, never from the client. */
    amountBdt: { type: Number, required: true, min: 1 },
    /** Sent to bKash as merchantInvoiceNumber and checked on the way back. */
    invoiceNumber: { type: String, required: true, unique: true },
    bkashPaymentId: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    trxId: { type: String, default: null },
    /** bKash status code (or our reason) when it failed. */
    failureCode: { type: String, default: null },
    /** The plan's end date this payment gave. */
    planExpiresAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentSchema.index(
  { bkashPaymentId: 1 },
  { unique: true, partialFilterExpression: { bkashPaymentId: { $type: 'string' } } },
);
paymentSchema.index({ userId: 1, createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: mongoose.Types.ObjectId };
export const Payment = mongoose.model('Payment', paymentSchema);

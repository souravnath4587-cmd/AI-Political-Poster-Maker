import { Router } from 'express';
import { z } from 'zod';
import {
  purchasePlanSchema,
  type PaymentResult,
  type PaymentsResponse,
  type StartPaymentResponse,
} from '@app/shared';
import { env } from '../config/env';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/auth';
import { Payment, type PaymentDoc } from '../models/Payment';
import { completeFromCallback, startPurchase, toPaymentDto } from '../services/payments';

export const paymentsRouter = Router();

// POST /api/payments/bkash { plan } — starts a payment; the browser then goes to bkashURL.
paymentsRouter.post('/bkash', requireAuth, async (req, res) => {
  const { plan } = parseBody(purchasePlanSchema, req.body);
  const body: StartPaymentResponse = { bkashURL: await startPurchase(req.auth!.userDoc, plan) };
  res.status(201).json(body);
});

const callbackQuerySchema = z.object({
  paymentID: z.string().min(1).max(100),
  status: z.string().min(1).max(30),
});

// GET /api/payments/bkash/callback?paymentID=…&status=success|failure|cancel — bKash redirects
// the browser here; we settle the payment and send the user back to the plans page.
paymentsRouter.get('/bkash/callback', async (req, res) => {
  const query = callbackQuerySchema.safeParse(req.query);
  const result: PaymentResult = query.success
    ? await completeFromCallback(query.data.paymentID, query.data.status)
    : 'failed';
  res.redirect(302, `${env.APP_ORIGIN}/plans?payment=${result}`);
});

// GET /api/payments/me — the user's last 10 payments.
paymentsRouter.get('/me', requireAuth, async (req, res) => {
  const payments = await Payment.find({ userId: req.auth!.userDoc._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean<(PaymentDoc & { createdAt: Date })[]>();
  const body: PaymentsResponse = { payments: payments.map(toPaymentDto) };
  res.json(body);
});

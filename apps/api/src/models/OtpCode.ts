import mongoose, { Schema, type InferSchemaType } from 'mongoose';

export const OTP_STATUSES = ['pending', 'verified', 'superseded', 'failed'] as const;

/** Rows are kept for a day (for the hourly request limits), long after the code stops working. */
export const OTP_RETENTION_MS = 24 * 60 * 60_000;

const otpCodeSchema = new Schema(
  {
    /** E.164, e.g. +8801712345678. */
    phone: { type: String, required: true },
    /** SHA-256 of pepper + phone + code; the code itself is never stored. */
    codeHash: { type: String, required: true },
    /**
     * pending: can still be used. verified: used for a login. superseded: replaced by a newer
     * code. failed: the SMS was never sent (doesn't count towards the limits).
     */
    status: { type: String, enum: OTP_STATUSES, default: 'pending' },
    /** Verification attempts used; the code is dead after the maximum. */
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
    /** The code stops working at this time. */
    expiresAt: { type: Date, required: true },
    /** Requesting IP, for the per-IP hourly limit. */
    ip: { type: String, default: null },
    /** MongoDB deletes the row shortly after this time (TTL index). */
    purgeAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

otpCodeSchema.index({ phone: 1, createdAt: -1 });
otpCodeSchema.index({ ip: 1, createdAt: -1 });

export type OtpCodeDoc = InferSchemaType<typeof otpCodeSchema> & { _id: mongoose.Types.ObjectId };
export const OtpCode = mongoose.model('OtpCode', otpCodeSchema);

import mongoose, { Schema } from 'mongoose';

const otpCodeSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    /** SHA-256 of pepper + phone + code; the code itself is never stored. */
    codeHash: { type: String, required: true },
    /** Verification attempts used; the code is dead after the maximum. */
    attempts: { type: Number, default: 0 },
    /** MongoDB deletes the row shortly after this time (TTL index). */
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const OtpCode = mongoose.model('OtpCode', otpCodeSchema);

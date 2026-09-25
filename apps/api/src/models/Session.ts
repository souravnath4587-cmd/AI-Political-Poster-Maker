import mongoose, { Schema } from 'mongoose';

const sessionSchema = new Schema(
  {
    /** SHA-256 of the cookie token; a leaked database can't be used to log in. */
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastSeenAt: { type: Date, required: true },
    /** MongoDB deletes the row shortly after this time (TTL index). */
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Session = mongoose.model('Session', sessionSchema);

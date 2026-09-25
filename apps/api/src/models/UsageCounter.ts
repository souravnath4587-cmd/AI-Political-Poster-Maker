import mongoose, { Schema } from 'mongoose';

/** One row per user per Dhaka day: posters, regenerations and headline suggestions used. */
const usageCounterSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** YYYY-MM-DD in Asia/Dhaka. */
    date: { type: String, required: true },
    posters: { type: Number, default: 0, min: 0 },
    regenerations: { type: Number, default: 0, min: 0 },
    headlines: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

usageCounterSchema.index({ userId: 1, date: 1 }, { unique: true });

export const UsageCounter = mongoose.model('UsageCounter', usageCounterSchema);

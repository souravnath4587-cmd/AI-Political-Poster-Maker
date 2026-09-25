import mongoose, { Schema } from 'mongoose';

/** One row per AI call or render, for cost tracking and misuse investigations (R1, R7). */
const generationLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    posterId: { type: Schema.Types.ObjectId, ref: 'Poster', default: null, index: true },
    uploadId: { type: Schema.Types.ObjectId, ref: 'Upload', default: null },
    stage: { type: String, enum: ['headline', 'face-crop', 'render'], required: true },
    /** AI model name, or 'puppeteer' for renders. */
    model: { type: String, required: true },
    latencyMs: { type: Number, required: true },
    success: { type: Boolean, required: true },
    error: { type: String, default: null },
    /** Estimated cost in USD, when known. */
    costEstimate: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const GenerationLog = mongoose.model('GenerationLog', generationLogSchema);

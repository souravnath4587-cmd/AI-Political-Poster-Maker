import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { PHOTO_FIELDS } from '@app/shared';

const storedImageSchema = new Schema(
  {
    publicId: { type: String, required: true },
    version: { type: Number, required: true },
    format: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

/** What the poster used from an upload, copied so it can always be re-rendered (e.g. A3 later). */
const posterPhotoSchema = new Schema(
  {
    field: { type: String, enum: PHOTO_FIELDS, required: true },
    uploadId: { type: Schema.Types.ObjectId, ref: 'Upload', required: true },
    image: { type: storedImageSchema, required: true },
    focus: {
      type: new Schema({ x: Number, y: Number }, { _id: false }),
      required: true,
    },
    faceDetected: { type: Boolean, default: false },
    lowResolution: { type: Boolean, default: false },
  },
  { _id: false },
);

const posterSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
    /** Poster text exactly as the user entered it (template defaults are applied at render time). */
    text: { type: Schema.Types.Mixed, required: true },
    photos: { type: [posterPhotoSchema], default: [] },
    outputs: {
      social45: { type: storedImageSchema, default: null },
      /** Rendered on the first A3 download, then reused. */
      a3: { type: storedImageSchema, default: null },
    },
    status: { type: String, enum: ['completed', 'failed'], required: true },
    watermarked: { type: Boolean, required: true },
    /** Bumped when the renderer changes in a way that alters output. */
    renderVersion: { type: Number, default: 1 },
    editCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
);

// History page: a user's posters, newest first.
posterSchema.index({ userId: 1, createdAt: -1 });

export type PosterDoc = InferSchemaType<typeof posterSchema> & { _id: mongoose.Types.ObjectId };
export const Poster = mongoose.model('Poster', posterSchema);

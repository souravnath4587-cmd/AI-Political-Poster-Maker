import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { uploadKindSchema } from '@app/shared';

/** A photo the user uploaded; posters reference these by id (ownership is checked). */
const uploadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: uploadKindSchema.options, required: true },
    /** Cloudinary asset (delivery type "authenticated"). */
    publicId: { type: String, required: true },
    version: { type: Number, required: true },
    format: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    bytes: { type: Number, required: true },
    /** Crop center in percent of width/height. */
    focus: {
      type: new Schema(
        { x: { type: Number, required: true }, y: { type: Number, required: true } },
        { _id: false },
      ),
      required: true,
    },
    faceDetected: { type: Boolean, default: false },
    /** Detected face box in percent (x, y = top-left). */
    faceBox: {
      type: new Schema({ x: Number, y: Number, w: Number, h: Number }, { _id: false }),
      default: null,
    },
    lowResolution: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type UploadDoc = InferSchemaType<typeof uploadSchema> & { _id: mongoose.Types.ObjectId };
export const Upload = mongoose.model('Upload', uploadSchema);

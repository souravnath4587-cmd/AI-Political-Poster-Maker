import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { layoutConfigSchema, occasionTypeSchema } from '@app/shared';

const templateSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, match: /^[a-z0-9-]+$/ },
    title: { type: String, required: true },
    occasionType: { type: String, required: true, enum: occasionTypeSchema.options, index: true },
    description: { type: String, default: '' },
    thumbnailUrl: { type: String, required: true },
    /** Validated against layoutConfigSchema on every save (see pre-validate hook). */
    layoutConfig: { type: Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Mongoose can't express the layout rules, so Zod checks them and stores the parsed result
// (with defaults filled in). A malformed template can't be saved.
templateSchema.pre('validate', function () {
  const parsed = layoutConfigSchema.safeParse(this.layoutConfig);
  if (!parsed.success) {
    this.invalidate(
      'layoutConfig',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
    return;
  }
  this.layoutConfig = parsed.data;
});

export type TemplateDoc = InferSchemaType<typeof templateSchema>;
export const Template = mongoose.model('Template', templateSchema);

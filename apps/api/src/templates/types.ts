import type { LayoutConfigInput, OccasionType } from '@app/shared';

/** A template as defined in code; `scripts/seed-templates.ts` writes these to MongoDB. */
export interface TemplateSeed {
  slug: string;
  title: string;
  occasionType: OccasionType;
  description: string;
  sortOrder: number;
  layoutConfig: LayoutConfigInput;
}

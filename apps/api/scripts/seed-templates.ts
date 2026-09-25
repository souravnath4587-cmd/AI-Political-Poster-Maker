// Writes the templates defined in src/templates to MongoDB. Safe to run repeatedly:
// existing templates (matched by slug) are updated in place.
//   pnpm --filter @app/api seed:templates
import { connectDb, disconnectDb } from '../src/config/db';
import { Template } from '../src/models/Template';
import { TEMPLATE_SEEDS } from '../src/templates';

await connectDb();

for (const seed of TEMPLATE_SEEDS) {
  const fields = {
    ...seed,
    thumbnailUrl: `/api/templates/thumbnails/${seed.slug}.webp`,
    isActive: true,
  };
  const existing = await Template.findOne({ slug: seed.slug });
  // save() (not updateOne) so the layoutConfig validation hook runs.
  const doc = existing ? existing.set(fields) : new Template(fields);
  await doc.save();
  console.log(`${existing ? 'updated' : 'created'}  ${seed.slug}  (${doc._id.toString()})`);
}

const extra = await Template.find({ slug: { $nin: TEMPLATE_SEEDS.map((s) => s.slug) } }, 'slug');
if (extra.length)
  console.log(`Not in code (left unchanged): ${extra.map((t) => t.slug).join(', ')}`);

await disconnectDb();

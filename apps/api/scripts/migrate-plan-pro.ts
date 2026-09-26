// One-time: moves users stored with the old plan name `premium` (10 posters a day) to `pro`.
// `premium` is now the unlimited plan, so run this once per database BEFORE deploying the API
// that has it, and never after an admin has given someone the new premium plan: it would
// downgrade them.
//   pnpm --filter @app/api db:migrate-plan-pro
import { connectDb, disconnectDb } from '../src/config/db';
import { User } from '../src/models/User';

await connectDb();
const { modifiedCount } = await User.updateMany({ plan: 'premium' }, { $set: { plan: 'pro' } });
console.log(`Moved ${modifiedCount} user(s) from premium to pro`);
await disconnectDb();

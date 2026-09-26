// Creates (or resets) the reviewer accounts from REVIEWER_FREE_PHONE / REVIEWER_PRO_PHONE.
// They log in with REVIEWER_CODE and have already accepted the terms. Safe to run repeatedly.
//   pnpm --filter @app/api seed:users
import { formatBdPhoneLocal } from '@app/shared';
import { reviewer } from '../src/config/env';
import { connectDb, disconnectDb } from '../src/config/db';
import { User } from '../src/models/User';

if (!reviewer) {
  console.error('Set REVIEWER_FREE_PHONE, REVIEWER_PRO_PHONE and REVIEWER_CODE first.');
  process.exit(1);
}

await connectDb();

const accounts = [
  { phone: reviewer.freePhone, plan: 'free' as const },
  { phone: reviewer.proPhone, plan: 'pro' as const },
];

for (const { phone, plan } of accounts) {
  const user = await User.findOneAndUpdate(
    { phone },
    {
      $set: { plan, planExpiresAt: null, isVerified: true, role: 'user' },
      $setOnInsert: { phone, acceptedTermsAt: new Date() },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(
    `${plan.padEnd(7)} ${formatBdPhoneLocal(phone)}  code ${reviewer.code}  (${user._id.toString()})`,
  );
}

await disconnectDb();

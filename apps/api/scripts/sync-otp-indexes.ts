// Brings the otpcodes indexes in line with the model: drops the old TTL index on expiresAt
// (codes are now kept until purgeAt for the hourly limits) and creates the new ones.
// Run once per database after deploying the OTP status/limits change. Safe to run repeatedly.
//   pnpm --filter @app/api db:sync-otp-indexes
import { connectDb, disconnectDb } from '../src/config/db';
import { OtpCode } from '../src/models/OtpCode';

await connectDb();

// Rows from before the change have no status or purgeAt; they live for minutes anyway.
const { deletedCount } = await OtpCode.deleteMany({ purgeAt: { $exists: false } });
const dropped = await OtpCode.syncIndexes();

console.log(
  `Removed ${deletedCount} old code(s); dropped indexes: ${dropped.join(', ') || 'none'}`,
);
await disconnectDb();

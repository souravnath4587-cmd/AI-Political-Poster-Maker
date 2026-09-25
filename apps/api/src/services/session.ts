import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { env } from '../config/env';
import { sha256 } from '../lib/crypto';
import { Session } from '../models/Session';
import { User, type UserDoc } from '../models/User';

const SESSION_TTL_MS = env.SESSION_TTL_DAYS * 24 * 60 * 60_000;
/** Extend a session at most once a day, so most requests only read. */
const SLIDE_AFTER_MS = 24 * 60 * 60_000;

export interface ValidSession {
  sessionId: string;
  user: UserDoc;
  /** Set when the expiry was pushed forward; the cookie should be re-sent with it. */
  renewedUntil?: Date;
}

export async function createSession(
  userId: Types.ObjectId,
  meta: { userAgent?: string; ip?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await Session.create({
    tokenHash: sha256(token),
    userId,
    lastSeenAt: now,
    expiresAt,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip ?? null,
  });
  return { token, expiresAt };
}

export async function validateSession(token: string | undefined): Promise<ValidSession | null> {
  if (!token || token.length > 100) return null;

  const now = new Date();
  // Check expiresAt as well: MongoDB's TTL cleanup runs only about once a minute.
  const session = await Session.findOne({
    tokenHash: sha256(token),
    expiresAt: { $gt: now },
  }).lean();
  if (!session) return null;

  const user = await User.findById(session.userId).lean<UserDoc>();
  if (!user) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }

  const result: ValidSession = { sessionId: session._id.toString(), user };
  if (now.getTime() - session.lastSeenAt.getTime() > SLIDE_AFTER_MS) {
    result.renewedUntil = new Date(now.getTime() + SESSION_TTL_MS);
    await Session.updateOne(
      { _id: session._id },
      { lastSeenAt: now, expiresAt: result.renewedUntil },
    );
  }
  return result;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (token) await Session.deleteOne({ tokenHash: sha256(token) });
}

/** Logs the user out everywhere (also used to lock out a banned user). */
export async function destroyAllSessions(userId: Types.ObjectId | string): Promise<number> {
  const { deletedCount } = await Session.deleteMany({ userId });
  return deletedCount;
}

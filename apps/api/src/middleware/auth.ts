import type { RequestHandler } from 'express';
import type { AuthUser } from '@app/shared';
import { HttpError } from '../lib/httpError';
import { readSessionToken, setSessionCookie } from '../lib/sessionCookie';
import { toAuthUser, type UserDoc } from '../models/User';
import { validateSession } from '../services/session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express's documented extension point
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      auth?: { user: AuthUser; userDoc: UserDoc; sessionId: string };
    }
  }
}

/** 401 unless the request carries a valid session cookie; loads the user into `req.auth`. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = readSessionToken(req);
  const session = await validateSession(token);
  if (!session) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in');

  if (session.renewedUntil && token) setSessionCookie(res, token, session.renewedUntil);

  req.auth = {
    user: toAuthUser(session.user),
    userDoc: session.user,
    sessionId: session.sessionId,
  };
  next();
};

/** Use after requireAuth. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.user.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'Admins only');
  next();
};

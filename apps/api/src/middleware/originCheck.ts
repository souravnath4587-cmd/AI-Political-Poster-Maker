import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie auth, on top of SameSite=Lax: a state-changing request from a
 * browser must come from our own origin. Browsers always send Origin on POST/PATCH/DELETE;
 * requests without it come from non-browser clients (curl, tests), which can't ride on a
 * victim's cookies, so they're allowed.
 */
export const originCheck: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && origin !== env.APP_ORIGIN) {
    throw new HttpError(403, 'FORBIDDEN', 'Cross-site request blocked');
  }
  next();
};

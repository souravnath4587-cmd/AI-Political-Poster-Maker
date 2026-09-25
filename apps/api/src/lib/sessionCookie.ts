import type { Request, Response } from 'express';
import { isProduction } from '../config/env';

export const SESSION_COOKIE = 'sid';

const cookieOptions = {
  httpOnly: true,
  // Browsers accept Secure cookies on http://localhost, but not on other plain-http dev hosts
  // (e.g. a phone testing over the LAN), so Secure is production-only.
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
} as const;

export function readSessionToken(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

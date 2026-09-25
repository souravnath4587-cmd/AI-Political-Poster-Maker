import type { z } from 'zod';
import { HttpError } from './httpError';

/**
 * Parses a request body. Schemas can report an API error code as the issue message
 * (e.g. 'INVALID_PHONE'); otherwise the error is a generic VALIDATION_ERROR.
 */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const code = issue && /^[A-Z_]+$/.test(issue.message) ? issue.message : 'VALIDATION_ERROR';
  throw new HttpError(400, code, 'Invalid request', { issues: result.error.issues });
}

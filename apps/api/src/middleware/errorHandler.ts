import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError';

/** MongoDB driver errors that mean the database can't be reached (not a bug in the request). */
const DB_UNAVAILABLE_ERRORS = new Set([
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
]);

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found'));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, ...err.details } });
    return;
  }

  // Malformed JSON or an oversized body, from express.json().
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500 && err.type) {
    res.status(err.status).json({ error: { code: 'BAD_REQUEST', message: 'Malformed request' } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', issues: err.issues },
    });
    return;
  }

  if (DB_UNAVAILABLE_ERRORS.has(err?.name)) {
    req.log.error({ err }, 'Database unavailable');
    res
      .status(503)
      .json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' } });
    return;
  }

  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};

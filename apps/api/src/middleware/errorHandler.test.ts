import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { logger } from '../lib/logger';
import { errorHandler } from './errorHandler';

function appThrowing(err: Error) {
  const app = express();
  app.use(pinoHttp({ logger }));
  app.get('/', () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('answers 503 SERVICE_UNAVAILABLE when the database cannot be reached', async () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), {
      name: 'MongoServerSelectionError',
    });
    const res = await request(appThrowing(err)).get('/');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('hides the details of other unexpected errors', async () => {
    const res = await request(appThrowing(new Error('secret detail'))).get('/');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret detail');
  });
});

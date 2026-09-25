import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';
import { connectDb } from './config/db';
import { logger } from './lib/logger';

// Vercel function entry (api/index.js). The same app as server.ts, without listen(): each instance
// connects to MongoDB on its first request and reuses the connection while it stays warm.
const app = createApp();
let db: Promise<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  db ??= connectDb().catch((err: unknown) => {
    db = null;
    throw err;
  });

  try {
    await db;
  } catch (err) {
    logger.error({ err }, 'Mongo connection failed');
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } }));
    return;
  }

  app(req, res);
}

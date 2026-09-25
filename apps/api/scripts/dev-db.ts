// Local MongoDB for development: no install or Atlas account needed.
// Uses the mongod binary managed by mongodb-memory-server, with data persisted in apps/api/.data/mongo.
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Nothing to start when .env points at Atlas (or any other remote server).
if (existsSync('.env')) process.loadEnvFile('.env');
const uri = process.env.MONGODB_URI ?? '';
if (uri && !/:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(uri)) {
  console.log('MONGODB_URI points to a remote database; local MongoDB not started.');
  process.exit(0);
}

const port = Number(process.env.DEV_DB_PORT ?? 27017);
const dbPath = resolve(import.meta.dirname, '../.data/mongo');
mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port, dbPath, storageEngine: 'wiredTiger' },
});

console.log(`Local MongoDB ready at ${server.getUri()} (data: ${dbPath})`);

const stop = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

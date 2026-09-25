import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../lib/logger';

export async function connectDb(): Promise<void> {
  if (env.DNS_SERVERS?.length) {
    dns.setServers(env.DNS_SERVERS);
    logger.info({ servers: env.DNS_SERVERS }, 'Using custom DNS servers');
  }

  mongoose.connection.on('disconnected', () => logger.warn('Mongo disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('Mongo reconnected'));

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
  });
  logger.info({ db: env.MONGODB_DB_NAME }, 'Mongo connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

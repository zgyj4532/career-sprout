import mongoose from 'mongoose';
import { logEvent, safeErrorMetadata } from '../utils/diagnostics.js';

let eventListenersAttached = false;

function setupConnectionEvents() {
  if (eventListenersAttached) return;

  mongoose.connection.on('error', (error) => {
    logEvent('database.error', safeErrorMetadata(error));
  });

  mongoose.connection.on('disconnected', () => {
    logEvent('database.disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logEvent('database.reconnected');
  });

  eventListenersAttached = true;
}

export const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  setupConnectionEvents();

  const mongoUri = process.env.MONGODB_URI;
  const env = process.env.NODE_ENV || 'development';

  if (!mongoUri && env !== 'development') {
    throw new Error('MONGODB_URI is not set. Set it in your .env file before starting the server.');
  }

  const uri = mongoUri || 'mongodb://localhost:27017/careerpilot';
  const autoIndex = process.env.DB_AUTO_INDEX
    ? process.env.DB_AUTO_INDEX === 'true'
    : env !== 'production';

  const maxPoolSize = parseInt(process.env.DB_MAX_POOL_SIZE, 10) || (env === 'production' ? 50 : 10);
  const minPoolSize = parseInt(process.env.DB_MIN_POOL_SIZE, 10) || (env === 'production' ? 5 : 2);

  logEvent('database.connecting');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize,
    minPoolSize,
    autoIndex,
  });
  logEvent('database.connected');

  // Slow-query profiling is opt-in only. Set ENABLE_DB_PROFILING=true to activate.
  const enableDbProfiling = process.env.ENABLE_DB_PROFILING === 'true';
  if (env !== 'test' && enableDbProfiling) {
    try {
      await mongoose.connection.db.command({ profile: 1, slowms: 100 });
      logEvent('database.profiling_enabled');
    } catch {
      logEvent('database.profiling_failed');
    }
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
    logEvent('database.disconnected');
  }
};

export const checkDBHealth = async () => {
  const state = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  if (state !== 1) {
    return { ok: false, state: states[state] || 'unknown', latencyMs: null };
  }

  const start = Date.now();
  try {
    await mongoose.connection.db.admin().ping();
    return { ok: true, state: 'connected', latencyMs: Date.now() - start };
  } catch {
    return { ok: false, state: 'error', error: 'DATABASE_UNAVAILABLE', latencyMs: Date.now() - start };
  }
};

/**
 * Helper to run a callback inside a MongoDB transaction session with automatic rollback on error.
 */
export const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};


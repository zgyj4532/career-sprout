import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Redis from 'ioredis';
import { connectDB, disconnectDB, checkDBHealth } from './config/database.js';
import {
  assertCampusStartup,
  allowedFrontendOrigins,
  bindHost,
} from './config/localDevIdentity.js';
import { campusDisabledReason } from './campus/profile.js';
import { globalErrorHandler } from './middleware/globalErrorHandler.js';
import resumeRoutes from './routes/resume.js';
import interviewRoutes from './routes/interview.js';
import enhanceRoutes from './routes/enhance.js';
import userProfileRoutes from './routes/userProfile.js';

const BLOCKED_ENHANCE = new Set([
  '/generate-email',
  '/optimize-linkedin',
  '/career-trajectory',
  '/element',
]);

export async function checkRedisHealth() {
  const url = process.env.REDIS_URL;
  if (!url) return { ok: false, error: 'REDIS_URL is not set' };
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    return { ok: pong === 'PONG' };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    client.disconnect();
  }
}

export function createCampusApp() {
  assertCampusStartup(process.env);
  const app = express();
  const origins = allowedFrontendOrigins(process.env);
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }));
  app.use((req, res, next) => {
    const reason = campusDisabledReason(req.originalUrl || req.path);
    if (!reason) return next();
    res.status(404).json({ success: false, error: reason, code: 'CAMPUS_DISABLED' });
  });
  app.get(['/health', '/api/health'], async (_req, res) => {
    let database = { ok: false, state: 'disconnected' };
    try {
      await connectDB();
      database = await checkDBHealth();
    } catch (error) {
      database = { ok: false, state: 'error', error: error.message };
    }
    const redis = await checkRedisHealth();
    const ok = Boolean(database?.ok && redis.ok);
    res.status(ok ? 200 : 503).json({
      status: ok ? 'OK' : 'DEGRADED',
      profile: 'campus-local',
      database,
      redis,
    });
  });
  app.use(async (req, res, next) => {
    if (req.path === '/health' || req.path === '/api/health') return next();
    try {
      await connectDB();
      next();
    } catch (error) {
      console.error(`[campus-db] ${req.method} ${req.originalUrl} ${error.message}`);
      res.status(503).json({
        success: false,
        error: '数据库不可用',
        message: '数据库不可用',
        code: 'DATABASE_UNAVAILABLE',
        method: req.method,
        path: req.originalUrl,
        detail: error.message,
      });
    }
  });
  app.use('/api/resumes', (req, res, next) => {
    if (req.path.startsWith('/import/')) {
      return res.status(404).json({
        success: false,
        error: '外部档案导入在校园本地版未开放',
        code: 'CAMPUS_DISABLED',
      });
    }
    next();
  }, resumeRoutes);
  app.use('/api/interview', (req, res, next) => {
    if (req.method === 'POST' && req.path === '/parse-jd' && req.body?.url) {
      return res.status(404).json({
        success: false,
        error: '岗位链接抓取在校园本地版未开放，请粘贴正文。',
        code: 'CAMPUS_DISABLED',
      });
    }
    if (/\/run-code$/.test(req.path)) {
      return res.status(404).json({
        success: false,
        error: '编程题在校园本地版未开放',
        code: 'CAMPUS_DISABLED',
      });
    }
    next();
  }, interviewRoutes);
  app.use('/api/enhance', (req, res, next) => {
    if (BLOCKED_ENHANCE.has(req.path)) {
      return res.status(404).json({
        success: false,
        error: '此功能在校园本地版未开放',
        code: 'CAMPUS_DISABLED',
      });
    }
    next();
  }, enhanceRoutes);
  app.use('/api/user-profiles', userProfileRoutes);
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: '路由不存在', code: 'NOT_FOUND' });
  });
  app.use(globalErrorHandler);
  return app;
}

export async function startCampusServer() {
  assertCampusStartup(process.env);
  const app = createCampusApp();
  const server = createServer(app);
  const host = bindHost(process.env);
  const port = Number(process.env.PORT || 5002);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  console.log(`campus server listening on http://${host}:${port}`);

  const shutdown = async (signal) => {
    console.log(`received ${signal}, closing campus server`);
    server.close();
    await disconnectDB().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  startCampusServer().catch((error) => {
    console.error(`[campus-startup] ${error.stack || error.message}`);
    process.exit(1);
  });
}

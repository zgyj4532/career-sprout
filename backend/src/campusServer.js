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
import { requestDiagnostics, diagnosticMount, logEvent, safeErrorMetadata } from './utils/diagnostics.js';
import { verifyToken } from './middleware/auth.js';
import campusAuthRoutes, { listTeachers } from './campus/auth.js';
import campusGrowthRoutes from './campus/growth.js';
import campusTargetRoutes from './campus/targets.js';
import campusSharingRoutes from './campus/sharing.js';
import { closeCacheConnection } from './middleware/cacheLayer.js';

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
  } catch {
    return { ok: false, error: 'REDIS_UNAVAILABLE' };
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
  app.use(requestDiagnostics);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    exposedHeaders: ['X-Request-ID', 'Content-Disposition'],
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ success: false, code: 'RATE_LIMITED' }),
  }));
  app.use((req, res, next) => {
    const reason = campusDisabledReason(req.originalUrl || req.path);
    if (!reason) return next();
    res.status(404).json({ success: false, error: reason, code: 'CAMPUS_DISABLED' });
  });
  app.use('/api/campus/auth', diagnosticMount('/api/campus/auth'), campusAuthRoutes);
  app.get(['/health', '/api/health'], async (_req, res) => {
    let database = { ok: false, state: 'disconnected' };
    try {
      await connectDB();
      database = await checkDBHealth();
    } catch {
      database = { ok: false, state: 'error', error: 'DATABASE_UNAVAILABLE' };
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
    } catch {
      logEvent('database.unavailable', { requestId: req.requestId });
      res.status(503).json({ success: false, code: 'DATABASE_UNAVAILABLE', safeMessage: '数据库暂时不可用，请稍后重试。' });
    }
  });
  for (const mount of ['/api/campus', '/api/resumes', '/api/interview', '/api/enhance', '/api/user-profiles']) app.use(mount, diagnosticMount(mount));
  app.use('/api/campus', verifyToken);
  app.get('/api/campus/teachers', listTeachers);
  app.use('/api/campus', campusGrowthRoutes, campusTargetRoutes, campusSharingRoutes);
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
  logEvent('server.started', { state: 'listening' });

  const shutdown = async (signal) => {
    logEvent('server.stopping', { state: signal });
    server.close();
    await closeCacheConnection().catch(() => {});
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
    logEvent('server.failed', safeErrorMetadata(error));
    process.exit(1);
  });
}

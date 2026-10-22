import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const OWNER_A = 'isolation-user-a';
const LOCAL_B = 'campus-local-dev';

const environmentKeys = ['MONGODB_URI', 'REDIS_URL', 'APP_PROFILE', 'NODE_ENV', 'HOST', 'DEV_BYPASS_AUTH', 'DEV_USER_UID', 'FRONTEND_URL', 'CLERK_SECRET_KEY'];
const previousEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

async function call(server, method, pathname, body) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: {
      host: '127.0.0.1:5002',
      origin: 'http://127.0.0.1:5173',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 300) }; }
  return { status: response.status, json };
}

describe('campus private resource isolation', () => {
  let memory;
  let server;
  let resumeId;
  let interviewId;

  before(async () => {
    process.env.REDIS_URL = '';
    memory = await MongoMemoryServer.create();
    process.env.MONGODB_URI = memory.getUri();
    process.env.APP_PROFILE = 'campus-local';
    process.env.NODE_ENV = 'development';
    process.env.HOST = '127.0.0.1';
    process.env.DEV_BYPASS_AUTH = 'false';
    process.env.DEV_USER_UID = LOCAL_B;
    process.env.FRONTEND_URL = 'http://127.0.0.1:5173';
    delete process.env.CLERK_SECRET_KEY;
    const { createCampusApp } = await import('../../campusServer.js');
    const { connectDB } = await import('../../config/database.js');
    await connectDB();
    server = await listen(createCampusApp());
    const { default: Resume } = await import('../../models/Resume.model.js');
    const { default: Interview } = await import('../../models/Interview.model.js');
    const resume = await Resume.create({
      userId: OWNER_A,
      originalText: 'A 的私有简历，B 不能看见',
      title: 'isolation-a',
    });
    resumeId = resume._id.toString();
    const interview = await Interview.create({
      userId: OWNER_A,
      jobRole: '隔离测试岗位',
      industry: '校园',
      experienceLevel: 'student',
      status: 'completed',
    });
    interviewId = interview._id.toString();
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const { closeCacheConnection } = await import('../../middleware/cacheLayer.js');
    await closeCacheConnection();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (memory) await memory.stop();
    for (const key of environmentKeys) {
      if (previousEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnvironment[key];
    }
  });

  test('unauthenticated requests cannot read private resume, history, or profile', async () => {
    process.env.DEV_BYPASS_AUTH = 'false';
    delete process.env.CLERK_SECRET_KEY;
    for (const pathname of [
      '/api/resumes',
      `/api/resumes/${resumeId}`,
      '/api/interview/history',
      `/api/interview/${interviewId}`,
      '/api/user-profiles/me',
    ]) {
      const result = await call(server, 'GET', pathname);
      assert.equal(result.status, 401, `${pathname} status=${result.status} body=${JSON.stringify(result.json)}`);
      assert.equal(result.json?.success, false);
    }
  });

  test('local user B cannot list, read, update, delete, export, or view history owned by A', async () => {
    process.env.DEV_BYPASS_AUTH = 'true';
    const list = await call(server, 'GET', '/api/resumes');
    assert.equal(list.status, 200, JSON.stringify(list.json));
    const rows = list.json?.data?.data || list.json?.data || [];
    assert.equal(rows.some((row) => String(row.id || row._id) === resumeId), false, JSON.stringify(rows));

    const detail = await call(server, 'GET', `/api/resumes/${resumeId}`);
    assert.equal(detail.status, 404, JSON.stringify(detail.json));

    const updated = await call(server, 'PUT', `/api/resumes/${resumeId}`, { title: 'B 改 A', revision: 1 });
    assert.equal(updated.status, 404, JSON.stringify(updated.json));

    const removed = await call(server, 'DELETE', `/api/resumes/${resumeId}`);
    assert.equal(removed.status, 404, JSON.stringify(removed.json));

    const exported = await call(server, 'GET', `/api/resumes/${resumeId}/download`);
    assert.equal(exported.status, 403, JSON.stringify(exported.json));

    const history = await call(server, 'GET', '/api/interview/history');
    assert.equal(history.status, 200, JSON.stringify(history.json));
    const interviews = history.json?.data || [];
    assert.equal(interviews.some((row) => String(row._id) === interviewId), false, JSON.stringify(interviews));

    const interview = await call(server, 'GET', `/api/interview/${interviewId}`);
    assert.equal(interview.status, 404, JSON.stringify(interview.json));
    for (const [method, suffix] of [['GET', '/profile-confirmation'], ['POST', '/profile-confirmation'], ['POST', '/continue'], ['POST', '/complete']]) {
      const body = suffix === '/profile-confirmation' && method === 'POST' ? { candidates: [], expected: { collegeStudent: null, major: '' } } : method === 'POST' ? {} : undefined;
      const denied = await call(server, method, `/api/interview/${interviewId}${suffix}`, body);
      assert.equal(denied.status, 404, `${suffix}: ${JSON.stringify(denied.json)}`);
    }

    const { default: Resume } = await import('../../models/Resume.model.js');
    const still = await Resume.findById(resumeId).lean();
    assert.equal(still.userId, OWNER_A);
    assert.equal(still.title, 'isolation-a');
  });

  test('canonical profile persists a selected study stage and explicit clear', async () => {
    process.env.DEV_BYPASS_AUTH = 'true';
    delete process.env.CLERK_SECRET_KEY;
    const selected = await call(server, 'PUT', '/api/user-profiles/me', { studyStage: '大三' });
    assert.equal(selected.status, 200, JSON.stringify(selected.json));
    assert.equal(selected.json.profile.studyStage, '大三');
    const cleared = await call(server, 'PUT', '/api/user-profiles/me', { studyStage: '' });
    assert.equal(cleared.status, 200, JSON.stringify(cleared.json));
    assert.equal(cleared.json.profile.studyStage, '');
    const reread = await call(server, 'GET', '/api/user-profiles/me');
    assert.equal(reread.status, 200, JSON.stringify(reread.json));
    assert.equal(reread.json.profile.studyStage, '');
  });

  test('zero-material discovery start and no-answer completion are durable and unscored', async () => {
    process.env.DEV_BYPASS_AUTH = 'true';
    const started = await call(server, 'POST', '/api/interview/discovery/start', { questionCount: 2, language: 'zh' });
    assert.equal(started.status, 200, JSON.stringify(started.json));
    const id = started.json.data.interviewId;
    assert.equal(started.json.data.questions.length, 1);
    assert.equal(started.json.data.purpose, 'discovery');
    const completed = await call(server, 'POST', `/api/interview/${id}/complete`, {});
    assert.equal(completed.status, 200, JSON.stringify(completed.json));
    assert.equal(completed.json.data.overallScore, null);
    assert.equal(completed.json.data.discovery.summary, '');
    assert.deepEqual(completed.json.data.discovery.candidates, []);
    const replay = await call(server, 'POST', `/api/interview/${id}/complete`, {});
    assert.equal(replay.status, 200);
    assert.equal(replay.json.data.completedAt, completed.json.data.completedAt);
    const analytics = await call(server, 'GET', '/api/interview/analytics');
    assert.equal(analytics.json.data.sessions.some((row) => String(row._id) === id), false);
  });

  test('expired generation permits owner deletion without calling the unavailable model', async () => {
    const { default: Interview } = await import('../../models/Interview.model.js');
    const session = await Interview.create({ userId: LOCAL_B, purpose: 'discovery', jobRole: '交流', industry: '交流', experienceLevel: 'unknown', generation: { status: 'pending', kind: 'complete', token: 'stale', leaseUntil: new Date(0) } });
    const deleted = await call(server, 'DELETE', `/api/interview/${session.id}`);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.json));
    assert.equal(await Interview.findById(session.id), null);
  });

  test('a configured Clerk secret blocks the local bypass even with a bearer token', async () => {
    process.env.DEV_BYPASS_AUTH = 'true';
    process.env.CLERK_SECRET_KEY = 'sk_test_not_a_real_session';
    const result = await call(server, 'GET', '/api/resumes');
    delete process.env.CLERK_SECRET_KEY;
    assert.notEqual(result.status, 200, `invalid Clerk credential must not open local data: ${JSON.stringify(result.json)}`);
    assert.equal(result.json?.data, undefined);
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import auth from '../auth.js';
import { requestDiagnostics, diagnosticMount } from '../../utils/diagnostics.js';
import { globalErrorHandler } from '../../middleware/globalErrorHandler.js';
import { getClerkClient, optionalAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { studentSchema } from '../schemas.js';

test('auth status and Resend boundaries do not touch database or fabricate identity', async (t) => {
  process.env.NODE_ENV = 'test';
  process.env.APP_PROFILE = 'campus-local';
  process.env.DEV_BYPASS_AUTH = 'false';
  delete process.env.CLERK_SECRET_KEY;
  const app = express();
  app.use(requestDiagnostics, express.json());
  app.use('/api/campus/auth', auth);
  let databaseTouched = false;
  app.use((_req, _res, next) => { databaseTouched = true; next(new Error('DATABASE_PRIVATE_MARKER')); });
  app.use(globalErrorHandler);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/campus/auth`;
  const output = [];
  t.mock.method(console, 'log', (line) => { output.push(JSON.parse(line)); });
  try {
    const response = await fetch(`${base}/status`, { headers: { 'x-request-id': 'fixture-status-123' } });
    assert.equal(response.headers.get('x-request-id'), 'fixture-status-123');
    const { data } = await response.json();
    assert.equal(data.mode, 'unavailable'); assert.equal(data.authenticated, false); assert.equal(data.user, null);
    for (const route of ['register', 'login', 'verify-email', 'resend-verification']) {
      const result = await fetch(`${base}/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'PRIVATE_PASSWORD', token: 'PRIVATE_TOKEN' }) });
      assert.equal(result.status, 503);
      assert.ok(result.headers.get('x-request-id'));
      const body = await result.json();
      assert.equal(body.code, 'EMAIL_AUTH_NOT_CONFIGURED');
      assert.doesNotMatch(JSON.stringify(body), /PRIVATE_PASSWORD|PRIVATE_TOKEN/);
      const completed = output.find((event) => event.event === 'request.completed' && event.requestId === result.headers.get('x-request-id'));
      assert.equal(completed?.route, `/api/campus/auth/${route}`);
    }
    assert.equal(databaseTouched, false);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('signed session directory outage stays unavailable instead of becoming anonymous', async (t) => {
  const previous = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = 'sk_test_fixture';
  const client = getClerkClient();
  const attach = optionalAuth[1];
  try {
    t.mock.method(client.users, 'getUser', async () => { throw Object.assign(new Error('PRIVATE_UPSTREAM'), { status: 503 }); });
    let error;
    await attach({ auth: { userId: 'user_fixture' } }, {}, (value) => { error = value; });
    assert.equal(error.statusCode, 503); assert.equal(error.code, 'AUTH_UNAVAILABLE');
    assert.doesNotMatch(error.safeMessage, /PRIVATE_UPSTREAM/);
    let missingError;
    await attach({ auth: {} }, {}, (value) => { missingError = value; });
    assert.equal(missingError, undefined);
  } finally { if (previous === undefined) delete process.env.CLERK_SECRET_KEY; else process.env.CLERK_SECRET_KEY = previous; }
});

test('error completion preserves mounted templates without parameter values or regex', async (t) => {
  process.env.NODE_ENV = 'test';
  const events = [];
  t.mock.method(console, 'log', (line) => { events.push(JSON.parse(line)); });
  const app = express();
  app.use(requestDiagnostics);
  app.post('/validate', express.json(), validate(studentSchema), (_req, res) => res.json({ success: true }));
  const interview = express.Router();
  interview.get('/:id([0-9a-fA-F]{24})', (_req, _res, next) => next(Object.assign(new Error('private'), { statusCode: 401 })));
  app.use('/api/interview', diagnosticMount('/api/interview'), interview);
  const profiles = express.Router();
  profiles.use((_req, _res, next) => next(Object.assign(new Error('private'), { statusCode: 401 })));
  app.use('/api/user-profiles', diagnosticMount('/api/user-profiles'), profiles);
  app.use(globalErrorHandler);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const [url, route] of [['/api/interview/507f1f77bcf86cd799439011?token=PRIVATE', '/api/interview/:id'], ['/api/user-profiles/me', '/api/user-profiles/:unmatched']]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`);
      await response.json();
      assert.equal(events.find((event) => event.event === 'request.completed' && event.requestId === response.headers.get('x-request-id'))?.route, route);
    }
    const invalid = await fetch(`http://127.0.0.1:${server.address().port}/validate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ availability: { startDate: '2026-02-30' } }) });
    const invalidBody = await invalid.json();
    assert.equal(invalidBody.code, 'VALIDATION_FAILED');
    assert.deepEqual(invalidBody.details, [{ field: 'availability.startDate', code: 'custom' }]);
    assert.doesNotMatch(JSON.stringify(events), /507f1f77bcf86cd799439011|PRIVATE/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

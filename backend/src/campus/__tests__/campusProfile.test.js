import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { campusDisabledReason } from '../profile.js';

describe('campus disabled route table', () => {
  test('closes payments, community, crawlers, and coding routes', () => {
    assert.match(campusDisabledReason('/api/payments'), /未开放/);
    assert.match(campusDisabledReason('/api/community/posts'), /未开放/);
    assert.match(campusDisabledReason('/api/fellowship'), /未开放/);
    assert.match(campusDisabledReason('/api/fetchjobs'), /未开放/);
    assert.match(campusDisabledReason('/api/job-alerts'), /未开放/);
    assert.match(campusDisabledReason('/api/outreach'), /未开放/);
    assert.match(campusDisabledReason('/api/interview/507f1f77bcf86cd799439011/run-code'), /编程题/);
    assert.match(campusDisabledReason('/api/resumes/import/github'), /外部档案/);
    assert.equal(campusDisabledReason('/api/resumes'), null);
    assert.equal(campusDisabledReason('/api/interview/parse-jd'), null);
    assert.equal(campusDisabledReason('/api/enhance/skill-gap'), null);
    assert.equal(campusDisabledReason('/api/user-profiles/me'), null);
  });
});

describe('campus app request boundary', () => {
  test('disabled API returns 404 before a database connection is required', async () => {
    process.env.APP_PROFILE = 'campus-local';
    process.env.NODE_ENV = 'development';
    process.env.HOST = '127.0.0.1';
    process.env.DEV_BYPASS_AUTH = 'true';
    process.env.FRONTEND_URL = 'http://127.0.0.1:5173';
    delete process.env.CLERK_SECRET_KEY;
    const { createCampusApp } = await import('../../campusServer.js');
    const app = createCampusApp();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/payments`, {
        headers: { host: '127.0.0.1:5002' },
      });
      const body = await response.json();
      assert.equal(response.status, 404);
      assert.equal(body.code, 'CAMPUS_DISABLED');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCampusStartup,
  allowedFrontendOrigins,
  evaluateLocalBypass,
  localDevUser,
} from '../localDevIdentity.js';

const baseEnv = {
  APP_PROFILE: 'campus-local',
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  DEV_BYPASS_AUTH: 'true',
  DEV_USER_UID: 'campus-local-dev',
  DEV_USER_EMAIL: 'campus-dev@localhost',
  FRONTEND_URL: 'http://127.0.0.1:5173',
};

function request(method, host, extraHeaders = {}) {
  return {
    method,
    headers: { host, ...extraHeaders },
  };
}

function productionEnvironment() {
  return {
    ...baseEnv,
    NODE_ENV: 'production',
    HOST: '0.0.0.0',
    DEPLOYMENT_MODE: 'container',
    DEV_BYPASS_AUTH: 'false',
    FRONTEND_URL: 'https://crayzamb.cloud/career-sprout',
    CLERK_SECRET_KEY: 'sk_live_1234567890',
    CLERK_PUBLISHABLE_KEY: 'pk_live_1234567890',
    MONGODB_URI: 'mongodb://career_sprout:secret@mongo:27017/career_sprout?authSource=career_sprout',
    REDIS_URL: 'redis://default:secret@redis:6379/',
  };
}

describe('campus local identity', () => {
  test('refuses production and staging startup when bypass is enabled', () => {
    assert.throws(() => assertCampusStartup({ ...baseEnv, NODE_ENV: 'production' }), /production/);
    assert.throws(() => assertCampusStartup({ ...baseEnv, NODE_ENV: 'staging' }), /staging/);
  });

  test('refuses a non-loopback bind address', () => {
    assert.throws(() => assertCampusStartup({ ...baseEnv, HOST: '0.0.0.0' }), /loopback/);
    assert.throws(() => assertCampusStartup({ ...baseEnv, HOST: '192.168.1.8' }), /loopback/);
  });

  test('allows a development loopback startup', () => {
    assert.doesNotThrow(() => assertCampusStartup(baseEnv));
  });

  test('ignores forwarded headers and rejects a remote Host', () => {
    const decision = evaluateLocalBypass(baseEnv, request('GET', '10.0.0.8', {
      'x-forwarded-host': '127.0.0.1:5002',
      'x-forwarded-for': '127.0.0.1',
    }));
    assert.equal(decision.allow, false);
    assert.equal(decision.reason, 'request-host');
  });

  test('rejects a mutating request from a non-local origin', () => {
    const decision = evaluateLocalBypass(baseEnv, request('POST', '127.0.0.1:5002', {
      origin: 'http://evil.example',
    }));
    assert.equal(decision.allow, false);
    assert.equal(decision.reason, 'origin');
  });

  test('grants a fixed non-admin user and ignores a client uid', () => {
    const decision = evaluateLocalBypass(baseEnv, request('POST', '127.0.0.1:5002', {
      origin: 'http://127.0.0.1:5173',
      'x-dev-uid': 'someone-else',
    }));
    assert.equal(decision.allow, true);
    assert.equal(decision.user.uid, 'campus-local-dev');
    assert.equal(decision.user.isAdmin, false);
    assert.equal(localDevUser({ ...baseEnv, ADMIN_EMAILS: 'campus-dev@localhost' }).isAdmin, false);
  });

  test('does not bypass when Clerk is configured', () => {
    const decision = evaluateLocalBypass(
      { ...baseEnv, CLERK_SECRET_KEY: 'sk_test_real' },
      request('GET', '127.0.0.1:5002'),
    );
    assert.equal(decision.allow, false);
    assert.equal(decision.reason, 'clerk-configured');
  });
  test('accepts only the explicit bounded campus production container contract', () => {
    const production = productionEnvironment();
    assert.doesNotThrow(() => assertCampusStartup(production));
  });

  test('refuses missing production auth, bypass, deployment mode, and dedicated services', () => {
    const production = productionEnvironment();
    for (const [key, value] of [
      ['DEPLOYMENT_MODE', undefined],
      ['DEV_BYPASS_AUTH', 'true'],
      ['CLERK_SECRET_KEY', undefined],
      ['CLERK_PUBLISHABLE_KEY', undefined],
      ['MONGODB_URI', 'mongodb://127.0.0.1:27017/career_sprout'],
      ['REDIS_URL', 'redis://127.0.0.1:6379'],
      ['MONGODB_URI', 'mongodb://mongo:27017/career_sprout'],
      ['REDIS_URL', 'redis://redis:6379'],
      ['FRONTEND_URL', 'http://crayzamb.cloud/career-sprout'],
      ['FRONTEND_URL', 'https://other.example/career-sprout'],
    ]) {
      const candidate = { ...production };
      if (value === undefined) delete candidate[key];
      else candidate[key] = value;
      assert.throws(() => assertCampusStartup(candidate), (error) => error.code === 'CAMPUS_STARTUP_REFUSED');
    }
    assert.equal(allowedFrontendOrigins(production).has('https://crayzamb.cloud'), true);
    assert.equal(allowedFrontendOrigins(production).has('http://localhost:5173'), false);
  });
});

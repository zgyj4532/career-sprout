import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { validate, safeValidationDetails } from '../validate.js';
import { studentSchema } from '../../campus/schemas.js';

/**
 * Create a minimal mock Express req/res with tracking.
 */
function mockReqRes(target = 'body', initial = {}) {
  const state = { statusCode: 200, body: null };
  const req = { [target]: initial };
  const res = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    },
  };
  return { req, res, state };
}

test('campus validation exposes bounded known fields and codes without source text', () => {
  const { req, res, state } = mockReqRes('body', { skillAssessments: [{ name: 'PRIVATE', level: 1 }, { name: 'private', level: 2 }], availability: { startDate: '2026-02-30' } });
  req.campusRequest = true;
  validate(studentSchema)(req, res, () => {});
  assert.equal(state.body.code, 'VALIDATION_FAILED');
  assert.ok(state.body.details.some((item) => item.field === 'skillAssessments' && item.code === 'custom'));
  assert.ok(state.body.details.some((item) => item.field === 'availability.startDate' && item.code === 'custom'));
  assert.doesNotMatch(JSON.stringify(state.body), /PRIVATE|SECRET/);
  const unknown = mockReqRes('body', { PRIVATE_UNKNOWN: 'SECRET' });
  unknown.req.campusRequest = true;
  validate(studentSchema)(unknown.req, unknown.res, () => {});
  assert.doesNotMatch(JSON.stringify(unknown.state.body), /PRIVATE|SECRET/);
  assert.deepEqual(safeValidationDetails([{ field: 'unknownSecret', code: 'custom' }, { field: 'name', code: 'custom', message: 'SECRET', input: 'SECRET' }]), [{ field: 'name', code: 'custom' }]);
});

describe('validate middleware', () => {
  const testSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().int().positive('Age must be positive'),
  });

  test('passes valid body through and calls next()', () => {
    const { req, res, state } = mockReqRes('body', { name: 'Alice', age: 30 });
    let nextCalled = false;

    validate(testSchema, 'body')(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    // Validated (and potentially transformed) data is written back
    assert.equal(req.body.name, 'Alice');
    assert.equal(req.body.age, 30);
  });

  test('rejects invalid body with 400 and structured errors', () => {
    const { req, res, state } = mockReqRes('body', { name: '', age: -5 });

    validate(testSchema, 'body')(req, res, () => {});

    assert.equal(state.statusCode, 400);
    assert.equal(state.body.success, false);
    assert.equal(state.body.error, 'Validation failed');
    assert.ok(Array.isArray(state.body.details));
    assert.ok(state.body.details.length > 0);
    // Should include field-level error messages
    const fields = state.body.details.map((d) => d.field);
    assert.ok(fields.includes('name'));
    assert.ok(fields.includes('age'));
  });

  test('validates query parameters when target is "query"', () => {
    const { req, res, state } = mockReqRes('query', { page: 'abc' });
    const pageSchema = z.object({ page: z.coerce.number().int().positive() });

    validate(pageSchema, 'query')(req, res, () => {});

    assert.equal(state.statusCode, 400);
    assert.equal(state.body.success, false);
  });

  test('validates URL params when target is "params"', () => {
    const { req, res, state } = mockReqRes('params', { id: 'not-a-number' });
    const paramsSchema = z.object({ id: z.coerce.number() });

    validate(paramsSchema, 'params')(req, res, () => {});

    assert.equal(state.statusCode, 400);
    assert.equal(state.body.success, false);
  });

  test('default target is "body"', () => {
    const { req, res, state } = mockReqRes('body', { name: 'Bob', age: 25 });
    let nextCalled = false;

    validate(testSchema)(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
  });

  test('coerced/transformed data is written back to req[target]', () => {
    const schema = z.object({
      count: z.coerce.number().int(),
    });
    const { req, res } = mockReqRes('body', { count: '42' });
    let nextCalled = false;

    validate(schema)(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.body.count, 42); // string '42' coerced to number 42
  });
});

describe('formatZodErrors helper (via module internals)', () => {
  test('formats nested field paths correctly', () => {
    const schema = z.object({
      preferences: z.object({
        jobRole: z.string().min(1),
      }),
    });
    const { req, res, state } = mockReqRes('body', { preferences: { jobRole: '' } });

    validate(schema)(req, res, () => {});

    assert.equal(state.statusCode, 400);
    const details = state.body.details;
    const jobRoleErr = details.find((d) => d.field === 'preferences.jobRole');
    assert.ok(jobRoleErr, 'Expected error for preferences.jobRole');
    assert.ok(jobRoleErr.message);
  });

  test('uses "root" as field when path is empty', () => {
    const schema = z.string().min(1);
    const { req, res, state } = mockReqRes('body', '');

    validate(schema)(req, res, () => {});

    assert.equal(state.statusCode, 400);
    const rootErr = state.body.details.find((d) => d.field === 'root');
    assert.ok(rootErr);
  });
});

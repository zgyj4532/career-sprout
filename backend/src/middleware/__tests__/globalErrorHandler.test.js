import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { globalErrorHandler, catchAsync } from '../globalErrorHandler.js';
import { ApiError } from '../errorHandler.js';

function mockReqRes() {
  const state = { statusCode: 200, body: null };
  const res = {
    setHeader(name, value) { state[name] = value; },
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    },
  };
  return { res, state };
}

describe('globalErrorHandler', () => {
  test('handles error with statusCode and message', () => {
    const { res, state } = mockReqRes();
    const err = new Error('Not found');
    err.statusCode = 404;

    globalErrorHandler(err, {}, res, () => {});

    assert.equal(state.statusCode, 404);
    assert.equal(state.body.success, false);
    assert.equal(state.body.requestId, state['X-Request-ID']);
    assert.equal(state.body.stack, undefined);
  });

  test('defaults to 500 when no statusCode', () => {
    const { res, state } = mockReqRes();
    const err = new Error('SECRET_PRIVATE_SOURCE');

    globalErrorHandler(err, {}, res, () => {});

    assert.equal(state.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(state.body), /SECRET_PRIVATE_SOURCE/);
    assert.equal(state.body.code, 'INTERNAL');
  });

  test('uses fallback message when no message', () => {
    const { res, state } = mockReqRes();
    const err = {};

    globalErrorHandler(err, {}, res, () => {});

    assert.equal(state.statusCode, 500);
    assert.equal(typeof state.body.message, 'string');
    assert.ok(state.body.requestId);
  });
  test('legacy operational errors retain messages but campus and unexpected errors do not leak', () => {
    const legacy = mockReqRes();
    globalErrorHandler(new ApiError(409, 'Known resource conflict'), {}, legacy.res, () => {});
    assert.equal(legacy.state.body.message, 'Known resource conflict');
    const campus = mockReqRes();
    globalErrorHandler(new ApiError(409, 'PRIVATE_SOURCE'), { campusRequest: true }, campus.res, () => {});
    assert.doesNotMatch(JSON.stringify(campus.state.body), /PRIVATE_SOURCE/);
  });
});

describe('catchAsync', () => {
  test('catches async errors and passes to next', async () => {
    const handler = catchAsync(async () => {
      throw new Error('Async error');
    });

    let passedError = null;
    await handler({}, {}, (err) => { passedError = err; });

    assert.equal(passedError.message, 'Async error');
  });

  test('passes through successful handler', async () => {
    let called = false;
    const handler = catchAsync(async (req, res, next) => {
      called = true;
      next();
    });

    await handler({}, {}, () => {});
    assert.equal(called, true);
  });
});

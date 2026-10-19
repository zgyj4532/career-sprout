import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const ORIG_GEMINI_KEY = process.env.GEMINI_API_KEY;
const ORIG_AI_PROVIDER = process.env.AI_PROVIDER;

describe('extractAIProvider middleware', () => {
  let extractAIProvider;

  before(async () => {
    // Set up env fallback
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.AI_PROVIDER = 'gemini';

    const mod = await import('../aiKey.js');
    extractAIProvider = mod.extractAIProvider;
  });

  after(() => {
    process.env.GEMINI_API_KEY = ORIG_GEMINI_KEY;
    process.env.AI_PROVIDER = ORIG_AI_PROVIDER;
  });

  function mockReqRes(headers = {}) {
    const state = { statusCode: 200, body: null };
    const req = {
      headers,
      aiProvider: null,
      aiProviderSource: null,
    };
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

  test('uses server env provider when no headers provided', async () => {
    const { req, res } = mockReqRes({});
    let nextCalled = false;

    await extractAIProvider(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.ok(req.aiProvider);
    assert.equal(req.aiProviderSource, 'server_env');
  });

  test('creates provider from x-ai-provider and x-ai-key headers', async () => {
    const { req, res } = mockReqRes({
      'x-ai-provider': 'gemini',
      'x-ai-key': 'user-gemini-key',
    });
    let nextCalled = false;

    await extractAIProvider(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.ok(req.aiProvider);
    assert.equal(req.aiProviderSource, 'user_header');
  });

  test('handles openrouter via x-openrouter-key header', async () => {
    const { req, res } = mockReqRes({
      'x-openrouter-key': 'or-key-123',
    });
    let nextCalled = false;

    await extractAIProvider(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.ok(req.aiProvider);
    assert.equal(req.aiProviderSource, 'user_openrouter_pkce');
  });

  test('rejects unsupported provider in header', async () => {
    const { req, res, state } = mockReqRes({
      'x-ai-provider': 'unsupported-provider',
      'x-ai-key': 'some-key',
    });

    await extractAIProvider(req, res, () => {});

    assert.equal(state.statusCode, 400);
    assert.match(state.body.error, /unsupported/i);
  });

  test('returns safe unavailable error when no key is configured', async () => {
    // Clear env keys
    const saved = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      CUSTOM_API_KEY: process.env.CUSTOM_API_KEY,
      CUSTOM_BASE_URL: process.env.CUSTOM_BASE_URL,
      AI_PROVIDER: process.env.AI_PROVIDER,
    };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.CUSTOM_API_KEY;
    delete process.env.CUSTOM_BASE_URL;
    process.env.AI_PROVIDER = 'gemini';

    const { req, res } = mockReqRes({});
    let error;
    await extractAIProvider(req, res, (value) => { error = value; });
    assert.equal(error.statusCode, 503);
    assert.equal(error.code, 'AI_KEY_MISSING');
    assert.doesNotMatch(error.safeMessage, /backend\/|CUSTOM_API_KEY|api key/i);

    process.env.GEMINI_API_KEY = saved.GEMINI_API_KEY;
    process.env.AI_PROVIDER = saved.AI_PROVIDER;
    if (saved.OPENAI_API_KEY) process.env.OPENAI_API_KEY = saved.OPENAI_API_KEY;
    else delete process.env.OPENAI_API_KEY;
    if (saved.GROQ_API_KEY) process.env.GROQ_API_KEY = saved.GROQ_API_KEY;
    else delete process.env.GROQ_API_KEY;
    if (saved.CUSTOM_API_KEY) process.env.CUSTOM_API_KEY = saved.CUSTOM_API_KEY;
    else delete process.env.CUSTOM_API_KEY;
    if (saved.CUSTOM_BASE_URL) process.env.CUSTOM_BASE_URL = saved.CUSTOM_BASE_URL;
    else delete process.env.CUSTOM_BASE_URL;
  });

  test('handles model override via x-ai-model header', async () => {
    const { req, res } = mockReqRes({
      'x-ai-provider': 'gemini',
      'x-ai-key': 'key-123',
      'x-ai-model': 'gemini-2.0-flash',
    });
    let nextCalled = false;

    await extractAIProvider(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.ok(req.aiProvider);
  });
});

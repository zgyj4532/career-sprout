import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { OpenRouterAdapter } from './providers/openrouter.js';
import { RequestyAdapter } from './providers/requesty.js';
import { ApiError } from '../middleware/errorHandler.js';
import { aiCallsCounter } from '../middleware/metrics.js';

dotenv.config();

// ---------------------------------------------------------------------------
// Supported provider identifiers
// ---------------------------------------------------------------------------
export const SUPPORTED_PROVIDERS = ['deepseek', 'gemini', 'openai', 'openrouter', 'requesty', 'groq', 'custom'];

// Default model names per provider (used when caller doesn't specify one)
const DEFAULT_MODELS = {
  deepseek: 'deepseek-flash',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',   // OpenRouter uses "org/model" format
  requesty: 'openai/gpt-4o-mini',     // Requesty uses "org/model" format
  groq: 'llama-3.3-70b-versatile',
  custom: 'gpt-3.5-turbo',
};

// ---------------------------------------------------------------------------
// Individual provider adapters
// Each adapter exposes:
//   async generateContent(prompt) => Promise<{ text: string, usage?: { prompt, completion, total } }>
// ---------------------------------------------------------------------------

/**
 * Adapter for Google Gemini (via @google/generative-ai SDK).
 */
class GeminiAdapter {
  constructor(apiKey, modelName) {
    if (!apiKey) {
      throw new Error(
        'Gemini API key is required. ' +
        'Set GEMINI_API_KEY in your .env file or provide it via the X-AI-Key header.'
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName || DEFAULT_MODELS.gemini });
    this.providerName = 'gemini';
  }

  async generateContent(prompt, options = {}) {
    aiCallsCounter.inc({ provider: this.providerName });
    const request = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: {
      ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    } };
    const result = await this.model.generateContent(request, { ...(options.signal ? { signal: options.signal } : {}), ...(options.timeout ? { timeout: options.timeout } : {}) });
    const response = await result.response;
    const text = response.text();
    const um = response.usageMetadata;
    const usage = um
      ? {
          prompt: um.promptTokenCount ?? 0,
          completion: um.candidatesTokenCount ?? 0,
          total: um.totalTokenCount ?? 0,
        }
      : undefined;
    return { text, usage };
  }

  async *generateContentStream(prompt) {
    const result = await this.model.generateContentStream(prompt);
    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      yield { text, fullText };
    }
    const response = await result.response;
    const um = response.usageMetadata;
    yield { done: true, usage: um ? { prompt: um.promptTokenCount ?? 0, completion: um.candidatesTokenCount ?? 0, total: um.totalTokenCount ?? 0 } : undefined };
  }
}

/**
 * Adapter for OpenAI (via official openai SDK).
 */
class OpenAIAdapter {
  constructor(apiKey, modelName) {
    if (!apiKey) {
      throw new Error(
        'OpenAI API key is required. ' +
        'Set OPENAI_API_KEY in your .env file or provide it via the X-AI-Key header.'
      );
    }
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.vibekey.cn/v1';
    this.client = new OpenAI({ apiKey, baseURL });
    this.baseURL = this.client.baseURL;
    this.modelName = modelName || process.env.OPENAI_MODEL || (String(baseURL).includes('vibekey.cn') ? 'gpt-6.1-sol' : DEFAULT_MODELS.openai);
    this.providerName = 'openai';
  }

  async generateContent(prompt, options = {}) {
    aiCallsCounter.inc({ provider: this.providerName });
    const images = options.imageDataUrls || (options.imageDataUrl ? [options.imageDataUrl] : []);
    const content = images.length
      ? [{ type: 'text', text: prompt }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
      : prompt;
    const completion = await this.client.chat.completions.create({
      model: options.model || this.modelName,
      messages: [{ role: 'user', content }],
      temperature: options.temperature ?? 0.7,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    }, {
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
      ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    });
    const u = completion.usage;
    const usage = u
      ? {
          prompt: u.prompt_tokens ?? 0,
          completion: u.completion_tokens ?? 0,
          total: u.total_tokens ?? 0,
        }
      : undefined;
    return { text: completion.choices[0]?.message?.content || '', usage };
  }

  async *generateContentStream(prompt) {
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      stream: true,
    });
    let fullText = '';
    for await (const chunk of completion) {
      const text = chunk.choices[0]?.delta?.content || '';
      fullText += text;
      yield { text, fullText };
    }
    const u = completion.usage;
    yield { done: true, usage: u ? { prompt: u.prompt_tokens ?? 0, completion: u.completion_tokens ?? 0, total: u.total_tokens ?? 0 } : undefined };
  }
}

/**
 * Adapter for Custom OpenAI-compatible endpoints (via official openai SDK).
 */
class CustomAdapter {
  constructor(apiKey, modelName, baseUrl) {
    const key = apiKey || 'dummy-key';
    const config = { apiKey: key };
    if (baseUrl) {
      config.baseURL = baseUrl;
    }
    this.client = new OpenAI(config);
    this.modelName = modelName || DEFAULT_MODELS.custom;
    this.providerName = 'custom';
  }

  async generateContent(prompt, options = {}) {
    aiCallsCounter.inc({ provider: this.providerName });
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    }, { ...(options.signal ? { signal: options.signal } : {}), ...(options.timeout ? { timeout: options.timeout } : {}), ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}) });
    const u = completion.usage;
    const usage = u
      ? {
          prompt: u.prompt_tokens ?? 0,
          completion: u.completion_tokens ?? 0,
          total: u.total_tokens ?? 0,
        }
      : undefined;
    return { text: completion.choices[0]?.message?.content || '', usage };
  }

  async *generateContentStream(prompt) {
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      stream: true,
    });
    let fullText = '';
    for await (const chunk of completion) {
      const text = chunk.choices[0]?.delta?.content || '';
      fullText += text;
      yield { text, fullText };
    }
    const u = completion.usage;
    yield { done: true, usage: u ? { prompt: u.prompt_tokens ?? 0, completion: u.completion_tokens ?? 0, total: u.total_tokens ?? 0 } : undefined };
  }
}


/**
 * Adapter for Groq (via groq-sdk).
 */
class GroqAdapter {
  constructor(apiKey, modelName) {
    if (!apiKey) {
      throw new Error(
        'Groq API key is required. ' +
        'Set GROQ_API_KEY in your .env file or provide it via the X-AI-Key header.'
      );
    }
    this.client = new Groq({ apiKey });
    this.modelName = modelName || DEFAULT_MODELS.groq;
    this.providerName = 'groq';
  }

  async generateContent(prompt, options = {}) {
    aiCallsCounter.inc({ provider: this.providerName });
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 4096,
    }, { ...(options.signal ? { signal: options.signal } : {}), ...(options.timeout ? { timeout: options.timeout } : {}), ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}) });
    const u = completion.usage;
    const usage = u
      ? {
          prompt: u.prompt_tokens ?? 0,
          completion: u.completion_tokens ?? 0,
          total: u.total_tokens ?? 0,
        }
      : undefined;
    return { text: completion.choices[0]?.message?.content || '', usage };
  }

  async *generateContentStream(prompt) {
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    });
    let fullText = '';
    for await (const chunk of completion) {
      const text = chunk.choices[0]?.delta?.content || '';
      fullText += text;
      yield { text, fullText };
    }
    const u = completion.usage;
    yield { done: true, usage: u ? { prompt: u.prompt_tokens ?? 0, completion: u.completion_tokens ?? 0, total: u.total_tokens ?? 0 } : undefined };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an AI provider adapter based on the given provider name and API key.
 *
 * @param {string} provider  - One of 'gemini' | 'openai' | 'openrouter' | 'groq' | 'custom'
 * @param {string} apiKey    - The API key for the chosen provider
 * @param {string} [modelName] - Optional override for the model name
 * @param {string} [baseUrl] - Optional override for the base URL (custom provider)
 * @returns {{ generateContent(prompt: string): Promise<{ text: string, usage?: { prompt: number, completion: number, total: number } }>, providerName: string }}
 */
/**
 * Adapter for DeepSeek (via official OpenAI-compatible API).
 * DeepSeek text models do not accept direct image_url inputs; image workflows
 * must extract text through ocrService before invoking DeepSeek.
 */
class DeepSeekAdapter {
  constructor(apiKey, modelName, baseUrl) {
    if (!apiKey) {
      throw new Error(
        'DeepSeek API key is required. ' +
        'Set DEEPSEEK_API_KEY in your .env file or provide it via the X-AI-Key header.'
      );
    }
    const resolvedBase = baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    this.client = new OpenAI({ apiKey, baseURL: resolvedBase });
    this.baseURL = this.client.baseURL;
    this.modelName = modelName || process.env.DEEPSEEK_MODEL || DEFAULT_MODELS.deepseek;
    this.providerName = 'deepseek';
  }

  async generateContent(prompt, options = {}) {
    const images = options.imageDataUrls || (options.imageDataUrl ? [options.imageDataUrl] : []);
    if (images.length) {
      const err = new ApiError(422, 'DeepSeek provider does not accept direct image inputs; run OCR text extraction first.');
      err.code = 'VISION_NOT_SUPPORTED';
      throw err;
    }
    aiCallsCounter.inc({ provider: this.providerName });
    const thinkingEnabled = options.thinking === true;
    const maxTokens = options.maxTokens
      ? (thinkingEnabled ? options.maxTokens : Math.min(options.maxTokens, 8192))
      : undefined;
    const useJsonObject = options.jsonMode === true && /\bjson\b/i.test(String(prompt));
    const completion = await this.client.chat.completions.create({
      model: options.model || this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
      ...(useJsonObject ? { response_format: { type: 'json_object' } } : {}),
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }, {
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
      ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    });
    const u = completion.usage;
    const usage = u
      ? {
          prompt: u.prompt_tokens ?? 0,
          completion: u.completion_tokens ?? 0,
          total: u.total_tokens ?? 0,
        }
      : undefined;
    return { text: completion.choices[0]?.message?.content || '', usage };
  }

  async *generateContentStream(prompt) {
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      thinking: { type: 'disabled' },
      stream: true,
    });
    let fullText = '';
    for await (const chunk of completion) {
      const text = chunk.choices[0]?.delta?.content || '';
      fullText += text;
      yield { text, fullText };
    }
    const u = completion.usage;
    yield { done: true, usage: u ? { prompt: u.prompt_tokens ?? 0, completion: u.completion_tokens ?? 0, total: u.total_tokens ?? 0 } : undefined };
  }
}

export function createAIProvider(provider, apiKey, modelName, baseUrl) {
  const normalised = (provider || '').toLowerCase().trim();

  switch (normalised) {
    case 'deepseek':
      return new DeepSeekAdapter(apiKey, modelName, baseUrl);
    case 'gemini':
      return new GeminiAdapter(apiKey, modelName);
    case 'openai':
      return new OpenAIAdapter(apiKey, modelName);
    case 'openrouter':
      return new OpenRouterAdapter(apiKey, modelName);
    case 'requesty':
      return new RequestyAdapter(apiKey, modelName);
    case 'groq':
      return new GroqAdapter(apiKey, modelName);
    case 'custom':
      return new CustomAdapter(apiKey, modelName, baseUrl);
    default:
      throw new Error(
        `Unsupported AI provider "${provider}". Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`
      );
  }
}

/**
 * Named factory for multi-provider SDK selection (same as createAIProvider).
 */
export const AIProviderFactory = {
  create: createAIProvider,
  supportedProviders: SUPPORTED_PROVIDERS,
};

// ---------------------------------------------------------------------------
// Default (server-side) provider instance – lazy-initialised
// ---------------------------------------------------------------------------

let _defaultProvider = null;

export function resetDefaultProvider() {
  _defaultProvider = null;
}

export function createServerProvider() {
  const envProvider = (process.env.AI_PROVIDER || '').toLowerCase().trim();
  const customKey = process.env.CUSTOM_API_KEY;
  const customBase = process.env.CUSTOM_BASE_URL;
  const customModel = process.env.CUSTOM_MODEL;
  if (envProvider === 'custom') {
    if (!customKey || !customBase) {
      throw new ApiError(
        503,
        'AI_PROVIDER=custom but CUSTOM_API_KEY or CUSTOM_BASE_URL is missing. Set both in backend/.env. Do not put the key in frontend env.',
      );
    }
    return createAIProvider('custom', customKey, customModel, customBase);
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY || (envProvider === 'deepseek' ? process.env.OPENAI_API_KEY : undefined);
  const keyed = {
    deepseek: deepseekKey,
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    requesty: process.env.REQUESTY_API_KEY,
  };
  if (envProvider && keyed[envProvider]) {
    return createAIProvider(envProvider, keyed[envProvider]);
  }
  if (envProvider === 'deepseek' && !deepseekKey) {
    throw new ApiError(
      503,
      'AI_PROVIDER=deepseek but DEEPSEEK_API_KEY is missing. Set DEEPSEEK_API_KEY in backend/.env.',
    );
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return createAIProvider('deepseek', process.env.DEEPSEEK_API_KEY);
  }
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey && groqApiKey.startsWith('gsk_')) {
    return createAIProvider('groq', groqApiKey);
  }
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey && openaiApiKey.startsWith('sk-')) {
    return createAIProvider('openai', openaiApiKey);
  }
  if (process.env.GEMINI_API_KEY) {
    return createAIProvider('gemini', process.env.GEMINI_API_KEY);
  }
  if (customKey && customBase) {
    return createAIProvider('custom', customKey, customModel, customBase);
  }
  throw new ApiError(
    503,
    'AI features are unavailable. Set one of DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or CUSTOM_API_KEY with CUSTOM_BASE_URL in backend/.env.',
  );
}

export function getDefaultProvider() {
  if (_defaultProvider) return _defaultProvider;
  _defaultProvider = createServerProvider();
  return _defaultProvider;
}

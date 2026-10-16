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
export const SUPPORTED_PROVIDERS = ['gemini', 'openai', 'openrouter', 'requesty', 'groq', 'custom'];

// Default model names per provider (used when caller doesn't specify one)
const DEFAULT_MODELS = {
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

  async generateContent(prompt) {
    aiCallsCounter.inc({ provider: this.providerName });
    const result = await this.model.generateContent(prompt);
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

  async generateContent(prompt) {
    aiCallsCounter.inc({ provider: this.providerName });
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
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

  async generateContent(prompt) {
    aiCallsCounter.inc({ provider: this.providerName });
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
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

  async generateContent(prompt) {
    aiCallsCounter.inc({ provider: this.providerName });
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
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
export function createAIProvider(provider, apiKey, modelName, baseUrl) {
  const normalised = (provider || '').toLowerCase().trim();

  switch (normalised) {
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
// Default (server-side) Gemini instance – used as the fallback
// ---------------------------------------------------------------------------

let _defaultProvider = null;

/**
 * Returns the default server-side Gemini provider (lazy-initialised).
 * Throws if GEMINI_API_KEY is not set.
 */
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

  const keyed = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    requesty: process.env.REQUESTY_API_KEY,
  };
  if (envProvider && keyed[envProvider]) {
    return createAIProvider(envProvider, keyed[envProvider]);
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
    'AI features are unavailable. Set one of GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or CUSTOM_API_KEY with CUSTOM_BASE_URL in backend/.env.',
  );
}

export function getDefaultProvider() {
  if (_defaultProvider) return _defaultProvider;
  _defaultProvider = createServerProvider();
  return _defaultProvider;
}

import OpenAI from 'openai';
import { aiCallsCounter } from '../../middleware/metrics.js';
import { logEvent } from '../../utils/diagnostics.js';

// Exponential backoff helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async (fn, maxRetries = 3, baseDelayMs = 1000) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      // 429 is Too Many Requests (rate limit)
      if (error?.status === 429 && attempt < maxRetries - 1) {
        attempt++;
        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        logEvent('ai.retry', { provider: 'requesty', attempt, status: error?.status });
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
};

/**
 * Adapter for Requesty (OpenAI-compatible endpoint via openai SDK).
 */
export class RequestyAdapter {
  constructor(apiKey, modelName) {
    if (!apiKey) {
      throw new Error(
        'Requesty API key is required. ' +
        'Set REQUESTY_API_KEY in your .env file or provide it via the X-AI-Key header.'
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://router.requesty.ai/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'CareerPilot',
      },
    });
    this.modelName = modelName || 'openai/gpt-4o-mini';
    this.providerName = 'requesty';
  }

  async generateContent(prompt, options = {}) {
    try {
      aiCallsCounter.inc({ provider: this.providerName });
      const completion = await withRetry(() =>
        this.client.chat.completions.create({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature ?? 0.7,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        }, { ...(options.signal ? { signal: options.signal } : {}), ...(options.timeout ? { timeout: options.timeout } : {}), ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}) }),
        options.maxRetries === 0 ? 1 : 3
      );

      const u = completion.usage;
      const usage = u
        ? {
            prompt: u.prompt_tokens ?? 0,
            completion: u.completion_tokens ?? 0,
            total: u.total_tokens ?? 0,
          }
        : undefined;

      return { text: completion.choices[0]?.message?.content || '', usage };
    } catch (error) {
      logEvent('ai.failed', { provider: 'requesty', status: error?.status });

      // Handle known errors gracefully
      if (error?.status === 401) {
        throw new Error('Requesty API Key is invalid or unauthorized.');
      }
      if (error?.status === 402) {
        throw new Error('Requesty account has insufficient credits.');
      }
      if (error?.status === 429) {
        throw new Error('Requesty rate limit exceeded. Please try again later.');
      }

      throw new Error(`Requesty API Error: ${error.message}`);
    }
  }

  async *generateContentStream(prompt) {
    try {
      const completion = await withRetry(() =>
        this.client.chat.completions.create({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          stream: true,
        })
      );
      let fullText = '';
      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta?.content || '';
        fullText += text;
        yield { text, fullText };
      }
      const u = completion.usage;
      yield { done: true, usage: u ? { prompt: u.prompt_tokens ?? 0, completion: u.completion_tokens ?? 0, total: u.total_tokens ?? 0 } : undefined };
    } catch (error) {
      logEvent('ai.failed', { provider: 'requesty', status: error?.status });
      if (error?.status === 401) throw new Error('Requesty API Key is invalid.');
      if (error?.status === 402) throw new Error('Requesty account has insufficient credits.');
      if (error?.status === 429) throw new Error('Requesty rate limit exceeded.');
      throw new Error(`Requesty API Error: ${error.message}`);
    }
  }
}

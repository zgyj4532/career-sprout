import { LIMITS, limitError } from './importLimits.js';
import { logEvent } from '../utils/diagnostics.js';

const DEFAULT_OCR_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_OCR_MODEL = 'qwen3.5-ocr';
const OCR_PROMPT = '请逐字完整识别图片中的全部可读文字，保持原有的标题、段落、表格行与列表换行顺序。只输出识别出的纯文本原文，不要输出解释、总结、Markdown代码块包裹或原文没有的内容。';

function extractMessageText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('\n')
      .trim();
  }
  return '';
}

function stripOptionalFence(text) {
  if (!text.startsWith('```')) return text;
  return text.replace(/^```(?:text|markdown|plaintext)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export function isOcrConfigured(env = process.env) {
  const provider = (env.OCR_PROVIDER || 'dashscope').toLowerCase().trim();
  if (provider !== 'dashscope') return false;
  return Boolean((env.DASHSCOPE_API_KEY || env.QWEN_API_KEY || '').trim());
}

export async function extractImageText({
  imageDataUrl,
  signal,
  timeoutMs = 45000,
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw limitError('IMPORT_IMAGE_INVALID');
  }
  const provider = (env.OCR_PROVIDER || 'dashscope').toLowerCase().trim();
  if (provider !== 'dashscope') {
    throw limitError('OCR_UNAVAILABLE');
  }
  const apiKey = (env.DASHSCOPE_API_KEY || env.QWEN_API_KEY || '').trim();
  if (!apiKey) {
    throw limitError('OCR_UNAVAILABLE');
  }
  const base = (env.QWEN_OCR_BASE_URL || env.QWEN_ASR_BASE_URL || DEFAULT_OCR_BASE_URL).replace(/\/$/, '');
  const model = (env.QWEN_OCR_MODEL || DEFAULT_OCR_MODEL).trim();

  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason || limitError('IMPORT_CANCELLED'));
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(limitError('OCR_TIMEOUT')), timeoutMs);

  const startedAt = Date.now();
  logEvent('ocr.started', { provider: 'dashscope' });
  try {
    const response = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageDataUrl } },
              { type: 'text', text: OCR_PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch { payload = null; }
    if (!response.ok) {
      logEvent('ocr.failed', { code: 'OCR_UPSTREAM', status: response.status, durationMs: Date.now() - startedAt });
      throw limitError('OCR_FAILED');
    }

    const text = stripOptionalFence(extractMessageText(payload));
    if (!text) {
      logEvent('ocr.failed', { code: 'NO_TEXT_LAYER', durationMs: Date.now() - startedAt });
      throw limitError('NO_TEXT_LAYER');
    }
    if (text.length > LIMITS.textChars) {
      logEvent('ocr.failed', { code: 'TEXT_TOO_LONG', durationMs: Date.now() - startedAt });
      throw limitError('TEXT_TOO_LONG');
    }
    logEvent('ocr.completed', { provider: 'dashscope', durationMs: Date.now() - startedAt, bytes: Buffer.byteLength(text, 'utf8') });
    return text;
  } catch (error) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      const code = reason?.code === 'OCR_TIMEOUT' ? 'OCR_TIMEOUT' : 'IMPORT_CANCELLED';
      logEvent('ocr.failed', { code, durationMs: Date.now() - startedAt });
      throw limitError(code);
    }
    if (error?.code && ['OCR_UNAVAILABLE', 'OCR_FAILED', 'NO_TEXT_LAYER', 'TEXT_TOO_LONG', 'IMPORT_IMAGE_INVALID'].includes(error.code)) {
      throw error;
    }
    logEvent('ocr.failed', { code: 'OCR_FAILED', durationMs: Date.now() - startedAt });
    throw limitError('OCR_FAILED');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

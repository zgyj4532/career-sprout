import { AIProviderFactory, getDefaultProvider, SUPPORTED_PROVIDERS } from '../config/aiProviders.js';
import { logEvent } from '../utils/diagnostics.js';
import { campusError } from '../campus/errors.js';

/**
 * Middleware: extractAIProvider
 *
 * Reads optional AI provider configuration from request headers and attaches
 * an AI adapter instance to `req.aiProvider`.
 *
 * Headers consumed:
 *   X-AI-Provider  – provider name (gemini | openai | openrouter | groq)
 *   X-AI-Key       – the user's API key for the chosen provider
 *   X-AI-Model     – (optional) model name override
 *
 * Fallback behaviour:
 *   If no headers are supplied the server-side Gemini key (GEMINI_API_KEY)
 *   is used automatically, so existing behaviour is fully preserved.
 */
export const extractAIProvider = async (req, res, next) => {
  try {
    const providerHeader = req.headers['x-ai-provider'];
    const apiKeyHeader   = req.headers['x-ai-key'];
    const modelHeader    = req.headers['x-ai-model'];
    const baseUrlHeader  = req.headers['x-ai-base-url'];
    const openRouterKeyHeader = req.headers['x-openrouter-key'];

    // --- Case 1a: User supplies OpenRouter key via BYOK PKCE flow ---
    if (openRouterKeyHeader) {
      req.aiProvider = AIProviderFactory.create('openrouter', openRouterKeyHeader);
      req.aiProviderSource = 'user_openrouter_pkce';
      return next();
    }

    // --- Case 1: User supplies both provider + key via headers (Legacy/API fallback) ---
    if (providerHeader && apiKeyHeader) {
      const provider = providerHeader.toLowerCase().trim();

      if (!SUPPORTED_PROVIDERS.includes(provider)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported AI provider "${providerHeader}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
        });
      }

      req.aiProvider = AIProviderFactory.create(provider, apiKeyHeader, modelHeader, baseUrlHeader);
      req.aiProviderSource = 'user_header';
      return next();
    }

    // --- Case 2: No custom headers – check for server-side fallback ---
    try {
      const { createServerProvider } = await import('../config/aiProviders.js');
      req.aiProvider = createServerProvider();
      req.aiProviderSource = 'server_env';
      return next();
    } catch (providerError) {
      if (providerError.statusCode !== 503) throw providerError;
      return next(campusError(503, 'AI_KEY_MISSING', 'AI 服务尚未配置，请继续手动编辑或联系维护者。'));
    }
  } catch (error) {
    logEvent('ai.initialization_failed', { code: 'AI_UNAVAILABLE' });
    return next(campusError(503, 'AI_UNAVAILABLE', 'AI 服务暂时不可用，请稍后重试。'));
  }
};

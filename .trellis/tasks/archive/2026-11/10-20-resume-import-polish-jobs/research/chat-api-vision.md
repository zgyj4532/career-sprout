# Chat API and vision

Date: 2026-10-20. Scope is the campus AI path in `backend/src/campus/ai.js`, the shared provider adapters, and the chat or upload UIs that can reach a model. Keys were not copied into this note.

## Verdict

**Image input on the campus chat path: No.**

Campus polish and job analysis accept only a text string. Every `generateContent` adapter puts that string in `messages[].content` or passes it straight to Gemini. Zod schemas are `.strict()`, so an image field is rejected. The campus resume and job pages have no image picker.

**Configured upstream, one direct image: Yes.** A single out-of-app probe (below) showed that the provider `getDefaultProvider()` actually builds can read one resume screenshot. That does not mean the app can send one today.

## Current campus request shape

`generateJson` loads the default provider and calls `generateContent` with one string. It does not pass files, parts, or a message array.

```7:16:backend/src/campus/ai.js
async function generateJson(event, prompt, schema) {
  logEvent(`${event}.started`);
  try {
    const provider = getDefaultProvider();
    const result = await provider.generateContent(prompt);
    if (typeof result.text !== 'string' || result.text.length > 60000) throw new Error('Invalid response');
    const parsed = schema.safeParse(JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')));
```

Callers:

| Route | Body | Model input |
|---|---|---|
| `POST /api/campus/jobs/analyze` | `{ description }` string, max 20_000 | One Chinese instruction string plus `JSON.stringify({ description })` (`backend/src/campus/growth.js:47`, `backend/src/campus/ai.js:24`) |
| `POST /api/campus/resumes/polish` | `{ sourceText, jobId? }` | One instruction string plus `JSON.stringify({ sourceText, target })` (`backend/src/campus/targets.js:34-36`, `backend/src/campus/ai.js:30`) |
| `POST /api/campus/me/resumes/:id/target` | `{ jobId }` | Same polish call, using saved `source.originalText` (`backend/src/campus/targets.js:38-41`) |

Schemas that block extra fields: `analyzeSchema` and `polishSchema` in `backend/src/campus/schemas.js:18-19`.

The OpenAI-compatible adapters all send the same text shape. Temperature is 0.7. There is no `image_url`, `inlineData`, or content-part array.

```97:103:backend/src/config/aiProviders.js
  async generateContent(prompt) {
    aiCallsCounter.inc({ provider: this.providerName });
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
```

The same string `content` is used by `CustomAdapter` (`backend/src/config/aiProviders.js:148-154`), `GroqAdapter` (`backend/src/config/aiProviders.js:201-208`, plus `max_tokens: 4096`), `OpenRouterAdapter` (`backend/src/config/providers/openrouter.js:61-66`), and `RequestyAdapter` (`backend/src/config/providers/requesty.js:54-59`). Gemini passes the string into `this.model.generateContent(prompt)` (`backend/src/config/aiProviders.js:49-51`). The factory comment types the argument as `prompt: string` (`backend/src/config/aiProviders.js:250`).

`backend/activity/ai_factory.py` mirrors that text-only contract: `generate(prompt: str)` and `messages=[{"role": "user", "content": prompt}]`.

## Provider, model, env

`getDefaultProvider()` caches `createServerProvider()` (`backend/src/config/aiProviders.js:339-343`).

Selection order (`backend/src/config/aiProviders.js:293-336`):

1. `AI_PROVIDER=custom` requires both `CUSTOM_API_KEY` and `CUSTOM_BASE_URL`, then optional `CUSTOM_MODEL` (default `gpt-3.5-turbo`).
2. `AI_PROVIDER` plus the matching key: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, or `REQUESTY_API_KEY`.
3. Else the first fallback that matches: Groq key starting with `gsk_`, OpenAI key starting with `sk-`, any `GEMINI_API_KEY`, then custom key plus base URL.
4. Otherwise `ApiError` 503.

Default models when the caller does not pass one (`backend/src/config/aiProviders.js:18-25`): Gemini `gemini-2.5-flash`, OpenAI `gpt-4o-mini`, OpenRouter and Requesty `openai/gpt-4o-mini`, Groq `llama-3.3-70b-versatile`, custom `gpt-3.5-turbo`.

OpenAI is special-cased (`backend/src/config/aiProviders.js:90-93`):

- Base URL: `OPENAI_BASE_URL`, or `https://api.vibekey.cn/v1` if unset.
- Model: `OPENAI_MODEL`, or `gpt-6.1-sol` when the base URL contains `vibekey.cn`, else `gpt-4o-mini`.

`config/campus-local.backend.env` sets app, database, and Redis only. It has no AI key. `backend/.env` is present and sets `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `CUSTOM_API_KEY`, `CUSTOM_BASE_URL`, `CUSTOM_MODEL`, `DASHSCOPE_API_KEY`, `QWEN_ASR_BASE_URL`, and `QWEN_ASR_MODEL`. Values are not recorded here. Gemini, Groq, OpenRouter, Requesty, and Anthropic keys are not set in that file.

Campus polish and analyze do **not** use `extractAIProvider`. They ignore `X-AI-Key` / `X-AI-Provider` and always use the server default. Header BYOK applies to `/api/enhance/*` and `/api/ai/*` (`backend/src/middleware/aiKey.js:20-59`).

Other fixed endpoints that are not the campus polish path:

- OpenRouter base `https://openrouter.ai/api/v1`, model argument or `openai/gpt-4o-mini`.
- Requesty base `https://router.requesty.ai/v1`, same default model.
- Anthropic repo chat uses `claude-3-5-sonnet-20241022` and `ANTHROPIC_API_KEY` (`backend/src/services/anthropicChatService.js:6-10`, `58-64`). Campus local mode disables `/api/analyzer` and `/api/project-visualizer` (`backend/src/campus/profile.js:22-25`).

## Frontend chat and uploads

Campus UI sends JSON text only:

- Resume polish: `POST /api/campus/resumes/polish` with `{ sourceText, jobId? }` (`frontend/src/campus/pages/ResumePage.jsx:66`). No file input.
- Job analyze: `POST /api/campus/jobs/analyze` with `{ description }` (`frontend/src/campus/pages/JobsPage.jsx:47`). Textarea only.
- Voice: `FormData` field `audio` to `/api/interview/transcribe` (`frontend/src/campus/components/VoiceInput.jsx:23-28`). Audio, not an image.

`campusFetch` can omit `Content-Type` for `FormData` (`frontend/src/campus/api.js:83`), but no campus screen builds an image form.

Non-campus chats also send string content, and they are disabled in the campus profile:

- Project visualizer: `{ messages, chatMode }` where each message is `{ role, content: string }` (`frontend/src/components/visualizer/VisualizerChat.jsx:50-64`).
- Repo analyzer: `{ sessionId, messages, isInterviewMode }` with the same string content (`frontend/src/components/analyzer/ChatPanel.jsx:46-56`).
- Portfolio AI edit: `{ prompt, currentData }` text (`frontend/src/components/landing/aiEditor/AIChatPanel.jsx:95-98`).

Those Anthropic routes forward `messages` unchanged (`backend/src/services/anthropicChatService.js:58-64`, `backend/src/routes/repoAnalyzer.js:102-111`). The UI never builds an image block. A hand-written client could put image blocks in JSON, and this server would not strip them. That is unused and not available on the campus profile. Treat image support there as **unknown** and out of scope.

PDF upload (`backend/src/routes/upload.js`, multer PDF only, 5 MB, then `pdf-parse`) is text extraction, not a model vision call. Campus local mode returns 404 for `/api/resumes/import/` (`backend/src/campusServer.js:116-124`). `imageOptimizer` resizes bytes; it does not call a model.

## Closest multimodal call: audio, not images

`transcribeAudio` is the only place that sends non-text parts, and the part is audio.

Qwen ASR (`backend/src/services/interviewService.js:542-557`):

```json
{
  "model": "<QWEN_ASR_MODEL or qwen3-asr-flash>",
  "messages": [{
    "role": "user",
    "content": [{ "type": "input_audio", "input_audio": { "data": "data:<mime>;base64,..." } }]
  }],
  "asr_options": { "language": "zh", "enable_itn": false }
}
```

Gemini transcription uses `inlineData` with an audio MIME type (`backend/src/services/interviewService.js:623-632`). OpenAI and Groq use `audio.transcriptions.create`, not chat parts (`backend/src/services/interviewService.js:606-619`). None of these accept a resume screenshot.

## Timeouts, limits, errors

| Boundary | Behavior | Anchor |
|---|---|---|
| Campus JSON body | 2 MB | `backend/src/campusServer.js:70` |
| Campus HTTP client | 120 s, export 300 s, then `REQUEST_TIMEOUT` | `frontend/src/campus/api.js:92-121` |
| OpenAI SDK when the app does not set one | 600_000 ms (10 min), `maxRetries` 2 | `backend/node_modules/openai/client.js:149-159` and `:692` |
| ASR | 60 s `AbortSignal.timeout`, provider timeout 60 s, `maxRetries: 0` | `backend/src/services/interviewService.js:592`, `:619` |
| OpenRouter / Requesty | Up to 3 attempts on 429; OpenRouter also retries socket errors | `backend/src/config/providers/openrouter.js:8-31` |
| AI routes | 20 requests / 24 h per user or IP | `backend/src/middleware/rateLimiter.js:3-4`, `:56-74` |
| Campus analyze / polish | That limiter applies. User-key skip does not, because these routes never set `req.aiProviderSource` | `backend/src/campus/growth.js:47`, `backend/src/campus/targets.js:34` |

Campus model failures (`backend/src/campus/ai.js:17-19`):

- Provider `statusCode === 503` becomes HTTP 503 `AI_UNAVAILABLE`. Missing server keys throw `ApiError` 503 from `createServerProvider`, so that path is covered.
- Anything else, including invalid JSON, schema failure, or `result.text` over 60_000 chars, becomes HTTP 502 `AI_FAILED`. Upstream SDK errors use `error.status`, not `statusCode`, so an upstream HTTP 503 still becomes `AI_FAILED`.
- Job evidence that is not an exact substring of `description` is HTTP 502 `AI_UNGROUNDED` (`backend/src/campus/ai.js:25`).
- A number in the polished draft that is not in `sourceText` is also `AI_UNGROUNDED` (`backend/src/campus/ai.js:32-33`).
- The client message is a fixed Chinese sentence. Provider body text is not returned. `globalErrorHandler` prefers `safeMessage` (`backend/src/middleware/globalErrorHandler.js:12`).

Logs store the event name, provider name, and error code. They do not store the prompt (`backend/src/campus/ai.js:8-18`).

## Tests

No test calls `analyzeJob`, `polishResume`, or `generateJson`. Nothing asserts image parts on the chat adapters.

Related coverage that does exist:

- `backend/src/middleware/__tests__/aiKey.test.js` — header vs server provider selection. Not used by campus polish.
- `backend/src/services/__tests__/transcription.test.js` — audio routing, including Gemini `inlineData` for audio.
- `frontend/src/campus/__tests__/api.test.js` — safe client errors for ASR and PDF codes, not for `AI_FAILED` / `AI_UNGROUNDED`.
- `backend/src/campus/__tests__/careerContracts.test.js` — schemas, matching, PDF sanitizer. No model call.

## What it would take to send one screenshot

The app cannot do this by stuffing base64 into `sourceText` or `description`. The model would see text, and polish/analyze grounding checks expect the source string, not pixels.

1. Add a campus route or field whose schema accepts one image (MIME, size cap). Do not reuse `.strict()` text schemas as-is.
2. Extend `generateContent` so the OpenAI-compatible adapters can send `content: [{ type: "text", ... }, { type: "image_url", image_url: { url } }]`. Gemini needs `inlineData` parts, as transcription already does for audio. Keep the default Groq model off this path; `llama-3.3-70b-versatile` is a text default.
3. Prefer multipart or a short-lived file over a huge JSON body. Campus JSON is capped at 2 MB (`backend/src/campusServer.js:70`). The sample shots below are about 77–141 KB, so one of them fits, but a larger PNG may not after base64 expansion.
4. Run vision as a separate extract step. Feed the extracted text into the existing polish/analyze prompts so the ungrounded-number and evidence checks still have a string source.
5. Set an explicit timeout and `maxRetries: 0` on that call. The chat adapters currently inherit a 10 minute SDK timeout and 2 retries.

## One-image probe

Credentials exist in `backend/.env`, so one probe was made. It did not go through `generateJson` or any HTTP route. It used `getDefaultProvider()` from `backend/src/config/aiProviders.js`, then one `chat.completions.create` on that adapter's client.

Safety choices: smallest file only, one request, `maxRetries: 0`, timeout 45 s, `temperature: 0`, `max_tokens: 120`. The prompt asked for a JSON flag object and told the model not to return names, phones, emails, schools, employers, or resume text. The transcript was not stored. Key values were not printed.

| Item | Result |
|---|---|
| Image | `data/Resume/pic/屏幕截图 2026-10-20 094731.png` (77_233 bytes). Nine other PNGs sit beside it, 112–141 KB. |
| Adapter | `openai` |
| Model | `gpt-6.1-sol` |
| Host | `api.vibekey.cn` |
| HTTP | 200, `finish_reason=stop`, about 12 s |
| Image received | **Yes** (`image_received: true`) |
| Text extracted | **Yes** (`text_extracted: true`, model-reported `char_count` 845, `language` `zh`) |

The response was 78 characters of JSON flags, not a resume transcript. So the configured Vibekey chat model can see one local screenshot. The product still has no path that sends one.

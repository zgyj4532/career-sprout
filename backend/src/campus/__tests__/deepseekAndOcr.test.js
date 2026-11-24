import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAIProvider, createServerProvider, getDefaultProvider, resetDefaultProvider } from '../../config/aiProviders.js';
import { extractImageText, isOcrConfigured } from '../ocrService.js';
import { PRIMARY_MODEL, RETRY_MODEL, runImportModels } from '../importAi.js';
import { runJobImageModels } from '../importJobAi.js';
import { polishResume } from '../ai.js';

test('DeepSeekAdapter sets official base URL, default flash model, and rejects direct image payloads', async () => {
  const savedBase = process.env.DEEPSEEK_BASE_URL;
  const savedModel = process.env.DEEPSEEK_MODEL;
  delete process.env.DEEPSEEK_BASE_URL;
  delete process.env.DEEPSEEK_MODEL;
  try {
    const adapter = createAIProvider('deepseek', 'sk-synthetic-deepseek');
    assert.equal(adapter.providerName, 'deepseek');
    assert.equal(adapter.modelName, 'deepseek-flash');
    assert.match(adapter.baseURL, /api\.deepseek\.com/);
    await assert.rejects(
      () => adapter.generateContent('describe image', { imageDataUrl: 'data:image/png;base64,AAAA' }),
      (error) => error.code === 'VISION_NOT_SUPPORTED' && error.statusCode === 422,
    );
    let capturedPayload = null;
    adapter.client.chat.completions.create = async (payload) => {
      capturedPayload = payload;
      return { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 } };
    };
    const res = await adapter.generateContent('请只输出 JSON {"ok":true}', { jsonMode: true, maxTokens: 12000, temperature: 0 });
    assert.equal(res.text, '{"ok":true}');
    assert.deepEqual(capturedPayload.thinking, { type: 'disabled' });
    assert.deepEqual(capturedPayload.response_format, { type: 'json_object' });
    assert.equal(capturedPayload.max_tokens, 8192);
  } finally {
    if (savedBase === undefined) delete process.env.DEEPSEEK_BASE_URL; else process.env.DEEPSEEK_BASE_URL = savedBase;
    if (savedModel === undefined) delete process.env.DEEPSEEK_MODEL; else process.env.DEEPSEEK_MODEL = savedModel;
  }
});

test('createServerProvider selects deepseek when AI_PROVIDER=deepseek and fails closed when key is absent', () => {
  const keys = ['AI_PROVIDER', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.AI_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'sk-synthetic-ds';
    resetDefaultProvider();
    const provider = createServerProvider();
    assert.equal(provider.providerName, 'deepseek');

    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    assert.throws(() => createServerProvider(), (err) => err.statusCode === 503);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetDefaultProvider();
  }
});

test('importAi defaults to deepseek-flash primary and deepseek-v4-pro validation fallback', () => {
  assert.equal(PRIMARY_MODEL, 'deepseek-flash');
  assert.equal(RETRY_MODEL, 'deepseek-v4-pro');
});

test('ocrService extracts verbatim text via DashScope compatible endpoint and handles missing key / blank text / timeout', async () => {
  assert.equal(isOcrConfigured({ OCR_PROVIDER: 'dashscope', DASHSCOPE_API_KEY: 'sk-dash' }), true);
  assert.equal(isOcrConfigured({ OCR_PROVIDER: 'dashscope', DASHSCOPE_API_KEY: '' }), false);

  await assert.rejects(
    () => extractImageText({ imageDataUrl: 'data:image/png;base64,AA==', env: { DASHSCOPE_API_KEY: '' } }),
    { code: 'OCR_UNAVAILABLE' },
  );

  let capturedUrl = '';
  let capturedBody = null;
  const text = await extractImageText({
    imageDataUrl: 'data:image/png;base64,AA==',
    env: { DASHSCOPE_API_KEY: 'sk-dash-test', QWEN_OCR_MODEL: 'qwen3.5-ocr' },
    fetchImpl: async (url, init) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: '```text\n张同学\n杭州师范大学 2020-2024\n```' } }] }),
      };
    },
  });
  assert.match(capturedUrl, /dashscope\.aliyuncs\.com\/compatible-mode\/v1\/chat\/completions$/);
  assert.equal(capturedBody.model, 'qwen3.5-ocr');
  assert.equal(text, '张同学\n杭州师范大学 2020-2024');

  await assert.rejects(
    () => extractImageText({
      imageDataUrl: 'data:image/png;base64,AA==',
      env: { DASHSCOPE_API_KEY: 'sk-dash-test' },
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '   ' } }] }) }),
    }),
    { code: 'NO_TEXT_LAYER' },
  );

  await assert.rejects(
    () => extractImageText({
      imageDataUrl: 'data:image/png;base64,AA==',
      timeoutMs: 15,
      env: { DASHSCOPE_API_KEY: 'sk-dash-test' },
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      }),
    }),
    { code: 'OCR_TIMEOUT' },
  );
});

test('two-stage OCR -> DeepSeek resume & job image pipelines ground against OCR text without sending image_url to LLM', async () => {
  const ocrResumeText = '李同学\n浙江大学 2021年09月-2025年06月 本科 软件工程\n参与校园选课小程序前端优化，服务 500 名学生，没有担任负责人。';
  let llmSawImage = false;
  const resumeOut = await runImportModels({
    blocks: [{ id: 'image-1', kind: 'image', text: '', status: 'pending_vision' }],
    imageDataUrl: 'data:image/png;base64,AA==',
    userId: 'student-ocr',
    operationId: 'op-ocr-1',
    ocr: async () => ocrResumeText,
    generate: async ({ imageDataUrl }) => {
      if (imageDataUrl) llmSawImage = true;
      return JSON.stringify({
        name: '李同学',
        education: [{ sourceBlockId: 'image-1', evidence: '浙江大学', institution: '浙江大学', degree: '本科', field: '软件工程', dateText: '2021年09月-2025年06月', fullText: '浙江大学 2021年09月-2025年06月 本科 软件工程' }],
        experiences: [{ sourceBlockId: 'image-1', evidence: '参与校园选课小程序前端优化', kind: 'project', title: '校园选课小程序', fullText: '参与校园选课小程序前端优化，服务 500 名学生，没有担任负责人。' }],
        skills: [],
      });
    },
  });
  assert.equal(llmSawImage, false);
  assert.equal(resumeOut.blocks[0].status, 'vision_unverified');
  assert.equal(resumeOut.blocks[0].text, ocrResumeText);
  assert.ok(resumeOut.issues.some((item) => item.code === 'VISION_UNVERIFIED'));
  assert.equal(resumeOut.result.experiences.length, 1);

  const ocrJobText = '星芽科技 新媒体运营实习生 杭州\n要求熟悉公众号排版\n每周至少4天';
  let jobLlmSawImages = false;
  const jobOut = await runJobImageModels({
    images: [{ id: 'image-1', imageDataUrl: 'data:image/png;base64,BB==' }],
    ocr: async () => ocrJobText,
    generate: async ({ imageDataUrls }) => {
      if (imageDataUrls) jobLlmSawImages = true;
      return JSON.stringify({
        pages: [{
          id: 'image-1',
          jobs: [{
            company: '星芽科技',
            title: '新媒体运营实习生',
            city: '杭州',
            text: ocrJobText,
            requirements: [{ name: '公众号排版', level: 2, required: true, evidence: '要求熟悉公众号排版' }],
            availability: { startDate: null, endDate: null, daysPerWeek: 4 },
            availabilityEvidence: '每周至少4天',
          }],
        }],
      });
    },
  });
  assert.equal(jobLlmSawImages, false);
  assert.equal(jobOut.candidates.length, 1);
  assert.equal(jobOut.candidates[0].company, '星芽科技');
  assert.ok(jobOut.issues.some((item) => item.code === 'VISION_UNVERIFIED'));
});

test('polishResume supports all 7 practical modes, enforces anti-hallucination grounding, and keeps interview_questions read-only', async () => {
  const savedProvider = process.env.AI_PROVIDER;
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.AI_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'sk-synthetic-polish';
  resetDefaultProvider();
  const provider = getDefaultProvider();
  const originalCreate = provider.client.chat.completions.create;

  const source = '参与校园公众号内容选题与活动推文撰写，累计发布 12 篇推文，单篇阅读量最高 3000，没有独立负责投放预算。';

  let mockReply = {};
  provider.client.chat.completions.create = async () => ({
    choices: [{ message: { content: JSON.stringify(mockReply) } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  });

  try {
    // Mode 2: project_compact collapses >2 lines to <=2 lines and checks grounding
    mockReply = {
      draft: '校园公众号运营实践\n- 参与内容选题与活动推文撰写，累计发布 12 篇推文\n- 单篇阅读量最高 3000，没有独立负责投放预算',
      changes: ['精简为项目栏表达'],
      questions: ['是否有互动率或涨粉数据？'],
    };
    const compactRes = await polishResume(source, null, { mode: 'project_compact', jobRole: '新媒体运营', jobDescription: '负责公众号日常运营' });
    assert.equal(compactRes.mode, 'project_compact');
    assert.ok(compactRes.draft.split(/\r?\n/).filter(Boolean).length <= 2);

    // Mode 3: hr_critique strips ungrounded critique excerpts while keeping grounded ones
    mockReply = {
      draft: '- 参与校园公众号选题与活动推文撰写，累计发布 12 篇推文，单篇最高阅读 3000；没有独立负责投放预算。',
      changes: ['删除冗词'],
      questions: [],
      critiques: [
        { kind: 'shortcoming', excerpt: '没有独立负责投放预算', advice: '可补充在预算执行或复盘中的协助细节' },
        { kind: 'irrelevant', excerpt: '原文根本不存在的经历', advice: '建议弱化' },
      ],
    };
    const hrRes = await polishResume(source, null, { mode: 'hr_critique' });
    assert.equal(hrRes.critiques[0].excerpt, '没有独立负责投放预算');
    assert.equal(hrRes.critiques[1].excerpt, '');

    // Mode 6: interview_questions returns read-only questions with empty draft
    mockReply = {
      draft: '',
      interviewQuestions: [
        { question: '阅读量 3000 的那篇推文选题是怎么定的？', approach: '按背景、读者痛点、标题测试回答', sourceExcerpt: '单篇阅读量最高 3000' },
        { question: '你在 12 篇推文中具体承担哪一步？', approach: '诚实说明参与选题与撰稿分工', sourceExcerpt: '累计发布 12 篇推文' },
      ],
    };
    const iqRes = await polishResume(source, null, { mode: 'interview_questions' });
    assert.equal(iqRes.mode, 'interview_questions');
    assert.equal(iqRes.draft, '');
    assert.equal(iqRes.interviewQuestions.length, 2);
    assert.equal(iqRes.interviewQuestions[0].sourceExcerpt, '单篇阅读量最高 3000');

    // Anti-hallucination: invented number in star_achievements is rejected
    mockReply = {
      draft: '- 参与公众号运营，阅读量提升 50%，没有独立负责投放预算。',
      changes: [],
      questions: [],
    };
    await assert.rejects(
      () => polishResume(source, null, { mode: 'star_achievements' }),
      (err) => err.statusCode === 502,
    );
  } finally {
    provider.client.chat.completions.create = originalCreate;
    if (savedProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = savedProvider;
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = savedKey;
    resetDefaultProvider();
  }
});

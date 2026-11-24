# 技术设计：DeepSeek 运营商接入、百炼云端 OCR 与简历 AI 多场景润色架构

## 1. 架构与模块边界

本次改造包含三大正交内聚子系统，全部运行在既有 Express 单体与 React 校园工作台边界内，对 2C2G 服务器（`backend` 容器内存硬上限 `768m`）保持 **0 新增系统包、0 新增常驻内存**：

```text
1. 运营商底座 (aiProviders.js + interviewService.js)
   ├── DeepSeekAdapter (OpenAI SDK 兼容, baseURL=https://api.deepseek.com, 默认 deepseek-flash)
   └── Qwen ASR 路由解耦 (配置 DASHSCOPE_API_KEY 且文本运营商无内置 ASR 时自动走百炼语音转写)

2. 图片两阶段导入流水线 (ocrService.js -> imports.js / jobImages.js -> importAi.js / importJobAi.js)
   └── [PNG/JPEG/WEBP] ──► 百炼 OCR (qwen3.5-ocr) ──► 落库 vision_unverified 文本块 ──► DeepSeek (flash -> v4-pro) ──► Grounding 核验

3. 简历 AI 多场景润色与辅导 (schemas.js + campus/ai.js + targets.js + ResumePage.jsx)
   ├── 改写类模式 (general / star_achievements / project_compact / hr_critique / profile_summary / quantify_value / layout_reorder)
   │     └── DeepSeek 生成 JSON -> assertPolishGrounding 防幻觉校验 -> 前端对照确认后采纳/前置插入
   └── 辅导类模式 (interview_questions)
         └── DeepSeek 生成 5 道预测追问 + 回答思路 + 原文依据核验 -> 前端只读辅导卡片展示（不改写正文）
```

---

## 2. 接口契约与数据流设计

### 2.1 `DeepSeekAdapter` 与环境变量契约（`backend/src/config/aiProviders.js`）

| 环境变量 | 默认值 / 回退规则 | 说明 |
|---|---|---|
| `AI_PROVIDER` | `deepseek` | 显式指定服务端默认大模型运营商 |
| `DEEPSEEK_API_KEY` | 回退 `OPENAI_API_KEY` | DeepSeek 密钥，加入 `SENSITIVE_KEYS` 脱敏保护 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek 官方 OpenAI 兼容端点 |
| `DEEPSEEK_MODEL` | `deepseek-flash` | 日常交互与润色默认模型 |
| `DEEPSEEK_IMPORT_PRIMARY_MODEL` | `deepseek-flash` | 材料/岗位导入首轮整理模型 |
| `DEEPSEEK_IMPORT_RETRY_MODEL` | `deepseek-v4-pro` | 导入首轮校验失败时的单次重试强模型 |

- `DeepSeekAdapter.generateContent` 若收到非空 `imageDataUrl` / `imageDataUrls` 直接抛出 `VISION_NOT_SUPPORTED`（422），杜绝多模态载荷被静默丢弃。
- 导出 `resetDefaultProvider()` 供测试安全清理缓存。

### 2.2 云端百炼 OCR 服务契约（`backend/src/campus/ocrService.js`）

- **配置**：读取 `DASHSCOPE_API_KEY || QWEN_API_KEY`，端点 `QWEN_OCR_BASE_URL || QWEN_ASR_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'`，模型 `QWEN_OCR_MODEL || 'qwen3.5-ocr'`。
- **两阶段解耦**：
  - `imports.js`：图片草稿在调用 DeepSeek 前先通过 `extractImageText` 提取全文，更新块为 `status: 'vision_unverified'` 并附带 `VISION_UNVERIFIED` 提示后落盘；若草稿中断重试，已识别出的文本块直接复用，不重复消耗 OCR。`parseImportResult` 对已含 `vision_unverified` 文本的块不再要求 DeepSeek 重复输出 `transcription`，直接用百炼 OCR 原文做逐字 Grounding 校验。
  - `jobImages.js`：逐张岗位截图提取/复用 OCR 文本写入 `locked.blocks`，再传入 `runJobImageModels`；`parseJobImageResult` 以服务端持有的 OCR 文本作为权威 `page.text` 核验每条岗位信息。
  - **单测兼容**：若既有单测向 `runImportModels` / `runJobImageModels` 注入自定义 mock `generate` 且块无预识别文本，仍透传 `imageDataUrl`/`imageDataUrls` 保证既有 17 套测试平滑兼容。

### 2.3 简历 AI 多场景润色契约（`schemas.js`、`campus/ai.js`、`targets.js`、`ResumePage.jsx`）

#### 请求 Schema（`POST /api/campus/resumes/polish`）
```js
export const POLISH_MODES = [
  'general',             // 综合润色整理（默认，保持向后兼容）
  'star_achievements',   // 1. 结合 JD 提炼最多 3 条匹配核心成果（STAR 句式 + 真实量化）
  'project_compact',     // 2. 改写项目经历，突出价值，精简到 2 行以内，贴合行业表达
  'hr_critique',         // 3. HR 视角挑短板、删空话、标注与目标岗位无关经历
  'profile_summary',     // 4. 根据目标岗位写 3 句话以内个人简介，突出核心竞争力
  'quantify_value',      // 5. 转化为可量化成果，无数据则合理提炼工作价值并追问指标
  'interview_questions', // 6. 基于简历预测 5 个面试官追问 + 回答思路
  'layout_reorder',      // 7. 优化排版逻辑与段落顺序，优先展示岗位匹配能力
];

export const polishSchema = z.object({
  sourceText: text(20000).min(1),
  jobId: objectId.optional(),
  mode: z.enum(POLISH_MODES).default('general'),
  jobRole: text(200).optional(),
  jobDescription: text(10000).optional(),
}).strict();
```

#### 目标岗位上下文合成（`resolvePolishTarget(job, { jobRole, jobDescription })`）
- 若传入 `jobId`（已保存岗位），读取 `company / title / description / requirements`；若用户同时填写了 `jobRole` 或临时粘贴了 `jobDescription`，将其补充进岗位上下文（临时粘贴内容同样包裹在不可信数据 JSON 内防 Prompt 注入）。
- `POST /api/campus/me/resumes/:id/target`（生成企业定向简历）继续调用默认 `polishResume(source.originalText, job)`（即 `mode: 'general'`），保持教师荐才与定向审批契约完全不变。

#### 响应 Schema 与防幻觉 Grounding 规则
```js
export const polishResultSchema = z.object({
  mode: z.enum(POLISH_MODES).default('general'),
  draft: text(20000).default(''),
  changes: z.array(text(500)).max(30).default([]),
  questions: z.array(text(500)).max(20).default([]),
  critiques: z.array(z.object({
    kind: z.enum(['shortcoming', 'fluff', 'irrelevant']),
    excerpt: text(500),
    advice: text(500),
  }).strict()).max(20).default([]),
  interviewQuestions: z.array(z.object({
    question: text(300).min(1),
    approach: text(800).min(1),
    sourceExcerpt: text(500).default(''),
  }).strict()).max(10).default([]),
}).strict();
```
- **防幻觉硬约束**：
  1. 除 `interview_questions` 外，其余 7 个模式均必须产出非空 `draft`，且**全部经过 `assertPolishGrounding(sourceText, result.draft)` 校验**！
  2. **关键细节（避免序号误伤数字校验）**：`validateGrounding` 会拦截 `draft` 中任何不在 `sourceText` 出现过的阿拉伯数字（如原文没有 `1, 2, 3`，模型若输出 `1. xxx` 会触发 `AI_UNGROUNDED`）。因此在各模式 Prompt 中明确规定：**`draft` 内分点一律使用 Markdown 无序列表 `- ` 或空行分段，严禁新增原文没有的阿拉伯数字或序号**；原文已有数字原样保留用于量化，缺失数据一律放入 `questions` 引导用户补充。
  3. **`project_compact` 行数约束**：Prompt 要求精简至最多 2 行非空正文，服务端校验非空行数 ≤ 2（超出时将换行折叠或触发单次纠偏，确保真正满足“精简到 2 行”）。
  4. **`profile_summary` 句数约束**：控制在 3 句话以内，突出与目标岗位匹配的核心优势。
  5. **`hr_critique` 依据校验**：每条 `critiques[i].excerpt` 若非空，必须能在 `sourceText` 中匹配（去掉空白比对），防止 AI 凭空指责用户没写过的内容。
  6. **`interview_questions` 模式**：要求输出恰好 5 道针对性追问（每道含 `question`、`approach` 回答思路及原文依据 `sourceExcerpt`）；服务端核验 `interviewQuestions.length === 5` 且非空 `sourceExcerpt` 存在于原文中；`draft` 置空，前端渲染专用只读“预测面试追问与回答思路”面板，不提供覆盖简历正文的按钮，防止误操作覆盖简历。

#### 前端工作台交互设计（`frontend/src/campus/pages/ResumePage.jsx` & `campus.css`）
- 在编辑器“AI 润色”区域增加简洁清晰的 **场景选择栏（`<div className="resume-polish-modes" role="radiogroup" aria-label="AI 润色与诊断方式">` 或语义化单选胶囊按钮组）**：
  - 默认选中：`综合润色`（保持原有“AI 润色建议”按钮文案与单测兼容，当切换到具体场景时按钮动态提示执行对应场景或统一清晰触发）。
  - 7 个快捷场景胶囊：`STAR 核心成果(3条)`、`项目精简(2行)`、`HR 挑刺删空话`、`个人简介(3句)`、`价值与量化提炼`、`预测面试5问`、`排版顺序优化`。
- 在“补充材料或选择目标岗位”折叠区（及需要 JD 的模式提示下）增加可选 `<label>临时粘贴目标岗位 JD（可选，仅用于本次 AI 分析与润色）<textarea ... /></label>`，修改该输入同样递增 `revision.current` 使过期建议失效。
- 结果面板按模式自适应展示：
  - **常规改写模式**：展示“本次原文 vs AI 建议（尚未保存）”、“修改说明”、“请你补充的事实/量化数据”，提供 `确认事实并采纳建议`（如果是 `profile_summary` 模式，额外提供 `插入到简历开头` 按钮，将简介拼在现有正文最上方而不丢弃经历正文！）与 `取消，保留原文`。
  - **`hr_critique` 模式**：置顶展示“HR 视角诊断（短板 / 空话 / 弱相关标注）”分类列表，下方仍提供去除空话后的 `draft` 供用户自愿确认采纳。
  - **`interview_questions` 模式**：展示 5 道预测追问卡片（问题 + 原文依据 + 回答思路框架），底部提供 `收起预测问题`（不修改简历正文）。

---

## 3. 兼容性、性能权衡与回滚策略

- **2C2G 容器安全余量**：云端百炼 OCR + DeepSeek Flash 纯 HTTP JSON 通信，无图像解码像素缓冲、无本地模型推理，单并发请求内存波动 < 5 MiB。
- **向后兼容**：`POST /api/campus/resumes/polish` 不传 `mode` 时默认 `'general'`，返回结构保留 `draft / changes / questions`，`SectionPolish.jsx`、`TargetResumes.jsx` 及既有 `careerContracts.test.js` 完全兼容。
- **回滚策略**：保留全部原有 AI Provider 适配器，回退环境变量即可切回其他 OpenAI 兼容服务；前端新增状态均为组件局部状态，不改动数据库持久化模型。

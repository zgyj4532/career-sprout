# 切换大模型至 DeepSeek、接入百炼云端 OCR 并升级简历 AI 多场景润色

## Goal

将项目默认大语言模型运营商正式切换为 **DeepSeek**（`AI_PROVIDER=deepseek`），按交互延迟与推理复杂度分级选用 `deepseek-flash` 与 `deepseek-v4-pro`；复用已配置的阿里云百炼 `DASHSCOPE_API_KEY` 接入云端轻量 OCR（`qwen3.5-ocr` / `qwen-vl-ocr`），以 **0 额外服务器内存、0 CPU 峰值、0 镜像膨胀** 适配 2C2G 服务器；同时围绕求职实战升级 **简历 AI 润色工作台**（新增 7 大定向润色、HR 诊断与面试追问预测场景），并使用 `data/Resume/` 中的真实简历数据集完成全链路实测验证。

## Background & Confirmed Facts

- **凭据与配置现状（`backend/.env`）**：用户已将 DeepSeek API Key 写入 `OPENAI_API_KEY` 与 `CUSTOM_API_KEY`，但运营商与地址仍为 `AI_PROVIDER=openai`、`https://api.vibekey.cn/v1`、`gpt-6.1-sol`；同时已配置有效的 `DASHSCOPE_API_KEY`（现用于 Qwen ASR `qwen3-asr-flash`）。
- **可用模型实测**：
  - DeepSeek（`https://api.deepseek.com`）：开放 `deepseek-flash`（低延迟主力）与 `deepseek-v4-pro`（高精度兜底），不支持多模态图片与 Whisper 语音转写。
  - 百炼（`https://dashscope.aliyuncs.com/compatible-mode/v1`）：现有 `DASHSCOPE_API_KEY` 直接支持 `qwen3.5-ocr` 与 `qwen-vl-ocr`，用户已明确批准采用**选项 A（云端百炼 OCR + DeepSeek 结构化整理）**。
- **既有代码耦合与润色现状**：
  - `backend/src/config/aiProviders.js:15,307-351` 尚未支持 `deepseek`；`backend/src/campus/importAi.js:5-6,35-42` 硬编码限制 `openai` 与 `gpt-6-luna`/`gpt-6.1-sol`；`backend/src/services/interviewService.js:610-619` 原依赖 `vibekey.cn` 触发 Qwen ASR。
  - 简历润色现状（`backend/src/campus/ai.js:37-43`、`backend/src/campus/targets.js:38-41`、`frontend/src/campus/pages/ResumePage.jsx:78-91,165-166`）：目前仅有单一通用“AI 润色建议”按钮，且只能绑定已保存的 `CampusJob`（不支持直接粘贴临时招聘 JD），缺乏分场景的 STAR 成果提炼、2 行项目精简、HR 挑刺、3 句话个人简介、价值量化转化、简历追问预测与排版重排能力。
- **真实测试数据集**：`data/Resume/` 包含 10 组真实简历的 `pdf/`（10 份）、`word/`（10 份）、`pic/`（10 张 PNG 截图）及 `review/` 超长简历压缩样本。

## Requirements

- **REQ-1（DeepSeek 运营商与环境配置迁移）**：
  - 在 `backend/src/config/aiProviders.js` 注册 `deepseek` 运营商适配器（OpenAI 兼容 SDK，默认 `https://api.deepseek.com`、默认模型 `deepseek-flash`；优先读取 `DEEPSEEK_API_KEY` 并兼容回退 `OPENAI_API_KEY`；对未转写的 `imageDataUrl` 明确报 `VISION_NOT_SUPPORTED`）。
  - 安全更新 `backend/.env` 为 `AI_PROVIDER=deepseek`、`DEEPSEEK_BASE_URL=https://api.deepseek.com`、`DEEPSEEK_MODEL=deepseek-flash`（复用现有密钥，严禁明文打印或提交），并同步更新 `.env.example`、`deploy/career-sprout/career-sprout.env.example`、`safeConfig.js` 与 `scripts/local/*`。
- **REQ-2（任务模型分级与 Qwen ASR 兼容）**：
  - 常规交互生成（探索对话、模拟面试、简历多场景润色、岗位分析、PDF 压缩）默认使用 **`deepseek-flash`**。
  - 材料导入与岗位截图整理（`importAi.js`、`importJobAi.js`）采用 `PRIMARY_MODEL='deepseek-flash'` + 首次校验失败单次重试 `RETRY_MODEL='deepseek-v4-pro'`（支持环境变量覆盖）。
  - 修复 `interviewService.js:610-619`：当配置了 `DASHSCOPE_API_KEY` / `QWEN_API_KEY` 且文本运营商为 `deepseek` / `custom`（或 `ASR_PROVIDER=qwen`）时自动路由至 `transcribeWithQwen()`。
- **REQ-3（2C2G 零内存增量的百炼云端 OCR 两阶段流水线）**：
  - 新增 `backend/src/campus/ocrService.js`，复用 `DASHSCOPE_API_KEY` 调用百炼兼容接口（默认 `qwen3.5-ocr`，支持配置 `qwen-vl-ocr`）提取图片纯文本；缺密钥明确报 `OCR_UNAVAILABLE`。
  - 改造 `imports.js` 与 `jobImages.js` 为“百炼 OCR 提取纯文本并落库（保留 `vision_unverified` / `VISION_UNVERIFIED`）→ DeepSeek 结构化整理 → 逐字 Grounding 校验”，保持 `Dockerfile.campus` 与 `package.json` 零重型本地依赖。
- **REQ-4（简历 AI 润色多场景升级：7 大实战模式 + 临时 JD 支持）**：
  - 扩展 `POST /api/campus/resumes/polish`（`schemas.js`、`targets.js`、`campus/ai.js`），向后兼容默认 `mode='general'`，并支持可选粘贴临时岗位要求 `jobDescription` / `jobRole`（与已选 `jobId` 互补）及以下 **7 大润色/诊断场景**：
    1. **`star_achievements`（核心成果 STAR 提炼）**：结合岗位 JD 从经历中提炼最多 3 条匹配核心成果，采用 STAR 句式，保留真实数据并在 `questions` 中引导补充缺失量化指标。
    2. **`project_compact`（项目栏 2 行精简改写）**：突出项目价值与动作结果，压缩精简至 2 行以内，用词贴合互联网/运营/目标岗位行业表达。
    3. **`hr_critique`（HR 视角挑短板与删空话）**：站在 HR 视角输出结构化短板诊断、空话套话删减说明、与目标岗位弱相关/无关经历标注（`critiques`），同时提供去除空话后的精炼草稿 `draft`。
    4. **`profile_summary`（3 句话个人简介）**：针对目标岗位提炼不超过 3 句话的个人简介，突出核心竞争力；前端除“替换正文”外额外支持**“插入到简历开头”**。
    5. **`quantify_value`（可量化成果与价值转化）**：将职责流水账转化为成果价值表达；有真实数据的突出量化结果，无数据的提炼实际工作价值并在 `questions` 给出具体可补充的量化维度。
    6. **`interview_questions`（预测 5 道面试追问 + 回答思路）**：基于当前简历与岗位预测面试官最可能追问的 5 个问题及每题回答思路（`interviewQuestions`），前端以**只读辅导面板**展示，防止误覆盖简历正文。
    7. **`layout_reorder`（排版逻辑与段落顺序优化）**：优化章节与段落排版逻辑，调整先后顺序以优先展示与目标岗位匹配的能力与核心经历。
  - **事实安全红线**：所有产出可采纳 `draft` 的模式均须通过 `assertPolishGrounding(sourceText, draft)`（禁止虚构原文没有的阿拉伯数字、禁止把“参与/了解”擅自拔高为“负责/精通”、禁止丢弃否定限定词；列表统一用 `- ` 避免引入无关序号数字），且所有建议须经用户确认才写入编辑器，未保存前绝不改写服务端原件。
  - 在 `ResumePage.jsx`（及 `SectionPolish.jsx` 可选快捷入口）提供符合校园版暖白纸色风格的模式切换控件与可选临时 JD 输入框，维护 `revision` 防过期覆盖与 `useUnsavedWork` 保护。
- **REQ-5（`data/Resume/` 真实简历全链路实测与回归验证）**：
  - 使用 `data/Resume/` 中 PDF、DOCX、PNG 真实简历执行“导入/OCR → DeepSeek 结构化整理 → 7 大 AI 润色场景 → PDF 超长压缩”端到端真实调用测试，采集成功率、Grounding 通过率、耗时与 Node 进程 RSS 内存峰值，输出脱敏实测报告到 `research/real-resume-benchmark.md`。
  - 通过前后端校园回归测试与 ESLint 静态检查。

## Acceptance Criteria

- [x] **AC-1**：`backend/.env` 已切换至 `AI_PROVIDER=deepseek`、`DEEPSEEK_BASE_URL=https://api.deepseek.com`、`DEEPSEEK_MODEL=deepseek-flash`，`getDefaultProvider().providerName === 'deepseek'`，无任何密钥泄露。
- [x] **AC-2**：`importAi.js` 默认采用 `deepseek-flash`（主）+ `deepseek-v4-pro`（单次校验重试）；`interviewService.js` 在 `deepseek` + `DASHSCOPE_API_KEY` 下正常路由至 Qwen ASR。
- [x] **AC-3**：PNG/JPEG/WEBP 简历与岗位截图经百炼 OCR 转写后由 DeepSeek 完成结构化提取，保留 `VISION_UNVERIFIED` 提示并通过全部逐字 Grounding 校验；未配置百炼 Key 时明确报 `OCR_UNAVAILABLE`。
- [x] **AC-4**：`POST /api/campus/resumes/polish` 与 `ResumePage.jsx` 完整支持默认润色 + 7 大实战场景及临时 JD 输入；改写类模式严守 `assertPolishGrounding`（零虚构数字/程度词不越界），`profile_summary` 支持插入简历顶部，`interview_questions` 只读展示 5 道追问与回答思路不覆盖正文，旧请求响应在编辑变化后自动失效。
- [x] **AC-5**：`Dockerfile.campus` 与 `package.json` 零新增重型依赖；`data/Resume/`（PDF/DOCX/PNG）与 7 大润色场景实测通过，后端 RSS 内存峰值远低于 `768MiB`，脱敏证据沉淀于 `.trellis/tasks/11-24-deepseek-ocr-migration/research/`。
- [x] **AC-6**：后端校园/共享单测（127/128 通过，`campusIsolation.test.js:193` 为提交 `d1dfa753` 既存本地免登策略差异）、前端 `33/33` 文件（`264/264` 用例）及相关 Lint 检查全部通过。

## Out of Scope

- 扫描版无文字层 PDF 的整页光栅化渲染 OCR 与 DOCX 内嵌图片自动提取。
- 在 2C2G 容器内安装 Python、OpenCV、RapidOCR 或 Tesseract。
- 变更 Clerk 登录认证、数据库持久化 Schema 或直接向远端生产服务器推送发布。

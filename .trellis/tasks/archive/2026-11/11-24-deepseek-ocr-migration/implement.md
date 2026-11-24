# 实施计划：DeepSeek 迁移、百炼 OCR 接入、简历 AI 7 大润色场景与真实简历验收

## 1. 有序实施清单

### Step 1：扩展 `aiProviders.js` 与语音转写兼容
- [x] 在 `backend/src/config/aiProviders.js` 新增 `DeepSeekAdapter`：
  - `SUPPORTED_PROVIDERS` 加入 `'deepseek'`，`DEFAULT_MODELS.deepseek = 'deepseek-flash'`。
  - 默认 `baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'`，密钥读取 `apiKey || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY`。
  - 若传入 `imageDataUrl` / `imageDataUrls` 抛出 `VISION_NOT_SUPPORTED`；导出 `resetDefaultProvider()`。
- [x] 在 `backend/src/services/interviewService.js` 更新 `transcribeAudio`：当存在 `DASHSCOPE_API_KEY` / `QWEN_API_KEY` 且文本运营商不支持原生音频转写（如 `deepseek` / `custom`）或 `ASR_PROVIDER=qwen` 时自动路由 `transcribeWithQwen()`。

### Step 2：实现百炼云端 OCR 模块并改造图片/岗位截图导入流水线
- [x] 新建 `backend/src/campus/ocrService.js`：实现 `extractImageText`，对接百炼兼容接口（默认 `qwen3.5-ocr`），覆盖缺密钥（`OCR_UNAVAILABLE`）、空文本（`NO_TEXT_LAYER`）、超长（`TEXT_TOO_LONG`）、超时与取消。
- [x] 更新 `backend/src/campus/importAi.js`、`importGrounding.js`、`imports.js`：
  - `PRIMARY_MODEL` 默认 `deepseek-flash`，`RETRY_MODEL` 默认 `deepseek-v4-pro`，放行 `deepseek` 运营商。
  - `imports.js` 先对图片执行 `extractImageText` 落盘 `vision_unverified` 块，再送入 `runImportModels`；`parseImportResult` 保留 `VISION_UNVERIFIED` 并基于 OCR 原文执行逐字 Grounding 校验。
- [x] 更新 `backend/src/campus/importJobAi.js` 与 `jobImages.js`：岗位截图先经百炼 OCR 提取/复用纯文本落盘到 `locked.blocks`，再交由 DeepSeek 提取结构化岗位并对照服务端 OCR 原文核验。

### Step 3：升级简历 AI 多场景润色（后端 + 前端工作台）
- [x] 更新 `backend/src/campus/schemas.js`、`backend/src/campus/ai.js`、`backend/src/campus/targets.js`：
  - 新增 `POLISH_MODES`（`general` + 7 大实战场景：`star_achievements`、`project_compact`、`hr_critique`、`profile_summary`、`quantify_value`、`interview_questions`、`layout_reorder`）与可选 `jobRole` / `jobDescription` 参数。
  - 为每个模式编写定制化中文防注入 Prompt（严禁虚构数字与新增列表序号数字，保留程度词与否定词），对所有产出 `draft` 的模式执行 `assertPolishGrounding` 及行数/句数/原文依据核验；对 `interview_questions` 校验 5 道预测题与回答思路。
- [x] 更新 `frontend/src/campus/pages/ResumePage.jsx` 与 `frontend/src/campus/campus.css`：
  - 增加模式选择栏（默认“综合润色”+ 7 大实战模式）与可选“临时粘贴目标岗位 JD”输入框。
  - 支持 `profile_summary` 的“插入到简历开头”与“替换当前正文”双操作、支持 `hr_critique` 的诊断挑刺分类展示 + 去空话草稿确认采纳、支持 `interview_questions` 的 5 题只读辅导卡片展示。
  - 确保编辑正文/岗位/临时 JD 时递增 `revision.current`，使在途旧请求自动失效，保持 `ResumePage.test.jsx` 既有行为全兼容。

### Step 4：更新环境变量、配置模板与周边脚本
- [x] 安全原位更新 `backend/.env`（写入 `AI_PROVIDER=deepseek`、`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL=https://api.deepseek.com`、`DEEPSEEK_MODEL=deepseek-flash`、`QWEN_OCR_MODEL=qwen3.5-ocr`，不打印任何密钥）。
- [x] 同步更新 `backend/.env.example`、`deploy/career-sprout/career-sprout.env.example`、`backend/src/utils/safeConfig.js`、`scripts/local/{doctor.mjs,verify-phase1.mjs,smoke-phase1.mjs,smoke-phase1.test.mjs,configure-server.ps1}`。

### Step 5：单元/组件回归测试与 `data/Resume/` 真实简历实测
- [x] 补充后端单测（`DeepSeekAdapter`、`ocrService`、图片/截图两阶段导入、Qwen ASR 路由、7 大润色模式及防幻觉拦截）与前端 `ResumePage.test.jsx` 多场景润色交互测试。
- [x] 运行 `data/Resume/` 真实简历全链路实测（覆盖 PDF、DOCX、PNG 截图导入整理 + 7 大润色模式 + 超长 PDF 压缩），记录成功率、耗时与后端进程 RSS 内存峰值到 `.trellis/tasks/11-24-deepseek-ocr-migration/research/real-resume-benchmark.md`（对个人信息脱敏）。

---

## 2. 验证命令（Review Gates）

1. **后端校园核心测试集与关联单测**：
   ```bash
   npm run test:campus --prefix backend
   node --test backend/src/utils/__tests__/safeConfig.test.js backend/src/middleware/__tests__/aiKey.test.js backend/src/services/__tests__/transcription.test.js scripts/local/smoke-phase1.test.mjs scripts/local/acceptance.test.mjs
   ```
2. **前端校园组件与页面测试（串行单 worker）**：
   ```bash
   npm test --prefix frontend -- src/campus --maxWorkers=1 --no-file-parallelism
   ```
3. **前后端静态检查（Lint）**：
   ```bash
   npx --prefix backend eslint src/config/aiProviders.js src/campus/ocrService.js src/campus/schemas.js src/campus/ai.js src/campus/targets.js src/campus/importAi.js src/campus/importGrounding.js src/campus/imports.js src/campus/importJobAi.js src/campus/jobImages.js src/services/interviewService.js src/utils/safeConfig.js
   npm run lint --prefix frontend
   ```
4. **服务器配置脚本自检**：
   ```powershell
   ./configure-server.bat -Action SelfTest -NonInteractive
   ```

---

## 3. 高风险文件与回滚检查点

- **`backend/.env`**：严禁打印或提交真实凭据。
- **`backend/src/campus/ai.js` & `importGrounding.js`**：7 大润色模式（除只读预测面试题外）均不可绕过 `assertPolishGrounding`；Prompt 严禁输出原文不存在的阿拉伯数字（包括 `1. 2. 3.` 列表编号），统一使用 `- ` 无序列表。
- **`frontend/src/campus/pages/ResumePage.jsx`**：必须保留现有表单可访问性标签（如 `真实经历与简历正文`、`AI 润色建议`、`保存简历`、`保存并继续`）与 `saveOperation` 幂等恢复逻辑，避免破坏既有端到端契约。

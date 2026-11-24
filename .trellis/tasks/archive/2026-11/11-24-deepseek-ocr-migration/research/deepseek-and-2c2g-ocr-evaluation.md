# DeepSeek 模型迁移与 2C2G 服务器图片 OCR 方案评估

## 1. 现状代码与配置盘点

### 1.1 `backend/.env` 与配置入口现状
- 用户已将 DeepSeek API Key 填入 `backend/.env` 的 `OPENAI_API_KEY` 与 `CUSTOM_API_KEY`（两者值一致，文中与日志不回显任何密钥原文）。
- 当前 `backend/.env` 仍保留旧代理配置：
  - `AI_PROVIDER=openai`
  - `OPENAI_BASE_URL=https://api.vibekey.cn/v1`、`OPENAI_MODEL=gpt-6.1-sol`
  - `CUSTOM_BASE_URL=https://api.vibekey.cn/v1`、`CUSTOM_MODEL=gpt-6.1-sol`
- 同时 `backend/.env` **已配置有效的阿里云百炼 `DASHSCOPE_API_KEY`**（原用于 `QWEN_ASR_MODEL=qwen3-asr-flash`，`QWEN_ASR_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`）。

### 1.2 代码耦合点（直接改 `.env` 会踩到的坑）
1. **`backend/src/config/aiProviders.js`**：
   - `SUPPORTED_PROVIDERS = ['gemini', 'openai', 'openrouter', 'requesty', 'groq', 'custom']`，尚未内置一等公民 `'deepseek'` 运营商（`DEEPSEEK_API_KEY` / `OPENAI_API_KEY` 兼容、`DEEPSEEK_BASE_URL` 默认 `https://api.deepseek.com` 或 `https://api.deepseek.com/v1`）。
2. **`backend/src/campus/importAi.js`**：
   - 第 5-6 行硬编码：`PRIMARY_MODEL = 'gpt-6-luna'`、`RETRY_MODEL = 'gpt-6.1-sol'`。
   - 第 38-39 行硬编码门禁：`if (provider.providerName !== 'openai') throw limitError('AI_UNAVAILABLE')` 以及 `if (![PRIMARY_MODEL, RETRY_MODEL].includes(model)) throw limitError('MODEL_NOT_ALLOWED')`。若切换运营商名至 `deepseek` 而不改此处，简历导入与岗位截图识别会直接报 `AI_UNAVAILABLE` / `MODEL_NOT_ALLOWED`。
3. **`backend/src/services/interviewService.js`（关键隐蔽回归点）**：
   - 第 612、617 行通过 `String(base).includes('vibekey.cn') || process.env.ASR_PROVIDER === 'qwen'` 判断是否把面试语音转写路由到 `transcribeWithQwen()`。
   - 当文本模型 URL 从 `vibekey.cn` 改为 `api.deepseek.com` 且运营商改为 `deepseek` 后，若未显式支持 `DASHSCOPE_API_KEY` / `deepseek` 走 Qwen ASR，语音转写会因 DeepSeek 无 Whisper 接口而中断。
4. **配套脚本与安全脱敏**：
   - `scripts/local/doctor.mjs`、`scripts/local/verify-phase1.mjs`、`scripts/local/smoke-phase1.mjs`、`scripts/local/configure-server.ps1`、`backend/src/utils/safeConfig.js`、`backend/.env.example`、`deploy/career-sprout/career-sprout.env.example` 均需同步支持 `DEEPSEEK_*` 变量并在隔离测试中清空外联密钥。

---

## 2. DeepSeek 可用模型实测与业务场景映射

通过只读查询 `GET https://api.deepseek.com/models`（使用当前 `backend/.env` 已配置密钥，未发送业务数据），实测该账号当前可用模型为：
- **`deepseek-flash`**（DeepSeek V4.1 Flash 层级：低延迟、高吞吐，支持 1M 上下文与严格 JSON 输出，错峰输入/输出约 $0.15 / $0.60 每百万 token）
- **`deepseek-v4-pro`**（DeepSeek V4 Pro 旗舰层级：更强复杂指令遵循与长文边界推理，错峰输入/输出约 $0.66 / $1.98 每百万 token）

### 任务分级选型建议
CareerSprout 的 AI 调用全部是**受严格 Schema + 原文逐字 Grounding 校验约束的结构化 JSON 生成**（禁止编造数字、禁止加强程度词、禁止丢弃否定词）：

| 业务模块 | 代码位置 | 特征与延迟要求 | 推荐模型 | 理由 |
|---|---|---|---|---|
| 兴趣探索追问 / 总结 | `services/discoveryService.js` | 交互式追问，要求响应快、JSON 原文摘录 | `deepseek-flash` | 交互延迟敏感，Flash 速度最快且成本极低 |
| 模拟面试出题 / 单题反馈 / 总结 | `services/interviewService.js` | 实时交互，单次输出 1k~4k tokens | `deepseek-flash` | 保证面试对话流畅度，避免长推理等待 |
| 岗位 JD 分析 / 简历润色 / 超长段落压缩 | `campus/ai.js`、`services/resumePdfExport.js` | 温度 0~0.7，服务端有严格 `validateGrounding` 兜底 | `deepseek-flash` | 规则明确，Flash 足够胜任且延迟低 |
| 材料导入整理 & 岗位截图整理（主调用） | `campus/importAi.js`、`campus/importJobAi.js` | `PRIMARY_MODEL`（原 `gpt-6-luna`），最长 60s | `deepseek-flash` | 承担 90%+ 常规简历/岗位文本一次成稿 |
| 材料导入整理 & 岗位截图整理（校验失败重试） | `campus/importAi.js`、`campus/importJobAi.js` | `RETRY_MODEL`（原 `gpt-6.1-sol`），仅在首次 JSON/Grounding 校验不通过时触发最多 1 次 | `deepseek-v4-pro` | 完美契合项目既有“轻量主模型 + 强模型单次校验兜底”架构，兼顾成本与复杂简历通过率 |

> 注：模型名同时支持通过环境变量（`DEEPSEEK_MODEL`、`DEEPSEEK_IMPORT_PRIMARY_MODEL`、`DEEPSEEK_IMPORT_RETRY_MODEL`）覆盖，避免未来模型迭代再次硬编码。
>
> **关键实测陷阱（默认思考模式耗尽 `max_tokens`）**：`api.deepseek.com` 上的 `deepseek-flash` 与 `deepseek-v4-pro` 在未显式传入 `thinking` 参数时**默认开启深度推理（`reasoning_content`）**。在含 10 段经历的长简历逐字核验任务中，默认思考会消耗 12,000+ `reasoning_tokens`（耗时 95s+ 触发 `finish_reason: "length"` 且正文 `content: ""`），引发导入超时。因此在 `DeepSeekAdapter.generateContent` 中默认显式设置 `thinking: { type: 'disabled' }`（除非调用方传入 `options.thinking === true`），并对 JSON 结构化任务启用 `response_format: { type: 'json_object' }`（`max_tokens` 上限对齐 8192），实测同一份 10 段经历 PDF 从超时降至 **10~14 秒一次通过**，面试/探索交互降至 **1.3~1.7 秒**。

---

## 3. 2C2G 服务器图片识别（OCR）方案深度对比

### 3.1 服务器硬性容量边界
根据 `docs/DEPLOYMENT_ASSESSMENT.md` 与 `deploy/career-sprout/compose.yml`：
- 目标服务器为 **2 vCPU / ~2 GiB RAM**，容器内存硬上限为：
  - `backend`: **`mem_limit: 768m`**（`cpus: 1.0`）
  - `mongo`: `512m`，`redis`: `128m`，`frontend`: `64m`（合计上限 `1472m`）
- `backend` 常驻热空闲 PSS 已达 **174–375 MiB**，Puppeteer Chromium 导出中文 PDF 时峰值更高（通过 `tryAcquireHeavyWork()` 单并发闸门串行保护）。

### 3.2 候选方案对比

| 维度 | 方案 A（强烈推荐）：复用已有百炼 `DASHSCOPE_API_KEY` 云端 OCR（`qwen3.5-ocr` / `qwen-vl-ocr`） | 方案 B（候选）：本地 Python + OpenCV + RapidOCR (`rapidocr_onnxruntime` PP-OCRv4 Mobile) | 方案 C：本地原生 C++ `tesseract-ocr` (`chi_sim` + `eng`) CLI 子进程 |
|---|---|---|---|
| **2C2G 内存增量** | **~0 MiB**（仅几百 KB~数 MB HTTP 请求缓冲，与原多模态发送一致） | **+200 ~ 320 MiB RSS/次**（Python + OpenCV + ONNXRuntime 权重常驻或冷启，逼近 768m 容器 OOM 线） | **+50 ~ 90 MiB RSS/次**（子进程用完即毁） |
| **2C2G CPU 负载** | **~0%**（网络 I/O 等待 1~2.5s） | **2 核 100% 满载 2~5s/张**（多图岗位截图最多 5 张会持续卡死 10~25s） | **单核/双核高负载 1.5~4s/张** |
| **Docker 镜像体积增量** | **0 MB**（零新增系统包与 npm/pip 依赖） | **+250 ~ 400 MB**（需装 `python3`、`opencv-python-headless`、`onnxruntime`、模型文件） | **+45 ~ 60 MB**（`tesseract-ocr` + `tesseract-ocr-chi-sim`） |
| **中文多栏简历/截图准确率** | **极高**（专为中文文档/表格/多栏简历/手机截图训练，原生输出完整顺序文本） | **高**（PP-OCRv4 中文行识别好，但双栏混排阅读顺序需额外框排序逻辑） | **中偏低**（对彩色底纹标题、双栏简历、UI 截图易串行或漏字） |
| **额外密钥/运维成本** | **无需新增密钥**！只读实测当前 `backend/.env` 的 `DASHSCOPE_API_KEY` 已开通 `qwen3.5-ocr`、`qwen-vl-ocr`、`vanchin/deepseek-ocr`；单张成本约 ¥0.0001~0.0005 | 零 API 费，但需维护 Node↔Python 跨语言构建与容器依赖 | 零 API 费，APT 安装简单 |

### 3.3 核心架构设计结论（OCR -> DeepSeek 两阶段解耦）
无论底层 OCR 驱动选哪一种，都应将原来“把 `imageDataUrl` 直接塞给文本大模型”改为清晰的**两阶段流水线**：
1. **Stage 1（OCR 纯文字转写）**：对输入图片执行 OCR，得到每张图的转写文本 `ocrText`（保留 `status: 'vision_unverified'` 与 `VISION_UNVERIFIED` 提示，遵循项目“图片识别文字须提示用户核对原图”的安全规范）。
2. **Stage 2（DeepSeek 结构化整理与原文核验）**：将 `ocrText` 作为来源块传给 DeepSeek（`deepseek-flash` 主模型 -> `deepseek-v4-pro` 校验重试），复用全部既有 Zod Schema 与逐字 Grounding 校验逻辑！
- 若采用抽象接口 `extractTextFromImages()`（默认 `OCR_PROVIDER=dashscope` 调用 `qwen-vl-ocr` / `qwen3.5-ocr`，同时支持配置切换候选本地驱动），既完美解决 2C2G 性能瓶颈，又保持架构可插拔。

---

## 4. 真实简历测试集盘点（`data/Resume/`）

仓库 `data/Resume/` 包含 10 组真实/仿真中文求职简历的三种格式对照（共 30 份文件）及超长压缩样本：
- `data/Resume/pdf/`：`01_小学语文教师_张慧.pdf` 至 `10_销售顾问_何佳颖.pdf`（10 份 PDF）
- `data/Resume/word/`：`01_小学语文教师_张慧.docx` 至 `10_销售顾问_何佳颖.docx`（10 份 DOCX）
- `data/Resume/pic/`：`屏幕截图 2026-10-20 *.png`（10 张 PNG 简历截图，含蓝底分栏标题、中英混排、百分比/金额数字、项目符号列表）
- `data/Resume/review/`：超长简历自动段落压缩核验样本

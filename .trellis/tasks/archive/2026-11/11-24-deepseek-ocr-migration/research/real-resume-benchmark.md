# `data/Resume/` 真实简历全链路实测报告（DeepSeek + 百炼云端 OCR + 7 大润色场景）

- **执行时间**：`2026-11-24T05:37:43Z` — `2026-11-24T05:46:38Z`
- **运行环境**：WSL Ubuntu 24.04 · Node.js `v24.14.1`（与生产容器 Node 24 基线一致）
- **生效配置（已脱敏）**：
  - `AI_PROVIDER=deepseek`，`DEEPSEEK_BASE_URL=https://api.deepseek.com`
  - 日常/润色与导入主模型：`deepseek-flash`；导入单次校验兜底模型：`deepseek-v4-pro`
  - 图片 OCR 服务：`OCR_PROVIDER=dashscope`，`QWEN_OCR_MODEL=qwen3.5-ocr`（复用已有 `DASHSCOPE_API_KEY`）
- **隐私脱敏说明**：以下记录已去除姓名、电话与邮箱原文，仅保留样本序号、岗位类别与可核查指标。

---

## 1. 本地文档解析基线（10 份 PDF + 10 份 DOCX）

| 格式 | 样本数量 | 解析成功率 | 字符数范围 | 单份耗时范围 | 未读页面/解析异常 |
|---|---:|---:|---:|---:|---:|
| `data/Resume/pdf/01..10` | 10 / 10 | **100%** | 707 – 881 字符 | 57 – 560 ms | 0 |
| `data/Resume/word/01..10` | 10 / 10 | **100%** | 658 – 829 字符 | 18 – 26 ms | 0 |

---

## 2. DeepSeek 简历结构化导入实测（PDF / DOCX）

| 样本编号与岗位类别 | 格式 | 实际调用模型轨迹 | 提取教育 / 经历 / 技能 | Grounding 与待确认标记 | 端到端耗时 | 进程 RSS 内存 |
|---|---|---|---:|---|---:|---:|
| `01_小学语文教师` | PDF | `deepseek-flash:completed` | 1 / 1 / 8 | `DATE_ASSOCIATION`, `SUSPECTED_MISS` | 49,387 ms | 127.64 MiB |
| `08_软件测试工程师` | PDF | `deepseek-flash:completed` | 1 / 3 / 7 | `DATE_ASSOCIATION`, `SUSPECTED_MISS` | 25,024 ms | 146.66 MiB |
| `04_新媒体运营专员` | DOCX | `deepseek-flash:completed` | 0 / 1 / 18 | `UNGROUNDED_ENTRY`（自动拦截并保留在 `otherMaterials`）, `SOURCE_ASSOCIATION`, `DATE_ASSOCIATION` | 51,324 ms | 146.66 MiB |
| `05_电商运营专员` | DOCX | `deepseek-flash:completed` | 1 / 3 / 10 | `SOURCE_ASSOCIATION`, `DATE_ASSOCIATION`, `SUSPECTED_MISS` | 24,315 ms | 146.79 MiB |

- **模型选型验证**：4 份复杂多段简历 **100% 由首轮 `deepseek-flash` 一次完成**，无需消耗更昂贵的 `deepseek-v4-pro` 重试额度；当 DOCX 某段跨块概括触发 `UNGROUNDED_ENTRY` 时，服务端 Grounding 机制自动将其安全回收到 `otherMaterials` 而不丢失任何原文。

---

## 3. 百炼云端 OCR（`qwen3.5-ocr`）+ DeepSeek 图片简历实测（`data/Resume/pic/`）

| PNG 截图样本 | OCR 识别字符数 | 百炼 OCR 耗时 | DeepSeek 整理耗时 | 总耗时 | 实际调用模型轨迹 | 提取教育 / 经历 / 技能 | `VISION_UNVERIFIED` 提醒 | 进程 RSS 内存 |
|---|---:|---:|---:|---:|---|---:|:---:|---:|
| 截图样本 #01（小学语文教师） | 674 字符 | **7,012 ms** | 34,417 ms | 41,429 ms | `deepseek-flash:completed` | 1 / 1 / 8 | ✅ 已标记 | **147.29 MiB** |
| 截图样本 #04（新媒体运营专员） | 674 字符 | **7,188 ms** | 35,384 ms | 42,572 ms | `deepseek-flash:completed` | 1 / 1 / 14 | ✅ 已标记 | **148.04 MiB** |
| 截图样本 #10（销售顾问） | 688 字符 | **6,939 ms** | 36,165 ms | 43,104 ms | `deepseek-flash:completed` | 1 / 2 / 13 | ✅ 已标记 | **148.66 MiB** |

### 2C2G 服务器容量结论
- 在 PNG 图片 OCR 阶段与 DeepSeek 整理阶段，后端 Node 进程常驻内存稳定在 **147.3 – 148.7 MiB**；整个连续压测进程（含 PDF.js 解析 10 份 PDF、Cheerio 解析 10 份 DOCX、3 次云端 OCR、16 次 DeepSeek 调用）最高 `peakRss` 仅为 **279.75 MiB**，距离生产容器 `mem_limit: 768m` 仍有近 **488 MiB** 安全余量，**0 CPU 算力尖峰、0 镜像体积膨胀**。

---

## 4. 岗位 JD 分析与 7+1 简历 AI 润色场景实测（基于样本 #04 + 新媒体运营 JD）

- **`analyzeJob` 岗位需求提取**：耗时 `24,927 ms`，准确提取 `10` 项带原文逐字 `evidence` 依据的岗位技能要求，通过 Grounding 校验。

| 润色/辅导模式 (`mode`) | 耗时 | 产出 `draft` 非空行数 / 字数 | 附加结构化输出 | `assertPolishGrounding` 事实校验 | 行为验证摘要（脱敏） |
|---|---:|---:|---|:---:|---|
| `general`（综合润色） | 20,526 ms | 21 行 / 729 字 | `changes: 3`, `questions: 3` | ✅ 通过 | 规范化 Markdown 层级，完整保留原数据与程度词 |
| `star_achievements`（① STAR 核心成果 3 条） | 30,011 ms | **3 行** / 301 字 | `changes: 3`, `questions: 7` | ✅ 通过 | 精准提炼 3 条 `- ` 开头 STAR 成果，保留原文 `1.2万→8.6万`、`10万+`、`30万+` 等真实指标，未编造新数字，并在 `questions` 追问缺失口径 |
| `project_compact`（② 项目栏 2 行精简） | 34,591 ms | **2 行** / 341 字 | `changes: 3`, `questions: 3` | ✅ 通过 | 严格压缩至 2 行高密度互联网运营行业表达 |
| `hr_critique`（③ HR 视角挑刺删空话） | 43,979 ms | 21 行 / 700 字 | **`critiques: 6`**, `changes: 3`, `questions: 7` | ✅ 通过 | 输出 6 条带原文锚点的短板/空话/相关性挑刺与去冗词草稿 |
| `profile_summary`（④ 3 句话个人简介） | 19,836 ms | **1 段（≤3 句）** / 210 字 | `changes: 1`, `questions: 3` | ✅ 通过 | 紧扣新媒体运营岗位提炼核心竞争力，支持一键插入简历顶部 |
| `quantify_value`（⑤ 成果量化与价值转化） | 24,798 ms | 21 行 / 734 字 | `changes: 6`, **`questions: 8`** | ✅ 通过 | 强化已有量化对比，对无数据条目提炼业务价值并给出 8 条量化追问 |
| `interview_questions`（⑥ 预测面试 5 问） | 32,402 ms | **0 行（只读）** | **`interviewQuestions: 5`** | ✅ 原文依据核验通过 | 生成恰好 5 道针对简历增长归因、爆款复盘等细节的追问与回答思路，`draft` 为空不覆盖简历 |
| `layout_reorder`（⑦ 排版与顺序优化） | 24,888 ms | 22 行 / 740 字 | `changes: 5`, `questions: 4` | ✅ 通过 | 将高匹配的“工作经历（MCN 新媒体运营）”自动前置到“教育经历”之前 |

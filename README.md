<div align="center">
  <h1>职芽 · CareerSprout</h1>
  <p><strong>从现在开始，让每一次练习长成未来。</strong></p>
  <p>面向大学生的 AI 职业成长助手：找方向、整理经历、做简历、练面试和授权荐才。</p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-24.14.1-339933?logo=node.js&logoColor=white" alt="Node.js"/>
    <img src="https://img.shields.io/badge/Express-campus%20entry-000000?logo=express&logoColor=white" alt="Express"/>
    <img src="https://img.shields.io/badge/MongoDB-local-47A248?logo=mongodb&logoColor=white" alt="MongoDB"/>
    <img src="https://img.shields.io/badge/Redis-local-DC382D?logo=redis&logoColor=white" alt="Redis"/>
    <img src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" alt="React"/>
    <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite"/>
    <img src="https://img.shields.io/badge/loopback-127.0.0.1-0f6e56" alt="Loopback"/>
  </p>
  <p>
    上游 <a href="https://github.com/anurag3407/career-pilot">anurag3407/career-pilot</a>
    · 本项目 <a href="https://github.com/zgyj4532/career-sprout">zgyj4532/career-sprout</a>
    · 基线 <code>0f0be2c1</code>
    · 说明 <a href="docs/LOCAL_WSL.md">本地启动</a>
    · License <a href="LICENSE">MIT</a>
  </p>
</div>

---

职芽面向所有年级，优先让大一大二新手也能独立使用；已有简历的高年级学生可直接进入练习。当前仍使用安全的 WSL 本地运行方式，不是上游完整平台的发行版。上游 Firebase、端口 5000、支付和作品集部署说明不适用于校园入口。

## 目录

- [这是什么](#这是什么)
- [保留与关闭](#保留与关闭)
- [页面](#页面)
- [本地启动](#本地启动)
- [端口](#端口)
- [身份与密钥](#身份与密钥)
- [目录结构](#目录结构)
- [验收边界](#验收边界)
- [许可证](#许可证)

## 这是什么

有简历先导入；没有材料也能从“没简历也可以给我讲讲你感兴趣的事”开始交流，不用预填档案。交流不打分，结束后可一次编辑确认资料或暂不保存；想法、正在做和已完成经历分开保留。岗位可人工录入并由 AI 整理要求；简历建议需确认采纳。正式面试的打字和转写共用回答编辑区，保存确认后才推进。学生另行授权教师查看匹配材料与已确认定向稿，资料确认不等于教师授权。未配置服务明确不可用，不返回假结果。

技术栈仍是 React/Vite、Express、MongoDB、Redis。没有换成别的框架，也没有把数据库从 MongoDB 迁走。

## 保留与关闭

| 已实现的校园能力 | 未启用或不在当前范围 |
|---|---|
| 成长档案、技能自评、可实习时间、岗位录入与分析 | 招聘爬虫、学校教学报表、社区与支付 |
| 口述/文本简历润色、确认、保存、中文 A4 PDF | 编造经历、自动采纳AI结果、永久保存音频 |
| 中文语音面试、转写校对、显式提交、历史反馈 | 真实电话拨号、编程题和视频表情评分 |
| 学生授权、教师匹配、定向版本确认和ZIP导出 | 公开学生资料目录、自动邮件外发简历 |
| 中文注册/登录/验证界面、已有 Clerk 正式路径 | Resend 发信/身份签发：仅预留，尚未启用 |

### 已有材料导入

“了解自己”和“做简历”共用导入入口：文字型 PDF、DOCX、PNG/JPEG/WEBP，单份最多 10MiB。默认看整理结果，来源按需展开；姓名、年月、经历全文和其他原文材料保留。没有写的内容可留空，图片与日期关联的不确定处需核对。已有简历正文不被导入重写；没有简历时才新建。

原件保留到主动丢弃，刷新后从导入记录找回。忙碌时继续读取；保存结果未知时先检查已完成步骤，不重复创建。可恢复导入前版本，但不会覆盖之后的人工修改。模型结果未知或校验预算耗尽时不自动重复调用。

“找个方向”支持最多 5 张、总计 10MiB 岗位截图，上传前调顺序/删图；同名不同城市或期限分别选择，保存为私有岗位。面试准备单按账号保留，取消或返回不清空原方向、题数和经历。简历列表可改名/删除，操作另一份不会清空当前未保存正文。

扫描版 PDF、旧 `.doc`、独立 OCR 不在当前范围。文件内容和模型输出不能改变所有者、公开状态或写入目标。真实样本质量与真人试用结果须看当前任务验收记录，不能把这些功能入口当成全部验收通过。

### 新手流程与保存保护

首页优先继续未完成交流、面试或导入，其次打开最近保存的简历；可选工具按需展开，未保存、来源疑点、发布范围和授权撤回保持可见。简历/岗位“保存并继续”使用服务器确认的新版本；结果未知先恢复同一次保存，跳转失败复用已保存记录。档案分步写入失败保留编辑，无法确认结果时锁定输入并提供恢复入口，冲突不静默覆盖。

新正式面试只按可用评分维度归一化，真实零分计入、未观测维度不作零分；评分范围可见，不混合比较不同范围。旧成绩保留旧规则标签，不批量重算。兴趣交流没有能力分，也不计入正式面试成绩。

## 页面

| 路径 | 作用 |
|---|---|
| `/` | 一个明确下一步；点击口号可切换 React Bits 彩蛋。 |
| `/resume` | 整理真实经历、语音补充、AI建议对照、保存/PDF及定向版本确认。 |
| `/interview` | 复用已保存的简历、岗位和准备单，核对后开始正式面试。 |
| `/discovery` | 无上传、无预填的兴趣与经历交流，不打能力分。 |
| `/interview/session/:id` | 按会话用途交流或面试；单一回答编辑区，确认保存后继续，末题保存后查看反馈。 |
| `/jd` | 校园岗位录入、发布、AI技能整理和差距查看。 |
| `/profile` | 基本档案、经历、自评、时间及教师授权/撤回。 |
| `/history` | 区分交流与正式面试，继续未完成会话、查看反馈、重命名和确认删除；成绩注明范围与规则。 |
| `/login`、`/register`、`/verify-email` | 正式账号入口与真实可用状态；Resend未启用时不发信。 |
| `/teacher` | 仅限已验证且被服务端授权的教师，查看获学生授权的候选材料。 |

电脑上的内页使用左侧导航。窄屏改成底部四宫格。面试间不套这层导航。

### On-demand loading and release caching

Non-home campus pages use module-level `React.lazy` imports; Home, navigation, authentication/session providers and the unsaved-work guard remain eager. Vite/Rollup extracts shared dependencies automatically: no manual vendor bucket, configuration change, raised 500kB warning threshold or blanket route prefetch. The slogan remains readable immediately; BlurText/Motion loads only after an animation-enabled click, with plain text retained while loading or after failure and reduced-motion preferences respected.

Pending route chunks show “第一次打开需要时间，请耐心等待” horizontally and vertically centered in the main content area, using the homepage font and colors. This is a `role="status"` pane, not a modal: navigation remains usable and focus is not moved. It disappears on completion without a minimum delay. Failure offers home navigation and explicit refresh with an unsaved-content warning; there is no automatic reload or fake retry of a cached rejected import. The router and dirty-work provider remain stable, and same-path query changes do not remount an editor.

Production comparison for the same local campus configuration (bytes, not server memory):

| Measurement | Before | After |
|---|---:|---:|
| Homepage initial JS / entry static dependency closure, minified | 625,144 | 384,770 |
| Same closure, calculated gzip | 197,388 | 120,233 |
| Largest emitted JS chunk, minified | 625,144 | 384,770 |
| All emitted JS chunks combined, minified | 625,144 | 630,595 |
| Cold homepage JS requests in production preview | 1 | 1 |

Initial JS fell **38.45%** (calculated gzip **39.09%**), while total emitted JS grew by **5,451 bytes**. This is deferred loading, not removal of product features; calculated gzip is not a claim about preview-server compression. All resulting JS chunks are below the original 500kB threshold. Build graphs are retained in [baseline.json](.trellis/tasks/10-21-campus-bundle-loading/baseline.json) and [optimized.json](.trellis/tasks/10-21-campus-bundle-loading/optimized.json).

The integrated check passed 166 campus tests across 28 files, scoped lint and the production build (548 transformed modules). Actual production-preview requests showed only the visited route and its dependencies loading; revisiting Resume kept its chunk request count at one. Controlled delayed-chunk checks showed the exact centered status at desktop and 390px widths, with `rgb(28, 25, 21)` text and no narrow-screen horizontal overflow. An aborted teacher chunk exposed recovery and allowed returning home. API 503 responses in this loading check were deliberate; it does not establish backend/model correctness, formal-account acceptance, physical-phone behavior or server RAM savings. Existing authentication and campus/full-app isolation are unchanged.

For a future deployment, serve HTML with `Cache-Control: no-cache` so it revalidates, and content-hashed JS/CSS with long-lived immutable caching. Retain previous releases' hashed assets during rollout and rollback so already-open tabs can still fetch their deferred chunks; do not delete old assets immediately or solve stale chunks with an automatic page reload. This is deployment guidance, not a server configuration or deployment performed by this change.

## 本地启动

在已有 WSL 的仓库根目录：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run doctor
npm run setup:local
npm run infra:up
npm run dev:local
```

浏览器打开 `http://127.0.0.1:5173`。

停止：

- `Ctrl+C` 只结束这一次前后端进程，不删除数据库卷。
- `npm run infra:down` 停止本项目的 MongoDB 和 Redis，不使用 `-v`。

不要用上游的 `docker compose up` 代替 `infra:up`。那会启动完整后端，并占用另一组数据库端口。

## 端口

| 服务 | 地址 |
|---|---|
| Vite | `127.0.0.1:5173` |
| 校园 API | `127.0.0.1:5002` |
| MongoDB | `127.0.0.1:27018` |
| Redis | `127.0.0.1:6380` |

前端的 `/api` 代理到 `127.0.0.1:5002`。端口被占用时命令失败，不会结束别人的进程。

## 身份与密钥

没有 Clerk 密钥时，本地配置可以打开 `DEV_BYPASS_AUTH`。它只在 `NODE_ENV=development`、`APP_PROFILE=campus-local`、监听 `127.0.0.1`，并且变更请求来自本机前端时生效。这不是注册，也不是多用户验证。

已配置 `CLERK_SECRET_KEY` 时，开发旁路关闭，正式认证仍走 Clerk。不要把 `HOST` 改成 `0.0.0.0` 后用开发身份做局域网或公网演示。

文本模型走 OpenAI 兼容代理。语音转写走 Qwen ASR。没有对应密钥时，页面和接口报告不可用，不返回假答案或假转写。环境样例见 `backend/.env.example`。不要提交真实的 `.env`。

教师需将真实 Clerk UID 加入服务端 `CAMPUS_TEACHER_UIDS`，且主邮箱已验证；本地开发身份永不升级为教师。学生另行授权，修改简历或岗位会使旧定向版本失效，需要重新生成/确认。

`RESEND_API_KEY`、`RESEND_FROM`、`APP_PUBLIC_URL` 是后续接入预留，填写后也不会自动启用邮件认证；当前相应接口返回 `503 EMAIL_AUTH_NOT_CONFIGURED`。不要把Resend当作完整身份系统。

部署认证方向已选定为 **Evren/Resend**，可信账号/会话集成尚待实现和验收；当前 Clerk 代码只是现有路径，不是新增加的上线前提。SMTP 发信不能代替身份认证，不能直接复用或复制生产账号、Cookie 和密钥。详见 [部署评估](docs/DEPLOYMENT_ASSESSMENT.md)。

## 日志与排障

- 服务端：`logs/backend.jsonl`；本地启动器：`logs/runtime.jsonl`。单文件2MiB或跨日轮转，最多保留3个旧文件，目录已被Git忽略。
- 页面错误可展开“技术信息”复制诊断编号，或下载最多200条前端事件。按 `requestId` 关联请求、AI/ASR/PDF阶段与结果。
- 日志只保留受限事件、字段名/错误码、耗时、字节数和安全异常类别，不记录密钥、验证链接、音频、口述和简历全文。
- PDF与ASR均为全进程单任务准入；繁忙时返回429，不无限排队。录音最长3分钟，上传最大10MiB；PDF一般一页、最多第二页上半页，超长明确拒绝且不截断。
- 低内存时不要同时跑构建、测试、浏览器和导出。校园构建在配置期隔离上游大模块；不要靠取消内存限制解决问题。


## 目录结构

```text
career-sprout/                   # Windows 与 WSL 新目录启动已验证
├── backend/src/campusServer.js   # 校园 API 入口
├── frontend/src/campus/          # 分流程页面、录音状态与口号彩蛋
├── backend/src/campus/           # 岗位、私密档案、授权、定向版本与匹配
├── compose.local.yml             # 只跑本项目 MongoDB / Redis
├── scripts/local/                # doctor、setup、infra、dev、verify
├── docs/LOCAL_WSL.md             # 启动细节
└── docs/evidence/phase1/         # 已跑过的冒烟和面试流程证据
```

上游的页面和路由仍在仓库里。校园构建只解析校园入口与普通CSS，不扫描未启用的作品集模板；原上游入口仍保留。Mongo数据库、Compose project和卷名继续使用历史 `career-pilot-local` / `career_pilot_local` 标识，避免改名丢失数据。

GitHub已改为 `zgyj4532/career-sprout`，仍保留原fork和提交历史。本地新目录已于2026-10-20验证启动，原有简历与档案可读，不再需要执行旧改名脚本。校园体验改造与轻量修正见 [Pull Request #2](https://github.com/zgyj4532/career-sprout/pull/2)；导入与截图需求见 [Issue #1](https://github.com/zgyj4532/career-sprout/issues/1)。未验证的功能不因存在接口或页面就视为完成。

## 验收边界

本轮新手流程证据见 `.trellis/tasks/10-21-novice-usability-information-reduction/research/verification.md` 与 `browser-model-smoke.json`。隔离合成账号的真实模型/API/浏览器冒烟已覆盖交流追问与摘要、编辑确认与重复确认、普通档案保存保留身份/专业/想法来源、两题正式面试末题到报告，以及简历/私有岗位保存后继续。1440px/390px 是模拟视口，不是真机；没有完整实施前截图基线，也不据此宣称全部验收通过。前一轮导入证据保留在 `.trellis/tasks/10-20-resume-import-polish-jobs/research/verification.md`，不覆盖历史记录。

当前明确未完成：

- 正式账号端到端联调：按已选 Evren/Resend 方案完成可信身份/会话集成与真实邮件送达；当前未启用。隔离权限测试不替代正式账号验收，也不新增 Clerk-only 前提。
- 真人麦克风/扬声器：用户已确认在此前周日测试过，按用户人工验收记录；真实手机仍未验证。部署后如浏览器HTTPS/权限环境改变，再做针对性复测。
- 新服务器备案/部署仍阻塞 3–5 名新手试用与物理手机验收；当前本地模型、API 和模拟视口证据不替代这些发布门。
- 服务器部署评估与实测内存见 [DEPLOYMENT_ASSESSMENT.md](docs/DEPLOYMENT_ASSESSMENT.md)。根目录 `configure-server.bat` 可安全准备/上传私密配置，使用见 [SERVER_CONFIG.md](docs/SERVER_CONFIG.md)；不代表当前服务器容量或注册登录已具备上线条件。
- 后端全量lint仍有停用上游模块的既存错误，具体结果见验证记录，不宣称全仓全绿。

## 许可证

上游代码仍按 [MIT](LICENSE) 分发。本分支是在该基线上的本地精简，不是上游作者提供的校园发行版。

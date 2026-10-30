# 职芽 CareerSprout：WSL 启动与排障

本文件描述校园入口，不是上游完整职业平台的启动说明。

## 环境

- 复用已有 Ubuntu 24.04 WSL，不重装、不注销。
- 当前目录为 `/mnt/e/github/career-sprout`（Windows：`E:\github\career-sprout`）。2026-10-20 已从此目录运行 doctor 和 dev:local，并确认 `/api/health` 的 MongoDB、Redis 均健康；旧目录句柄阻塞已解除，不再运行旧改名脚本。不要把 Windows 的 node_modules 拷进 WSL。
- 验收要求 WSL 与 `.nvmrc` 指定的 Node `24.14.1`，npm 及 Node 子进程使用同一安装；不要依赖系统 Node 20 或 Windows npm 混跑。
- Python 要求3.9+，使用已有合格解释器，不替换系统 Python。以每次 doctor 报告的实际路径/版本为准：本轮最终 PATH 选择为3.14.7，早先直接调用系统解释器记录为3.12.3，不能把3.12写成固定运行版本。
- MongoDB 8.0 与 Redis 7.4 只由 `compose.local.yml` 管理，项目名 `career-pilot-local`。

## 端口

| 服务 | 地址 |
|---|---|
| Vite | `127.0.0.1:5173` |
| Express 校园入口 | `127.0.0.1:5002` |
| MongoDB | `127.0.0.1:27018` |
| Redis | `127.0.0.1:6380` |

端口被其他进程占用时命令会失败，不会结束别人的进程。

## 命令

在 WSL 的仓库根目录：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run doctor
npm run setup:local
npm run infra:up
npm run dev:local
```

停止：

- `Ctrl+C` 只结束本次前后端进程，不删除数据库卷。
- `npm run infra:down` 停止本项目 MongoDB/Redis，不使用 `-v`，不删除数据。

浏览器访问 `http://127.0.0.1:5173`。前端把 `/api` 代理到 `127.0.0.1:5002`。

启动器先等待 `/api/health` 确认 MongoDB/Redis 就绪，再启动前端；看到 Vite 的 Local 地址后访问。Node 24 后端默认启用 `NODE_USE_ENV_PROXY=1`，使用已有 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`。本机地址须在 `NO_PROXY` 中；这不会配置或购买代理。需要禁用时显式设置 `NODE_USE_ENV_PROXY=0`。已观察到未启用此支持时 WSL 直连模型主机 `EHOSTUNREACH`，启用后同一 Luna 模型请求成功。

## 身份

没有 Clerk 密钥时，`setup:local` 生成的本地配置会打开 `DEV_BYPASS_AUTH`。它只在 `NODE_ENV=development`、`APP_PROFILE=campus-local`、监听 `127.0.0.1`，且变更请求的 `Origin` 是本机前端时生效。它不是注册，也不是多用户隔离。已配置 `CLERK_SECRET_KEY` 时旁路关闭，正式认证仍走 Clerk。

正式教师需要验证过主邮箱的Clerk账号，并将UID加入后端 `CAMPUS_TEACHER_UIDS`。权限还受学生授权与定向简历确认版本限制。本地身份不能模拟正式教师权限。

2026-10-23批准决定：继续现有 Clerk，取代此前 Evren/Resend 迁移方向，不创建替代应用、不升级 SDK 来代替配置。用户在本地私密配置填写同一既有 Clerk 应用的后端 `CLERK_SECRET_KEY` 与前端公开 `VITE_CLERK_PUBLISHABLE_KEY`；secret 不得进入任何 `VITE_*`。关闭 `DEV_BYPASS_AUTH` / `VITE_DEV_BYPASS_AUTH`，按既有 Clerk 应用设置核对 `http://127.0.0.1:5173` 的授权来源、回调与登录后跳转，启用邮箱验证，再按人工清单验收真实双账号。缺凭据或真实会话保持 `BLOCKED_EXTERNAL`，不要在聊天索要密钥。

Clerk Express also requires `CLERK_PUBLISHABLE_KEY` in `backend/.env`, with the same public value as `VITE_CLERK_PUBLISHABLE_KEY` in `frontend/.env.local`. Keep `CLERK_SECRET_KEY` backend-only. With the installed Express SDK, omitting the backend public key causes even anonymous `/api/campus/auth/status` requests to fail with HTTP 500. Restart both services after configuration changes. A healthy anonymous response is HTTP 200 with `mode: clerk` and `authenticated: false`; protected APIs must still return HTTP 401. Key presence alone does not prove registration or login.

Campus authentication distinguishes Clerk initialization from backend session lookup. Initialization is bounded to 20 seconds (or fails earlier when the SDK reports failure); account-status lookup, including token acquisition, is bounded to 15 seconds. A Clerk initialization retry reloads the current URL, so save unsaved work first. A backend-status retry stays on the page. Neither timeout grants a local identity or indicates a successful login. The warm centered Clerk card uses static decorative leaves; mobile layouts hide them. If another browser works but yours fails, inspect the reported stage and browser/network blocking rather than treating key presence as proof of connectivity.

`RESEND_API_KEY`、`RESEND_FROM`、`APP_PUBLIC_URL` 仅为未启用的预留；相应邮箱接口返回503，不发送邮件、不创建账户或会话，不能替代 Clerk。已有 Evren 服务和账号不改动。

## 诊断日志

`logs/backend.jsonl` 记录服务端请求、AI/ASR/PDF阶段；`logs/runtime.jsonl` 记录启动与子进程退出。两者按2MiB或跨日轮转，各保留3份旧日志，已排除入库。`CAMPUS_LOG_DIR` 可用于直接启动后端的私密日志位置；`dev:local` 固定使用仓库logs目录。

页面“技术信息”显示requestId；服务端响应头 `X-Request-ID` 使用同一编号。ASR/PDF还记录阶段及安全错误类别，可区分上传、转换、模型、浏览器启动、字体、打印与解析故障。未知错误不向客户端回显原始堆栈或个人资料。

## 内存与验证

先关闭本项目不需要的服务，串行执行验证。不要同时启动全量测试、构建和浏览器；不要结束其他项目进程。校园前端构建：

```bash
VITE_APP_PROFILE=campus-local NODE_OPTIONS=--max-old-space-size=384 npm run build --prefix frontend
npm test --prefix frontend -- src/campus --maxWorkers=1 --no-file-parallelism
npm run test:campus --prefix backend
```

若使用systemd用户会话，可给单个验证命令设置 `MemoryHigh`、`MemoryMax`、`MemorySwapMax`，约束整个子进程树；仍需检查Windows主机余量，WSL的available不能与Windows余量相加。降低堆上限可能让单个命令失败，不是成功证明；检查真实原因后再调整。

PDF和ASR全进程单任务，忙时429而不是无限积压；取消会释放已获得的资源。ASR最长180秒、上传10MiB、解码后6MiB上限。WebM等压缩录音需要 `FFMPEG_PATH` 指向可运行的ffmpeg；现有WSL默认尝试Windows Scoop的ffmpeg。不要将缺转码器错误当作录音成功。

改名只改代码路径和拥有的GitHub仓库；数据库 `career_pilot_local`、Compose项目 `career-pilot-local` 及卷名不变。旧资料应在迁移后重新读取确认，不执行 `down -v`。

## 导入材料与容量

- 原件默认存放在 WSL `~/.career-sprout/imports`，可用后端 `CAMPUS_IMPORT_DIR` 指向私密持久目录；不要配置成公开静态目录或自动清理的临时目录。
- 每人未完成导入最多 10 份、个人保留材料最多 80MiB；全局最多 500MiB。保存后的原件继续计入字节容量，只有主动丢弃才释放。应用不自动删除其他人的材料。
- 文件流式落盘；PDF/Word/图片解析与 PDF 导出共用单任务准入。上传等待不占解析位；解析超时终止子进程后释放。DOCX 解压最多 20MiB、PDF最多30页、图片最多4000万像素且只接收单帧。
- 每次整理先用 Luna，只有校验失败才用同一输入试一次 Sol；已有完成结果恢复时复用，不重新计日额度。服务器每日每账号最多20次导入整理操作。
- 当前校园后端单进程运行；简历关联写入和删除共享进程内准入，删除标记、墓碑和导入执行单持久化。不要直接扩成多进程部署而不补分布式准入。
- 档案“保存成功但缓存等待刷新”不是数据丢失；仅重试缓存刷新。校园简历/面试读档案绕过旧的120秒缓存。


## 不要做的事

- 不要把 `HOST` 改成 `0.0.0.0` 后用开发身份做局域网或公网演示。
- 不要运行根目录旧的 `docker compose up` 来代替 `infra:up`；那会启动完整后端并暴露 27017/6379。
- 不要在没有 AI/ASR 密钥时把失败页面当成通过。

## 页面按需加载与发布缓存（2026-10-21历史证据）

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

Initial JS fell **38.45%** (calculated gzip **39.09%**), while total emitted JS grew by **5,451 bytes**. This is deferred loading, not removal of product features; calculated gzip is not a claim about preview-server compression. All resulting JS chunks are below the original 500kB threshold. Build graphs are retained in [baseline.json](../.trellis/tasks/archive/2026-10/10-21-campus-bundle-loading/baseline.json) and [optimized.json](../.trellis/tasks/archive/2026-10/10-21-campus-bundle-loading/optimized.json).

The integrated check passed 166 campus tests across 28 files, scoped lint and the production build (548 transformed modules). Actual production-preview requests showed only the visited route and its dependencies loading; revisiting Resume kept its chunk request count at one. Controlled delayed-chunk checks showed the exact centered status at desktop and 390px widths, with `rgb(28, 25, 21)` text and no narrow-screen horizontal overflow. An aborted teacher chunk exposed recovery and allowed returning home. API 503 responses in this loading check were deliberate; it does not establish backend/model correctness, formal-account acceptance, physical-phone behavior or server RAM savings. Existing authentication and campus/full-app isolation are unchanged.

For a future deployment, serve HTML with `Cache-Control: no-cache` so it revalidates, and content-hashed JS/CSS with long-lived immutable caching. Retain previous releases' hashed assets during rollout and rollback so already-open tabs can still fetch their deferred chunks; do not delete old assets immediately or solve stale chunks with an automatic page reload. This is deployment guidance, not a server configuration or deployment performed by this change.

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


## 工程验收入口

在 WSL 仓库根目录先 `source "$HOME/.nvm/nvm.sh"`、`nvm use`，安装依赖并启动本项目 Mongo/Redis 后运行：

```bash
npm run doctor
npm run verify:phase1
# 可选全量上游检查，单独列 scope，失败仍保留
npm run verify:phase1 -- --include-upstream
# 指定独立报告路径
npm run doctor -- --report /tmp/career-sprout-doctor.json
npm run verify:phase1 -- --report /tmp/career-sprout-verify.json
```

默认报告为 `docs/evidence/phase1/doctor.json`、`docs/evidence/phase1/verify-phase1.json`，运行证据保留在 `docs/evidence/phase1/runs/<runId>/`。以实际报告时间、命令、运行时、退出码和分项状态为准，旧文件不证明新运行通过。默认验收固定 `APP_PROFILE` / `VITE_APP_PROFILE=campus-local`，串行覆盖脚本边界测试、校园后端及相关共享测试、明确范围的 lint、单 worker 校园前端测试、384MiB 堆构建与隔离非 AI 冒烟。

`doctor` 只读检查 WSL、Node/npm/Python、Compose/daemon、依赖与锁声明、端口空闲/本项目/其他或未知归属，以及 Clerk/模型/ASR 配置存在性。它不会安装升级、终止进程、打印密钥或调用付费服务；配置存在不等于供应商可用，锁声明一致不等于已执行 `npm ci`。首次缺依赖先运行 `setup:local`，daemon/权限问题先修复已有 Docker 服务；端口未知归属应人工定位，不杀占用进程。

状态分为 `PASS`、`FAIL`、`BLOCKED_EXTERNAL`、`NOT_RUN`。必需检查失败或基础设施阻塞不能返回全绿；依赖步骤未执行须保留原因。外部真实 Clerk、模型/ASR、真人/真机仍单列，不能用自动测试替代。全量上游检查不是默认校园范围，已知停用模块问题不通过删测试、放宽 lint 或卸依赖规避。

单独运行隔离冒烟：

```bash
node scripts/local/smoke-phase1.mjs
node scripts/local/smoke-phase1.mjs --report /tmp/career-sprout-smoke.json --pdf
```

冒烟使用独立合成 UID、数据库、临时导入/日志目录及自有动态 loopback 端口，只重启自己启动的后端，验证简历创建/编辑/读取与同一运行标记的重启持久化，最后清理自有资源；不停止开发服务，不删除原数据库或卷，不更改开发配置。默认不调用模型、ASR 或 Clerk；PDF 默认 `NOT_RUN`，`--pdf` 的二进制导出检查也不证明中文视觉可读性。失败、基础设施阻塞或清理失败应保留 JSON 证据并非零退出。

冒烟在进程内调用 `check-persist.mjs` 的 `checkPersistence`。独立诊断命令 `node scripts/local/check-persist.mjs --evidence /absolute/run-evidence.json` 必须显式提供本轮 `runId`、`uid`、`database`、`base`、`resumeId`、`marker`、`originalText`、`title`、`revision`，并通过活动后端 `/auth/status` 的精确 UID 校验；不再支持无参固定历史 ID。后端进程所有权由冒烟另外校验 IPC pid/run/database/Node路径。正常冒烟报告描述的是已清理运行，不能把清理后的旧证据重新执行当作持久化验收；通常直接运行完整冒烟即可。

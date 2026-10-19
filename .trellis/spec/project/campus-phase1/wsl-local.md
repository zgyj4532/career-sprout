# WSL 本地运行契约

## 运行布局

代码和依赖放 WSL Linux 文件系统，例如 `~/projects/career-pilot`。前端、后端、npm 和本地 Agent 在同一 WSL 发行版执行；Windows 浏览器访问 `http://localhost:5173`。Windows 的 node_modules 不得复用。已有 WSL 不重装、不注销、不迁移虚拟磁盘。

推荐前后端在 WSL 原生运行，MongoDB/Redis 由独立 `compose.local.yml` 提供。现有可用 Docker Engine 或 Docker Desktop WSL integration 均可复用，不另起冲突的第二套引擎。没有 Docker 权限时提供明确人工步骤，禁止 chmod 666 docker.sock。

## 版本策略

检查实际 package.json、锁文件的 engines 和 .npmrc；优先采用 Node 24 LTS，验证依赖兼容后将精确版本写入 .nvmrc 和环境报告。Trellis 需要 Python 3.9+；仅检查/使用合格解释器，不自动替换系统 Python。保留现有 npm 与锁文件工作流：锁文件一致时 npm ci；缺失/不一致时记录原因后最小化修复，禁止 npm audit fix --force 或批量升级。

数据库镜像使用与实际驱动兼容且仍受支持的版本，明确固定 tag/必要时 digest，不使用 latest。MongoDB 8.0 与 Redis 7.x 可作为候选，最终由本地依赖和镜像可用性验证决定。

## 统一端口（本方案目标，不是上游既有保证）

- Vite：127.0.0.1:5173，strictPort，冲突时报错不静默漂移。
- Express：127.0.0.1:5002。
- 本项目 MongoDB：127.0.0.1:27018 → 容器 27017。
- 本项目 Redis：127.0.0.1:6380 → 容器 6379。
- MongoDB URI：mongodb://127.0.0.1:27018/career_pilot_local。
- Redis URL：redis://127.0.0.1:6380。

已占用端口先识别归属，不杀别人的进程；必须换端口时集中更新脚本、环境、代理和文档。

前端优先使用同源 `/api`，Vite 转发到后端。核对实际 API 客户端对 base URL 的拼接，防止 `/api/api`。Socket.IO 若仍被核心功能使用，要单独核对代理/鉴权和连接地址；不要默认 HTTP 代理已覆盖 WebSocket。`VITE_*` 中不得出现私密 API key。

MongoDB/Redis 使用本项目独立命名卷与 Compose project name，带健康检查。infra:down 只停止本项目，保留数据；禁止 down -v、docker system prune、删用户数据。

## 需交付的根目录命令

这些命令要求 Agent 新增并实测：

- `npm run doctor`：检查 WSL/解释器/Node/npm/Compose/daemon/端口/环境字段；只输出配置是否存在，不输出密钥值。
- `npm run setup:local`：幂等安装前后端锁定依赖、生成缺失配置模板；不覆盖现有 .env，不自动注册服务，不触发无关外部请求。
- `npm run infra:up` / `npm run infra:down`：按明确 -f 和 -p 操作本项目基础服务。
- `npm run dev:local`：预检、启动或复用本项目基础服务、等待健康、同时启动前后端；Ctrl+C 清理本次子进程但不删数据；失败非零退出。
- `npm run verify:phase1`：聚合实际 lint/build/tests/smoke 并保留每步退出码，不用 `|| true` 伪装通过。

不要引入一套复杂部署平台，只用少量 shell/Node 脚本或小型进程管理依赖解决。

## 环境变量证据分类

上游已观察到：PORT、NODE_ENV、FRONTEND_URL、MONGODB_URI、REDIS_URL、DEV_BYPASS_AUTH、DEV_USER_UID、DEV_USER_EMAIL、ENABLE_GITHUB_SYNC_CRON、CLERK_SECRET_KEY、VITE_CLERK_PUBLISHABLE_KEY。是否仍有效必须本地复核。

本方案建议新增：APP_PROFILE=campus-local、HOST=127.0.0.1、VITE_DEV_BYPASS_AUTH。新增变量必须写明读取点和测试，不得假装只填 env 就会自动生效。不要无依据创造 ENABLE_ALL_QUEUES=false 等开关并宣称原项目支持。

## 两种鉴权模式

1. 正式联调模式：保留当前 Clerk，密钥由用户在本地 .env 填入；不改成自建 JWT 或新数据库账号系统。
2. 可选本地开发身份：用户未配置 Clerk 时用 development + campus-local + 显式开关 + loopback 约束进入固定、非管理员测试身份。前端显示醒目开发模式标识。

上游后端已有 DEV_BYPASS_AUTH，但前端未配置 Clerk 只进入匿名预览；不能假定开关已贯通。检查 Clerk client/middleware 是否在本地分支前就被构造；需要最小适配，在无密钥时不调用 Clerk，且不能移除正式路径。

本地开发模式必须同时满足后端开发环境、显式开关、只监听 127.0.0.1、严格 Host/Origin 和变更请求来源检查；不信任 X-Forwarded-* 绕过判断。前端分支还需 import.meta.env.DEV。production/staging、绑定 0.0.0.0、通过隧道/远端访问时应拒绝启动本地旁路。开发身份不赋予管理员权限，不支持匿名选择任意 uid。正式模式需真实鉴权和按 owner 过滤资源。

单用户开发身份只证明页面和接口可联调，不证明注册、多账号隔离、教师权限已经通过。不得用它做手机 LAN 或公网演示。

## AI/语音与可选存储

首次只接通一个用户已有的真实模型配置，不要求注册所有上游服务。聊天模型有响应不等于支持语音转写，ASR 能力需单独验证。保留现有 provider 接口；没有兼容 endpoint 时只做必要的配置化适配，避免重建多模型路由系统。

空 key、示例占位 key、网络失败、无 ASR 能力均明确返回结构化错误。生产业务禁用伪答案、占位转写和假成功；测试 mock 只能出现在明确测试范围。

音频不自动长期上传到外部媒体服务。检查 Cloudinary 是否被作为核心上传前置；普通录音可内存上传至 ASR 后释放，历史默认保留文本。确需本地文件时加大小/类型/路径与 owner 检查，禁止公开目录直接裸露个人材料。

## 手机边界

第一阶段完成响应式视口检查，并在 Windows 浏览器 localhost 实测录音与播放。手机的 localhost 指向手机自身；手机访问电脑需另外处理网络和可信 HTTPS。getUserMedia 的安全上下文要求不能用关浏览器安全或裸露开发旁路规避。未做真实手机测试要写 NOT_RUN，不能把模拟视口当真机验收。

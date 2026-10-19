# 设计：最小改动的本地精简版

## 1. 不另起技术体系

保留既有前后端目录、路由风格、模型和 provider 边界，不重建 monorepo 或强制 TypeScript 化。现有 JS 项目以 lint/build/tests 验证，不能为了产生 typecheck 命令大规模改语言。

## 2. 启动拓扑

Windows 浏览器 → localhost:5173 → WSL Vite → 同源 /api 代理 → WSL Express:5002 → 本项目 MongoDB:27018 / Redis:6380。

代码放 Linux 文件系统。新建独立 compose.local.yml 只管理 Mongo/Redis；根目录 Node/shell 脚本管理前后端开发进程。不要直接照 README 假定 Docker-compose.yml 存在。本方案研究时该精确路径读取返回 404，应本地列目录确认后处理。

## 3. 本地 profile 与功能停用

新增小型本地 profile/feature 配置，不引入插件平台。默认校园 profile 只注册核心路由。对作品集/社区/fellowship/payments/outreach/爬虫等有外部依赖的模块，处理 import 与 init，而不只是改导航。

支付 import、initJobFetcher、initializeDigestQueue/startDigestWorker/scheduleWeeklyDigest、startOutreachWorker、GitHub sync cron 为重点审计点。现有 ENABLE_GITHUB_SYNC_CRON=false 可复用；其他开关若不存在，需要在实际代码中实现并测试。

保留 shared upload/parse/pdf/auth/owner checks/security middleware；校园 profile 不开放无关 API，返回明确 404 或既有规范的禁用响应。上游未配置密钥不能阻碍核心服务启动。

## 4. 鉴权适配，而非重写

正式模式维持 Clerk；本地开发模式仅为单用户调试提供受限身份。集中构建前后端身份适配，不逐个删除路由 verifyToken。检查 Clerk middleware/client 构造时机，避免缺 secret 时尚未进入旁路就报错。

前后端开发开关都默认关闭；新增开关遵循环境白名单和 loopback 约束。生产启动发现开发开关直接报错。保持非管理员身份和 owner uid 一致。无凭据时 multi-user 检查阻塞，不用两个任意 uid 请求头假装正式隔离。

## 5. 简化页面，而不是另建完整前端

首页只显示“做简历、练面试、分析岗位、我的档案”。每个入口只链接本阶段实际工作的页面；先审查对应路由和 API，不能创建假可用按钮。

简历：填写或导入 → AI 辅助（可用时）→ 编辑/预览/导出。默认一套简单 A4 样式，其余模板先隐藏，验证无引用后再删。

面试：选岗位/语言 → 加载简历或选择示例 → 用户授权麦克风 → AI 播报问题 → 真实转写 → 反馈与复盘。示例简历必须注明，不能冒充学生真实经历；不要求展示数字人或编程编辑器。拒绝麦克风时允许文字兜底，但该次不算语音验收通过。

个人档案优先复用现有字段；不在本阶段扩展完整技能评价体系。空白页给一个明确下一步按钮，避免整屏配置项。加载可见、失败可重试、用户输入不因错误丢失。

## 6. 语音与数据

LLM 和 ASR 能力分别检查。保留现有浏览器 TTS 入口并测试实际中文音色；无中文音色时明确报状态，不能以调用 API 未报错作为“已经发声”。不要引入新的直播/电话服务，只先验证浏览器内双向语音。

音频默认不长期保存；现有 Cloudinary 引用需审计，必要时仅对本地 profile 解耦临时音频上传与永久媒体存储。文本历史按用户保存。模型输出做既有 schema 校验和错误处理，勿渲染未经清理的 HTML。

## 7. 可回退与证据

任何物理删除都列原路径、引用检查、为什么删、受影响路由、回归结果。保留上游 git 历史；未提交情况下只能按文件精确撤回自己的改动，不覆盖用户改动。最终提供建议提交分组，不自动提交。

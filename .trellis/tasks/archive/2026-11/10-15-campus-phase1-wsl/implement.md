# 实施顺序

这些是同一 Trellis 任务中的工作包，按顺序推进；不是要求同时起六个改同一入口文件的 Agent。

## W0：环境与上游基线

检查 pwd、WSL 发行版、node/npm/python 路径和版本、Docker/Compose/daemon、git 状态/远端/HEAD、现有 Trellis 版本和 workflow。记录端口占用、代理是否可用（脱敏）。不重装系统，不改用户网络策略。

读根目录及前后端 package.json/锁文件/.npmrc、README 启动章节、环境样例、auth/AuthProvider、Vite/API client、index.js、queue/cron、resume/interview 服务。归档源码支持的事实与 README 声明的差异。

输出 research/local-baseline.md、research/dependency-map.md。完成必要规范引导后才开始实现；用任务实际路径重新添加研究上下文并 validate。

验收：明确最小必需服务、可选服务、计划新增变量、实际端口和禁止触发的副作用。若全量上游启动需凭据或会外发动作，不强行全量启动；记录原因，运行最小受控基线。

## W1：WSL 可重复启动

选择兼容 Node LTS 并锁定版本；保留锁文件安装策略。新增 compose.local.yml 和根目录命令；统一 5173/5002 与 Mongo/Redis 专用端口，前端 /api 相对路径和代理一致。doctor 区分必要/可选环境变量，识别占位值，禁日志打印密钥。

先隔离外部副作用再启动。处理进程退出、Ctrl+C、端口冲突、基础服务健康与幂等性。无需为 disabled 模块配置云服务。

验收：dev:local 启停两次；Mongo/Redis 健康；前端可打开；/health 在 DB 正常/失联时返回真实状态；旧数据保留；没有邮件/支付/爬虫/发布请求。

## W2：按清单停用再有限删除

参照 pruning-matrix.md。先处理 backend index 路由、静态 import、worker/cron，再前端 App/layout/hub/navbar/deep links。可以将相关模块保持在 git 工作树中，但运行时不能加载或开放入口。

第一批关闭 portfolio/deploy/themes/community/fellowship/payments/GitHub intelligence/outreach/job alerts/crawlers/digest/coding rounds/非必要花哨展示。保留 JD parser、resume matcher、个人档案、简历/面试/历史及共享安全层。

引用审计涵盖 rg、路由注册、动态 import、资源路径、测试和构建配置，不只跑一个 grep。每批回归通过后才删确定孤立的页面/资源/依赖；边界不清的写 KEEP_PENDING_AUDIT。

验收：禁用页面和 API 不能绕过导航直接访问；worker 未启动；核心构建及接口没有新增失败。输出逐项 disposition 和证据，不以删掉多少文件作为绩效。

## W3：本地鉴权与服务配置边界

先检查有无用户已配置 Clerk；有则保留并联调。没有则最小贯通本地非管理员身份，限制 development/profile/loopback/Host/Origin；避开缺密钥的 Clerk 构造。不重写生产认证。新增反向测试证明生产环境和远程访问不能使用开发旁路。

AI 只保留一个默认有效配置即可，接通已有 provider，不重构整个模型管理。核对现有 ASR 文件上传结构、格式与 provider 能力。没有 key 或 capability 时明确失败，绝不落库为真实答案。

验收：无 Clerk key 可进入标识清楚的开发页面；正式模式仍需鉴权；无 AI key 时页面不崩溃、不假成功；有凭据时真实完成简历分析和语音回合。多用户正式验证缺条件则阻塞。

## W4：低门槛中文入口

基于既有布局增加四个明确入口及移动端布局；保留一个主要动作，隐藏不需要的多级 hub/高级设置。只汉化核心路径，不全站替换文本。

简历默认中文一页 A4 风格，复用当前编辑与导出；实际打开生成 PDF 检查乱码/换行/裁切。面试默认中文与适合学生的难度，麦克风权限解释、录音状态、停止按钮、反馈下一步明确。岗位分析先用现有粘贴 JD，不新建爬虫。

验收：360/390/768/1440 视口不横向溢出、关键控件可触达、错误后输入保留。真实手机未测要标明。

## W5：回归与交接

复用既有前端 Vitest 和后端 Node tests，补本阶段高风险测试；没有 TS 不强造 typecheck。测试工具存在就实际运行，不存在则最小安装或标阻塞。完成 lint/build/unit/integration/browser/真实服务的分项报告。

记录上游原有失败、新增失败、未跑测试，输出 docs/LOCAL_WSL.md、docs/PHASE1_REPORT.md、docs/PRUNING_LOG.md 和脱敏截图/日志。根 README 增加本地入口链接并纠正当前范围内过期说明，保留上游来源说明。

更新 Trellis journal 与稳定 spec；有外部阻塞不归档为全部完成；不自动 git commit/push。最后给出可复制启动/停止/验证命令和精确待办。

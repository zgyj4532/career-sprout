# 登录与注册界面优化

## Goal
解决生产环境邮箱注册后登录卡住的问题，并让公开登录、注册入口符合中文用户的使用习惯，同时保留教师权限的安全边界。

## Confirmed background and technical constraints
- 用户反馈生产地址 `https://crayzamb.cloud/career-sprout` 已上线，邮箱注册成功，但后续登录停留在登录界面；这是用户实际报告，尚无可用的真实会话日志或本地复现。
- 用户报告直接打开网站不会自动进入登录界面，登录 UI 显示英文，没有明显的教师端登录入口；注册分别要求 first name 与 last name，密码提示要求 15 位。用户希望中文界面、单个全名输入、密码至少 6 位。
- `frontend/src/campus/pages/AuthPage.jsx:7,41-52,67-97` 使用 Clerk `SignIn`/`SignUp`，按 `VITE_CLERK_SIGN_UP_ENABLED` 控制注册，并传递 `returnTo`；未登录导航目前显示“登录 / 注册”。
- `frontend/src/main.jsx:4-9,44-49` 的 ClerkProvider 在 `campus-local` profile 下传入 `frontend/src/campus/clerkLocalization.js`；现有认证词条为 `zh-CN`，姓名字段仍分列“名字”“姓氏”。
- `frontend/src/campus/CampusApp.jsx:46-61,87-` 在 `/` 渲染公开首页；登录路由为 `/login` 与 `/register`。教师路由 `/teacher` 已存在；`TeacherPage.jsx:88` 要求服务端授权 `isTeacher`，并提供 `/login?returnTo=/teacher`。教师入口只能复用普通登录并保留这一权限边界。
- 历史任务 `.trellis/tasks/10-26-clerk-auth-integration/research/verification.md` 已记录完成 20s SDK / 15s status 超时恢复、主题和匿名权限检查；不重复实施。该记录当时未包含真实账号闭环；10-29 用户后来确认基本账号流程可用。当前生产登录卡住是新的用户报告，不能用历史确认宣称本次故障已解决。
- Clerk 官方登录配置文档说明用户模型可开启 first/last name；当前预置组件依赖 Clerk 实例配置。全名单输入需先验证官方组件/当前 SDK 能否支持、及如何兼容现有 firstName/lastName 数据，不能只把标签替换掉。
- Clerk 旧密码规则文档曾援引最低 8 字符，`createUser` API 也有至少 8 字符约束；不能把旧引用写成现行 NIST 的通用最低值。NIST SP 800-63B-4 区分单因素密码最低 15 字符与多因素场景最低 8 字符。用户批准的产品目标仍是提供商实际配置最低 8（允许更长），不是“任何不低于 8 的配置均算完成”；须保留真实提供商限制与安全差异说明，不能仅改前端提示。
- 用户明确要求只让根路径 `/` 自动跳转登录；其他显式页面/深链不强制登录，所有受保护数据仍由后端鉴权。
- 生产 Dockerfile 明确 `VITE_APP_PROFILE=campus-local`，production Compose 又暴露 `https://crayzamb.cloud/career-sprout/`。公网 HTML 当前响应 200，`/login`、`/register`、`/teacher` 深链返回 200。线上主 JS bundle 已完整读取：HTTP 200、405,356 字节；包中包含 `zh-CN` 词典（包括“登录职芽”“邮箱地址”“密码”），线上构建对 ClerkProvider 传入该词典。线上静态 bundle 中没有 `15 characters`、`At least 15` 或 `minimumLength` 字串。由此可排除“发布包没有中文词典”这一根因推测；尚不能证明 Clerk SDK 实际渲染语言，也不能解释用户实际登录卡住的原因。
- GitHub 部署进展已记入 `https://github.com/zgyj4532/career-sprout/issues/6`；本任务范围是解决后续登录和界面测试问题。
- 2026-11-07 本轮匿名 HTTP：站点页面和 `/career-sprout/api/campus/auth/status` 可达，后者返回 `mode=clerk, authenticated=false`。主代理实际浏览器观察到登录主要文本为中文，但 Optional、Show password、邮箱格式说明和 Clerk 品牌脚注等仍有英文；这是部分本地化缺失，不是所有页面未加载中文。

## Requirements
1. 排查并修复用户报告的生产注册后登录卡住；分别检查 Clerk SDK 初始化、账号状态接口、验证/会话和跳转，不绕过认证或服务端授权。
2. 登录、注册及错误、邮箱验证、恢复和切换流程中实际可见的认证文案完整使用简体中文；追查为何生产页面未使用当前 `zh-CN` 词条。
3. 提供明确“教师登录”入口，复用普通 Clerk 登录并将登录后返回目标设为 `/teacher`；教师数据继续仅允许服务端授权教师访问。
4. 注册 UI 提供单个全名输入，用户已批准 Clerk Custom Flow。中文按第一个 Unicode 字符为 firstName、余下为 lastName；英文按第一个词为 firstName、余下为 lastName。单字/单词支持合法空 lastName；不伪造姓名、不批量迁移或覆盖已有账户姓名。
5. 用户已批准将提供商实际配置的最低密码长度设为 8 个字符（密码本身不要求恰好 8 位，允许更长）。核实生产实例实际限制，保持服务端策略、提示、边界验证一致；不要求已有用户重置密码，不将前端允许提交等同于提供商接受。
6. 仅匿名访问根路径 `/` 自动跳转登录；已登录根路径保留真实业务首页。其他显式页面/深链不强制登录，已登录访问登录/注册页跳转安全目标；所有受保护数据仍由后端鉴权。
7. 2026-11-07 匿名读取生产公开 Clerk `/v1/environment` 已确认 `password_settings.min_length=15`，这是当前实例策略，不是应用 bundle 硬编码。代码不能把 8 字符提交等同实例接受；目标 8 的提供商配置变更仍需维护者执行和真实边界验收。
8. GitHub 部署进展已记入 `https://github.com/zgyj4532/career-sprout/issues/6`；本任务范围是解决后续登录和界面测试问题。
## Acceptance Criteria
- [ ] 用户报告的登录卡住已定位到具体阶段；可行时用真实账号完成生产注册后登录、目标页访问和退出闭环；无法由工具操作的真实账号环节清楚标注未验证。
- [ ] 登录、注册及错误/验证/恢复状态的所有认证界面可见文本均为简体中文。
- [ ] 登录入口提供教师登录；成功后尝试 `/teacher`，未获服务端教师授权仍不能访问教师数据。
- [ ] 新账号注册只要求填写一个全名；已有账户姓名数据保持兼容。
- [ ] 生产 Clerk 实际配置的最低密码长度为 8：7 字符被拒绝，未泄露且满足其他策略的 8 字符密码具备被接受资格，更长密码允许；界面说明与提供商行为一致。当前最低 15 不满足这一目标，不能因其“不低于 8”判定通过。
- [ ] 按用户确认后的根路径/匿名访问规则运行；合法内部 returnTo 正确，外部/不安全 returnTo 仍被拒绝。
- [ ] 完成相关既有认证回归和真实浏览器冒烟，记录非真实会话测试与生产边界。

## Out of scope
更换认证供应商、绕过邮箱验证、赋予任何账号教师权限、静默篡改生产 Clerk 设置、接受六位 Clerk 密码、认证之外的产品页面重设计、在任务记录中保存真实账号密码/验证码/session token。


## Implementation approval
2026-11-07：用户明确批准继续现有 `11-06-login-ux` 任务及全部既有评审建议，批准实施、最少 8 字符和单全名 Custom Flow 映射。无需重新申请建任务或实施批准。不提交、不推送、不部署；子代理不运行 build/lint/tests/formatters，父代理统一集成验证。

## 最终验收与归档

- 用户后续明确要求使用官方 Clerk SignUp/SignIn，取消自定义注册及验证码流程；该决定取代上述单全名 Custom Flow 实施方案。
- 最终部署提交：`81b7d14cacaaf90c5e10a90ff26b539ff8dd620a`。修复 Protect 挑战兼容性、React Router 路由接入和旧 `/register#/continue` 链接；保持服务端授权及安全防护。
- 用户在本次会话明确确认：“登录已经完成，归档这个任务”。以用户实际登录成功及明确归档指令作为本任务关闭依据。
- 验证：初始 108 项相关回归通过；最后变更相关 22 项回归与 ESLint 通过；线上官方登录/注册切换、浏览器返回、旧链接恢复及移动端页面已实测。生产源码 2786 文件和镜像静态资源完整性已核验，后端与数据库保持不动。
- 边界：上述原始清单保留为需求演进记录，不整体补勾。未声称所有官方组件文案完全中文、单全名自定义表单仍存在、教师授权或生产退出流程均完成真实验收；生产登录成功来源为用户确认。依赖审计问题及本地测试/生产 Clerk 密钥混用不在本次归档中标记为已修复。

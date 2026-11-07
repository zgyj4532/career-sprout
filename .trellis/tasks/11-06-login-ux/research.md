# 登录 UX 规划研究

## 已确认的应用行为
- `main.jsx` 已按 campus profile 注入 locale；前序公网静态研究确认生产 Docker profile 和 bundle 均包含中文词典。缺少 provider wiring 不是已证实根因；运行时 Clerk 动态词条/会话仍需独立调查。
- `frontend/src/campus/pages/AuthPage.jsx:67-69` 渲染 Clerk SignUp/SignIn，直接复用 Clerk 实例要求的用户模型字段。注册/登录 redirect 由现有 `safeReturnTo` 与 path helper 控制。
- `frontend/src/campus/CampusApp.jsx:87-` 根路径渲染公开首页；未登录导航使用“登录 / 注册”。
- 教师 route 已有服务端授权保护，并从未授权 `/teacher` 页面链接 `/login?returnTo=/teacher`。
- 锁定安装的 `@clerk/clerk-react` 是 5.61.9。旧任务 verification 已记录 20s SDK / 15s session 超时恢复、主题及匿名/无效 token 检查，当时未记录真实账号闭环；10-29 用户后来确认基本账号流程可用。当前生产新故障尚无解决证明；不能混淆这三个时间范围。旧 implement gate 属于过期计划，不得阻止本次已批准实施。

## Clerk 约束
- 官方预置 SignUp 无单全名配置；用户 2026-11-07 已批准 custom registration 和 first Unicode character / first word 映射，保留合法空 lastName 和既有用户数据。
- 官方密码规则：https://clerk.com/docs/guides/secure/password-protection-and-rules.md?sdk=js-frontend 。Clerk 旧文档曾援引最低 8 字符，`createUser` API 也有至少 8 字符约束；现行 NIST SP 800-63B-4 则区分单因素最低 15 与多因素最低 8，不能沿用“现行 NIST 通用最低 8”的表述。用户批准的实际提供商最低长度目标是 8，允许更长；生产仍为 15 并不满足这一目标。
- 官方 auth model 配置：https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options.md?sdk=js-frontend 。公开注册和 User model 策略由 Clerk Dashboard 管理；实际密码最低 8 的提供商变更已获批准，但本环境缺少可用管理凭据/认证会话。
- 2026-11-07 公开生产 FAPI `https://clerk.crayzamb.cloud/v1/environment` 实读确认 min_length=15、名字/姓氏均 enabled=true/required=false、email_code 验证启用、注册 public、captcha/legal/MFA/org-selection 未启用。密码 8 是批准目标而非现状；因管理访问条件缺失尚未修改 Dashboard，不声称 provider 已接受 8。
- 公开 display_config 的默认 home/after-sign-in/after-sign-up URL 指向域名根而非 `/career-sprout/`。应用现有 forceRedirectUrl 覆盖普通表单落点；这些默认值是需维护者检查的配置风险，不足以证明用户本次卡住原因。
- 主代理匿名浏览器已看到主要中文登录界面及残余英文 Optional、密码显示控件、邮箱格式说明、品牌脚注。官方 zhCN 基线也有部分 auth/error/reverification 空词条，需要明确补齐；无受支持词条的供应商品牌/无障碍字符串不得用 DOM 注入伪造翻译。

## 待验证技术问题
- 采用 SDK 兼容官方 zhCN 基线而不是继续维护不完整手写翻译；动态密码文案仍受生产实例策略影响。
- 注册 Custom Flow 必须使用当前 v5 SDK 接口，覆盖邮箱验证、重发、重复操作及会话建立失败，不盲用 Core3 示例。
- 匿名根路径进入登录，已登录根路径保留业务首页；安全深链和 basename 不能丢失或形成登录循环。

## 证据边界
前序规划已经匿名访问生产 HTML、深链和主 bundle（PRD 记录 HTTP 200、405,356 bytes 及中文词典）。这不等于浏览器运行时语言或真实账号成功证明。用户注册成功后登录卡住是 ground truth；本轮新增证据另写 `research/session-ux-implementation.md`，未观察到的根因不得当事实。

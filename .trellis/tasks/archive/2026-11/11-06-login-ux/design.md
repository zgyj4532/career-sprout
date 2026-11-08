# 登录与注册界面改造设计

## Boundary
沿用 React/Vite、Clerk React 5.x 和 Express Clerk session 校验。仅注册切换为已批准的 Clerk Custom Flow，登录保留官方组件。按证据区分 SDK 初始化、会话状态请求、邮箱验证、会话建立和 redirect；不要求再次复现用户已报告的失败。旧任务已完成有限加载超时、恢复和主题，保留这些逻辑。

## 页面/会话路径
匿名 `/` → `/login`；已登录 `/` 保留业务首页。`/login` 的 Clerk `SignIn` → Clerk session → `CampusSessionProvider` `/api/campus/auth/status` → 安全 `returnTo`（默认 `/`）。`/register` 使用同一 provider 的 Custom Flow、真实邮箱验证与激活会话。教师入口使用 `/login?returnTo=/teacher`；服务端 `isTeacher` 边界不变。显式深链继续可达，部署 basename `/career-sprout/` 只添加一次，拒绝外部及不安全目标，登录/注册目标不能形成循环。

## 技术边界和策略
- Localization：现有 production profile 已确认传入中文词典，不能再把缺少 wiring 当已证实原因。采用与现有 SDK 类型兼容的官方 `@clerk/localizations` zhCN 基线，加少量职芽品牌覆盖；不升级 Clerk major。完整覆盖登录、错误、验证及恢复词条。
- 姓名：用户已批准自定义注册和映射。中文取首 Unicode 字符为 firstName，余下为 lastName；英文取首词为 firstName，其余为 lastName。空 lastName 必须遵循实例合法支持，不填虚假占位；已有账户不修改，不做 mass migration。
- 密码：用户批准的实际提供商最低长度目标是 8，7 字符拒绝，满足其余策略的 8 字符可用，更长密码允许；不以仍为 15 冒充完成。Clerk 旧文档的 8 字符引用不代表现行 NIST 的通用最低值；NIST SP 800-63B-4 区分单因素最低 15 与多因素最低 8。诚实记录产品目标与安全标准差异，不仅修改前端文案。
- 登录卡住：保留真实 session/status 错误和受保护访问拒绝；不以默认成功、客户端身份或跳过状态接口来消除卡住。成功后返回路径仍通过现有 `safeReturnTo`。
- 账户安全：生产注册与普通登录保持公开/正常使用，不加访问门禁；教师权限不从登录入口赋予。

## Expected files
- `frontend/src/campus/pages/AuthPage.jsx`：教师登录入口、认证页面本地 UI、returnTo；仅按证据修复卡住路径。
- `frontend/src/campus/CampusApp.jsx`：根路径匿名重定向，已登录根路径仍为 Home。
- `frontend/src/main.jsx`：保留已正确配置的 campus provider；仅在有必要时修改。
- `frontend/src/campus/clerkLocalization.js` 及 frontend package/lock：官方 SDK 兼容中文基线与品牌覆盖。
- `frontend/src/campus/campus.css`：若新增入口需要样式，沿用已有认证主题和键盘焦点模式。
- 相关 auth 路由/session/本地化回归测试及现有操作说明，按改动更新。
- 用户已批准生产提供商密码策略最低 8；不能靠仓库前端文案修改实现。当前缺少可用管理凭据/认证会话，尚未执行 Dashboard 变更；提供精确的维护步骤，不把这一访问条件误写成缺少用户授权，不暴露 secret。
- `frontend/src/campus/auth.jsx`：会话就绪、路径安全和 post-login 协议的最小拥有层修改；保留现有 20s / 15s 超时与恢复。
- 两个独立修改面：AuthForms 负责 AuthPage 和新注册模块；SessionUX 负责 session/router/locale/package 和本任务记录。接口先协调，不交叉编辑。

## Verification and rollback
对根路径规则、错误阶段、深链 returnTo、教师 unauthorized boundary 编写已有 Vitest conventions 的测试；真实开发配置使用浏览器验证 `/login`、`/register`、教师入口和对应 viewport。真实 Clerk 账号步骤用户自行完成；不得要求提供密码/OTP/token。未真实测试的生产成功闭环明确记录。代码改动限局部、可回退，不执行部署或改动生产 secrets/数据。

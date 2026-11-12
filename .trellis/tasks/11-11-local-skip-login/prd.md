# 本地跳过登录并分离测试与生产环境

## Goal

在本机测试环境打开职芽时，不经过登录页，直接进入首页。生产环境继续使用 Clerk，密码规则仍由线上 Clerk 实例决定。

## Background

用户在本地看到「至少 15 个字符」，而服务器上的密码最低长度已经是 8。应用没有写死 15。文案来自当前 Clerk 实例的密码策略（`frontend/src/campus/clerkLocalization.js:130`）。本地 `dev:local` 只要读到 Clerk 密钥，就会关闭本机身份并进入正式登录（`scripts/local/dev-local.mjs:87`，`backend/src/config/localDevIdentity.js:142-144`）。未登录访问 `/` 会转到 `/login`（`frontend/src/campus/CampusApp.jsx:90-91`）。

本仓库的测试运行时是 `npm run dev:local`（development、campus-local、只监听 loopback）。生产是已有的容器契约：必须显式关闭旁路，并使用 live Clerk 密钥（`backend/src/config/localDevIdentity.js:24-39`）。没有另一套已部署的公开测试站。

## Requirements

1. 本地测试运行时打开 `/` 时，使用现有固定本机身份进入首页，不显示 Clerk 登录、注册或密码长度提示。
2. 本地测试运行时直接打开 `/login`、`/register` 或 `/verify-email` 时，进入首页或安全的站内 `returnTo`，不展示密码表单。
3. 本机身份保持现有约束：固定用户、非管理员、非教师，只在 development、campus-local 和 loopback 下生效；变更请求仍必须来自本机前端来源。
4. 生产环境不因本地 `.env` 里留有 Clerk 密钥而改变：旁路必须关闭，未登录访问 `/` 仍进入 Clerk 登录，密码最低长度继续由线上 Clerk 策略决定，应用不写死 8 或 15。
5. 选择环境的依据是运行时，而不是删除生产配置里的密钥。本地启动不得把 Clerk 公钥交给前端。

## Acceptance Criteria

- [ ] 本地 `dev:local` 下，匿名打开 `http://127.0.0.1:5173/` 显示首页，地址栏不是 `/login`，页面没有密码输入和「至少 15 个字符」。
- [ ] 同一本地运行时，账号状态为已认证的本机身份，导航标明这是本机体验身份，且不提供进入正式登录的入口。
- [ ] 本地直接访问 `/login` 不会停留在登录页。
- [ ] 生产启动配置仍拒绝 `DEV_BYPASS_AUTH=true`，未登录的生产首页仍进入登录页。
- [ ] 现有「仅匿名 Clerk 首页才跳转登录、明确深链不强制跳转」的行为保持不变。
- [ ] 后端本地身份测试覆盖：development + loopback 即使存在 Clerk 密钥也使用本机身份；production 有密钥时不使用本机身份。

## Out of Scope

- 修改 Clerk 控制台里的密码策略，或在应用里拦截 8/15 位密码。
- 用本机身份模拟正式注册、多账号隔离或教师权限。
- 把本机身份暴露到局域网、隧道或公网。
- 新建一套远程测试部署。

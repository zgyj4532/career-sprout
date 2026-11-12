# 本地跳过登录并分离测试与生产环境

## Boundary

两个运行时，不新增第三种部署。

| 运行时 | 身份 | 前端 |
|---|---|---|
| `dev:local`：`NODE_ENV=development`、`APP_PROFILE=campus-local`、`HOST` 为 loopback | 现有固定本机用户 | 不加载 Clerk |
| 生产容器契约 | 只认 live Clerk | 使用生产公钥，旁路关闭 |

本地 `.env` 可以继续保存生产或开发用的 Clerk 密钥。`dev:local` 不得把 `VITE_CLERK_PUBLISHABLE_KEY` 传给 Vite，并必须把 `DEV_BYPASS_AUTH` 固定为 `true`。Vite 已存在的环境变量优先于 `.env.local`，所以要在启动进程里显式覆盖为空，不能只依赖“不复制密钥”。

## Flow

1. 浏览器打开 `/`。
2. 本地前端没有 Clerk 公钥，会话层直接请求 `/api/campus/auth/status`，不等待 Clerk SDK。
3. 后端在 development + campus-local + loopback + `DEV_BYPASS_AUTH=true` 时允许本机身份，即使 `CLERK_SECRET_KEY` 有值。不进入 `clerkMiddleware`。
4. 状态返回 `mode: local`、`authenticated: true`。`CampusApp.jsx` 现有的未登录跳转不触发，渲染首页。
5. 本地访问 `/login`、`/register`、`/verify-email` 时，在认证页确认 `mode === local` 后重定向到安全的 `returnTo`，默认 `/`。
6. 生产仍走现有 Clerk 分支。`assertCampusStartup` 继续拒绝生产旁路。

## Compatibility

- 保留 `evaluateLocalBypass` 的 Host、Origin 和安全方法检查。不信任 `X-Forwarded-*`。
- 本机用户仍由 `localDevUser` 生成，忽略客户端传入的 uid，且不是管理员或教师。
- `frontend/src/campus/__tests__/CampusApp.test.jsx` 里 Clerk 匿名首页跳转、深链不跳转、basename 只加一次，都保持。
- 改变 `.trellis/spec/project/campus-phase1/wsl-local.md` 的“有密钥即正式联调”：该规则只保留给生产。实现完成后再改规范，不在规划阶段改。
- `backend/src/config/__tests__/localDevIdentity.test.js:85-91` 要改成区分 development 与 production，不能整段删除。

## Trade-off

同一条 `dev:local` 不能再顺便验收真实 Clerk 登录。真实登录只在生产配置下验收。这是用户要求的环境分离，不另加“本地可选 Clerk”开关，避免密钥再次把本地拉回 15 位密码页。

## Rollback

恢复三处选择器即可：`dev-local.mjs` 在有密钥时关闭前端旁路；`evaluateLocalBypass` 在有密钥时拒绝旁路；认证页不再因 `mode === local` 离开登录路由。生产契约不用回滚。

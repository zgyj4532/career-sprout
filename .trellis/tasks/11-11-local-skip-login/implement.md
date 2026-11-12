# 本地跳过登录并分离测试与生产环境

## Checklist

1. 在 `backend/src/config/localDevIdentity.js` 中，仅对 development + campus-local + loopback + `DEV_BYPASS_AUTH=true` 忽略 `CLERK_SECRET_KEY`。生产、staging、非 loopback、开关关闭时仍拒绝旁路。
2. 更新 `backend/src/config/__tests__/localDevIdentity.test.js`：development 有密钥仍给本机身份；production 有密钥或旁路打开时启动失败。
3. 在 `scripts/local/dev-local.mjs` 中强制后端 `DEV_BYPASS_AUTH=true`，并让 Vite 进程的 `VITE_DEV_BYPASS_AUTH=true`、`VITE_CLERK_PUBLISHABLE_KEY` 为空。不要打印密钥。
4. 本地 `mode === local` 时，`frontend/src/campus/pages/AuthPage.jsx` 重定向到 `safeReturnTo` 的结果，不渲染 Clerk 或邮箱表单。
5. `frontend/src/campus/auth.jsx` 的本机导航只保留本机身份说明，去掉“注册 / 登录正式账号”。
6. 为本地已认证首页和 `/login` 离开登录页补前端测试。保留 `CampusApp.test.jsx` 的 Clerk 匿名跳转用例。
7. 实现通过后，把 `wsl-local.md` 的两种鉴权模式改成按运行时选择，而不是按本地是否填了密钥。

## Validation

在 WSL、Node 24.14.1 下串行执行：

```sh
node --test backend/src/config/__tests__/localDevIdentity.test.js
npm test --prefix frontend -- src/campus/__tests__/CampusApp.test.jsx src/campus/__tests__/auth.test.jsx src/campus/pages/__tests__/AuthPage.registration-disabled.test.jsx --maxWorkers=1 --no-file-parallelism
```

然后重启 `dev:local`，用浏览器打开 `http://127.0.0.1:5173/`。通过标准见 `prd.md` 的验收条目。不要把生产 Clerk 的 8 位策略写成代码断言。

## Rollback points

- 第 1 步后：生产测试必须先绿，再改前端。
- 第 3 步后：确认启动日志和 doctor 输出不含密钥值。
- 前端改动后：先跑上面的 Vitest，再做浏览器确认。

## Risky files

- `backend/src/middleware/auth.js`：只在旁路判断已允许时保持跳过 Clerk；不要放宽 `enforceAuth`。
- `frontend/src/campus/CampusApp.jsx`：不要把非首页深链改成强制登录或强制首页。
- `scripts/local/configure-server.ps1`：生产准备脚本不要改成允许旁路。

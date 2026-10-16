# 校园本地版：WSL 启动

本文件描述本阶段新增的本地命令，不是上游 README 的启动说明。

## 环境

- 复用已有 Ubuntu 24.04 WSL，不重装、不注销。
- 代码留在当前仓库 `/mnt/e/github/career-pilot`。不要把 Windows 的 `node_modules` 拷进 WSL。
- Node 优先 `24.14.1`（`.nvmrc`）。系统 Node 20 仍能跑脚本，但安装和启动会优先改用 nvm 里的 24。
- Python 使用系统 `python3` 3.12，不替换系统 Python。
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

## 身份

没有 Clerk 密钥时，`setup:local` 生成的本地配置会打开 `DEV_BYPASS_AUTH`。它只在 `NODE_ENV=development`、`APP_PROFILE=campus-local`、监听 `127.0.0.1`，且变更请求的 `Origin` 是本机前端时生效。它不是注册，也不是多用户隔离。已配置 `CLERK_SECRET_KEY` 时旁路关闭，正式认证仍走 Clerk。

## 不要做的事

- 不要把 `HOST` 改成 `0.0.0.0` 后用开发身份做局域网或公网演示。
- 不要运行根目录旧的 `docker compose up` 来代替 `infra:up`；那会启动完整后端并暴露 27017/6379。
- 不要在没有 AI/ASR 密钥时把失败页面当成通过。

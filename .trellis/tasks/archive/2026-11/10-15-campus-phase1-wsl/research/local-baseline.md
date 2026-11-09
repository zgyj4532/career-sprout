# 本地基线

记录时间：2026-10-15。实际 HEAD：`0f0be2c176b3dd08ba8a574b75a6c9003ce86c61`。分支：`feat/campus-phase1-wsl`。远端：`origin https://github.com/anurag3407/career-pilot.git`。未跟踪的 `phase1-kit/` 保留，没有 fork 到其他账号。

## 环境

- WSL：Ubuntu-24.04，Linux `6.18.33.2-microsoft-standard-WSL2`
- Linux Node：`/usr/local/bin/node` v20.20.2；nvm 另有 v22.23.2 与 v24.14.1
- npm：10.8.2（系统）/ 11.11.0（Node 24）
- Python：`/usr/bin/python3` 3.12.3
- Docker：29.7.2，Compose v5.4.0，daemon 可用，当时没有运行中的容器
- Trellis：未预装。已安装 `@mindfoldhq/trellis` 0.6.17，并用 `trellis init -u campus-dev --omp -y --skip-existing` 初始化 Oh My Pi 平台
- 任务目录：`.trellis/tasks/10-15-campus-phase1-wsl`
- 会话绑定：`TRELLIS_CONTEXT_ID=omp-campus-phase1-20261015-session`

## 端口

当时监听：DNS、`127.0.0.1:7676` node、`127.0.0.1:4040` ngrok。5173/5002/27018/6380 未见占用。

## 与方案研究记录不一致的本地事实

- `docker-compose.yml` 存在，不是 404。它使用 mongo 6.0、Redis 7、后端 5001，不是本阶段端口。
- 根 `.env.example` 仍是 Firebase 前端模板；`frontend/.env.example` 同时有损坏的 Firebase 行和 Clerk 公钥说明。
- `backend/.env.example` 的 `PORT=5000`，`index.js` 默认 5002，Vite 代理 5002。

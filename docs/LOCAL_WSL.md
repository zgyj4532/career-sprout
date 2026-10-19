# 职芽 CareerSprout：WSL 启动与排障

本文件描述校园入口，不是上游完整职业平台的启动说明。

## 环境

- 复用已有 Ubuntu 24.04 WSL，不重装、不注销。
- 当前仍在 `/mnt/e/github/career-pilot`（Windows：`E:\github\career-pilot`）。目标目录是 `career-sprout`，但当前omp主会话持有目录句柄，Windows/WSL改名均被拒绝。关闭此会话及占用旧目录的终端后，可在PowerShell运行 `powershell -NoProfile -ExecutionPolicy Bypass -File E:\github\rename-careersprout.ps1`；脚本只做不覆盖的完整目录改名，不杀进程、不删Git或数据。完成后从 `/mnt/e/github/career-sprout` 运行doctor/dev。不要把Windows的node_modules拷进WSL。
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

正式教师需要验证过主邮箱的Clerk账号，并将UID加入后端 `CAMPUS_TEACHER_UIDS`。权限还受学生授权与定向简历确认版本限制。本地身份不能模拟正式教师权限。

`RESEND_API_KEY`、`RESEND_FROM`、`APP_PUBLIC_URL` 仅为预留；当前邮箱认证接口返回503，不发送邮件、不创建账户或会话。实际发信需要后续完整接入和真实邮箱验收。

## 诊断日志

`logs/backend.jsonl` 记录服务端请求、AI/ASR/PDF阶段；`logs/runtime.jsonl` 记录启动与子进程退出。两者按2MiB或跨日轮转，各保留3份旧日志，已排除入库。`CAMPUS_LOG_DIR` 可用于直接启动后端的私密日志位置；`dev:local` 固定使用仓库logs目录。

页面“技术信息”显示requestId；服务端响应头 `X-Request-ID` 使用同一编号。ASR/PDF还记录阶段及安全错误类别，可区分上传、转换、模型、浏览器启动、字体、打印与解析故障。未知错误不向客户端回显原始堆栈或个人资料。

## 内存与验证

先关闭本项目不需要的服务，串行执行验证。不要同时启动全量测试、构建和浏览器；不要结束其他项目进程。校园前端构建：

```bash
VITE_APP_PROFILE=campus-local NODE_OPTIONS=--max-old-space-size=384 npm run build --prefix frontend
npm test --prefix frontend -- src/campus --maxWorkers=1 --no-file-parallelism
npm run test:campus --prefix backend
```

若使用systemd用户会话，可给单个验证命令设置 `MemoryHigh`、`MemoryMax`、`MemorySwapMax`，约束整个子进程树；仍需检查Windows主机余量，WSL的available不能与Windows余量相加。降低堆上限可能让单个命令失败，不是成功证明；检查真实原因后再调整。

PDF和ASR全进程单任务，忙时429而不是无限积压；取消会释放已获得的资源。ASR最长180秒、上传10MiB、解码后6MiB上限。WebM等压缩录音需要 `FFMPEG_PATH` 指向可运行的ffmpeg；现有WSL默认尝试Windows Scoop的ffmpeg。不要将缺转码器错误当作录音成功。

改名只改代码路径和拥有的GitHub仓库；数据库 `career_pilot_local`、Compose项目 `career-pilot-local` 及卷名不变。旧资料应在迁移后重新读取确认，不执行 `down -v`。


## 不要做的事

- 不要把 `HOST` 改成 `0.0.0.0` 后用开发身份做局域网或公网演示。
- 不要运行根目录旧的 `docker compose up` 来代替 `infra:up`；那会启动完整后端并暴露 27017/6379。
- 不要在没有 AI/ASR 密钥时把失败页面当成通过。

<div align="center">
  <h1>Career Pilot · 校园本地版</h1>
  <p><strong>在已有 WSL 里跑的精简练习站：中文简历、岗位文本、普通语音面试和历史档案。</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-24.14.1-339933?logo=node.js&logoColor=white" alt="Node.js"/>
    <img src="https://img.shields.io/badge/Express-campus%20entry-000000?logo=express&logoColor=white" alt="Express"/>
    <img src="https://img.shields.io/badge/MongoDB-local-47A248?logo=mongodb&logoColor=white" alt="MongoDB"/>
    <img src="https://img.shields.io/badge/Redis-local-DC382D?logo=redis&logoColor=white" alt="Redis"/>
    <img src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" alt="React"/>
    <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite"/>
    <img src="https://img.shields.io/badge/loopback-127.0.0.1-0f6e56" alt="Loopback"/>
  </p>
  <p>
    上游 <a href="https://github.com/anurag3407/career-pilot">anurag3407/career-pilot</a>
    · 基线 <code>0f0be2c1</code>
    · 说明 <a href="docs/LOCAL_WSL.md">本地启动</a>
    · License <a href="LICENSE">MIT</a>
  </p>
</div>

---

这不是上游完整职业平台的发行版。上游 README 里的 Firebase、端口 5000、`Docker-compose.yml`、支付和作品集部署，不适用于本分支。本分支只在本机回路跑一个校园练习壳。

## 目录

- [这是什么](#这是什么)
- [保留与关闭](#保留与关闭)
- [页面](#页面)
- [本地启动](#本地启动)
- [端口](#端口)
- [身份与密钥](#身份与密钥)
- [目录结构](#目录结构)
- [验收边界](#验收边界)
- [许可证](#许可证)

## 这是什么

给大学生在本机练习三件事：写一份中文简历并导出 PDF，粘贴岗位描述做对照，做一场普通语音面试并留下历史。没有配好的服务会直接说明，不会装成已经成功。

技术栈仍是 React/Vite、Express、MongoDB、Redis。没有换成别的框架，也没有把数据库从 MongoDB 迁走。

## 保留与关闭

| 保留 | 关闭 |
|---|---|
| 简历编辑、保存、重读、导出中文 PDF | 作品集、社区、支付、爬虫 |
| 粘贴岗位描述；有密钥时做技能对照 | 招聘网站抓取、邮件、部署、同步任务 |
| 普通语音面试、转写、回答反馈、总评 | 编程题、直播电话、长期保存音频 |
| 个人档案、历史档案的重命名和删除 | 局域网或公网开放本地开发身份 |

## 页面

| 路径 | 作用 |
|---|---|
| `/` | 欢迎大厅。四个入口，没有侧栏。 |
| `/resume` | 简历工作台。左边编辑，右边已保存列表。 |
| `/interview` | 开始一场中文面试。 |
| `/interview/session/:id` | 深色面试间。题目说完后手动录音或打字。 |
| `/jd` | 只接受粘贴的岗位描述。 |
| `/profile` | 姓名、技能、年级。 |
| `/history` | 历史档案。可以重命名，删除前要确认。 |

电脑上的内页使用左侧导航。窄屏改成底部四宫格。面试间不套这层导航。

## 本地启动

在已有 WSL 的仓库根目录：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run doctor
npm run setup:local
npm run infra:up
npm run dev:local
```

浏览器打开 `http://127.0.0.1:5173`。

停止：

- `Ctrl+C` 只结束这一次前后端进程，不删除数据库卷。
- `npm run infra:down` 停止本项目的 MongoDB 和 Redis，不使用 `-v`。

不要用上游的 `docker compose up` 代替 `infra:up`。那会启动完整后端，并占用另一组数据库端口。

## 端口

| 服务 | 地址 |
|---|---|
| Vite | `127.0.0.1:5173` |
| 校园 API | `127.0.0.1:5002` |
| MongoDB | `127.0.0.1:27018` |
| Redis | `127.0.0.1:6380` |

前端的 `/api` 代理到 `127.0.0.1:5002`。端口被占用时命令失败，不会结束别人的进程。

## 身份与密钥

没有 Clerk 密钥时，本地配置可以打开 `DEV_BYPASS_AUTH`。它只在 `NODE_ENV=development`、`APP_PROFILE=campus-local`、监听 `127.0.0.1`，并且变更请求来自本机前端时生效。这不是注册，也不是多用户验证。

已配置 `CLERK_SECRET_KEY` 时，开发旁路关闭，正式认证仍走 Clerk。不要把 `HOST` 改成 `0.0.0.0` 后用开发身份做局域网或公网演示。

文本模型走 OpenAI 兼容代理。语音转写走 Qwen ASR。没有对应密钥时，页面和接口报告不可用，不返回假答案或假转写。环境样例见 `backend/.env.example`。不要提交真实的 `.env`。

## 目录结构

```text
career-pilot/
├── backend/src/campusServer.js   # 校园 API 入口
├── frontend/src/campus/          # 欢迎大厅、工作台、面试间
├── compose.local.yml             # 只跑本项目 MongoDB / Redis
├── scripts/local/                # doctor、setup、infra、dev、verify
├── docs/LOCAL_WSL.md             # 启动细节
└── docs/evidence/phase1/         # 已跑过的冒烟和面试流程证据
```

上游的页面和路由仍在仓库里。校园入口不加载已关闭模块，也不启动它们的后台任务。

## 验收边界

已在本机核对的内容写在 `docs/PHASE1_REPORT.md` 和 `docs/PHASE1_1_REPORT.md`。那里没有标成通过的项，不要在这里补成通过。

当前明确未完成：

- Clerk 正式注册和两个真实账号。
- 真人用麦克风把一场面试从头走到尾。
- 公网部署。本分支不部署。

## 许可证

上游代码仍按 [MIT](LICENSE) 分发。本分支是在该基线上的本地精简，不是上游作者提供的校园发行版。

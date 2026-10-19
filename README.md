<div align="center">
  <h1>职芽 · CareerSprout</h1>
  <p><strong>从现在开始，让每一次练习长成未来。</strong></p>
  <p>面向大学生的 AI 职业成长助手：找方向、整理经历、做简历、练面试和授权荐才。</p>
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
    · 本项目 <a href="https://github.com/zgyj4532/career-sprout">zgyj4532/career-sprout</a>
    · 基线 <code>0f0be2c1</code>
    · 说明 <a href="docs/LOCAL_WSL.md">本地启动</a>
    · License <a href="LICENSE">MIT</a>
  </p>
</div>

---

职芽面向所有年级，优先让大一大二新手也能独立使用；已有简历的高年级学生可直接进入练习。当前仍使用安全的 WSL 本地运行方式，不是上游完整平台的发行版。上游 Firebase、端口 5000、支付和作品集部署说明不适用于校园入口。

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

从真实课程、社团、项目或实习经历起步，按保存进度获得下一步建议。岗位可人工录入并由 AI 整理技能要求；简历支持口述转写、建议对照与确认采纳；面试录音有明确状态，转写校对后才提交。学生可授权教师按技能和时间匹配岗位，并下载学生确认过的定向版本。未配置服务明确不可用，不返回假结果。

技术栈仍是 React/Vite、Express、MongoDB、Redis。没有换成别的框架，也没有把数据库从 MongoDB 迁走。

## 保留与关闭

| 已实现的校园能力 | 未启用或不在当前范围 |
|---|---|
| 成长档案、技能自评、可实习时间、岗位录入与分析 | 招聘爬虫、学校教学报表、社区与支付 |
| 口述/文本简历润色、确认、保存、中文 A4 PDF | 编造经历、自动采纳AI结果、永久保存音频 |
| 中文语音面试、转写校对、显式提交、历史反馈 | 真实电话拨号、编程题和视频表情评分 |
| 学生授权、教师匹配、定向版本确认和ZIP导出 | 公开学生资料目录、自动邮件外发简历 |
| 中文注册/登录/验证界面、已有 Clerk 正式路径 | Resend 发信/身份签发：仅预留，尚未启用 |

## 页面

| 路径 | 作用 |
|---|---|
| `/` | 一个明确下一步；点击口号可切换 React Bits 彩蛋。 |
| `/resume` | 整理真实经历、语音补充、AI建议对照、保存/PDF及定向版本确认。 |
| `/interview` | 选择保存的简历、岗位和练习类型。 |
| `/interview/session/:id` | 明确录音开始/结束，转写校对，确认提交，再生成总评。 |
| `/jd` | 校园岗位录入、发布、AI技能整理和差距查看。 |
| `/profile` | 基本档案、经历、自评、时间及教师授权/撤回。 |
| `/history` | 已保存面试、重命名、确认删除和反馈。 |
| `/login`、`/register`、`/verify-email` | 正式账号入口与真实可用状态；Resend未启用时不发信。 |
| `/teacher` | 仅限已验证且被服务端授权的教师，查看获学生授权的候选材料。 |

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

教师需将真实 Clerk UID 加入服务端 `CAMPUS_TEACHER_UIDS`，且主邮箱已验证；本地开发身份永不升级为教师。学生另行授权，修改简历或岗位会使旧定向版本失效，需要重新生成/确认。

`RESEND_API_KEY`、`RESEND_FROM`、`APP_PUBLIC_URL` 是后续接入预留，填写后也不会自动启用邮件认证；当前相应接口返回 `503 EMAIL_AUTH_NOT_CONFIGURED`。不要把Resend当作完整身份系统。

## 日志与排障

- 服务端：`logs/backend.jsonl`；本地启动器：`logs/runtime.jsonl`。单文件2MiB或跨日轮转，最多保留3个旧文件，目录已被Git忽略。
- 页面错误可展开“技术信息”复制诊断编号，或下载最多200条前端事件。按 `requestId` 关联请求、AI/ASR/PDF阶段与结果。
- 日志只保留受限事件、字段名/错误码、耗时、字节数和安全异常类别，不记录密钥、验证链接、音频、口述和简历全文。
- PDF与ASR均为全进程单任务准入；繁忙时返回429，不无限排队。录音最长3分钟，上传最大10MiB；PDF一般一页、最多第二页上半页，超长明确拒绝且不截断。
- 低内存时不要同时跑构建、测试、浏览器和导出。校园构建在配置期隔离上游大模块；不要靠取消内存限制解决问题。


## 目录结构

```text
career-pilot/                    # 本地目录仍被当前会话锁定，目标为 career-sprout
├── backend/src/campusServer.js   # 校园 API 入口
├── frontend/src/campus/          # 分流程页面、录音状态与口号彩蛋
├── backend/src/campus/           # 岗位、私密档案、授权、定向版本与匹配
├── compose.local.yml             # 只跑本项目 MongoDB / Redis
├── scripts/local/                # doctor、setup、infra、dev、verify
├── docs/LOCAL_WSL.md             # 启动细节
└── docs/evidence/phase1/         # 已跑过的冒烟和面试流程证据
```

上游的页面和路由仍在仓库里。校园构建只解析校园入口与普通CSS，不扫描未启用的作品集模板；原上游入口仍保留。Mongo数据库、Compose project和卷名继续使用历史 `career-pilot-local` / `career_pilot_local` 标识，避免改名丢失数据。

GitHub已改为 `zgyj4532/career-sprout`，仍保留原fork和提交历史。本地改名被当前omp会话的目录锁阻止，未强杀或复制替代；关闭会话后使用 `E:\github\rename-careersprout.ps1`，具体操作见本地启动说明。校园体验改造与轻量修正发布在 `feat/career-sprout-experience-polish`；后续导入、截图识别和流程合并见 GitHub Issue #1，复杂能力仍须讨论后实施。

## 验收边界

本轮实际结果见 `.trellis/tasks/10-18-student-career-experience/research/verification.md`。已验证真实模型/ASR、浏览器交互、中文PDF与隔离授权ZIP；测试使用的合成身份和语音不是真人使用证据。历史基线报告仍保留在 `docs/PHASE1_REPORT.md` 和 `docs/PHASE1_1_REPORT.md`，不覆盖原记录。

当前明确未完成：

- Clerk正式师生账号端到端联调：当前缺少真实配置；隔离权限测试不替代正式账户验收。
- 真人麦克风/扬声器质量与真实手机：受控浏览器音轨和模拟视口仅验证状态及布局。
- Resend实际邮件送达和公网部署：本轮未启用。
- 后端全量lint仍有停用上游模块的既存错误，具体结果见验证记录，不宣称全仓全绿。

## 许可证

上游代码仍按 [MIT](LICENSE) 分发。本分支是在该基线上的本地精简，不是上游作者提供的校园发行版。

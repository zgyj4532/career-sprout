# Phase 1.1 报告

## 当前汇总 — 2026-10-23

下方为2026-10-15及其当时续记，保留原始通过/失败与请求证据。首段“没有配置AI/语音”只是早期状态，后文已有真实模型与Qwen ASR成功记录；当前不据此重复判为缺失。日志现行说明见 [LOCAL_WSL](LOCAL_WSL.md#诊断日志)，不要将旧堆栈示例视为当前公开错误输出契约。

工程收尾入口为 `npm run verify:phase1`，包括隔离非 AI 冒烟与自有后端重启持久化；旧无参 `check-persist.mjs` 及固定历史 ID 不再是当前操作方法，见 [工程验收入口](LOCAL_WSL.md#工程验收入口)。主验收执行者最终运行退出0，9个本地必需门 PASS：20项脚本、116项后端校园、148项共享、166项前端（28文件），校园构建通过；限定 lint 0错误，后端11/前端20项警告保留。隔离重启持久化与全部清理 PASS；另一次实际 SIGTERM 冒烟按预期退出143，清理均 PASS。见 [本轮验证记录](../.trellis/tasks/10-22-engineering-acceptance-closeout/research/verification.md) 与 [最终运行 JSON](evidence/phase1/runs/2026-10-23T16-14-46-510Z-ee3fc51f/verify-phase1.json)。`fullAcceptance=false`：本地工程通过不等于全量上游或外部真实验收通过。

2026-10-23主验收执行者已在当前 development 校园入口、隔离合成数据库下实际检查首页/简历/面试/反馈360与768模拟视口，均未见横向溢出；证据与截图见 [browser-2026-10-23.json](../.trellis/tasks/10-22-engineering-acceptance-closeout/research/browser-2026-10-23.json) 及同目录。真实保存先遇基础设施不可用，经页面“检查保存结果”恢复后 POST201、仅一份简历、文本保留。反馈为数据库预置合成样本，仅作布局证据，没有模型调用；模拟视口不是真机。

本轮 `gh pr list` 已确认 PR #2、#3、#4 合并，准确合并时间与SHA、后续导入/新手流程历史证据集中在 [第一阶段当前汇总](PHASE1_REPORT.md#当前汇总--2026-10-23)。正式认证选择现有 **Clerk**，此前 Evren/Resend 迁移方向已被替代；真实双账号、邮箱验证、教师授权仍待真实配置/会话验收。新服务器备案/部署继续阻塞新手和物理手机，用户确认的真人录音/扬声器历史记录保持有效，不自动归档。停用模块在整体测试稳定且另行批准前不删除。

## 历史记录 — 2026-10-15及当时续记

结论：本地基线仍可用，扫描超时已修复，私有资源隔离有自动测试。真实 AI、语音和正式账号没有配置，不能标通过，也不具备进入第二阶段的条件。本轮没有人工逐项确认，因此没有 `PASS_HUMAN`。

- 分支：`feat/campus-phase1-wsl`
- HEAD：`0f0be2c176b3dd08ba8a574b75a6c9003ce86c61`（未提交，未推送）
- 时间：2026-10-15
- 任务：`.trellis/tasks/10-15-phase1-1-stabilize-real-flow`，状态 `in_progress`
- 会话：`TRELLIS_CONTEXT_ID=omp-campus-phase11-20261015`
- Trellis：`session_auto_commit: false`。本轮没有自动提交。

## 如何定位错误

校园 API 失败时，服务端打一行，不包含 Authorization、Cookie 或请求体：

```text
[api-error] {"at":"...","requestId":"...","method":"GET","path":"/api/resumes","statusCode":401,"code":"REQUEST_FAILED","name":"Error","message":"Unauthorized"}
```

响应 JSON 同时有 `message`、`error`、`code`、`method`、`path`、`requestId`。500 在非生产环境附带 `stack`。数据库连不上时：

```text
[campus-db] GET /api/resumes <error.message>
```

响应 `code=DATABASE_UNAVAILABLE`。进程起不来时：

```text
[campus-startup] <stack>
```

页面错误文案会拼上 `status`、`code`、`at`、`requestId`。拿 `requestId` 对服务端 `[api-error]` 即可定位同一次请求。

## 扫描超时

修复前，单独运行：

```bash
cd frontend && npx vitest run src/__tests__/dangerouslySetInnerHTML.test.js --reporter=verbose
```

- 退出码：1
- 墙钟：40.80s
- Vitest：`tests 10.68s`，默认超时 5000ms
- 错误：`Test timed out in 5000ms`，位置 `dangerouslySetInnerHTML.test.js:31`
- 扫描范围：`frontend/src/components/portfolio/templates`，1150 个 jsx/tsx
- 该测试和模板目录不在本分支 diff 里。失败出在当前工作区的原测试，不是本阶段新改出来的断言。未做另一台机器的上游对照，所以不写成“上游 CI 必然失败”。

根因：旧实现对每个条目 `stat`，再读全文。在 `/mnt/e` 上读 1150 个文件约 9.8–10.7s，超过 5s。

修复：一次递归 `readdir`，仍检查全部 `.jsx`/`.tsx`，白名单仍为空，断言仍要求零违规。有限超时改为 30000ms，不是关闭超时。

修复后同一命令：

- 退出码：0
- 测试耗时：9769ms
- `Test Files 1 passed`，`Tests 1 passed`
- 违规数：0

## 私有资源隔离

命令：

```bash
cd backend && node --test --test-timeout=90000 src/campus/__tests__/campusIsolation.test.js
```

- 退出码：0
- 3 通过，0 失败
- 用内存 Mongo，不碰本机数据库卷

未登录 `GET` 简历列表、简历详情、面试历史、面试详情、`/api/user-profiles/me` 都是 401。示例：

```text
[api-error] {"requestId":"35454ac4-e1ef-44a1-bf7b-091bc3f88f7f","method":"GET","path":"/api/resumes","statusCode":401,"code":"REQUEST_FAILED","message":"Unauthorized"}
```

本地身份 B 访问 A 的资源：

| 操作 | 状态 | requestId |
|---|---|---|
| 列表 | 200，不含 A 的 id | — |
| 详情 | 404 Resume not found | `77bb10a1-f7f0-4e2d-9702-7d1f15d65915` |
| 更新 | 404 | `c95a8484-d591-4dcd-ae5c-f66993b79238` |
| 删除 | 404 | `cf9b3b58-56ae-46e9-bfe5-5ab18b5b2e88` |
| 导出 | 403 Access denied | `aed0566b-644a-4073-b799-340908965ef3` |
| 面试详情 | 404 Interview not found | `d4438b7f-20b1-4490-b33d-d4ad2ffbf168` |

A 的简历标题在这些请求后仍是 `isolation-a`。

无效 Clerk 密钥不会打开本地旁路。`CLERK_SECRET_KEY=sk_test_not_a_real_session` 时 `GET /api/resumes` 返回 500，不是 200，也没有 `data`。日志：

```text
requestId=ce39a0df-f961-4177-a302-302f47925a09
statusCode=500
code=INTERNAL
message=Publishable key is missing...
```

这是失败关闭，不是开发身份。正式注册登录仍未测。

另外：

```bash
node --test src/config/__tests__/localDevIdentity.test.js src/campus/__tests__/campusProfile.test.js src/middleware/__tests__/globalErrorHandler.test.js
```

退出码 0，14 通过。生产/staging 和非回路绑定仍拒绝。

## 冒烟与持久化

```bash
node scripts/local/smoke-phase1.mjs
```

退出码 0。证据：`docs/evidence/phase1/smoke-phase1.json`，时间 `2026-10-15T12:34:09.057Z`。

| 项 | 结果 |
|---|---|
| health | PASS，200，database true，redis true |
| payments | PASS，404 |
| 远程 Host | PASS，401 |
| 创建简历 | PASS，201 |
| 读取简历 | PASS，200 |
| PDF | PASS，40018 字节 |
| 粘贴 JD | PASS，200 |
| URL 抓取 JD | PASS，404 |
| skill-gap | BLOCKED_EXTERNAL，403 |
| 开始面试 | BLOCKED_EXTERNAL，403 |

```bash
node scripts/local/check-persist.mjs
```

退出码 0。`resumeStatus=200`，`kept=true`。没有重建容器，也没有清卷。

## 状态

| 项 | 状态 | 说明 |
|---|---|---|
| 模板 innerHTML 扫描 | PASS_AUTO | 9769ms，退出码 0 |
| 未登录私有读取 | PASS_AUTO | 401 |
| B 不能读写 A | PASS_AUTO | 404/403，数据未改 |
| 无效 Clerk 不走旁路 | PASS_AUTO | 500，无 data。不是正式登录通过 |
| 保存、重读、PDF、受限路由 | PASS_AUTO | smoke 退出码 0 |
| 重启后简历仍在 | PASS_AUTO | persist 退出码 0 |
| 真实文本模型 | PASS_AUTO | OpenAI 客户端的 `baseURL` 是 `api.vibekey.cn`，模型 `gpt-6.1-sol`。调用返回 `pong`，5788ms。不是官方 `api.openai.com`。 |
| 语音转写 | PASS_AUTO | 代理的 `/audio/transcriptions` 返回 404。转写改走 Qwen `qwen3-asr-flash`。直播接口 `POST /api/interview/transcribe` 200，文本是「欢迎与使用阿里云。」，requestId `chatcmpl-b9aa4a8b-51f1-9d96-b55c-05ee5e046453`。这不是真人麦克风验收。 |
| 正式双账号 | BLOCKED_EXTERNAL | 无 Clerk 密钥。模型不能代替登录。 |
| 人工验收 | NOT_RUN | 没有逐项人工反馈，不标 PASS_HUMAN |

早先那份 `smoke-phase1.json` 里的 skill-gap 403 是重启 API 之前的结果。后来的 200 以上面这行为准。

## 是否进入第二阶段

否。文本和转写接口已经能调用。正式账号仍阻塞，真人口语面试和定向简历全流程也还没验完。

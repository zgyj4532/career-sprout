# 第一阶段报告

## 当前汇总 — 2026-10-23

本节优先于下方2026-10-15历史状态；不改写旧命令、退出码和当时缺失配置的事实。当前路径为 `/mnt/e/github/career-sprout`，启动与验收命令见 [LOCAL_WSL](LOCAL_WSL.md)。本轮工程收尾任务为 [10-22-engineering-acceptance-closeout](../.trellis/tasks/10-22-engineering-acceptance-closeout/prd.md)；此文档更新本身没有运行新验证，不把旧证据记为本轮 PASS。

- 本轮主验收执行者通过 `gh pr list` 确认：[PR #2](https://github.com/zgyj4532/career-sprout/pull/2) 于 `2026-10-19T15:45:14Z` 合并，SHA `45482edd6b5cc87df7bc1be8cb86f7f08d44237f`；[PR #3](https://github.com/zgyj4532/career-sprout/pull/3) 于 `2026-10-22T05:12:04Z` 合并，SHA `9f2866883530faf858e081416a71897e3f496c21`；[PR #4](https://github.com/zgyj4532/career-sprout/pull/4) 于 `2026-10-22T05:12:22Z` 合并，SHA `472b78fab4ec9aa95cf7ddb2e12dcaaeece1addc`。导入/截图范围关联 [Issue #1](https://github.com/zgyj4532/career-sprout/issues/1)；合并不等于全部产品验收通过。
- 2026-10-20导入证据见 [verification.md](../.trellis/tasks/10-20-resume-import-polish-jobs/research/verification.md)；2026-10-21新手流程、真实模型/API与390/1440模拟视口证据见 [verification.md](../.trellis/tasks/10-21-novice-usability-information-reduction/research/verification.md)。已有模型/ASR结果不再按最初“缺密钥”状态描述，也不证明今天的服务可用性。
- 当前正式认证继续现有 **Clerk**，取代 Evren/Resend 迁移方案。真实凭据/双账号会话不足时仍 `BLOCKED_EXTERNAL`；隔离身份不是正式注册验收。
- 新服务器备案/部署仍阻塞3–5名新手与物理手机验收。用户于2026-10-20确认此前周日的真人录音/扬声器测试，保留原范围；不推断每项清单全部通过。
- 2026-10-23实际浏览器：当前 development 校园入口、隔离合成数据库下，首页/简历/面试/反馈的360与768模拟视口均未见横向溢出。截图与 [browser-2026-10-23.json](../.trellis/tasks/10-22-engineering-acceptance-closeout/research/browser-2026-10-23.json) 保留在本轮任务 `research/`。真实保存最初遇基础设施不可用，页面可见的“检查保存结果”恢复后 POST 返回201，仅创建一份简历且文本保留。反馈由数据库预置合成数据，仅证明布局，不是新模型调用或正式账号/真机验收。
- 环境诊断补充：主验收执行者观察到本机 WSL 在没有持续存活的 WSL 进程时，会在有限命令调用之间停止发行版服务/容器；上述首轮基础设施不可用属于宿主生命周期，不记为应用缺陷。保留自有 WSL 进程并重启本项目基础服务后恢复健康。该临时保活不是产品部署配置，结束时应清理自有保活并恢复初始基础服务停止状态；此处不提前声称清理完成。
- 主验收执行者最终运行 `npm run verify:phase1` 退出0，9个本地必需门均 PASS：脚本测试20项、后端校园116项、共享148项、前端166项（28文件），校园构建通过；限定范围 lint 为0错误，保留后端11项、前端20项警告。隔离冒烟的后端重启/持久化及全部自有资源清理 PASS；另一次实际 SIGTERM 冒烟按预期退出143，清理均 PASS。完整分项见 [本轮 verification.md](../.trellis/tasks/10-22-engineering-acceptance-closeout/research/verification.md) 与 [最终运行 JSON](evidence/phase1/runs/2026-10-23T16-14-46-510Z-ee3fc51f/verify-phase1.json)。这是本地工程通过，`fullAcceptance=false`；不代表全量上游检查、真实 Clerk、供应商或真人/真机验收全部通过。
- 停用源码维持 `DISABLED` / `KEEP_PENDING_AUDIT`。整体测试稳定且用户另行批准前不删除模块、不卸依赖、不自动归档阻塞任务。

## 历史记录 — 2026-10-15

结论：本地基线可用，真实外部功能验收未完成。当前只适合本机开发，不是已完成的课程产品。

- 分支：`feat/campus-phase1-wsl`
- HEAD：`0f0be2c176b3dd08ba8a574b75a6c9003ce86c61`（未提交）
- 时间：2026-10-15
- 环境：Ubuntu 24.04 WSL，Node v24.14.1，npm 11.11.0，`/usr/bin/python3` 3.12.3，Docker 29.7.2，Trellis 0.6.17，平台 `--omp`
- 任务：`.trellis/tasks/10-15-campus-phase1-wsl`，状态保持 `in_progress`。B 项阻塞，不归档。

## 启动与停止

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
cd /mnt/e/github/career-pilot
npm run doctor
npm run setup:local
npm run dev:local
```

停止前后端：在 `dev:local` 终端按 `Ctrl+C`。停止本项目数据库且保留卷：

```bash
npm run infra:down
```

访问：`http://127.0.0.1:5173`，API `http://127.0.0.1:5002`。本次执行结束时这两个进程和 `career-pilot-local` 容器仍在运行。

## 验收

| ID | 状态 | 证据 |
|---|---|---|
| A01 | PASS | doctor 退出码 0；Node 24.14.1；Python `/usr/bin/python3` 3.12.3 |
| A02 | PASS | `task.py validate` 成功，implement/check 各 10 条 |
| A03 | PASS | `infra:up` 退出码 0，二次执行为容器重建后健康；API 监听 `127.0.0.1:5002` |
| A04 | PASS | 简历 `6ad07b39638c2cf6e2b0fdeb` 在 API 重启和容器重建后内容一致 |
| A05 | PASS | 未配置邮件、支付、爬虫、Clerk、AI，核心接口仍可启动 |
| A06 | PASS | `/api/payments` 404 `CAMPUS_DISABLED`；URL 抓取 JD 被拒绝 |
| A07 | PASS | 生产/staging/非回路绑定单测拒绝；远程 Host 401 |
| A08 | PASS | 远程 Host 不落入开发身份。正式 Clerk 未登录多账号未测 |
| A09 | PASS | 保存、重读、PDF 文本含「测试同学」「校园测试简历」 |
| A10 | PASS | 360/390/768/1440 模拟视口无横向溢出。真机 NOT_RUN |
| A11 | PASS | 无 AI key 返回 403 `requireApiKey`，页面保留输入 |
| A12 | 部分 | 后端 `npm test` 405 通过。校园构建 0。前端 Vitest 1 个上游超时失败 |
| B01-B02 | BLOCKED_EXTERNAL | 无 Clerk 密钥 |
| B03-B06 | BLOCKED_EXTERNAL | 无 AI/ASR 密钥；未做真人录音和中文音色实机确认 |
| C01 | NOT_RUN | 未做可信 HTTPS 真机 |
| C02 | 不声称 | 校园业务、上线和真人使用未做 |

## 命令

| 命令 | 退出码 |
|---|---|
| `npm run doctor` | 0 |
| `npm run setup:local` | 0 |
| `npm run infra:up` | 0 |
| `node --test` 校园身份与路由 | 0（9 通过） |
| `node scripts/local/smoke-phase1.mjs` | 0 |
| `node scripts/local/check-persist.mjs` | 0 |
| `backend npm test` | 0（405 通过，0 失败） |
| `frontend npx eslint src/campus src/main.jsx` | 0，7 个既有风格警告 |
| `frontend` campus `npm run build` | 0 |
| `frontend npm test -- --run` | 1。104 通过，1 失败：`dangerouslySetInnerHTML.test.js` 扫描作品集模板超时。未删测试 |
| 浏览器 360/390/768/1440 | 无横向溢出。截图在 `docs/evidence/phase1/` |

PDF 文本：`docs/evidence/phase1/campus-resume.txt`。截图：`docs/evidence/phase1/viewport-*.png`。冒烟：`docs/evidence/phase1/smoke-phase1.json`。

## 配置状态

- Clerk：缺失。本地旁路仅 development + campus-local + `127.0.0.1`。
- AI：Gemini/OpenAI/Groq 均缺失。技能差距和面试开始返回 403，不落假答案。
- ASR/TTS：未用真录音或真耳机验收。页面拒绝把无中文音色当成播报成功。
- 邮件、支付、爬虫、部署密钥：未配置，也不需要。

## 建议提交分组

不要自动提交。

1. `chore: add campus local wsl scripts and compose`
2. `feat: add loopback campus server and dev identity guard`
3. `feat: add chinese campus entry`
4. `docs: record phase1 local baseline and blockers`

Trellis 生成文件和 `phase1-kit/` 可单独一组，避免和业务改动混在一起。

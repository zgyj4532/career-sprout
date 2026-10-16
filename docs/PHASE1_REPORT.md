# 第一阶段报告

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

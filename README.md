<div align="center">
  <h1>职芽 · CareerSprout</h1>
  <p><strong>从现在开始，让每一次练习长成未来。</strong></p>
  <p>面向大学生的 AI 职业成长助手：找方向、整理经历、做简历、练面试和授权荐才。</p>
  <p><a href="docs/LOCAL_WSL.md">本地启动</a> · <a href="docs/MANUAL_ACCEPTANCE.md">使用与验收</a> · <a href="https://github.com/anurag3407/career-pilot">上游</a> · <a href="LICENSE">MIT</a></p>
</div>

职芽面向所有年级，优先让大一大二新手也能独立开始；已有简历可直接导入，没有材料也能先聊兴趣和经历。当前是 **WSL 本地校园入口**，不是上游完整平台发行版，也未完成公网、正式账号和真人新手验收。

## 核心功能

- **了解自己**：无需预填档案的兴趣与经历交流，不打能力分；摘要可编辑确认或暂不保存。
- **整理材料**：导入文字型 PDF、DOCX 或图片，保留原件、来源疑点和恢复入口；不擅自重写已有简历。
- **找方向、做简历**：人工岗位与截图整理、技能差距、真实经历润色、版本保存和中文 A4 PDF；AI 建议需确认采纳。
- **练面试**：复用简历、岗位和准备单；打字与语音转写共用编辑区，确认保存后推进，历史反馈注明评分范围。
- **授权荐才**：学生单独授权或撤回；教师须验证邮箱并获服务端授权，只能查看允许的材料和已确认定向版本。

未配置模型或 ASR 时明确不可用，不返回假答案。支付、社区、爬虫、作品集部署等上游模块未启用；保持 `DISABLED` / `KEEP_PENDING_AUDIT`，**整体测试稳定并另获批准前不物理删除、不卸依赖**。

## 技术栈

React 19 / Vite 7 · Express · MongoDB 8.0 · Redis 7.4 · Node.js 24.14.1 · Clerk。文本模型使用 OpenAI 兼容代理，语音转写使用 Qwen ASR；现有框架、数据库和上游历史均保留。

## 快速启动

在已有 Ubuntu WSL 的仓库根目录运行（不要复用 Windows 的 `node_modules`）：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run doctor
npm run setup:local
npm run infra:up
npm run dev:local
```

打开 `http://127.0.0.1:5173`，API 为 `127.0.0.1:5002`；MongoDB / Redis 为 `127.0.0.1:27018` / `6380`。`doctor` 只读诊断；首次未安装依赖或未启动基础服务的提示按 [本地指南](docs/LOCAL_WSL.md) 处理。`Ctrl+C` 停止本次前后端，`npm run infra:down` 停止基础服务但保留卷。不要使用上游 `docker compose up` 或 `down -v`。

工程验收在同一 WSL / Node 24 下串行运行：

```bash
npm run verify:phase1
# 可选：另列停用上游范围，不掩盖其失败
npm run verify:phase1 -- --include-upstream
```

分项结果、隔离冒烟、报告路径及失败口径见 [LOCAL_WSL](docs/LOCAL_WSL.md#工程验收入口)。这不是正式账号、真实模型、真人或真机全部通过的声明。

**身份与安全：** 2026-10-23 当前批准方向继续使用现有 Clerk，取代此前 Evren/Resend 迁移计划。前端只放公开 `VITE_CLERK_PUBLISHABLE_KEY`，后端私密 `CLERK_SECRET_KEY`；两者来自同一既有 Clerk 应用。配置后关闭开发旁路。无 Clerk 时的本地身份仅限 development + campus-local + loopback，不用于局域网/公网，不是注册或多账号证明。不要提交 `.env` 或把密钥贴到聊天；Resend 预留变量不会启用身份签发。

## 文档与验收状态

- [WSL 启动、配置、日志、内存与发布缓存](docs/LOCAL_WSL.md)
- [产品流程、页面与人工验收清单](docs/MANUAL_ACCEPTANCE.md)
- [第一阶段报告](docs/PHASE1_REPORT.md) / [Phase 1.1 报告](docs/PHASE1_1_REPORT.md)：当前汇总与带日期的历史证据
- [停用模块保留政策](docs/PRUNING_LOG.md)
- [部署容量与外部阻塞](docs/DEPLOYMENT_ASSESSMENT.md) / [私密配置工具](docs/SERVER_CONFIG.md)

真实模型/API、390/1440 模拟视口及用户确认的真人录音已有历史记录；不将它们冒充本轮结果或物理手机验收。正式 Clerk 双账号仍需真实配置与会话；新服务器备案/部署阻塞 3–5 名新手和物理手机验收。全量上游 lint 的既存失败不等于校园范围全绿，也不得通过删除停用模块掩盖。

## 上游与许可

基于 [anurag3407/career-pilot](https://github.com/anurag3407/career-pilot) 的 `0f0be2c176b3dd08ba8a574b75a6c9003ce86c61`；入口结构参考该 [固定版本 README](https://cdn.jsdelivr.net/gh/anurag3407/career-pilot@0f0be2c176b3dd08ba8a574b75a6c9003ce86c61/README.md)，不沿用其 Firebase、5000 端口或完整平台配置。当前仓库为 [zgyj4532/career-sprout](https://github.com/zgyj4532/career-sprout)。保留原 fork、提交历史和 [MIT 许可证](LICENSE)；这不是上游作者提供的校园发行版。

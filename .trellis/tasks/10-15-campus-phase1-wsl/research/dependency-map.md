# 依赖与副作用

## 必须保留

- React/Vite、Express、MongoDB、Redis
- `/api/resumes` 编辑、保存、PDF
- `/api/interview/parse-jd` 的粘贴文本路径
- `/api/enhance/skill-gap`
- `/api/interview` 的开始、转写、回答、历史
- `/api/user-profiles`
- Clerk 正式路径；无密钥时的回路开发身份

## 校园入口不加载

`dev:local` 启动 `backend/src/campusServer.js`，不导入 `index.js`。因此不会执行 `initJobFetcher`、weekly digest、outreach worker、GitHub sync cron、支付路由动态导入或 Socket.IO 初始化。

直接访问下列前缀返回 `CAMPUS_DISABLED`：payments、community、fellowship、portfolio、outreach、job-alerts、fetchjobs、email-tracking、admin、cover-letter、salary、recruiter、bugs、analyzer、readme-generator、project-visualizer、collaboration、roast、webhooks、search、gdpr、job-tracker、auth/2fa。

另外关闭：`/api/interview/:id/run-code`、`/api/resumes/import/*`、`/api/interview/parse-jd` 的 URL 抓取、`/api/enhance/generate-email`、`/optimize-linkedin`、`/career-trajectory`、`/element`。`/element` 在上游失败时会返回伪造润色，校园入口不开放。

## 仍保留在工作树

上述模块文件没有删除。`index.js` 在 `APP_PROFILE=campus-local` 时拒绝启动，避免误开完整后台任务。物理删除留到核心回归之后，当前状态是 KEEP_PENDING_AUDIT。

## 可选密钥

邮件、支付、爬虫、部署、Cloudinary、Clerk、AI、ASR 都不需要就能启动校园入口。没有 AI/ASR 时相关接口返回真实错误，不写假答案。

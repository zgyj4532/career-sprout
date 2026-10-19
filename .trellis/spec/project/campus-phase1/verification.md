# 质量门与真实性

## 基线先行

运行前记录脚本、版本、HEAD、git 状态和环境依赖；关闭外部副作用后运行最小基线。对上游原有失败与本阶段新增失败分别记录。不能删失败测试、降 lint 严格度、忽略退出码或批量改依赖掩盖问题。

## 双层验收

A 工程与本地非 AI 功能：必须有实际执行证据。包括 Trellis 上下文有效、锁定依赖可装、Mongo/Redis 健康、前后端可启动/关闭、简历保存/编辑/重启持久化/中文导出、无关路由与 worker 停用、开发旁路边界、响应式布局与无配置错误反馈。

B 外部服务与真实交互：真实 Clerk 注册/登录、多账号资源隔离、LLM 生成/分析、简历驱动面试、真实录音转写与语音播报、历史记录。凭据与设备具备时必须测试；缺失时准确标 BLOCKED_EXTERNAL/NOT_RUN，不转为 PASS。

只有 PRD 必须项都满足且满足当前 Trellis 完成条件才完成/归档。A 通过而 B 阻塞时报告“本地基线可用，真实功能验收未完成”，任务保持合法未完成/待复核状态。

## 必测失败路径

缺少环境变量、无效 key、模型超时/限流、麦克风拒绝、空录音、过大/非法上传、Mongo 断连、Redis 不可达、5173/5002 被占用、正式模式未登录、错误 owner 访问、生产环境开启本地旁路、禁用业务直接访问 API。

关键路径无法验证时标明其影响，不把其他通过项抹掉；核心请求不允许无限 loading 或返回 200 假成功。

## 浏览器与文件证据

至少 360/390/768/1440 像素视口检查首页、简历表单、面试、反馈；截图注明模拟视口或实机。实际中文简历导出后查看文件和页面，不以 blob 非空代表无乱码/不裁切。初版优先一套 A4 模板与超长提示，不谎称严格满足 1/1.5 页限制。

浏览器工具不可用时明确标 NOT_RUN，不编造截图路径。保存证据前去除真实姓名、email、token 和个人材料；开发用合成数据须标为测试数据，不能算作课程的真人使用证据。

## 报告

每项记录命令、环境、时间、退出码、摘要和证据位置。状态为 PASS/FAIL/BLOCKED_EXTERNAL/NOT_RUN 的是报告状态，不擅自写成 Trellis 未支持的 task.status。输出 lint/build/tests/smoke 分项结果与现存缺陷；未完成项不得被总表“全绿”覆盖。

`.trellis/tasks/<task>/research/` 写研究；`.trellis/workspace/<developer>/` 写会话进展；规范中只沉淀稳定结论。不能只更新任务数量或 todo 然后宣布实现。

## CareerSprout cross-layer contracts (approved follow-on)

### 1. Scope / Trigger

The approved CareerSprout follow-on adds campus-authored jobs, private student material, consented teacher matching, target resume approval, explicit voice review and reserved Resend UI. These approved features supersede the historical Phase1 exclusions only; loopback identity, disabled workers, data preservation and truthful evidence remain required.

### 2. Signatures

- `GET/PUT /api/campus/me`: private CampusStudent extension composed with canonical UserProfile by authenticated UID. Canonical `studyStage` supports explicit empty string; do not force a year.
- `/api/campus/jobs`: authored CRUD, `/analyze`, `/:id/gap`; owner edits, published/own-draft reads.
- `/api/campus/me/resumes/:id/target`, `/me/targets/:id`, `/approve`: independent draft with sourceRevision, jobRevision, revision and approvedRevision.
- `/api/campus/me/sharing[/:teacherId]`, `/teacher/jobs/:id/candidates`, `/export`: student consent, verified teacher permission and current approved version all required.
- `useAudioCapture` drives actual MediaRecorder state; `VoiceInput` performs ASR and explicit adoption; interview answer submission is separate.

### 3. Contracts

New JSON success `{success:true,data}`; errors `{success:false,error,message,code,requestId,details?}`. `X-Request-ID` covers binary/error/limited responses; validation details contain only bounded known `{field,code}`, no submitted values. Existing resume/interview success envelopes stay compatible. New routes never trust client UID or teacher flags.

`CAMPUS_TEACHER_UIDS` is server-only, requires verified Clerk primary email; local bypass cannot be a teacher. `RESEND_API_KEY`/`RESEND_FROM`/`APP_PUBLIC_URL` are reserved and do not activate incomplete auth. `CAMPUS_LOG_DIR` points to private rotated JSONL, not a public path. Logs retain safe event/stage/class/code, never raw prompt/recording/token/URI.

PDF admission is process-wide single-flight, raw input capped before Markdown/HTML parsing. ASR admission happens before upload buffering; upload10MiB, decoded6MiB, duration180s, cancellation propagates to conversion/provider. ZIP max20 targets/25MiB, per-item and final permission/version recheck. Target edits, source changes or job changes invalidate approval.

Campus Vite uses configuration-time `@app-entry`/`@app-styles` aliases. Runtime conditional dynamic imports are insufficient to exclude the upstream template graph. Campus plain CSS and no Tailwind/PWA processing; noncampus entry retains them.

### 4. Validation & Error Matrix

| Condition | Observable result |
| --- | --- |
| Email integration reserved/unavailable |503 EMAIL_AUTH_NOT_CONFIGURED, no email/account/session side effects|
| Signed Clerk user directory outage |503 AUTH_UNAVAILABLE, never local fallback|
| Forged/unverified/local teacher |403 TEACHER_REQUIRED|
| Unknown skill/time |explicit unknown, not zero/failure|
| Stale source/job/target revision |409 SOURCE_CHANGED/JOB_CHANGED/REVISION_CONFLICT; no approved export|
| ASR/PDF already active |429 ASR_BUSY/PDF_BUSY, no unbounded queue|
| Too-long recording/resume |422 with bounded domain code, no truncation|
| Invalid/duplicate fields |400 VALIDATION_FAILED with known field/code details only|

### 5. Good / Base / Bad Cases

Good: new student leaves year/target unknown, records real course evidence, reviews AI changes before adoption. Base: no Resend keys shows a disabled honest email form while local loopback experience remains labelled. Bad: source/job changed during generation or approval cannot be exported under an old confirmation; a granted teacher must not receive another teacher's student material.

### 6. Tests Required

`npm run test:campus --prefix backend` covers isolated owner/consent/revision/atomic answer, blank-stage round trip, resource limits, error templates and unavailable auth. Frontend `npm test --prefix frontend -- src/campus --maxWorkers=1 --no-file-parallelism` covers late permission/unmount, explicit ASR adoption, stale session responses, unsaved empty-body edits and diagnostic redaction. Actual browser/PDF/model/ASR/ZIP smoke is additional proof; synthetic media/trusted test identities never count as real accounts/human microphone.

Profile-cache tests must isolate REDIS_URL before dotenv/app import and close owned cache clients in teardown. Never fix leaked test handles with force-exit or longer timeouts. Serial memory-contained systemd scopes may protect the workstation; retain observed heap-limit failures in reports.

### 7. Wrong vs Correct

Wrong: `onstop -> transcribe -> answer`, or `text changed -> accept late AI result`; correct: `onstart -> visible recording`, `onstop -> transcribe -> editable review -> explicit adoption/submission`, with generation/cancellation guards. Wrong: clean `.git`/rename database identifiers with product branding; correct: rename owned fork/worktree, preserve volume/database identity and keep recoverable history.


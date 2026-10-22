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


## Durable material import (2026-10-20)

### 1. Scope / Trigger

Applies to resume imports, screenshot jobs, ordinary profile edits, resume revisions and preparation recovery. These contracts do not enable scanned-PDF rendering, public recruitment ingestion, Resend identity issuance or automatic adoption.

### 2. Signatures

- `/api/campus/imports`: raw MIME upload; paginated owned list. `/:id` reads/discards; `/source` returns private original; `/continue`, `/confirm`, `/restore`, `/cache` are explicit POST actions.
- `/api/campus/jobs/images`: ordered multipart `images`, at most five PNG/JPEG/WEBP files totaling 10MiB. Owned list/read/source/continue/discard and `/saved {jobId}` retain originals after the private job is persisted. Received order is immutable; reorder/delete before upload.
- `PUT /api/resumes/:id`: mandatory `revision`; title-only writes rename, body writes never accept a title change. `contentRevision` changes only for content, not rename/score/PDF metadata.
- `GET/PUT /api/campus/me/interview-prep`: account-owned preparation, including jobRole/manualRole, resumeId, jobId, mode/count/text and savedJobTitle. `/jd?from=interview` is the UI return flow; `/jobs` is an API segment, not a page route.
- `CAMPUS_IMPORT_DIR`: optional private persistent source root; default `~/.career-sprout/imports`. Never expose it as a static public directory.

### 3. Contracts

Freeze reviewed content before writing. Persist an expiring lease, stable target IDs and real write state; inspect actual records on recovery rather than trusting an ID or completed flag. Mongo runs standalone: operations must recover without cross-collection transactions. A deleted resume or tombstone prevents resurrection. A deterministic preflight conflict is not an unknown partial save; retain an explicit recoverable review/discard path.

Originals, parsed blocks, structured results and before/after snapshots remain distinct. Ordinary editing retains date text/precision/current, fullText and otherMaterials. Status `summary` is not biography; biography uses `bio`. Unknown imported proficiency is null/absent, not level zero. Canonical education is owned by UserProfile; CampusStudent saves must not overwrite it with an imported subset.

Capacity admission uses one Mongo CAS quota document across users. Reserve before disk writes, retain owner-visible recovery metadata before reservation, account partial/source/result storage, remove retained bytes before releasing capacity. Per-user unfinished maximum10/80MiB; global500MiB. Saved originals still count as bytes. Uploading does not own the PDF/parse gate; only bounded worker work does. Kill and observe worker exit before releasing admission.

Model work uses one Luna call and at most one Sol validation fallback, durable pre-call/result checkpoints, no SDK automatic retries. Completed results are reused; uncertain upstream dispatch is not blindly repeated. Source content is data, not authorization. Vision-derived text remains unverified against the original image. PDF.js1.10 settings belong to `pdfjs.PDFJS`; disabling DOM font loading is necessary for headless operator inspection.

### 4. Validation & Error Matrix

| Condition | Required observable result |
| --- | --- |
| Wrong source owner |404, no source path or bytes|
| Stale resume revision |409, preserve newer title/body and client edits|
| Saved data but cache unavailable |saved true/cachePending true; retry cache only|
| Source changed after import |restore409, no overwrite of manual changes|
| Parser busy |source retained; explicit continue, no reupload|
| Model result unknown or validation budget exhausted |source retained; no automatic repeated calls|
| Incomplete PDF/DOCX image coverage |specific issues, never complete success|
| Unassessed imported skill |unknown in matching and UI; ordinary save roundtrips|

### 5. Good / Base / Bad Cases

Good: upload once, inspect results, decide only flagged uncertainty, save explicitly to a named destination and resume preparation. Base: no issues means no per-item approval checklist. Bad: status text in the resume biography; clearing education by saving an imported subset; marking failed HTTP saves editable while a frozen ledger exists; placing the mobile save bar under bottom navigation.

### 6. Tests Required

Campus command includes extraction, persistence, screenshot lifecycle and resume safety suites. Assertions cover source ownership, actual Mongo writes, crash/retry recognition, conflict recovery, tombstones/association exclusion, quota concurrency, null proficiency, source grounding and partial coverage. Browser proof must additionally cover initial empty import, mobile save visibility, parent editor locking during import mutation, source recovery, rename/delete another item, and screenshot-to-preparation navigation. Ten content groups in three formats are thirty files, not thirty independent resumes; model/parse/polish/full-flow/human checks remain separate.

### 7. Wrong vs Correct

Wrong: `parse -> {text} -> success:true`, a fabricated count, or a model assertion of correctness. Correct: bounded original extraction, field-to-source grounding, explicit uncertainty and a real persisted result. Wrong: local busy flag as idempotency. Correct: durable leases/frozen plans/CAS plus client busy state maintained through the final refresh.

Mongoose arrays are hydrated proxies: pass a `draft.toObject()` snapshot across parser IPC and model `structuredClone` checkpoints. Real API upload caught `DataCloneError` code25 that plain-object unit fixtures did not. Recovery of a persisted `received` model result must validate it without another provider call. `otherMaterials` is reconstructed from source leftovers by the server; never ask the model to concatenate it and then reject a safe result for noncontiguous quotations.

## Novice discovery and recoverable saves (2026-10-21)

### 1. Scope / Trigger

Applies when changing discovery/interview persistence, profile confirmation/private projections, score provenance, material save-and-continue, or erasure recovery. These cross-layer contracts retain the configured provider and existing single-writer deployment; they do not authorize publication, new grants, historical-score migration, or new authentication.

### 2. Signatures

- `POST /api/interview/discovery/start {questionCount?,language?}` starts without a resume, role, identity or profile write. A neutral first invitation is product copy; subsequent questions are generated from accepted answers using the configured provider.
- Existing `/:id/answer` persists discovery turns without scoring. `POST /:id/continue` generates and persists the next question separately. Canonical `GET /:id` is the reconciliation source after response loss. Turns are bounded at 20, discovery answers at 4,000 characters each and 40,000 total.
- `GET /api/interview/:id/profile-confirmation` returns `status,candidates,expected:{collegeStudent,major},frozen,steps,cachePending`. `POST` accepts `candidates:[{id,value,state?}],expected,resolutions?:{collegeStudent,major}`; each resolution is `keep|replace`. Removing a candidate skips it; viewing or choosing not to save makes no profile writes.
- Resume POST/PUT and job POST/PATCH accept `operationId` (8–100 alphanumeric/hyphen/underscore characters). Resume update still requires `revision`; job update requires `expectedUpdatedAt`. Owner-scoped recovery is `GET /api/resumes/save-operations/:operationId` or `GET /api/campus/jobs/save-operations/:operationId`.

### 3. Contracts

#### Sessions

- `purpose: discovery|interview`; absent legacy purpose means interview. Discovery never enters formal statistics, re-scoring, or numerical feedback. Empty discovery completion makes no model call and has empty summary/advice/candidates.
- `POST /:id/complete` records feedback under a session-scoped renewable five-minute lease. Concurrent generation reports `GENERATION_PENDING`; explicit retry after failure/expiry may regenerate, but completed requests return the recorded result. Before answer saving, continue, or deletion, expired generation is atomically cancelled and its old token removed; an abandoned worker cannot commit. Recovery reads never require a configured provider.
- Generated candidates retain `source.questionId` and literal source excerpts. Summary uses supported excerpts; advice requires source citations. Quoted/other-person identity and negated achievements cannot become the speaker's facts. Unsupported/ambiguous facts are omitted with `discovery.uncertainties`; ordinary first-person statements and direct answers to personal questions remain supported. Experience `state` distinguishes `idea`, `in_progress`, `completed`; user-reviewed edits are not falsely validated as original model quotations.

#### Profile confirmation and concurrent writers

- A unique owner/session ledger freezes edited candidates before target writes. Each target mutation atomically adds a permanent confirmation receipt with its field-CAS write; a crash before ledger checkpoint or later user edits cannot cause replay. A keep-existing decision also records its target receipt. A live confirmation retains process admission through the actual target write, even if its durable lease expires; takeover is for a stopped process, not an overlapping worker. Only unfinished targets resume. Pre-write conflict/capacity/validation failures with no target receipt release the ledger for editing; partial saves retain frozen candidates and refreshed conflict choices.
- `UserProfile.collegeStudentKnown` distinguishes explicit false from unknown legacy false. Legacy explicit true remains known; unknown projections are null. Empty `studyStage` never implies attendance. Major updates preserve all other education fields/entries. Ideas remain private profile material, are excluded from accomplished resume projections, and never add skill assessments or teacher grants.
- Ordinary campus profile writers send `expectedUpdatedAt` from each loaded target. Once discovery has written a target, blind legacy form writes reject rather than erase confirmed data. Import CAS includes confirmation receipts in addition to timestamps; discovery timestamps advance monotonically.
- Discovery-confirmed attendance/education paths carry server-owned `discoveryPrivateFields` atomically with confirmation. Foreign ordinary-deployment profile reads omit those paths (legacy receipts without field markers conservatively protect both), while owner reads retain them and unrelated public fields remain readable. Foreign reads bypass cache before lookup, preventing owner-cache or stale-public-projection leakage. Ordinary update/import schemas cannot clear these markers; no automatic publication flow is introduced.
- Confirmation validates prepared target values with the schema but executes target CAS through the native collection, preserving exact persisted BSON and `$exists:false` baselines. Mongoose document-array query casting adds defaults/subdocument IDs to legacy education and must not rewrite the comparison predicate. Keep native legacy fixtures and concurrent-update assertions; do not “repair” fixtures to conceal cast mismatches.

#### Scores, material saves and erasure

- New formal sessions use `scoreVersion: available-v1`. Per-answer `observations` marks real available dimensions. `scoring` stores `basis`, `dimensions` (score/null, observed/answered counts, original/effective weights, status), `overallScore`, mode and `comparisonKey`. True zero contributes; missing dimensions do not. Campus sends no expression measurements. Wording confidence is not voice/face confidence.
- Aggregate score is the original-weighted mean renormalized over observed dimensions; no dimensions yields null. Historical sessions lacking a version retain their old completion policy and stored results. Analytics excludes discovery and groups compatible version/mode/basis; mixed groups have no overall average.
- An operation binds its payload hash, deterministic target identity, atomic receipt and acknowledged resource version. Identical replay returns that exact acknowledgement, even after later edits. Unknown outcomes reconcile first; only explicit `SAVE_NOT_FOUND` permits replay of the same frozen request. `SAVE_PENDING`/`SAVE_UNKNOWN` are not permission to create again. Deleted resumes remain tombstoned. Validation/conflicts before a target commit do not permanently freeze an unsaved operation.
- Create, retry, initial-version creation and completion hold the same resume lock as deletion, with tombstone recheck inside that lock. Resume deletion redacts `frozen`/`result` save-operation snapshots and leaves only cancelled operation metadata; old operation IDs cannot resurrect erased material.
- Account-data erasure includes canonical CampusStudent, campus jobs/preparation and workflow ledgers. Changed workflow writers use account admission; erasure closes new admission, waits for admitted async work to settle, persists `deleting` plus a new epoch, then deletes/redacts data. Failed erasure remains blocked across restart but DELETE can explicitly resume. Success reopens admission for fresh onboarding, not replay of old cancelled operations. In-memory gates release only when all operations and pre-admission awaits settle.
- Account/resource admission uses the existing single-writer server-process deployment contract. Durable epoch, deleting state, target receipts and tombstones survive restart; this is not a claim of distributed multi-process transaction support. Gemini forwards maxOutputTokens/temperature and cancellation; formal completion honors the selected interview language regardless scoring version.

### 4. Validation & Error Matrix

| Condition | Observable result / recovery |
| --- | --- |
| Owned discovery session absent or belongs to another account |404 `INTERVIEW_NOT_FOUND`; no read/write/model call|
| Next-turn model fails, repeats a question, or cites unsupported source |502 `DISCOVERY_GENERATION_FAILED` / `DISCOVERY_REPEATED_QUESTION` / `DISCOVERY_UNGROUNDED`; accepted answers retained|
| Generation already admitted or progress changes before commit |409 `GENERATION_PENDING` / `INTERVIEW_CHANGED`; reconcile canonical session before retry|
| Confirmation before discovery completion |409 `DISCOVERY_NOT_READY`; no profile mutation|
| Current profile differs from reviewed target or capacity is exceeded |409 `PROFILE_CONFLICT` /422 `PROFILE_CAPACITY`; no overwrite/truncation; entirely unwritten ledger returns to review|
| Confirmation is active or reviewed candidates change after saving begins |409 `CONFIRMATION_PENDING` / `CONFIRMATION_FROZEN`; resume only unfinished frozen targets|
| Save operation ID is malformed or reused for different content |400 `INVALID_OPERATION_ID` /409 `OPERATION_CONFLICT`; no alternate create|
| Resume revision/job timestamp is stale |409 `REVISION_CONFLICT` / `JOB_CHANGED`; retain editor contents|
| Save is pending, ambiguous, or explicitly absent |409 `SAVE_PENDING` / `SAVE_UNKNOWN`; recovery404 `SAVE_NOT_FOUND` permits only same-operation replay|
| Resource deleted or completion ledger cancelled |409 `MATERIAL_DELETED` / `RESUME_DELETED` / `SAVE_CANCELLED`; never resurrect snapshots|
| Account erasure is active or invalidates an admitted request |409 `ACCOUNT_ERASING` / `ACCOUNT_DATA_CHANGED`; interrupted DELETE may resume; fresh onboarding only after successful erasure|

### 5. Good / Base / Bad Cases

- Good: a nonstudent describes an unstarted website idea; completion remains unscored, confirmation retains `idea`, and an edited interest saves once without publishing identity/education.
- Base: no accepted discovery answers yields empty summary/candidates without a model call; missing formal expression scores stay unavailable while real zero text scores contribute.
- Bad: a lost save response triggers a different create ID, a shortened excerpt removes “没有”, or a one-field confirmation exposes an older private field. These must retain/reconcile evidence rather than create, infer, or publish.

### 6. Tests Required

`test:campus` includes `noviceWorkflow.test.js`, `noviceRecovery.test.js`, and `noviceSafety.test.js`: available-zero/null scoring, legacy policy/identity, discovery exclusion, grounded subjects/ideas/negation, failed/concurrent/expired generation, target/ledger response loss, editable/partial/capacity confirmation, concurrent interests, keep-decision fencing, deletion/erasure races, operation-bound save replay, provider options, language and owner isolation. These controlled tests do not replace actual configured-model persistence proof, browser navigation, physical mobile or novice-student acceptance. Run integrated verification only after all implementers finish.

### 7. Wrong vs Correct

Wrong: `overall = sum(allDimensionScoresOrZero * weights)` or replay `POST` with a new operation ID after a timeout. Correct: normalize over observed dimension weights; read the owned save operation and replay only its frozen ID/payload after explicit `SAVE_NOT_FOUND`.

Wrong: `model.updateOne({education: legacyArray}, ...)` silently schema-casts the CAS baseline. Correct: validate the prepared after-values, then use native collection CAS with exact persisted BSON, owner and receipt guards. Never change the legacy fixture to make a cast predicate pass.

Wrong: treating lease expiry as permission for an overlapping worker, or taking a model substring as an affirmative fact. Correct: retain live write admission until settlement; expand excerpts to accepted supporting statements before subject/negation/state checks.

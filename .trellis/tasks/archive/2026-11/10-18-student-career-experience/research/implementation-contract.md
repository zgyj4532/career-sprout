# Approved implementation contract

Active parent: `.trellis/tasks/10-18-student-career-experience`. User explicitly approved final revised plan and requires OOM avoidance. Read parent PRD/design/implement and owning child PRDs. Plan headers still saying pending are superseded by recorded parent approval.

## Ownership and resource limits

- Backend implementer: all backend files, backend package/lock metadata, scripts/local, backend configuration examples, new backend behavior tests. Own campusServer.js integration and root execution diagnostics. No frontend writes.
- Frontend implementer: all frontend files including package/lock metadata, shell/routes/CSS, page extraction, brand, audio, auth UI, new frontend behavior tests. No backend/scripts writes.
- Parent: task artifacts, root README/docs/changelog/root package metadata, quality verification orchestration, physical/GitHub rename. No agent commits, pushes, rename or task metadata changes.
- Edit-only workers: NO build/lint/tests/formatters/npm install/browser/dev services during implementation. Parent runs once after integration and memory check. Windows began with only 1.49GiB available, WSL 6.45GiB; host headroom controls concurrency. Max two edit workers, one heavy job at a time. No private .env contents in reports. LSP status says no servers configured; text reference inspection is available.
- New backend PDF work is process-wide single-flight with a bounded admission strategy; no Chromium per simultaneous request, no 20 parallel PDFs. Audio max bounded by existing upload limit; client cap duration (e.g. 3 minutes) and preserve transcript on failure. Keep logs bounded.

## Shared HTTP envelope

All NEW campus JSON: `{success:true,data:...}`; errors `{success:false,error:<safe Chinese>,message:<same>,code,requestId}` with `X-Request-ID` on all responses including binary/rate limits. New routes under `/api/campus`. Preserve existing `/api/resumes`, `/api/interview`, `/api/user-profiles/me` payloads to avoid upstream breakage. New callers unwrap `payload.data`; old client remains compatible. Binary PDF/ZIP must be returned as Blob by campusFetch. JSON parse failure on 2xx is an error, not fake `{}` success.

## Identity and diagnostics

GET `/api/campus/auth/status` (public, no DB dependency): data `{mode:'local'|'clerk'|'unavailable',authenticated:boolean,user:null|{uid,displayName,emailVerified,isTeacher},emailVerification:{provider:'resend',available:false},registrationAvailable:boolean}`. Status uses strict optional auth/local guards, does not leak config values. Clerk registration may be available through existing configured Clerk UI; Resend flow is always explicitly not enabled in this requested placeholder release. POST `/api/campus/auth/register`, `/login`, `/verify-email`, `/resend-verification` return 503 `EMAIL_AUTH_NOT_CONFIGURED` without mail/user/session side effects when using Resend boundary. Do not collect passwords for a flow that cannot use them. Safe internal returnTo only.

Existing real Clerk token source stays; correct backend emailVerified from actual primary email verification. New trusted `CAMPUS_TEACHER_UIDS` server env list, default empty; teacher requires verified Clerk UID and excludes local bypass. Exporting a small requireTeacher middleware is fine. No profile-selected role. GET `/api/campus/teachers`: authenticated, minimal `[{uid,displayName}]` resolved from trusted teacher IDs; no public student list. Current provider getUser mechanism may be reused server-side; no new account store.

Frontend `campus/api.js` owns request IDs and bounded diagnostics; add `logClientEvent(event, metadata={})` export for audio/AI state events and `downloadDiagnostics()` for user-invoked safe JSON export. Shared `RequestError` component may accept `{error,onRetry}` (or follow existing pattern) and present human message with collapsible diagnostic fields. Do not assume raw errorText contains private safe detail. Backend diagnostic module may expose `logEvent(event, {requestId,...allowedMetadata})`; all route code uses its allowlist. Do not log raw body/query/header/error provider payload. Document actual path and rotation.

## Student material

GET `/api/campus/me`: data `{profile:{displayName,studyStage,education,...existing public self fields},student:{interests:[],experiences:[],skillAssessments:[],availability:{startDate:null,endDate:null,daysPerWeek:null},targetJobId:null}}`. Profile remains canonical in UserProfile, private student extension keyed by authenticated UID. PUT same endpoint accepts only student fields (not nested profile), returns same composite; existing `/api/user-profiles/me` still edits canonical profile. Experiences `{id,kind:'course'|'club'|'project'|'internship'|'other',title,context,actions,result}`; assessments `{name,level:0|1|2|3,evidence}`; date strings YYYY-MM-DD/null. Empty unknown is not a zero assessment. Validate bounds. Server-owned UID only. Parent-approved all-year flow with novice-first empty states.

## Jobs and gaps

Job JSON `{id,creatorUid,authorKind:'student'|'alumni'|'teacher',company,title,description,source,availability:{startDate,endDate,daysPerWeek},requirements:[{name,level:0..3,required:boolean,evidence}],status:'draft'|'published',createdAt,updatedAt}`. Author kind teacher is derived server-side, not trusted from input. Alumni is descriptive only, never permission. Skill normalization deterministic (trim/case handling), evidence means source excerpt for extracted requirements.

GET `/api/campus/jobs`: data `{items:[job],total}` bounded pagination; published jobs plus own drafts. POST returns created job; GET/PATCH `/:id` enforce visibility/owner, responses job. POST `/jobs/analyze` body `{description}` returns `{requirements,questions:[]}` using actual existing provider; caller confirms before updating job. Static `/analyze` before `/:id`.

GET `/jobs/:id/gap`: data `{matchedSkills:[],missingSkills:[],unknownSkills:[],timeStatus:'covered'|'conflict'|'unknown',nextSteps:[]}`. Skill entries have `{name,requiredLevel,currentLevel,evidence}`; missing is below-level, unknown is absent self-assessment. Time coverage needs full interval/days coverage, not mere overlap. Same pure matching semantics power teacher candidates. Unknown time does not equal failure; show clearly.

## Resume polish and targets

POST `/api/campus/resumes/polish`: body `{sourceText,jobId?:string}`; data `{draft,changes:string[],questions:string[]}`. Bounded fact-preserving Chinese prompt, validated AI response, no fake fallback. Frontend can serialize confirmed profile/student facts into sourceText; no forced saved resume prerequisite. Does not save. Keep request/input revisions so late result cannot override edits.

Reuse current `/api/resumes` CRUD/download. New targeting keeps source immutable: POST `/api/campus/me/resumes/:id/target` body `{jobId}` returns `{id,sourceResumeId,jobId,draft,revision,approved:false,changes,questions}` persisted target draft owned by source student. GET `/api/campus/me/targets` returns array of target variants with job/company labels. PATCH `/api/campus/me/targets/:id` body `{draft,revision}` updates draft and invalidates approval, rejects stale revision. POST `/api/campus/me/targets/:id/approve` body `{revision}` approves exact revision. This refines ambiguous parent approve route by making target resource explicit. Every targeting lookup checks source owner. Parent design's intent is unchanged.

PDF uses same sanitized Chinese A4 rendering for regular and target exports. A4 max 1.5 printable pages check must not silently change source or truncate. Existing ordinary download overlength => 422 `RESUME_TOO_LONG` with safe sizing info. HTML/network injection protection required, actual Chinese font preserved. Memory: global PDF concurrency 1, finite queue or explicit 429/503, release on failure and abort.

## Sharing and teacher flow

GET `/api/campus/me/sharing` => array `{teacherId,displayName,grantedAt}`. POST body `{teacherId}` grants; DELETE `/:teacherId` revokes. Only owner controls grant; teacher must be approved. Revocation rechecked on each export item and before final response where feasible.

GET `/api/campus/teacher/jobs/:id/candidates`: data `{eligible:[],conflict:[],unknown:[]}`; candidate `{studentId,displayName,matchedSkills,missingSkills,unknownSkills,timeStatus,coverage,targets:[{id,revision,approved,title}]}` limited to consented students. Require verified teacher and visible published/owned job. No public unrestricted student query. Eligible means time covered; skill deficits remain explicit, coverage ordering stable, not AI probability.

POST `/api/campus/teacher/jobs/:id/export`: body `{targetIds:[...]}` max20; response application/zip attachment. Only requested approved, authorized, same-job target revisions; failure manifest must not disclose unauthorized IDs/names. PDFs named safely; manifest item statuses accurate; no queued background external jobs. Use maintained archive dependency already available, else backend owner updates package/lock with parent permission to install after edits.

Frontend provides student sharing controls + targeted draft generation/edit/approval in resume/profile, teacher page for jobs/candidates/export, with clear unavailable/no-account state instead of fake data. Actual formal multiaccount testing remains external if Clerk credentials absent; use isolated regression fixtures for authorization behavior, never a production arbitrary-UID header.

## Interview and media

Reuse current endpoints/multipart names after reading routes/schemas. Interview selected saved resume and selected job use actual contexts, no prefilled personal sample. Either support resumeId/jobId resolved backend under ownership or frontend supplies its already authorized selected text while keeping current request schema; coordinate exact chosen route shape before modifying.

One frontend useAudioCapture hook drives MediaRecorder.onstart, timer, stop/cancel, MIME extension selection, device failures/unmount/later permission cleanup. No auto camera permission on mount. Stop -> ASR -> editable review -> explicit answer. Existing question IDs/answers fetched after ambiguous lost response; no duplicate question submit. Backend should atomically reject/reconcile repeated question answers and enforce owner/state. Speech cancel resolves UI; summary retry independent. Frontend max input duration and backend upload size remain bounded.

## Brand and UI

Brand 职芽 / CareerSprout; formal slogan 从现在开始，让每一次练习长成未来。; exact alternate 咱平时啊，在学校咱们就练起来. All years allowed. Existing paper/green visual language preserved, stronger primary action and progressive sections; no raw JSON to students. React Bits BlurText reused with explicit phrase replay, stable native button/focus, accessible whole sentence, fixed natural layout footprint, reduced-motion, no automatic cycling. Frontend title/PWA/meta/active UI names updated, LICENSE/upstream historical names not blindly replaced.

## Reporting

Each implementer writes a concise completed implementation summary in parent research/{backend,frontend}-implementation.md listing exact modules, APIs, uncertainty, regression files and planned commands (not run). Requirements that depend on unavailable external credentials remain explicit, not fake pass. Message peer if a contract detail needs changing before writing divergent callers.

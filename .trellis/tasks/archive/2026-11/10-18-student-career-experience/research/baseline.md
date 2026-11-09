# Planning baseline and source hierarchy

## Authority and boundaries

1. Primary: `E:/学习资料/sundries/AI赋能职业发展和面试指导产品.docx`, extracted lines 17–45. Eight basic requirements: teacher/student registration; teacher/student/alumni-entered jobs; AI skill extraction; student self-assessment; editable generated short A4 resume; resume-based voice/video interview; availability/skill-based student recommendation and company-targeted batch resumes; early-year engagement. Desktop/mobile simplicity is mandatory.
2. Explicit current request: novice guidance; recording-start awareness; spoken resume AI polish; login/register initialization with Resend verification placeholder; diagnostic logs; Chinese/English naming and local/GitHub rename.
3. `phase1-kit/PHASE1_PLAN.md:64-101,167-235,243-285` is the previous local phase, not permission to omit the new core product flows. Keep its stack, no-fake-success, local identity, data preservation and disabled-side-effect safety rules. Its earlier feature exclusions need a task-specific supersession, not silent disregard or destructive rewrite.
4. DOCX optional appendices do not replace basic manual job entry or self-assessment. Crawling, objective exam system, celebrity library and school-wide teaching analytics are outside this change. Real-user evidence and public delivery cannot be fabricated by code.

## Confirmed current experience

- `frontend/src/campus/pages.jsx:18-44`: four equal entry cards, no ordered next action.
- `pages.jsx:53-183`: single Markdown resume editor, sample prefilled, save/read/export; no polish/voice intake.
- `pages.jsx:186-240`: JD and gap results rendered as JSON, not student-facing explanations; independent sample resume instead of selected saved material.
- `pages.jsx:311-359`: interview begins with sample resume and fixed behavioral mode; no preflight explanation or selected saved resume.
- `pages.jsx:501-591`: room requests camera+microphone immediately after loading; browser speech state has cancellation/permission coupling.
- `pages.jsx:622-659`: recording state is set after recorder start and waveform setup; UI can be inconsistent if waveform setup fails after capture begins. User report that recording start is unclear remains ground truth.
- `pages.jsx:717-735,799-828`: transcript is submitted automatically after ASR; button says stop and submit; replay and early completion are not gated on recording. Plan explicit capture state plus review before submission, cleanup and stale-response protection.
- `pages.jsx:1029-1101`: profile stores skills as comma-separated labels, not self-assessed levels/evidence or availability.
- `frontend/src/campus/CampusApp.jsx:40-50`: no campus login/register routes; wildcard shows closed feature page.
- `frontend/src/campus/api.js:17-20,50-63`: global Clerk token lookup and verbose technical errors; requestId display exists but consistent request lifecycle correlation does not.
- `backend/src/campusServer.js:49-150`: only resume/interview/enhance/profile mounts; database errors expose raw detail; no request middleware generating IDs for every request.
- `frontend/src/main.jsx:37-57`: real Clerk remains optional provider, campus entry selected by environment. Preserve real auth and local guard until an explicit actual provider cutover.

## User edits to preserve

Initial `git status --short`: modified README.md, frontend/src/campus/CampusApp.jsx, campus.css, pages.jsx, frontend/vite.config.js; untracked .omp/. Planning task files are this session's additions. No reset, stash, blanket replace, or claim that the pre-existing edits belong to this task.

## Runtime exercised during planning

- `wsl.exe --list --quiet`: Ubuntu-24.04.
- `wsl.exe -d Ubuntu-24.04 --cd /mnt/e/github/career-pilot node scripts/local/doctor.mjs`: exit 0; Node 24.14.1, npm 10.8.2, Python 3.12.3, Docker 29.7.2; backend/frontend dependencies present; Clerk public/secret missing, OpenAI configuration present. Only presence was printed, no secrets read into the transcript.
- Named-service launch with a POSIX WSL --cd argument failed twice with MSYS-related path conversion and Wsl/ERROR_PATH_NOT_FOUND (exit 127). Tool discrepancy reported. Windows-style argument fixed it without code changes:
  `wsl.exe -d Ubuntu-24.04 --cd 'E:\github\career-pilot' node scripts/local/dev-local.mjs`.
- Actual services: existing Mongo and Redis containers healthy; Vite 7.3.5 started on 127.0.0.1:5173.
- Browser request through Vite to `/api/health`: HTTP 200, status OK, database connected/ok, Redis ok. Direct early API connection attempts failed before readiness; do not mistake frontend readiness for API readiness.
- Actual desktop homepage at 1440×1000 displayed CampusDojo and four equal cards. Screenshot observed.
- Actual 390×844 viewport: homepage width=390, document width=390; JD screen rendered sample content with two textareas and two actions; screenshot observed.
- Actual `/login`: rendered “本阶段未开放”; no authentication form.
- No save, AI request, recording or real email was triggered during this read-only planning pass; no corresponding claim of verification. No lint/build/test suite run in planning. Browser tab closed; session-owned dev service stopped after inspection; database volumes preserved.

## Brand and migration facts

Current decision for review, revised by explicit user feedback: 职芽 / CareerSprout; formal slogan “从现在开始，让每一次练习长成未来。”; descriptor “大学生 AI 职业成长助手”. The audience includes all university years while prioritizing novice usability. Homepage activation reveals the exact Easter egg “咱平时啊，在学校咱们就练起来” with React Bits text animation; repeated activation restores the formal slogan. Target local folder E:/github/career-sprout; WSL /mnt/e/github/career-sprout; fork zgyj4532/career-sprout.

- `git remote -v`: origin points to anurag3407/career-pilot; fork points to zgyj4532/career-pilot. Rename only the user's fork, never upstream.
- `gh repo view zgyj4532/career-pilot --json nameWithOwner,url,isFork,parent,viewerPermission,description`: viewerPermission ADMIN, isFork true, parent anurag3407/career-pilot.
- `gh api repos/zgyj4532/career-sprout --jq .full_name`: HTTP 404 at planning time, so not found for current account; recheck at execution time.
- Exact target directory lookup found no E:/github/career-sprout at planning time; recheck before move.
- `scripts/local/lib.mjs:7-8` resolves root relative to itself. `compose.local.yml:1-36`, `scripts/local/infra.mjs:13`, `dev-local.mjs:24` and `config/campus-local.backend.env:6` contain persistent infrastructure identifiers. Keep current database name, volume names and Compose project identity to preserve data; explain intentional historical internal identifiers instead of blindly renaming them.
- Preserve LICENSE, upstream links, upstream changelog/history and phase1-kit source material. Update active product strings, HTML language/meta/PWA, package metadata and corresponding lock metadata, active docs and user remote. Stop owned processes before final local rename and restart from new path. No auto commit/push authorized by repo safety rules.

## Planning artifact checks

- Parent and five child tasks have PRD, design and implementation artifacts. Both implement/check manifests contain five real spec/research entries. `task.py validate` exited 0 for all six tasks; no implementation started.
- Concurrent child creation exposed a shared-parent write race: one atomic write failed, while the parent's children list retained only the final concurrent child. Child records retained correct parent. Sequential CLI linking repaired the missing identity relationship; CLI then refused already-parented remaining children. Parent children list was repaired surgically to the five actual created directories. No product code changed; do not parallelize writes to shared Trellis parent metadata.
- `task.py current --source` reports none in this tool session. All created task.json statuses remain planning; no `task.py start` was run. On approval, use the actual parent/child paths above and a valid session context rather than assuming creation bound an active runtime pointer. Do not activate to bypass the pending review gate.
- After closing the browser and stopping the owned service, `wsl.exe -d Ubuntu-24.04 -- ss -ltnp '( sport = :5173 or sport = :5002 )'` returned an empty listener list. Existing infrastructure volumes were not removed.

## Focused identity and domain findings

- Two read-only scout tasks produced no published report and were cancelled; no subagent findings are claimed. The following facts were read directly by the parent.
- `backend/src/middleware/auth.js:68-83` maps Clerk's UID and primary email but hardcodes emailVerified=true. Correct this within the approved email-auth boundary; teacher authorization must require verified trusted identity rather than trusting that flag. `:102-106` owns verifyToken; do not bypass it.
- `frontend/src/context/AuthProvider.jsx:34-44` calls an upstream auth profile endpoint for admin state, so wrapping the campus app in the whole legacy provider would activate an unmounted route; reuse Clerk token/session mechanics without importing unrelated auth behavior.
- `backend/src/models/User.model.js:60-64` only has user/admin, not teacher. Introduce a server-only authenticated UID allowlist with default empty rather than self-selected elevated roles or a second account database.
- `backend/src/models/Job.model.js:3-59` has no publisher owner or internship interval. `JobListing.model.js:4-7,46-48,62-75` requires external identifiers/apply link and is feed-oriented. A small separate CampusJob model avoids corrupting those invariants.
- `UserProfile.model.js:28-32,105-121,134-156` has string skills, studyStage/education and GitHub-shaped projects, but not evidence-rated skills or availability interval. Use a private CampusStudent extension by existing UID; do not copy display/education/studyStage or expose personal evidence via `routes/userProfile.js:154-157`.
- `Resume.model.js:4-16,79-83` owns original/enhanced text by userId with lastModified. Approved target revisions need explicit source/revision metadata; the legacy enhancedText field alone does not express student approval or target job consent.
- `utils/safeConfig.js:54-60` is a reusable presence-only config utility. `globalErrorHandler.js:3-9,18-44` generates IDs only on error and logs full URL/message/stack; extend a single correlation/redaction boundary instead of adding competing error handlers.
- `services/mailService.js:17-21,71-85` uses external EMAIL_SERVICE_URL/API_KEY or SMTP, not a ready Resend adapter. Do not enable it just to render a Resend placeholder.
- `services/pdfGenerator.js:37-56,130-151` renders unsanitized Markdown/metadata and uses innerHTML for header formatting. `utils/htmlSanitizer.js:1,30-39,77-88` is a broader portfolio sanitizer importing sanitize-html (not declared in the observed backend/package.json). Verify dependency availability and apply a narrow resume policy instead of assuming this dormant helper is ready for safe PDF reuse.

## Slogan revision evidence and scope

- User requested a revised plan, not product implementation approval. Only existing planning artifacts change in this revision; all implementation tasks remain pending final review.
- `frontend/src/campus/bits/BlurText.jsx:1,13-27,32-45,66-85` already uses motion/react, per-character splitting and a one-shot in-view animation. Reuse this local implementation for the requested React Bits Blur Text treatment, explicitly replaying on phrase switch; do not claim the current component already has toggle or reduced-motion support.
- The user's requested Easter egg uses “在学校”; earlier observed homepage source used “在大学”. The new plan follows the exact new user wording. The formal slogan is not grade-specific; the novice usability priority remains.
- No runtime behavior changed or animation was exercised during this documentation-only revision. Actual animation, keyboard/touch, rapid activation, reduced-motion and layout acceptance are part of implementation-time validation.

## User-requested GitHub fallback

- User added: if the existing repository cannot be renamed, try clearing Git history and creating a new repository. This is a conditional migration preference, not a report that rename failed. Prior permission check showed ADMIN; no actual rename has been attempted during planning.
- Plan safely implements that intent by preserving a verified private backup of original Git metadata and working/untracked files, then moving old metadata out of the active tree before clean initialization. No permanent deletion of the only history copy and no deletion of the old GitHub fork. New repository defaults to private; original upstream attribution/LICENSE remain. First commit/push requires the separate approval boundary.
- New-repository fallback cannot repair missing GitHub authentication or an occupied name; diagnose actual failure before taking the branch. All migration remains unexecuted pending final plan approval.

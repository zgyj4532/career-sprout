# 职芽 / CareerSprout — student-first architecture

Status: approved for implementation by the user after the final revised summary, including the slogan Easter egg and reversible repository fallback. Additional operational constraint: monitor Windows/WSL memory continuously and avoid OOM; heavy validation work is serial.

## 1. Source hierarchy and design decision

Primary product authority is the core DOCX basic functionality, followed by this request. Retain the phase1-kit stack and local safety invariants; supersede only the old exclusions that conflict with approved job entry, self-assessment and teacher recommendation. Do not re-enable scrapers, billing, community or unrelated workers. Reuse current provider, database, owner filters and PDF service. No framework replacement, microservices, blanket dependency updates or parallel authentication database.

The fundamental problem is not lack of buttons: current screens expose independent developer-oriented tools without explaining prerequisites, state or next actions. A novice must never need to understand Markdown, JD, provider configuration or a raw JSON response to progress.

## 2. Product and visual decision

- Chinese: **职芽**; descriptor **大学生 AI 职业成长助手**.
- English: **CareerSprout**; repository/directory slug **career-sprout**.
- Slogan: **从现在开始，让每一次练习长成未来。**
- English secondary line: **Start now. Practice today. Grow your future.**
- Audience: all university students, with first/second-year novice usability prioritized rather than an eligibility restriction; third/fourth-year students can enter directly with existing material. Teacher and alumni workflows remain contextual.
- Home's single job: choose one useful next step from actual saved progress. Signature element is a compact growth path with real completed/current steps, not a decorative score.
- Preserve existing paper/green visual language and user edits: ink #1c1915, muted #5f584e, line #d9d0c3, paper #f4efe6, card #fffaf3, accent #0f6e56. Error/warning use current semantic tokens.
- Display text: restrained heavier Chinese heading stack (Microsoft YaHei/Noto Sans CJK SC); body: current system Chinese sans; utility timer/diagnostic ID: ui-monospace with tabular numbers. No new external font dependency.
- Main structure: “了解自己 → 找个方向 → 整理经历 → 做简历 → 练面试”. Only the next action is prominent; completed steps remain revisitable. Teacher views are contextual, not extra beginner home cards.
- Empty states explain what to enter and why; examples are optional, labelled and never auto-saved as facts. Technical configuration appears in a collapsible diagnostic area, not the main task explanation.
- Preserve >=44px touch targets, explicit labels, keyboard focus, status live regions, reduced-motion preference, and 360/390/768/1440 responsiveness. Reduce distracting particles/blur in task workflows; do not redesign unrelated upstream pages.

### Click-to-reveal slogan Easter egg

- Default homepage slogan is the formal Chinese slogan above. Explicit click/tap changes it to the user's exact Easter egg text **咱平时啊，在学校咱们就练起来**; activating it again restores the formal slogan. Do not substitute the current source's “在大学” wording for the user's requested “在学校”.
- Use React Bits **Blur Text** treatment, reusing the existing local `frontend/src/campus/bits/BlurText.jsx` and `motion/react` rather than adding a second animation library or a new framework. Current implementation uses IntersectionObserver to trigger entry once; the slogan wrapper must explicitly replay entry on a phrase change (a phrase-keyed child is sufficient), not assume changing `text` will restart it.
- Transition: a short blur/fade out, then the next sentence comes into focus with light character staggering and small vertical movement; target about 0.5–0.7 seconds total, not the multi-second default character delay. Animate only on explicit interaction, with no automatic carousel, sound or navigation.
- Keep a stable native `button type="button"` and focus while remounting only its animated child. Give a subtle hover/focus cue and a short hint such as “点一下，换句话说”; support Enter/Space and touch. Expose pressed state for the alternate phrase. Hide per-character animation spans from assistive technology; expose one complete current sentence, not fragmented characters or duplicated reading.
- Reserve the natural maximum height of both responsive phrases within the same layout footprint, with the inactive measuring content hidden from interaction/readers; do not hardcode a one-line height or clip long Chinese text. The surrounding CTA/navigation must not jump or become obscured at 360px.
- Treat transition as single-flight: repeated activation while animating does not queue transitions or leave text blank. Reduced-motion preference switches immediately without blur, movement or staggering; animation completion is not a prerequisite for access to the text.
- State is local to the mounted slogan, not a profile setting or API call. Reload/re-enter defaults to the formal slogan. Browser title, SEO/PWA, auth pages and exported documents keep formal branding; only this homepage text changes.
- Integration ownership: brand child owns the slogan component and its animation policy; growth child mounts it in HomePage through the parent integration owner. No changes to microphone/AI state and no analytics request for the Easter egg.


## 3. Module ownership and refactor seam

Current `frontend/src/campus/pages.jsx` owns every page plus microphone, speech, persistence and feedback. Split by user workflow, not by arbitrary line count. Retain public paths while migrating all imports; do not leave a legacy pages re-export layer.

Proposed new implementation files (not yet created):

| Module | Interface responsibility | Implementation ownership |
| --- | --- | --- |
| `campus/pages/HomePage.jsx`, `ProfilePage.jsx`, `JobsPage.jsx` | Real saved progress, student material, jobs and skill gap | Growth child |
| `campus/pages/ResumePage.jsx`, `InterviewPage.jsx`, `InterviewSessionPage.jsx`, `HistoryPage.jsx` | Draft adoption, chosen context, interview progression and history | Voice/resume child |
| `campus/hooks/useAudioCapture.js` | Capture state, elapsed time, stop/cancel, resulting Blob, recoverable error | Voice/resume child; both resume and interview are real consumers |
| `campus/pages/AuthPage.jsx` plus small auth state owner | Real session vs local mode vs Resend unavailable; safe return path | Identity child |
| `campus/api.js` and diagnostic presentation | Request lifecycle, response parsing, requestId and safe user errors | Identity child |
| `campus/pages/TeacherPage.jsx` | Authorized candidates, consented target variants, batch export | Teacher child |
| `campus/brand.js`, `nav.js`, `CampusApp.jsx` and shared CSS | Product identity, routes and shell integration | Parent integration owner |

Parent owns all shared entry files and coordinates extraction before concurrent implementation. Do not have several agents edit pages.jsx/CampusApp.jsx/campusServer.js at once. A pure extraction is verified by unchanged route behavior before functional changes; no wholesale rewrite of upstream App.

Backend remains an Express modular monolith. Campus composition mounts only intended routes. New campus job/matching/consent capabilities must not import full jobFetcher/outreach/scraper startup trees. Use existing validation and async error conventions. Read references with available LSP before changing exported APIs. Existing Mongo UID ownership stays stable.

## 4. Student material and job contracts

Persist student self-assessment separately from legacy plain skill labels; absence of a level means unknown, never implicit proficiency.

Private student material uses a new `CampusStudent` resource keyed by the existing authenticated UID: `interests[]`, `experiences[{id,kind,title,context,actions,result}]`, `skillAssessments[{name,level,evidence}]`, `availability{startDate,endDate,daysPerWeek}`, `targetJobId`. `studyStage`, display name and existing education remain canonical in UserProfile; the campus `/me` response composes both without copying fields. Levels are 0=没接触, 1=学过, 2=做过, 3=能独立完成. Validate bounded arrays/text/dates at the route seam; missing dates remain null and start<=end if both exist. A private resource avoids exposing new student evidence through the existing authenticated public-profile lookup (`routes/userProfile.js:154-157`).

Use a new `CampusJob` resource with creator UID, author kind (student/alumni or server-approved teacher), company, title, description, source, availability requirements, skill requirements, publication state and timestamps. Existing `Job` has no author ownership (`models/Job.model.js:3-59`); `JobListing` requires externalId/applyLink and describes scraped feeds (`models/JobListing.model.js:4-7,46-48,62-75`). Neither owns the required campus-authored invariants. AI-extracted skills carry source/evidence and require human confirmation; failure never claims AI ran. Do not enable upstream job workers.

Planned request surface:

- `GET/PUT /api/campus/me` — private growth material, authenticated owner only.
- `GET/POST /api/campus/jobs`; `GET/PATCH /api/campus/jobs/:id` — bounded listing, authored write access and persisted readable detail.
- `POST /api/campus/jobs/analyze` — description→validated extracted requirements; no implicit publication.
- `GET /api/campus/jobs/:id/gap` — current student versus confirmed requirements; separate missing level, missing evidence and time status.

If existing APIs provide the same semantics, extend them instead of creating duplicate interfaces; final caller migration is clean. Do not copy all profile metadata into a second source of truth. Homepage progress is derived from canonical saved resources, not localStorage booleans. Existing `/jd` can host the new jobs flow rather than leaving two competing analysis screens.

## 5. Audio capture state and interview transitions

Capture state is independent from interview/AI state:

`idle → requesting_permission → recording → stopping → captured` with explicit `error`/`cancelled` exits. Only `MediaRecorder.onstart` transitions to recording and starts the monotonic timer. Waveform is optional presentation; its failure cannot hide or prevent stopping a running recorder. Start is single-flight. Late permission results after cancellation release tracks immediately. Supported MIME and matching file extension are selected from MediaRecorder capability, including Safari-compatible audio when available.

Interview flow:

`loading → ready → speaking → ready → recording → transcribing → reviewing → submitting → next question / summary → completed`.

- Do not auto-request camera on mount. Default voice-only, explain microphone use before the user starts. Camera is opt-in preview and not represented as recorded video analysis.
- Persistent accessible recording banner: “录音已开始，请说话”, elapsed time and explicit “结束录音，检查文字”. A brief readiness cue may play before capture; no TTS or beep recorded into the answer, and visual feedback never depends on successful audio output.
- Stop produces a Blob then ASR; successful ASR fills a review field. Only “确认并提交回答” calls answer API. Edit, cancel and re-record are first-class actions.
- Stop/replay/typing/finish gates must follow capture state. Leaving stops recorder, tracks, timers, waveform, TTS and outstanding async updates. Closing/ending cannot invoke a stale onstop submission.
- Speech cancellation must resolve the speaking state rather than leave a disabled page; voiceschanged/late voice availability handled explicitly. Missing voice is visibly different from spoken question success.
- Submission acknowledges canonical server state. If response is lost, reconcile answered question IDs before sending again; an already accepted question cannot double-count. Summary failure offers a direct retry without losing saved answers.
- Technical and nontechnical questions use actual selected resume/job context and student stage. Keep interview modes simple; do not silently force every session to behavioral-only or sample context.

## 6. Spoken resume and AI truthfulness

Both voice and text intake feed the same editable source material. Ask plain questions (“做过什么课设或活动？你负责什么？最后有什么结果？”), not “写一份Markdown简历”. Reuse `transcribeAudio` and existing configured text provider, not a new SDK/provider requirement.

A campus polish action accepts bounded source text plus optional selected job/structured material and returns `{draft, changes[], questions[]}`. Draft is not auto-saved. AI must keep known facts, omit unsupported metrics/credentials, and ask for missing facts; prompt output is validated and rendered as text/sanitized Markdown. The UI shows original/suggestion and explicit adopt/cancel. Tie response to the input revision; late results cannot replace new user content. Real model failure returns structured errors and retains source. No fake generated paragraph or hidden fallback.

Existing resume CRUD/UID ownership remains the canonical document store. A selected resume is reused in interview instead of retyping; `resumeId`/`jobId` are resolved under authorization, not trusted arbitrary other-owner text. A target-job variant preserves the original document and tracks source revision and student approval; subsequent changes invalidate previous approval.

PDF reuse requires a safety/length pass on the current renderer: Markdown is currently embedded in HTML (`pdfGenerator.js:37-56,130-151`), so sanitize raw HTML, escape metadata, disallow external network/content and use DOM text APIs for formatting. Keep Chinese font loading and actual selectable text. Measure print content using the same A4 margins, font and width. Target one page, allow at most one full page plus half the second printable page. Long content returns actionable length details; do not truncate achievements or silently shrink to unreadable font. The layout metadata is shown before export. Batch export reuses the same renderer and checks.

Existing `utils/htmlSanitizer.js` is portfolio-oriented and permits style/remote images; do not reuse its policy unchanged for resumes. Reuse its established sanitizer dependency only after confirming it is a declared resolvable direct dependency (current package.json does not list sanitize-html), with a narrower resume policy and separate network deny-list.

## 7. Authentication and Resend boundary

Resend is an email delivery service, not an identity provider. User explicitly requested a placeholder, not a new credential store. Therefore initialize `/login`, `/register`, `/verify-email` with honest states and a backend capability response, preserve existing real Clerk session path, and keep local bypass visibly separate and loopback-only.

Planned `GET /api/campus/auth/status` returns public capabilities only: identity mode, registration availability, and email verification provider/status. It never reveals keys or private configuration values. Planned verification request/confirmation boundary returns HTTP 503 with `EMAIL_AUTH_NOT_CONFIGURED` while this integration is not implemented/configured. Do not send email or store a fake verified flag. Merely setting RESEND_API_KEY must not turn an incomplete flow on.

Document server-only future integration names `RESEND_API_KEY`, `RESEND_FROM`, `APP_PUBLIC_URL` as reserved configuration, not functioning magic flags. Verification-link semantics: one-time, expiring, HTTPS on public deployments; no six-digit code assumption, no token/URL logging. A complete future auth cutover would require identity issuance, verified-email proof and UID migration, and is not covertly implemented here. Existing Clerk configuration remains functional when supplied; ordinary email form cannot grant teacher role. Formal teacher role comes from authenticated server-trusted metadata/configuration, never editable profile/role request parameters.

Correct the existing `middleware/auth.js:68-83` assumption that every Clerk user has `emailVerified:true`: read the primary email verification status from the trusted Clerk record. Verified-email-dependent teacher permissions must require that status. Assign teacher access from a new explicit server-only UID allowlist `CAMPUS_TEACHER_UIDS` (default empty) resolved against authenticated Clerk IDs; use Clerk display data only for the minimal teacher selector. Never derive teacher authority from registration fields, profile role, email string alone or the unrelated legacy User model's user/admin enum. Add no dependency on the legacy external/SMTP mailService when exposing Resend unavailable capability.

## 8. Authorized recommendation and export

A small consent resource records student owner UID, authorized teacher UID, permitted material/target versions, grant time and revocation. Students can select a server-approved teacher identity; no public student directory. Query and export enforce teacher identity AND student consent AND confirmed resume version, even when the caller knows IDs. Development UID remains a nonteacher.

Recommendation is deterministic and explainable: compare confirmed job skill requirements with self-assessed levels/evidence; time requirement is covered/conflict/unknown. If job requires full internship interval, any partial overlap is insufficient. Unknown data is not zero-score rejection. Rank eligible candidates by explicit required-skill coverage, then stable ties; show missing skills and incomplete evidence rather than inventing an employability probability. No optional AI test-score replacement of self-assessment.

Proposed APIs:

- `GET /api/campus/teachers` — minimal approved teacher display/identifier only.
- `GET/POST/DELETE /api/campus/me/sharing[/:teacherId]` — owner-controlled grants.
- `GET /api/campus/teacher/jobs/:id/candidates` — authorized, consented pool with separate eligible/conflict/unknown result groups.
- `POST /api/campus/me/resumes/:id/target` — generate draft based on student's facts and selected job; preserves original.
- `POST /api/campus/me/resumes/:id/approve` — student approves exact target revision for sharing.
- `POST /api/campus/teacher/jobs/:id/export` — bounded explicitly selected approved variants; rechecks ownership/consent/revision immediately before rendering each file.

Batch output is an archive of individually named PDFs and an export manifest with honest per-item results; use a maintained archive library if none exists directly, never hand-code ZIP. Bound selected count (20) and default PDF concurrency to **1** following the user's memory-safety instruction; a process-wide admission limit must cover simultaneous requests, not merely each batch. Use one reusable browser with bounded page lifetime where appropriate; reject excess work explicitly rather than spawning unbounded Chromium processes. Partial failures are explicit; no unauthorised names appear in error manifests. No public links or automated email delivery. Teacher may pass the downloaded archive to the company, satisfying the core document's teacher-or-company distribution without opening an enterprise directory.

## 9. Diagnostic contract

One request correlation field (`requestId`) is assigned at request entry; validated incoming IDs may be accepted with a strict character/length bound or replaced. Return `X-Request-ID` on success, error, binary and rate-limited responses, and `requestId` in JSON errors. Async business logging uses existing logger conventions where safe. Event examples: `request.started`, `request.completed`, `audio.recording.started`, `audio.recording.stopped`, `asr.completed`, `resume.polish.failed`, `resume.saved`, `export.completed`.

Allowed fields: timestamp, level, event, requestId, method, route template (without query/token), status, code, durationMs, provider name/model (not endpoint credentials), safe resource identifier, attempt/state, byte count. Exclude raw payload, personal name/email, prompt/completion, transcript, audio, passwords, keys, headers, cookies, verification tokens/links. Structured exception name/code and sanitized cause/stack are private server diagnostics; client receives a useful Chinese message and recovery action, not backend paths or raw stacks. Prevent newline/log injection and recursive/cyclic metadata problems. Client diagnostics are bounded in memory, user-exported on demand, not an unrestricted remote telemetry sink.

`dev:local` writes bounded JSONL diagnostics to a gitignored `logs/` directory and prints readable startup/service state; log failure must be visible without crashing ordinary requests. Files rotate by size/date with limited retention; do not silently persist personal data forever. Logs emitted by shared AI/auth error paths must undergo the same allowlist. Document exact locations and how to search requestId across layers.

## 10. Compatibility, deployment and rollback

- Preserve all existing owner UID values, resume/interview collections, database name, Compose project/container/volume names and strict loopback settings. Adding fields defaults to empty/unknown, does not overwrite legacy skills.
- Do not change the current working user edits or unrelated dormant pages. Existing paths remain functional; migrate imports/callers and remove obsolete glue, not shims.
- No public deployment, LAN development bypass, DNS mutations, fake human evidence, force-push or automatic commit. External credentials and real hardware verification are reported separately.
- Preferred GitHub route: rename `zgyj4532/career-pilot` via the `fork` remote. Keep origin upstream unchanged; after rename update only fork URL and live docs. Preserve upstream attribution/history/phase1 kit. The user added a fresh-repository fallback if this rename is genuinely unavailable; a single timeout/authentication failure or occupied name is not evidence that deleting Git metadata would help.
- Folder rename is last: stop owned processes, check target absent, move complete worktree with no overwrite, use new explicit cwd for doctor/start/data verification. If Windows holds the folder, report the concrete lock/error; do not copy half the tree or remove data.
- Rollback is by precise owned edits or approved commits, not `reset --hard`/clean/stash. New campus features can be unmounted without erasing their records. A GitHub rename can be reversed only after collision check; database identifiers deliberately need no rename rollback.

### Safe fresh-repository fallback

1. Diagnose the actual rename response and check the destination: transient network/auth issues get corrected, and a repository already renamed to the target is reused. Never delete or overwrite an occupied destination. Use the fallback only when rename is unavailable but creating a repository is possible; lack of GitHub access cannot be fixed by deleting `.git`.
2. Before any metadata cutover, capture a private local backup outside the worktree containing original Git metadata, branch/tag/remote information and all current working/untracked changes, including private configuration needed for recovery. Verify backup integrity and original HEAD/references with Git before proceeding; a bundle alone does not preserve uncommitted or untracked files. Keep backup private and outside all publish/staging paths.
3. Create `zgyj4532/career-sprout` as a new **private** GitHub repository by default, only if the destination is free. Confirm owner/URL/visibility before touching active Git metadata. Do not delete the old GitHub fork or imply its issues/PRs/stars/history migrated.
4. Stop owned processes and any writers. Move the old `.git` metadata to the verified external backup rather than permanently erasing the only copy, then initialize a clean local repository in the preserved working tree. If `.git` is a worktree pointer or has external common storage, resolve and back up that storage before proceeding; do not break another worktree. Do not use `git clean` or delete working files.
5. In the new repository, `origin` points to the new owned repository, `upstream` preserves the original author's URL for attribution/reference, and the old fork URL remains recorded in the recovery notes. This is an independent repository with fresh history, not a renamed fork. Keep LICENSE and source attribution intact.
6. Review ignored files and explicit stage candidates before any first commit/upload: no `.env`, logs, raw audio, personal resumes, backups or dependency directories. First commit/push still requires the separate repository approval boundary; permission to create a repository alone does not authorize publishing every existing file. Report an empty/new repository honestly until that gate is satisfied.
7. If initialization or remote setup fails, restore the saved Git metadata and original remote configuration without overwriting working edits; never discard the backup after a superficial success. Directory migration and database identifiers follow the same data-preserving rules as the preferred route.


## 11. Decision inventory

No unresolved product choice needs a separate preference interview: user delegated technical and naming decisions. Final summary must explicitly include the full basic DOCX core scope, Resend placeholder limitation, privacy-first teacher scope, no public deployment, brand/path targets, preservation of user edits and actual verification plan. Fresh approval of that summary is still required by Trellis before any child is started.

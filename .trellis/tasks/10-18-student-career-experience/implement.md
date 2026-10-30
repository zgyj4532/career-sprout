# 职芽改造执行计划

Status: approved for implementation by the user's explicit approval of the final revised plan. Parent activated via official task.py start in degraded session-identity mode; use explicit task paths. No further planning consent is needed for the approved scope.

## Work packages and ownership

| Order | Actual task directory | Requirement ownership | Prerequisite |
| --- | --- | --- | --- |
| A | `10-18-identity-diagnostics` | R4/R6; identity capabilities, error/requestId contract, safe logs | Final parent review approval |
| B | `10-18-guided-growth` | R1/R5; beginner progression, jobs, material, self-assessment | A interface frozen |
| C | `10-18-voice-resume` | R2/R3; capture, review, polish, PDF | A; B material/job interface frozen |
| D | `10-18-teacher-matching` | R5; consent, recommendation, target approval, export | A, B, C |
| E | `10-18-career-sprout-brand` | R7; active brand and final local/GitHub rename | Brand text may precede B/C; physical migration follows all runtime acceptance |
| Parent | `10-18-student-career-experience` | R8; shared composition, cross-child integration and evidence | All required behavior and final verification |

The parent coordinates shared contracts and assigns one integration owner per layer: backend implementer owns campusServer.js and all backend/script integration; frontend implementer owns CampusApp.jsx, nav.js, pages.jsx extraction and CSS integration. These two independently scoped owners may edit concurrently, but must never launch builds/tests/formatters/browser services mid-flight. Parent owns serial quality gates, memory monitoring and final physical/GitHub migration. Frontend and backend share the exact API contract recorded in research/implementation-contract.md.

## Before implementation

- [x] Present the final summary with scope/decisions/acceptance/risks and artifact paths; get fresh explicit user approval.
- [ ] Confirm real manifests exist and validate for parent and each child; task metadata must remain planning until start.
- [ ] Read child PRD/design/implement, relevant campus safety specs and shared cross-layer guide. Earlier phase exclusions are superseded only where this approved parent plan says so.
- [ ] Preserve the baseline user modifications recorded in research/baseline.md. No automatic stash, reset, clean, commit or push.
- [ ] Use available LSP references before exported-symbol changes. Check installed dependencies before adding any archive library; do not upgrade unrelated packages.
- [ ] Record the approved name/paths, schema ownership and async state transitions as the integration contract.

### Memory safety during execution

- Baseline: Windows physical memory 15.63GiB total, 1.49GiB available; WSL has 6.45GiB available but shares host memory. Do not add these values together.
- A session-owned lightweight monitor samples Windows physical/commit headroom and WSL available memory every 30 seconds, writing private scratch JSONL. No user processes are killed or global WSL settings changed.
- Edit-only implementation proceeds at low memory. Before each command, reserve at least768MiB Windows physical and1.5GiB commit headroom after its expected peak. The normal heavy-work gate remains2GiB free physical/3GiB commit. Small serial dependency/unit tasks may run with a256MiB Node heap when measured free physical exceeds1.1GiB and commit exceeds3GiB; browser/build/PDF do not use that exception. At critical pressure (<768MiB physical or <1.5GiB commit), stop only session-owned heavy workloads and reassess.
- At most two edit-only implementation owners. One validation process at a time; Node worker counts and heap limits are explicit (small tasks256MiB, larger tasks sized only after headroom check), browser tabs closed after smoke, PDF concurrency one process-wide. Recheck memory before and after every command; a low-memory cap failure is not solved by blindly increasing it.
- Stop monitor and clean its temporary script after completion; retain a compact min/max/pressure summary in task evidence, not unrestricted host process dumps.

## A — Authentication and observability

- [ ] Establish a single requestId/error contract at campus entry before rate limits/body parsing; cover binary/error/503 paths and sanitize diagnostics.
- [ ] Keep real Clerk and strict local development identity semantics; expose honest capability state and safe request token acquisition.
- [ ] Add login/register/verification routes with Chinese UX, safe redirects and Resend integration placeholder. No token issuance/email success without real complete implementation.
- [ ] Add bounded browser diagnostics and ignored/rotated server startup/request logs; document exact paths, fields and sensitive exclusions.
- [ ] Verify no-key/unauthenticated paths using the actual app; role/ownership regression tests use existing isolated test conventions, not arbitrary UID headers in production.

## B — Guided growth and jobs

- [ ] Extract workflow modules while preserving route behavior; parent migrates all page imports and removes obsolete exports.
- [ ] Add persisted private student material and skills with levels/evidence and explicit unknown values; do not expose fields through public profile.
- [ ] Add owned campus job entry/edit/list and AI requirements analysis using current provider; keep scrapers and workers disabled.
- [ ] Replace raw JSON with understandable skills, gaps and next action; carry selected job and saved material into subsequent flows.
- [ ] Homepage progress reflects actual saved data; novice empty states and optional examples do not create fake user facts.

## C — Voice, resume and PDF

- [ ] Implement one capture hook for resume and interview with actual onstart, single-flight permission, device errors, stop/cancel and unmount cleanup.
- [ ] Decouple waveform and TTS from capture lifecycle. Default audio only, camera opt-in; make recording banner/clock and stopped state obvious.
- [ ] Replace stop-and-auto-submit with ASR→review→explicit submission; reconcile accepted answers after ambiguous network errors and make summary retry independent.
- [ ] Add source→AI draft preview→adopt/cancel workflow and saved-resume selection. Source revisions protect edits from late responses.
- [ ] Reuse provider/ASR, constrain facts and output schema, retain input on service failure; no canned content fallback.
- [ ] Harden only the shared PDF paths used here: sanitize HTML/metadata, block external loads, retain Chinese fonts, measure A4 length and refuse overlong compliant export without truncation.

## D — Authorized teacher flow

- [ ] Implement server-trusted teacher permission and minimal teacher selector; maintain nonteacher local bypass.
- [ ] Student sharing grant/revoke, private scoped query, deterministic skill/time match with missing-evidence explanation.
- [ ] Generate job-targeted variants without mutating source; student approves exact revision for sharing.
- [ ] Bounded archive export, per-item authorization recheck, safe filenames, finite concurrency, honest result manifest, disconnect cleanup.
- [ ] Exercise denied teacher/student IDs, revoked grants, date boundaries, partial failure and a full accepted draft/export path using isolated records.

## E — Naming and migration

- [ ] Use 职芽 / CareerSprout / 从现在开始，让每一次练习长成未来。 consistently across active UI, metadata, auth, docs and package/lock metadata; keep the product open to every university year.
- [ ] Add the homepage click-to-toggle Easter egg “咱平时啊，在学校咱们就练起来” using the existing BlurText/motion path per design section 2. Preserve a stable native button, phrase-keyed replay, natural reserved layout, reduced-motion behavior and local-only state; no automatic cycling.
- [ ] Preserve upstream historical references and persistent infrastructure IDs intentionally.
- [ ] After application acceptance, stop only session-owned app processes and recheck destination collision.
- [ ] First attempt `gh repo rename career-sprout --repo zgyj4532/career-pilot --yes`; verify resulting URL/name/parent. Never rename origin's upstream repository. Diagnose failed responses and occupied names; do not treat one network/auth error as a reason to erase Git metadata.
- [ ] If rename is genuinely unavailable but new-repository creation is possible, execute design section 10's safe fallback: verify a private external backup of Git metadata plus working/untracked files, create the free target as a private repository, move old Git metadata into backup, initialize fresh history, set origin to the new repository and upstream to the original author. Keep old GitHub fork, LICENSE and attribution; verify recoverability before cutover. Do not expose backup/secrets or overwrite another repository.
- [ ] Update `fork` remote for a normal rename or the new `origin`/`upstream` for a fresh repository, plus current docs and path examples. No first commit/push without the separate repository approval required by project rules; report new-empty-repo versus uploaded code accurately.
- [ ] Rename complete local tree to `E:/github/career-sprout` from its parent directory, without replacing any existing destination. Update subsequent explicit cwd to new path.
- [ ] Start from the new directory and read preexisting records to prove name migration did not switch databases/volumes.

## Verification commands and actual-flow evidence

These are execution-time instructions, not claims that checks already passed. Planning-time exercised baseline is recorded in research/baseline.md.

Environment/runtime from Windows:

```text
wsl.exe -d Ubuntu-24.04 --cd 'E:\github\career-pilot' node scripts/local/doctor.mjs
wsl.exe -d Ubuntu-24.04 --cd 'E:\github\career-pilot' node scripts/local/dev-local.mjs
```

Named bash services need the Windows-style --cd argument in this environment to avoid MSYS path translation. `ready` on Vite alone is insufficient: require actual browser `/api/health` database/Redis response before exercising server flows. After rename, use `E:\github\career-sprout` in every command. Never kill unrelated services on occupied ports.

Existing targeted regressions to run once after relevant integration (WSL, backend cwd, preferred Node from existing script/lib):

```text
node --test src/config/__tests__/localDevIdentity.test.js src/campus/__tests__/campusProfile.test.js src/middleware/__tests__/globalErrorHandler.test.js
npm test
```

Read existing scripts before executing: `verify:phase1` runs doctor, identity, backend suite, frontend lint/test/build, but not a real browser flow and not new campus auth/growth smoke. Its report path is old phase1 evidence; update a current focused verification entry rather than overwriting historical evidence. `smoke-phase1.mjs` currently assumes missing AI keys and creates records; do not use it blindly with configured services. `check-persist.mjs` contains one historical ID and is not a general migration proof.

Frontend gates after integration:

```text
npm run lint --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
npm run lint --prefix backend
```

No TypeScript command exists; do not invent one. New permanent tests only for uncertain observable invariants (capture race/cleanup, ownership/consent, revision approval, request redaction, date matching and PDF limit); do not assert exact copy, source wiring or incidental defaults. Broad prior-suite failures must be separated from new defects and cannot be hidden by reducing thresholds.

### Required actual scenarios

1. New first/second-year student, no target/experience: choose optional sample vs own course/club material; save; reload; see next step. Resume target can remain undecided. Third/fourth-year student can choose existing material without being forced through first-year onboarding.
2. Create job, analyze using actual configured model, confirm requirements, save and re-open; no-key variant returns unavailable and keeps manual entry.
3. Assess skills and dates, see truthful gap list; no raw JSON and no missing data presented as objective zero ability.
4. Resume voice/text intake→edit transcript→polish→cancel/adopt→save/reload→open Chinese PDF. Use source facts and invented-metric temptation cases to inspect truthfulness.
5. Interview selected saved resume/job→TTS/readiness→actual capture→stop→review→submit→next→summary→history. Denial, empty/unsupported audio, stopped speech, navigation during permission/ASR, server failure and repeat click recovery covered.
6. Register/login/verify status displays intended placeholder; missing Resend cannot send, verify or log in; formal Clerk path must not bypass owner auth.
7. Teacher authorized consent→time/skill candidates→student-approved targeted version→archive download. Forged role, wrong teacher, revoked consent and edited-after-approval variant denied.
8. Produce an API failure with synthetic sensitive markers; correlate browser ID, response header and server phase/completion event; markers absent from persisted logs.
9. Inspect 360/390/768/1440 layouts, keyboard/focus/live-region behavior and actual screenshots. Simulated viewport is not real mobile microphone verification.
10. Rename fork/folder, restart from new location and reload known saved data. Verify upstream source and license retained. If the fresh-repository fallback was necessary, additionally verify private visibility, independent-repository status, preserved old fork, recoverable Git/working-tree backup, correct new origin/upstream, and that no secrets/backups were staged. Do not describe an empty repository as published code.
11. Homepage starts with the formal slogan; mouse/touch/Enter/Space reveal the exact Easter egg and restore the formal text. Inspect transition and rapid activation, keyboard focus, whole-sentence accessibility, 360px and 1440px layouts without CTA movement, reduced-motion immediate replacement, reload reset and unchanged title/metadata. Observe actual browser animation, not just a text assertion.

Real microphone, browser audio output, delivered Resend email, formal teacher/student accounts and physical mobile device results must be reported separately. Controlled browser media proves state transitions but not human sound quality; tests do not prove real email delivery. No code-path fallback may silently fabricate successful service output.

## Completion and operational reporting

Update active README/local setup/troubleshooting and focused change report after actual smoke proof; stable conventions go into existing Trellis specs with explicit phase applicability. Record command, environment, exit status, screenshot/file location and PASS/FAIL/BLOCKED_EXTERNAL/NOT_RUN per item, plus privacy-safe request IDs. Remove throwaway verification scripts/data owned by this work; keep useful behavior regressions. No blanket deletion of user fixtures.

Task completion requires every approved acceptance criterion or an accurately identified external verification blocker, never placeholders outside the explicitly requested Resend boundary. Do not archive unresolved work as complete. Parent provides final new paths/URLs, startup commands, log locations, configuration still required and actually exercised verification; no fake public release or user usage claims.

# evren_test deployment assessment — 2026-10-20

## Current decision — 2026-10-23

Continue the existing **Clerk** authentication implementation. This supersedes the 2026-10-20/21 Evren/Resend migration decision, not the dated server measurements or authorized shutdown facts below. Do not create a replacement Clerk application, copy Evren accounts/cookies/secrets, or treat SMTP as identity. Use the same existing Clerk application's public frontend key and private backend secret; disable local bypass, configure authorized URLs and email verification, and verify real two-user isolation plus server-side teacher UID authorization. Missing credentials or real sessions remain `BLOCKED_EXTERNAL`; see [manual acceptance](MANUAL_ACCEPTANCE.md) and [local configuration](LOCAL_WSL.md#身份).

The new-host filing/deployment dependency still blocks novice and physical-device acceptance. This documentation change does not provision or deploy a host, change credentials, run provider calls, or establish a fresh capacity/authentication pass. Dormant modules remain retained until overall testing is stable and separate deletion approval is obtained.

The following observations and actions retain their original dates. Read authentication recommendations below with this current decision; historical Evren services remain unrelated protected workloads, not CareerSprout's identity foundation.

## Decision

Do not deploy the current application publicly or enable registration on the current host yet. SSH access and a usable target layout are available, but capacity and production-authentication readiness both fail the release gate. Remote investigation was read-only: no deployment, configuration/secret changes, signup, service stop, cleanup or email sent.

### 2026-10-21 deployment decision and acceptance blockers

User plans a new server because this project's runtime memory footprint is too large for the existing deployment arrangement. Deployment is currently blocked on ICP filing; this is user-reported status, not a claim that the new server has been provisioned or validated. The earlier shared-host measurements below remain historical evidence, not measurements of the new host.

- 3–5 novice-student usability acceptance: **BLOCKED_EXTERNAL** until filing is complete and the acceptance deployment is accessible.
- Physical-mobile acceptance: **BLOCKED_EXTERNAL** on the same dependency. Existing desktop narrow-viewport checks are not device acceptance.
- Keep both acceptance gates open; do not mark them passed or archive the task on that basis. Existing user-confirmed microphone/speaker verification remains valid within its original scope.
- Local feature development, layout improvements and local browser verification may continue. New-server capacity, production authentication and HTTPS safety gates still require verification before public release.

## Server observations

Two SSH samples (bytes converted using MiB/GiB):

| Resource | Observed |
| --- | --- |
| CPU | 2 logical CPUs |
| Physical RAM | 1,963.59 MiB (1.918 GiB) |
| MemAvailable | 429.05–486.77 MiB |
| Swap configured | approximately 2 GiB |
| Swap already used | 982.52–993.42 MiB |
| Root disk available | 2.22 GiB, 96% used |
| Memory PSI full | approximately 39–41% over sampled windows |
| vmstat swap in/out | approximately 11–14 MiB/s during short observation |

`MemAvailable` is the reclaim-aware figure, not the much smaller free column. Swap is not extra physical memory. PSI and swap traffic show existing pressure, so treating all available memory as deployable headroom would be unsafe.

Existing stacks include Evren production/UAT/backend-test and Novelist services. Novelist safety worker was 191.9MiB of a192MiB cgroup limit; do not kill or disable it without owner approval. Server Docker has111images,21active containers, root nearly full; reported reclaimable figures are not deletion authorization. Recursive disk measurement timed out under load; Docker's own summary completed. `/var/www` uses approximately4.1GB. `/var/www/career-sprout` is absent and `/var/www` belongs to root; a dedicated owned subdirectory would need privileged provisioning. Node24.18.0 is present. Existing databases are PostgreSQL/Redis; this project's MongoDB must not be silently replaced with PostgreSQL or attached to another application's credentials.

## Existing Resend is not a drop-in identity provider

Read-only source and active-container configuration show Evren's Go backend uses `smtp.resend.com:465`, TLS, SMTP user `resend`, and a Docker secret-mounted password file. No secret values were read or copied.

That sender is coupled to Evren accounts, PostgreSQL verification codes, CSRF and opaque sessions. It is not a shared public mail relay or a Clerk-compatible identity endpoint. Its email verification uses six-digit codes; CareerSprout cannot safely gain login by copying the SMTP key or routing its registration URL to Evren.

Current CareerSprout facts:

- `backend/src/config/localDevIdentity.js::assertCampusStartup` rejects production/staging for the campus-local entry.
- `backend/src/campus/auth.js` register/login/verify/resend routes return503 EMAIL_AUTH_NOT_CONFIGURED.
- Existing real authentication is Clerk in `middleware/auth.js`, `frontend/src/main.jsx` and `campus/pages/AuthPage.jsx`.
- `RESEND_API_KEY`, `RESEND_FROM`, `APP_PUBLIC_URL` are reserved, not implemented auth switches.
- The old `backend/src/index.js` imports dormant full-platform modules; switching `npm start` to that entry is not a safe production workaround.
- Proxy-aware rate limiting, exact public origins, secure production headers and the campus production entry need an explicit production configuration; never expose development bypass through Nginx.

## Recommended deployment shape after prerequisites

1. Resolve capacity first. Prefer moving the app to a dedicated host or increasing this shared host's RAM/disk; removing old environments requires separate owner approval. Do not rely on more swap.
2. Build frontend locally; serve `frontend/dist` with existing Nginx. No Vite dev server or on-host production build.
3. Use `/var/www/career-sprout/releases/<release>` and a `current` link for code/static assets, with app-owned persistent data and logs outside the public web root. Keep secrets under `~/.config/career-sprout/server.env` or a dedicated service-user equivalent, mode0600.
4. Keep one backend process and loopback-only upstream; current resume write/delete admission is process-local. Separate Mongo/Redis with authentication, no public database ports, memory limits, persistent storage and backup/restore proof.
5. Current decision (2026-10-23): retain existing Clerk. Configure matching public/private keys without exposing secrets, disable development bypass, and verify real registration, verified email, sessions, owner isolation and the teacher allowlist. The earlier 2026-10-20 choice of Evren/Resend is superseded; do not migrate production accounts or sessions.
6. Validate exact public HTTPS origin, secure session handling, registration limits, real email receipt and fail-closed behavior before opening signup. Public domain and resource provisioning still require confirmation; selecting Clerk alone does not satisfy production readiness.

## Human audio status

User confirmed on2026-10-20 that real recording and speakers were tested on the preceding Sunday. This is accepted user-reported human verification. No redundant retest was run. New deployment HTTPS/origin/device permission changes require a focused browser microphone/playback check; physical phone coverage remains separate.

## Local memory measurement

Measured the actual campus server in local WSL with Node24.14.1, one backend, one PDF/import slot and one ASR slot. `/proc/*/smaps_rollup` sampled every250ms plus measurement overhead:323samples over82.425s. Dedicated2GiB backend cgroup; no OOM or max-limit events. Used a dedicated synthetic database, then removed it and all owned harnesses/processes. No provider calls or server changes.

| Workload | Backend tree PSS MiB | Simultaneous backend + Mongo/Redis PSS MiB |
| --- | ---: | ---: |
| Connected cold idle |174.12|654.76|
| Chromium PDF,3 serial exports |835.56|1239.20|
|30-page PDF import,3 serial parses |397.65|875.04|
| Near-input-limit PDF rejected after layout |818.21|1048.88|
| PDF + ASR conversion,3 pairs |881.63|1262.38|
| Warm idle |375.05|864.50|

Totals include existing Mongo/Redis container healthchecks. `mongosh` healthchecks matter: Mongo's container tree peaked483.34MiB PSS, while mongod alone peaked221.40MiB. Excluding healthchecks, cold idle totaled404.60MiB and the sampled peak1112.30MiB. RSS sum peaked1814.92MiB but double-counts shared Chromium mappings; PSS is the comparison figure. Backend cgroup peak687.28MiB is **not** a standalone cold-host requirement because shared cached pages can be charged outside its cgroup.

Actual workloads: three89,021-byte Chinese PDF outputs; three30-page/15,796-character imports with Mongo checkpoints;186,013-byte source correctly rejected for PDF layout;160-second10,240,044-byte synthetic float WAV converted to5,120,078-byte PCM WAV. Local conversion uses Windows ffmpeg: its native memory is outside Linux measurements, so this is **not a measured Linux ASR maximum**. No Vite/build/client browser included; production frontend is static. This is an observed envelope, not a mathematical maximum for arbitrary concurrency.

Capacity calculation:1262.38MiB observed project envelope minus486.77MiB highest sampled server availability = **775.61MiB deficit before safety margin** (833.33MiB versus the lower availability sample). Existing host pressure means even idle startup is risky. Plan approximately2GiB for this project's bounded runtime, including/additionally reserving256–512MiB for unmeasured Linux ffmpeg/cold-page variation; retain separate OS/other-stack headroom.

Recommendation: a dedicated/reclaimed4GiB host is a starting deployment target with controlled Mongo cache and off-host builds, not a guarantee. If retaining all current stacks on evren_test, start planning at8GiB and remeasure their combined peaks. Increase disk capacity or approve targeted archival first;2.22GiB free is insufficient comfortable headroom. Local Puppeteer cache is1.3GB and may contain multiple versions; it is not an exact deployment artifact size.

Evidence: [deployment-memory-2026-10-20.json](evidence/deployment-memory-2026-10-20.json). The root configuration helper is documented in [SERVER_CONFIG.md](SERVER_CONFIG.md); configuration preparation does not remove the capacity/production/authentication blockers.

## Selective shutdown candidates (2026-10-20 follow-up)

Read-only inventory, retained logs, current Nginx routes and aggregate job-state queries; no service stopped. Memory below is Docker working set (`memory.current - inactive_file`), not configured limits; swap is separate and cannot be added to physical-memory savings. Values fluctuate. Retained logs are not a full historical audit and may exclude authentication/survey routes by design.

| Candidate | Resident MiB | Swap MiB | Observed use and consequence |
| --- | ---: | ---: | --- |
| Evren old backend-test,4containers |32.23|28.13|StartedJuly28; retained edge log latestSeptember2; no current public upstream to18082. First retirement candidate if private tests no longer needed. Bridge still probes.|
| Evren onboarding UAT,5containers |42.02|28.08|API startedAugust14; retained edge log latestAugust20; no current public upstream to18084. First retirement candidate if onboarding acceptance no longer needed. Bridge still probes.|
| Novelist whole stack,7containers |528.81|262.96|Largest application; real/public requests as recently asOctober19. Not demonstrably long-unused. Stopping disables novel frontend, generation and safety processing.|
| Two old remote Cursor agent sessions |48.46 PSS|296.88 SwapPSS|Approximately7.3/12.2days old, one cwdNovelist. May be paused work; user must confirm sessions are disposable.|
| Old private preview service |2.20 cgroup|10.02 process swap|StartedJuly30, no14day journal activity and no current public upstream18080. Small return only.|

Novelist decomposition: safety worker191.89MiB, backend99.19MiB, H575.79MiB, creative worker54.14MiB, gateway41.18MiB, PostgreSQL60.27MiB, Redis6.35MiB. Creative tasks have no live leases; latest successOctober14, but3safety cases remain open. Do not stop only safety processing while continuing public generation. If retaining read-only Novelist, a coordinated maintenance mode would be needed rather than silently leaving job submission enabled.

Keep Evren production (approximately54.23MiB Docker working set) and its account/session/SMTP/PostgreSQL/Redis dependencies: public API traffic was observed on2026-10-20. At that date it was the selected authentication foundation; the2026-10-23 decision now retains Clerk for CareerSprout without changing Evren. Keep Nginx, Docker/containerd, SSH and security agents. Static course directories are not separate always-running applications; deleting them saves disk, not meaningful runtime RAM.

Stopping both old environments saves approximately74.24MiB resident; stopping those plus all Novelist containers totals approximately603.05MiB resident and319.17MiB swap. Actual MemAvailable change must be measured after any approved stop. This does not by itself prove enough margin for CareerSprout's1262MiB sampled workload on a2GiB shared host.

Candidate evidence: `docs/evidence/server-shutdown-candidates-2026-10-20.json`. Execution evidence below supersedes the earlier no-change state.

## Authorized shutdown executed at18:57–18:59 CST

User requested A/B/C/D shutdown while explicitly requiring Novelist and Evren to remain available. C is the whole Novelist stack, so it was retained to honor availability; A/B/D were stopped. No container, data volume, database or project file was removed.

- A: all4 `evren-backend-test-*` containers stopped, exit0.
- B: all5 `evren-onboarding-uat-*` containers stopped, exit0.
- D: PID13113 and1532885 revalidated as the exact UID1000 Cursor agent entries/cwds, signalled SIGTERM using pidfds. Both absent in final verification; PID13113 briefly waited in disk sleep before exiting. Other Codex session untouched.
- Novelist7containers and Evren production5containers remain running; health-enabled services healthy. Nginx and public Evren static service active.
- HTTP200: Evren home/readiness/anonymous session; Novelist homepage after canonical redirect, local/public API health and application-auth configuration. Real browser screenshots confirmed Evren homepage and Novelist login form. No real login, generation or email actions were performed.
- MemAvailable453.68→609.97MiB (observed increase156.29MiB); swap1008.05→630.96MiB (decrease377.09MiB). Memory PSI/swap I/O remain elevated, so this is not approval to deploy CareerSprout yet.

Existing `unless-stopped` restart policies were retained; manual Docker stop persists across daemon restart under that policy. To restore A/B, explicitly start the same named containers, databases first and then APIs/bridges/edges; all volumes and releases remain. Cursor sessions must be deliberately reopened/resumed rather than replaying old process command lines. No automatic restart was scheduled.

Execution record: `docs/evidence/server-shutdown-executed-2026-10-20.json`.

# CareerSprout Docker image build diagnostics

## Goal

Diagnose and complete the local Linux Docker builds for CareerSprout campus frontend and backend images, plus the dedicated Redis image, without deploying or transferring images to the server.

## Confirmed evidence (2026-11-06)

- `frontend/Dockerfile.campus` now copies `frontend/.npmrc` before `npm ci`. This fixes the earlier `EUSAGE` caused by npm using its default peer resolution despite the project lock being generated with `legacy-peer-deps=true`.
- The latest Linux build used `--network=host` and plain BuildKit output. It passed image/context setup and entered `npm ci`, printed two deprecation warnings, then made no observable progress for over an hour before that build process was stopped. It produced no image; the cause of the stall is still unknown.
- Previous frontend builds initially failed because the build container used an unreachable loopback proxy (`127.0.0.1:7897`); an earlier host-network/proxy retry also exposed the npm lock-policy mismatch, now fixed by copying `.npmrc`.
- Backend Docker builds were blocked while apt fetched about 329 MB of Chromium/FFmpeg/fonts packages from Debian. No backend image resulted.
- Backend regression tests passed 16/16 and frontend campus tests passed 74/74. These do not prove Linux Docker image builds.
- No images, runtime smoke, server upload, or deployment were produced. The user requests diagnostic logging, external documentation research, a root-cause analysis, and a concrete remediation/build plan.

## Requirements

- Use bounded diagnostics to capture which exact Dockerfile step, proxy/registry request, and package operation stalls or errors. Use BuildKit plain/debug output and package-manager debug logging where it adds useful evidence; do not leave any build running indefinitely.
- Determine the actual BuildKit driver/network, proxy reachability and endpoint from inside the build context, registry/package feed response, and apt package fetch behavior. Do not print proxy credentials, `.env`, Clerk keys, npm tokens, or secret-bearing config; redact logs before saving.
- Research current official Docker BuildKit, npm config, and Debian apt proxy documentation. Base the diagnosis and fix on observed logs, not assumptions.
- Keep the project dependency policy and `npm ci` behavior intact. Do not edit `package-lock.json`, disable clean install, switch registries permanently, or hardcode a regional mirror unless the evidence shows it is required and the user explicitly approves a lasting policy change.
- Use a syntactically valid dummy publishable key only for a local non-deployable diagnostic frontend image if needed. Never transfer or deploy that image. A production release image requires the real matching `pk_live_` and backend runtime `sk_live_`; no secret values may be printed or recorded.
- Implement only the smallest evidence-based build fix, then build the campus frontend/backend and dedicated Redis image.
- Run a bounded one-off frontend Nginx container smoke if its image builds. Do not run the production Compose file as-is: it hardcodes production container, network, and volume names. Full multi-container isolated smoke belongs to the parent release task and must use an explicit override with unique names. Do not modify server resources, push, commit, or deploy.

## Acceptance Criteria

- [ ] A secret-safe diagnostic record captures the final failing stage and enough npm/apt/BuildKit network evidence to identify the root cause, with official source links and a concrete fix plan.
- [ ] The applied fix preserves `.npmrc`, lockfile integrity, and existing proxy/secret handling; it does not introduce an unapproved permanent package mirror or dependency-policy change.
- [ ] Frontend, backend, and dedicated Redis images build successfully with explicit unique local tags; image inspection confirms expected campus assets/runtime and no backend Clerk secret in image config/layers.
- [ ] Any dummy-key frontend image is marked diagnostic/non-deployable and never transferred. Production-key release image remains separately dependent on a privately configured matching live Publishable/Secret key pair.
- [ ] A bounded one-off frontend container returns the base path, SPA deep route, and hashed assets using only its exact task-owned container and loopback port; no production Compose resources are reused. Full stack smoke is deferred to the parent task with an explicit isolated Compose override.
- [ ] No deployment, server mutation, public route change, git commit, or push occurs.
- [ ] Deployment documentation records the observed root cause, exact build outcomes, and remaining release prerequisites without claiming Docker success before evidence exists.

## Out of Scope

- Production deployment/upload to `zgyjserver`, server-side builds, or changes to Nginx/DNS/TLS.
- Changing dependency versions or npm lockfiles, permanently changing package registry/mirror policy, or weakening `npm ci`.
- Reading or printing secret values from local `.env` files, sharing credentials, or using a fake Clerk key in a deployable artifact.
- Enabling/disabling sign-up, changing auth policy, or requiring real Clerk session/two-account tests for local image builds.

## Open Questions

- None block the diagnostics. BuildKit proxy visibility, reachable package feeds, and final image-build duration are evidence to collect during the task.

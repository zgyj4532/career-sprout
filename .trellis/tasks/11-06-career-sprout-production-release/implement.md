# Implementation and verification plan

1. **Reconcile state.** Read the parent deployment PRD/design/implement plan, local follow-up results, current `docs/CAREER_SPROUT_DOCKER_DEPLOYMENT.md`, source branch/dirty state, and secret-safe local key presence/prefix without printing values. Do not overwrite local dev keys or unrelated user files.
2. **Resolve Clerk certificates.** Confirm Clerk Domains still shows DNS verified and certificate status for `clerk.crayzamb.cloud` and `accounts.crayzamb.cloud`; check public CNAME/CAA results. Wait or contact Clerk Support if issuance remains stuck. Confirm when both Clerk certificates are active before relying on those custom API/account domains.
3. **Build images off-host from immutable source.** Select/verify an accessible trusted Linux Docker builder and registry/npm/Debian feeds. Build frontend with real Production `pk_live_` only, backend, and dedicated Redis image; tag all images by full source SHA, use the documented Mongo image tag, inspect the frontend key label, and ensure backend secret never enters image layers/build args. Keep `.npmrc` present before `npm ci`; preserve `npm ci` policy. Bound downloads/build duration and record exact results.
4. **Run disposable production-like smoke.** Use only test-format/dummy Clerk values in a non-release disposable build if a real-key image is unnecessary for local checks; never transfer that image. Before Compose, create a temporary override that removes/replaces every production `container_name`, volume `name`, network `name` and static address, and host-published port with unique diagnostic values; use a unique project name and disposable secret files. Pull/tag the exact pinned Mongo image required by `pull_policy: never`. Render Compose config and verify it contains no production resource names, fixed production ports, or production subnet before startup. Validate healthy Mongo/Redis/backend/frontend, authenticated/unauthenticated route boundaries, `/career-sprout/`, deep links, hashed assets, API proxy, restart persistence, Redis ACL, and isolated backup/restore. Record exact temporary resource names and remove only those resources.
5. **Prepare the release inventory/config.** From actual changed/untracked files and runtime dependencies generate the complete config/archive inventory and checksums, excluding credentials, `.env`, caches, data, and unrelated changes. Prepare private `career-sprout.env` plus Mongo/Redis password and ACL files with restrictive permissions. Populate matching live Clerk values privately; user-reported local secret stays local unless validated and transferred through the private path. Verify production signup/sign-in toggles remain on and backend bypass is false.
6. **Recheck target read-only.** Connect only to the configured `zgyjserver` alias after verifying host identity. Record available RAM/swap/disk, Docker/runtime, unrelated containers/volumes/networks, release directory ownership, port 18082, current Nginx TLS route and permissions. Reconfirm existing swap is used within finite limits; no unrelated stop/restart/remove or broad cleanup.
7. **Transfer and verify.** Build from a detached worktree at the exact full committed source SHA. Create image/config archives and complete SHA-256 manifests, transfer public artifacts separately from private files, and verify archive, extracted files, private file manifests and image tags on the target before startup.
8. **Deploy narrowly.** Create a versioned release directory, load only the named images, validate Compose configuration without displaying secrets, start only CareerSprout services with its dedicated volumes, and confirm readiness. Update only `/career-sprout` in the authorized existing Nginx virtual host; overwrite `X-Forwarded-For` with `$remote_addr` at that first trusted hop.
9. **Verify production path.** Exercise HTTPS root redirect, `/career-sprout/`, SPA deep link, hashed assets, `/career-sprout/api/health`, Clerk custom-domain TLS, public sign-up/sign-in availability and backend protected-resource behavior. Real Clerk session and two-account tests may remain `NOT_RUN`; do not block public registration on them and do not claim live-account behavior without evidence. Confirm exact public URL and remote release image/file hashes.
10. **Preserve rollback and report.** Retain prior release/config/assets and persistent volumes. Verify project-only rollback procedure without deleting data. Update docs/CHANGELOG with observed state, checks, exact image/source SHA and remaining NOT_RUN boundaries. No commit/push unless separately authorized.

## Validation evidence

- Successful full image builds (frontend, backend, Redis), SHA-bound image inspection and config/archive checksums.
- Isolated Compose smoke with actual readiness and HTTP results for path, deep route, static asset, health/API and protected endpoint behavior; persistence/restart and backup/restore evidence.
- Read-only pre-deployment host inventory; post-deployment exact remote image/tree hashes, service health, HTTPS headers/status/route behavior and TLS certificate result.
- Clerk dashboard status for both managed certs; production auth screens enabled. Session tests remain NOT_RUN if skipped by user.

## Rollback points

- Before startup: do not expose route; retain current host configuration.
- Failed startup/smoke: stop only named CareerSprout services; leave existing route unchanged; preserve all volumes and other services.
- Failed public route: revert only the CareerSprout Nginx location to previous configuration, then restore the prior immutable release if available.
- Never run `docker compose down -v`, `docker system prune`, or remove resources not created/identified by this task.
## Execution progress

- **Complete:** task reconciled and activated; Clerk's dashboard shows both managed certificates issued; custom Clerk endpoints have valid TLS; target host inventory and route checks were read-only.
- **In progress:** inventory now covers 70 release paths plus one explicitly excluded machine diagnostic. Initial commit `0daec0e6e63d35aeb2f11afd33e6035a597f7b5a` is tree/blob verified; a follow-up adds a deploy-only `.dockerignore` after identifying that a root Mongo build context could carry private env files to Docker. The user authorized local commits without push.
- **Private setup:** the user-confirmed live Clerk pair and four random database/cache passwords are stored locally with restrictive permissions; update the env tag and checksum manifest after the final source commit. No private values were shown.
- **Not run:** SHA-bound release image build, disposable Compose smoke, backup/restore proof, transfer, deployment, Nginx path update, and post-deploy checks. No server mutations have occurred.

## Checks run before source commit

- Backend focused regressions passed **16/16** under WSL Node 24.14.1 with system MongoDB 8.0.34: startup/auth contract, database index readiness, and campus isolation.
- Frontend focused regressions passed **62/62** across CampusApp routing, API path handling, auth/sign-up, and ResumePage compression comparison.
- Frontend lint passed. Backend lint passed for all changed backend source/test files; repository-wide backend lint remains red on six errors in untouched legacy files (`communityAppController.js`, `uploadValidator.test.js`, `postScheduler.js`).
- The full campus test commands exceeded the 300-second runner limit. The frontend full run exposed one duplicate-text selector failure; the assertion now scopes to the comparison heading and the focused file/test passes. A Windows Node 20 attempt failed the PDF child-process fixture; the same fixture passes in the project's documented WSL Node 24 runtime.
- Docker image builds, disposable Compose smoke, backup/restore proof, transfer, deployment, and public URL verification remain pending.

# CareerSprout production release follow-up

## Goal

Deploy the campus-only CareerSprout service to `zgyjserver` and make it usable at `https://crayzamb.cloud/career-sprout`, with Clerk email-code sign-in and public sign-up enabled. This is a production release task; it does not authorize changing unrelated server workloads.

## Confirmed status (2026-11-06)

- The existing parent task `11-04-docker-deploy-career-sprout` owns the original deployment goal. The separate local follow-up `11-04-career-sprout-docker-deploy-followup` completed regression work but explicitly did not deploy.
- Clerk Domains screenshot supplied by the user now shows Frontend API, Account portal, and Email DNS verification green, with both Clerk-managed SSL certificates **Issued**. This is dashboard evidence; it does not establish that the deployed site or runtime auth works.
- Backend Docker image built locally using the SJTU Debian mirror: `career-sprout-backend:local-sjtu-mirror-20261106`, digest `sha256:89fb7b8839ad13a0c89479074e65fa0cbe32237f38083ecce00548354779ac55`. Isolated `--network=none` runtime inspection found Chromium, ffmpeg, entrypoint, and no `.env*` files in `/app`.
- Existing local frontend diagnostic image used a dummy `pk_live` value and is **not deployable or transferable**. Prior isolated HTTP smoke returned 200 for the app base, auth route, and a JS asset; full disposable Compose smoke and a SHA-bound image set have not been completed.
- Secret-safe inspection found live-format `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in local `backend/.env`; the deployment variable `CLERK_PUBLISHABLE_KEY` there and `frontend/.env.local` are test-format. The user confirms the `NEXT_PUBLIC_` live key belongs to the same Production Clerk instance as the live secret; a secret-key API request returned HTTP 200. The deployment environment will use the confirmed live publishable key. No key value was output.
- Read-only preflight on `zgyjserver` reached `VM-0-17-ubuntu` as `ubuntu`: 1.7 GiB RAM, 1.1 GiB available, 9.9 GiB swap (75 MiB used), 29 GiB disk free, Docker 27.5.1 and Compose 2.32.4 via sudo. No containers, volumes, or non-default networks exist; loopback port 18082 is free; Nginx owns 80/443. `/opt/career-sprout` is absent. HTTPS `/career-sprout/` returns 404; public root HTTPS succeeds. No server files, services, routes, or data were changed.
- Current source HEAD is `463e7d6b3962bb22d8bb3cbb5efa0455c7227907` on `feat/teacher-portal-career-workspace`. The worktree has 21 modified tracked files and 14 untracked paths, including deployment artifacts; these are not yet in a commit and their complete delivery scope must be reconciled before creating immutable release images.

## Requirements

- Resolve any Clerk certificate issuance issue before relying on the custom domains. The user now confirms both Clerk-managed certificates are issued; refresh Clerk status and public DNS during execution.
- Complete reproducible off-host Linux Docker builds of the campus frontend, backend, and dedicated Redis image; use project npm configuration and a reachable package proxy/mirror. Do not weaken `npm ci`, use test keys in production, or leave indefinite builds running.
- Run disposable local production-like Compose smoke for service readiness, `/career-sprout/`, deep links/assets, API health, Clerk public-key/runtime agreement, authenticated boundary behavior, persistence, and the project's isolated backup/restore contract. Remove only the explicitly named temporary resources.
- Build immutable release artifacts from a full committed source SHA. Generate the delivery manifest from actual changed/untracked/runtime-dependent files; exclude `.env`, private config, credentials, caches, and unrelated user work. Verify artifact and remote file/image integrity.
- Configure a private, project-only production environment. Use a matching Production `pk_live_` for the frontend build and `sk_live_` only in backend runtime configuration. Configure dedicated MongoDB/Redis secrets and ACLs without exposing values. The user says a Secret key is in `backend/.env`; verify the key format without displaying it and transfer it only via the approved private method.
- Recheck `zgyjserver` read-only before deployment: identity/access, disk/RAM/swap/Docker, owned release directory, listener on `127.0.0.1:18082`, existing Nginx route/TLS, and project resource isolation. Use the already-approved existing swap with finite container limits; do not create extra swap or alter unrelated services.
- Deploy only this project's immutable release and configure only `/career-sprout/` on the existing HTTPS virtual host. The first trusted host Nginx must overwrite `X-Forwarded-For` with `$remote_addr`; keep backend, MongoDB, and Redis private.
- Keep production Clerk sign-in and public sign-up enabled. Real Clerk session and two-account isolation tests may remain `NOT_RUN` per the user's instruction and are not release gates. Do not add arbitrary allowlists, administrative approval, or other registration barriers. Do not weaken backend authentication for protected resources.

## Acceptance Criteria

- [ ] Clerk reports both Frontend API and Account portal SSL certificates active/issued; any persistent issuance failure has a documented provider diagnosis and next action.
- [ ] Frontend, backend, and Redis images build successfully from the exact committed source SHA; image labels/tags correspond to that SHA and the frontend contains only the public `pk_live_` key.
- [ ] Disposable Docker smoke passes health/readiness, deep route, static asset, API route, auth boundary, persistence/restart, and isolated backup/restore checks; temporary resources are removed by exact name only.
- [ ] Production secrets/config are private and correctly scoped; backend starts only with matching live Clerk credentials, dedicated authenticated data services, production profile, and development bypass disabled.
- [ ] The exact deployment bundle and remote release tree/content are verified against generated manifests; no secrets or unrelated files are transferred.
- [ ] Deployment changes only the CareerSprout release and authorized Nginx path; no unrelated server services/data are modified.
- [ ] `https://crayzamb.cloud/career-sprout/`, a deep link, hashed assets, and `/career-sprout/api/health` respond correctly over HTTPS. Public sign-in and sign-up remain enabled; Clerk real-session checks may be recorded `NOT_RUN`.
- [ ] If a CareerSprout release or route already exists at execution time, rollback to its prior image and proxy configuration preserves project data; otherwise document removal of only the newly added project route/services while preserving any project data.

## Out of Scope

- Changing unrelated server applications, databases, Docker resources, Nginx routes, or credentials.
- Building or deploying the dormant upstream full-platform entry point.
- Reusing another project's data, credentials, or persistent volumes.
- Closing public registration pending real-session/two-account tests; those checks are explicitly optional for this release.
- Creating new swap, bypassing authentication, or using development/test Clerk credentials in production.

## Open operational state

- Clerk SSL: **ISSUED** per the user's dashboard screenshot; custom Clerk endpoints return with valid TLS. Production site remains undeployed.
- Docker package: **PARTIAL** — backend local image built with SJTU mirror; the frontend diagnostic image is non-deployable. No SHA-bound release images or full Compose smoke. Focused backend tests passed 16/16 and focused frontend tests passed 62/62; both broader campus commands exceeded the 300-second runner limit.
- Production private config: **LOCAL_READY_FOR_PRIOR_SHA** — live Clerk pair and four random Mongo/Redis credentials are in a mode-0700/0600 private WSL directory; update the release SHA and checksum manifest after the build-context security commit, then transfer only via SSH.
- Server release/public URL: **NOT_DEPLOYED** — current public path returns 404; target has no CareerSprout containers, volumes, release directory, or 18082 listener. No host mutations have occurred.
- Immutable source: **FOLLOW-UP_COMMIT_REQUIRED** — initial release commit `0daec0e6e63d35aeb2f11afd33e6035a597f7b5a` matched all 69 inventory paths and blobs. Build-context secret exclusion is now an additional source change; the final source commit must include it. No push.

## Remaining release gates

- The user authorized local release-only commits, without pushing. A source commit is already verified; the secret-safe build-context correction must be committed and verified before creating images.
- The confirmed live Clerk pair and generated MongoDB/Redis files are prepared locally under restrictive permissions; regenerate the `career-sprout.env` release tag and private checksum manifest for the final source SHA.

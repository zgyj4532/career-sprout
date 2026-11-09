# Docker部署 CareerSprout

## Goal

为 CareerSprout 准备 Docker 打包并部署到经用户确认的 `zgyjserver`（`124.223.188.111`），目标地址为 `https://crayzamb.cloud/career-sprout`；备案已完成，按用户要求使用主机现有 swap 作为有限内存余量。

- User confirms the configured `zgyjserver` host and `crayzamb.cloud` hostname are the intended deployment target; desired path is `/career-sprout`.
- Read-only inspection showed 1.7 GiB physical RAM, about 1.0 GiB available, 9.9 GiB configured swap (about 137 MiB used), 50 GiB disk with 30 GiB available, Docker 27.5.1 and Compose v2.32.4 (available with `sudo`), Nginx 1.24, no containers or Docker volumes, default Docker networks only, no host route for the planned `172.30.0.0/24` subnet, and host loopback port 18082 free. DNS resolves `crayzamb.cloud` to this host and HTTPS succeeds, but `/career-sprout` currently returns Nginx 404. The private CareerSprout server env file is absent; no server changes have been made.

## Requirements

- Package the current CareerSprout campus application for Docker using its existing frontend/backend runtime contracts; do not deploy the upstream full-platform entry point.
- Deploy to the confirmed `zgyjserver` and serve `/career-sprout` over `https://crayzamb.cloud`, preserving correct API routing and client-side routes.
- Resolve and implement the production startup and authentication safety requirements needed for this campus application to run safely behind HTTPS.
- Verify the target server's capacity/runtime and actual DNS, TLS, and reverse-proxy routing for `/career-sprout` before deploying publicly.
- Do not stop, remove, or alter unrelated server workloads or data.
- Keep credentials private; use only project-specific MongoDB/Redis and the existing authorized Clerk application. Do not reuse other applications' stores or secrets.
- Keep public Clerk sign-in and sign-up enabled in production. Real Clerk sessions and two-user isolation may be `NOT_RUN` at the user's direction and are not release gates; production auth must still use matching live keys, fail closed for protected resources, and never use a development bypass.
- Do not claim successful release without remote deployment integrity and exact public URL verification.

## Confirmed Technical Constraints

- `backend/package.json` starts `src/index.js`; `backend/src/campusServer.js` is the campus entry but its startup guard currently rejects production/staging and non-loopback binds.
- `docs/DEPLOYMENT_ASSESSMENT.md` (2026-10-23) requires production authentication, capacity, HTTPS/origin, and provisioning checks before public release. Historical capacity data describes another host, not `zgyjserver`.
- `docs/SERVER_CONFIG.md` documents a private-config helper targeting `evren_test`; it is not a deployment tool and must not be repurposed for this deployment.
- `frontend/vite.config.js` currently emits root-based assets by default; the requested path deployment requires working asset base, SPA fallback, API routing, and Clerk authorized-origin configuration.
- Production startup requires an explicit project MongoDB URI. Production auth must fail closed without development identity fallback.
- The README describes the campus entry as WSL-local, not production-ready. Existing local Compose/data must not be replaced by destructive volume operations.
- SSH configuration resolves the user-supplied name differently: `zgyjserver` is the configured alias for user `ubuntu`; `zgyj_server` is not configured. The user approved `zgyjserver`.

## Acceptance Criteria

- [ ] Docker packages the campus frontend/backend with safe production configuration and no development bypass or secret leakage.
- [ ] HTTPS `https://crayzamb.cloud/career-sprout` correctly serves the app, hashed assets, SPA routes, and API paths.
- [ ] Production Clerk auth uses matching live keys, fails closed for protected resources, and has no development bypass; public sign-in and registration remain enabled. Real sessions and two-user isolation may be `NOT_RUN` per user direction and do not block registration.
- [ ] Dedicated CareerSprout data services/storage, persistence, backup/restore, and rollback are verified without altering unrelated server workloads/data.
- [ ] Existing swap is bounded/available to the project containers, and observed service memory/swap pressure remains stable; Docker/runtime, ownership and HTTPS route are verified before deployment.
- [ ] Remote release files are integrity-checked and smoke-tested; the exact confirmed URL succeeds.

## Out of Scope

- Disabling/removing/modifying other server applications, containers, databases, or data.
- Reusing another project's MongoDB, Redis, Clerk credentials, or private configuration.
- Using test-format Clerk keys or a development authentication bypass in production.

## Planning Status

- User approved including production startup/auth safety, server capacity, domain/TLS routing, and deployment in this task.
- Earlier read-only checks found no private CareerSprout deployment env and local files then contained only test-format Clerk keys. The user now reports a Secret key in local `backend/.env`; its prefix/content have not been verified, and the private server env and matching frontend Production Publishable key remain unverified. Real Clerk sessions/two-account tests are not release gates; matching live keys are required for functioning production auth.

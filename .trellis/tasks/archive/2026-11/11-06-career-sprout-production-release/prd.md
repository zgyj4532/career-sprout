# CareerSprout production release follow-up

## Goal

Deploy the campus-only CareerSprout service to `zgyjserver` and make it usable at `https://crayzamb.cloud/career-sprout`, with Clerk email-code sign-in and public sign-up enabled. This is a production release task; it does not authorize changing unrelated server workloads.

## Confirmed status (2026-11-06)

- Clerk Dashboard shows DNS verified and both custom-domain SSL certificates issued. Public Clerk endpoints use valid TLS.
- The deployment source commit is `9946f38b2d434f429e968c7bdaaff9f1d49e4df1` on `feat/teacher-portal-career-workspace`.
- All four release image tags were verified on the server. A fresh frontend build at the final SHA failed during `npm ci` because the registry transfer stalled; the release reuses images built at `16bab7a7cdc2f7ff9f7fe3d50b09e264450a2ad8`. The source diff contains only Compose/Mongo-init and docs/task changes, not image inputs. Local/server filesystem-layer hashes match for all four images; OCI revision labels remain the actual build SHA `16bab7a7cdc2f7ff9f7fe3d50b09e264450a2ad8`.
- Deployment completed on `zgyjserver` (`VM-0-17-ubuntu`). Project-specific images, containers, networks, and five volumes were added. The host Nginx TLS vhost now proxies only `/career-sprout/` to loopback port 18082; existing TLS and routes remain intact.
- Production Clerk and database credentials were transferred only over SSH/SCP. Local private originals remain mode 600; the server Compose directory is mode 700 and file-backed runtime secrets are mode 0444 inside it because this Docker Compose version ignores secret `mode` options.
- Before public ingress, all five volumes were backed up as one quiescent encrypted archive. The encrypted copy passed checksum/decryption verification; all five volumes restored to fresh isolated local volumes, and restored Mongo/Redis passed `ping` checks. The backup key remains local/off-host.
- Target preflight found 1.7 GiB RAM, 9.9 GiB swap, 29 GiB free disk, no existing Docker workloads/volumes/networks, and no listener on port 18082. No unrelated resources were changed.

## Requirements

- Resolve any Clerk certificate issuance issue before relying on the custom domains. The user now confirms both Clerk-managed certificates are issued; refresh Clerk status and public DNS during execution.
- Build the campus frontend, backend, and dedicated Redis image from the final SHA; if a fresh build is blocked, reuse prior images only with proof that every image input and filesystem layer is unchanged, and record the original image revision labels. Do not weaken `npm ci`, use test keys in production, or leave indefinite builds running.
- Run disposable local production-like Compose smoke for service readiness, `/career-sprout/`, deep links/assets, API health, Clerk public-key/runtime agreement, authenticated boundary behavior, persistence, and the project's isolated backup/restore contract. Remove only the explicitly named temporary resources.
- Build immutable release artifacts from a full committed source SHA. Generate the delivery manifest from actual changed/untracked/runtime-dependent files; exclude `.env`, private config, credentials, caches, and unrelated user work. Verify artifact and remote file/image integrity.
- Configure a private, project-only production environment. Use a matching Production `pk_live_` for the frontend build and `sk_live_` only in backend runtime configuration. Configure dedicated MongoDB/Redis secrets and ACLs without exposing values. The user says a Secret key is in `backend/.env`; verify the key format without displaying it and transfer it only via the approved private method.
- Recheck `zgyjserver` read-only before deployment: identity/access, disk/RAM/swap/Docker, owned release directory, listener on `127.0.0.1:18082`, existing Nginx route/TLS, and project resource isolation. Use the already-approved existing swap with finite container limits; do not create extra swap or alter unrelated services.
- Deploy only this project's immutable release and configure only `/career-sprout/` on the existing HTTPS virtual host. The first trusted host Nginx must overwrite `X-Forwarded-For` with `$remote_addr`; keep backend, MongoDB, and Redis private.
- Keep production Clerk sign-in and public sign-up enabled. Real Clerk session and two-account isolation tests may remain `NOT_RUN` per the user's instruction and are not release gates. Do not add arbitrary allowlists, administrative approval, or other registration barriers. Do not weaken backend authentication for protected resources.

## Acceptance Criteria

- [x] Clerk Dashboard reports Frontend API and Account portal SSL certificates issued; custom domains were verified over TLS.
- [x] Four pinned release images are present and their local/server filesystem layers match; image input files are unchanged between the original image build commit and the deployed source commit. The fresh final-SHA frontend build failure and original OCI revision labels are documented; the frontend contains only the production public key.
- [x] Disposable Compose smoke passes service readiness, deep routes/assets, API health, and protected-route boundary; the five-volume encrypted backup was restored into fresh isolated volumes and Mongo/Redis answered health checks.
- [x] Production config uses matching live Clerk keys, the live-signup UI, authenticated Mongo/Redis credentials, production profile, and `DEV_BYPASS_AUTH=false`; backend and protected API boundary are healthy.
- [x] Exact public config archive and private runtime files passed SHA-256 verification on the target; no credentials entered the image archive.
- [x] Only CareerSprout Docker resources and the authorized `/career-sprout/` Nginx location were added. Existing server workloads, Nginx routes, TLS, and data were preserved.
- [x] `https://crayzamb.cloud/career-sprout/`, login/register deep routes, hashed assets, API health, and protected-route behavior were verified over HTTPS. Public sign-in/sign-up forms render; no registration gate was added. Real Clerk sessions remain `NOT_RUN`.
- [x] No prior CareerSprout release existed. The prior Nginx vhost is backed up; rollback can remove only the project route and stop only its services while preserving all five data volumes.

## Out of Scope

- Changing unrelated server applications, databases, Docker resources, Nginx routes, or credentials.
- Building or deploying the dormant upstream full-platform entry point.
- Reusing another project's data, credentials, or persistent volumes.
- Closing public registration pending real-session/two-account tests; those checks are explicitly optional for this release.
- Creating new swap, bypassing authentication, or using development/test Clerk credentials in production.

## Completion state (2026-11-06)

- Clerk SSL: **ISSUED**; Clerk custom endpoints validated over TLS.
- Deployment: **LIVE** at `https://crayzamb.cloud/career-sprout/`.
- Services: four project containers healthy; backend, Mongo, Redis are not published to host ports.
- Public access: app, login/register routes, JS/CSS assets and API health return 200; protected profile route returns 401. Registration and sign-in remain open.
- Images: four final-SHA tags with verified matching filesystem layers local-to-server; OCI labels correctly retain build source SHA `16bab7a7cdc2f7ff9f7fe3d50b09e264450a2ad8`. Final-SHA frontend `npm ci` could not complete due npm registry network timeout. Reused image build inputs are unchanged in the source diff; no claim of a fresh final-SHA frontend build.
- Backup: initial five-volume encrypted archive is stored off-host; the key remains local. Restore smoke passed using fresh isolated volumes.
- NOT_RUN: real Clerk sign-in/session, email code delivery/completion, and account creation. User requested skipping real sessions; public signup/login were not gated.

# Technical design

## Scope and boundaries

Package and deploy the repository's campus-only application, not the dormant upstream full-platform app. Expected runtime is a production frontend static server/reverse proxy, one campus backend process, and project-dedicated MongoDB and Redis unless verified server-owned isolated instances are explicitly approved. Do not modify unrelated workloads or reuse their credentials/data.

The frontend must be built for `/career-sprout/`, serve immutable hashed assets and non-cached HTML, support SPA route fallback, and forward `/api/` to the campus API without stripping required paths. Verify Clerk's exact public origin and callback behavior. Backend binds to loopback/container network only; public ingress is exclusively HTTPS reverse proxy. Trust-proxy configuration must only trust the actual proxy path and must not enable spoofable forwarded headers.

## Production safety contract

Replace the blanket campus-local startup prohibition with an explicit production profile/config contract; never weaken the development-only loopback bypass. Production must refuse startup unless Clerk backend public/private credentials and corresponding frontend public key are configured consistently, development bypass is false, exact HTTPS frontend origin is valid, server-side teacher UID allowlist is configured as intended, and dedicated MongoDB/Redis endpoints are valid. Auth middleware must fail closed when Clerk is unavailable; health routes must not leak secrets or sensitive topology. Validate cookie, CORS, CSRF, rate-limit, secure-header, and trusted-proxy behavior behind TLS. Keep one backend process because write/delete admission is process-local.

## Data and operations

Use separately named CareerSprout persistent volumes/directories, restrictive secret-file permissions, non-public DB ports, bounded CPU/memory plus a deliberate cap on container RAM+swap usage, health checks and dependency readiness. The host already has roughly 10 GiB swap; do not create additional swap unless measurement proves it is necessary and the user approves it. Swap is slower than physical RAM and does not count as equivalent capacity. Establish a backup/restore path and prove rollback preserves data. Never run destructive compose volume operations or clean up unrelated Docker resources. Deployment transfer inventory must be generated from tracked/untracked deliverables and dependencies; secrets, local env, caches, and runtime data excluded.

Use immutable release directories or image digests with an explicit active release pointer. Retain the previous working release/assets through rollout; rollback switches the app/proxy to that release without deleting persistent data. Confirm ownership, available disk/RAM, swap pressure, and existing Docker usage before provisioning.

## Release gates

1. Verify the `zgyjserver` host key and access, current physical RAM/swap pressure, Docker/runtime, owned deployment directory, DNS for `crayzamb.cloud`, existing TLS certificate/proxy route, and permission to change only the project path. The user approved use of existing swap; set finite project limits and block release if the measured workload causes sustained swapping or degraded services.
2. Build and exercise the production Docker artifacts locally; test startup refusal on insecure/missing config, health, API path, SPA deep link, static assets, Clerk session/auth boundary, and cross-user isolation.
3. Obtain the project-specific secrets through the approved private config mechanism; never print, commit, or forward them into frontend build artifacts. Validate actual Clerk authorized URLs and real verified test sessions.
4. Deploy the verified artifact to the dedicated target, configure only the authorized reverse-proxy location, verify complete remote release contents and hashes, persistent data boundaries, health, and exact public URL.
5. Enable public registration only after real verified-account and isolation gates pass; otherwise keep registration closed and report the deployment as gated, not complete.

## Compatibility and rollback

Preserve current local-development defaults and existing local volumes/config. Keep `campus-local` behavior bound to development + loopback and its current explicit bypass policy. Roll back the image/release and proxy config to the last known good revision; do not revert/delete database data absent a compatible migration and separately verified restore plan. Database/schema migrations, if required, must be additive/backward-compatible across the rollback window.

## Deferred operational dependencies

Public DNS/TLS/proxy ownership, new host capacity, private project database endpoints, existing Clerk credentials/authorized origins, and human real-session validation are not established by the repository. Verify through authorized server inspection and private operator configuration; block public exposure rather than infer or bypass.

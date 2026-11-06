# Production release design

## Scope and boundaries

This child task completes the original campus-only deployment goal from `11-04-docker-deploy-career-sprout`; it is separate from the local verification follow-up. Target `zgyjserver`, application path `/career-sprout`, base URL `https://crayzamb.cloud/career-sprout`. Do not alter unrelated server resources or use upstream full-platform entrypoints.

Clerk owns TLS for the custom Frontend API (`clerk.crayzamb.cloud`) and Account portal (`accounts.crayzamb.cloud`) CNAMEs. The user-provided Clerk dashboard screenshot shows DNS verified and both Clerk-managed certificates issued. This does not establish that the website is deployed or that production authentication succeeds.

## Release architecture

- Build the campus frontend/backend and dedicated Redis image on a trusted off-host Linux Docker builder from an exact full source SHA. Pull/tag the Mongo image under the same immutable SHA release. Keep the browser-visible Clerk publishable key in frontend build configuration only; backend Clerk secret remains runtime-only.
- Build configuration uses repository `.npmrc` before `npm ci`; do not relax clean-lock installation. Package feeds/proxy must be reachable from BuildKit. Bound each build attempt; no indefinite wait.
- Compose uses the existing campus-only network/containers, private MongoDB/Redis, project-specific persistent volumes, finite memory and RAM+swap limits, readiness checks, and loopback-only host ingress. Preserve the one-backend-process invariant and never run destructive volume cleanup.
- Deliver immutable image/config archives plus complete generated SHA-256 manifests. Private environment and database/Redis secret files travel separately over a private channel; never include them in images, public archives, logs, or chat.
- Existing host Nginx keeps TLS and proxies only `/career-sprout/` to `127.0.0.1:18082`. It overwrites `X-Forwarded-For` with `$remote_addr`; only the fixed frontend container is trusted by Express. Backend, MongoDB, and Redis remain unpublished.

## Auth behavior

Production Clerk email-code sign-in and public email sign-up remain enabled. Use matching Production `pk_live_` at frontend build time and `sk_live_` at backend runtime. The user reports `sk_live` material was saved in local `backend/.env`; verify its prefix privately without displaying it and install the production secret only through the approved private configuration. Do not use test keys or local bypass. Real Clerk sessions and two-account tests are explicitly optional/NOT_RUN at user's direction and are not rollout gates; protected APIs still enforce Clerk authentication and owner boundaries.

## Execution sequence and rollback

1. Confirm the user-reported issued Clerk managed certificates and public DNS state before relying on the custom domains.
2. Complete image builds and full isolated Compose smoke. Generate a temporary override that replaces every production container name, named volume/network, static address/subnet, and host-published port; use a unique project name, disposable private secrets, and a pinned Mongo image matching `pull_policy: never`. Verify rendered config contains no production names/ports/subnet before starting, then generate artifact inventory/hashes from actual deliverables.
3. Recheck target identity, capacity/swap, Docker use, route ownership, listener, and release directory read-only.
4. Prepare private release configuration; build from committed SHA; transfer and verify image/config/private-file manifests.
5. Start only this project, verify health/routes/assets/API/auth boundary/persistence, then add or update only the approved Nginx location and verify exact public URL.
6. Keep previous immutable release and its assets/config. Rollback switches only the CareerSprout image/release and Nginx location; preserve persistent data.

## Risk handling

- Certificate state may remain pending despite green DNS; the current public CNAMEs resolve correctly and public CAA lookups showed no restriction. Escalate persistent issuance to Clerk with hostnames/status, never transmit private certificates or keys in chat.
- Package feed slowness previously stalled both npm and Debian downloads. Use the configured proxy/mirror correctly, bound attempts and report exact final stage; do not change dependency policy or claim a successful image from a partial build.
- Host has low physical RAM with existing swap. Preserve approved swap use and documented container caps; check actual available resources and impact before starting. Do not create extra swap or introduce unrelated service restrictions.
- Public URL, callbacks and rate-limit client identity depend on the exact subpath and first-proxy header contract. Keep ingress private until the specified Nginx routing is in place.

# Implementation and verification plan

1. Load backend, frontend and project-deployment specs; inspect existing compose files, Docker ignore rules, configuration helpers, Clerk auth flow, health endpoints, proxy behavior, and current server route ownership. Reconcile current docs against deployed-code facts.
2. Establish exact production contract: isolated production profile, fail-closed Clerk requirements, loopback/private backend ingress, exact HTTPS origin and path-base behavior, proxy trust policy, resource bounds, and explicit registration gating. Add regression coverage for production startup refusal and bypass/auth/CORS/proxy edge cases.
3. Implement campus-specific production runtime without changing local development behavior. Add minimal Docker build/runtime artifacts for campus frontend/backend and only dedicated required services. Exclude secrets, Git metadata, test/cache artifacts and local persistent data. Add uniquely named persistent volumes, Mongo/Redis authentication, a backup-only Redis `SAVE` account, production model index creation, readiness/health checks, bounded CPU/memory and explicit `mem_limit` / `memswap_limit`; leverage only the host's existing swap, and fail rollout if observed memory/swap pressure is unstable. Add safe secret injection and teardown commands that never remove volumes by default.
4. Implement `/career-sprout/` asset base, SPA fallback, immutable asset caching, no-cache HTML, retained prior hashed assets and API proxy routing; verify Clerk redirect/callback paths, runtime/build publishable-key agreement and exact approved origin. Ensure backend one-process invariant and forwarded-header handling match the actual proxy.
5. Build artifacts and run targeted production-like Docker smoke locally: safe startup configuration, healthy dependencies, health endpoint, API paths, SPA deep links/assets, authenticated/unauthenticated behavior, data isolation, container limits, restart persistence, backup/restore and rollback. Run affected existing campus tests; never treat mock auth as real Clerk acceptance.
6. Read-only inspect `zgyj_server`: verify host fingerprint, disk/RAM/swap/CPU and Docker usage, OS/runtime, available isolated deployment directory, installed reverse proxy/certificate, domain DNS/TLS, existing `/career-sprout` route and owner approval. Do not stop, remove, restart or modify unrelated services. Stop release if capacity or required access is insufficient.
7. Prepare a complete artifact manifest from actual changes and dependencies. Verify no private files, unrelated work, local datasets, caches or credentials are included. Build only from a detached worktree of the exact committed full SHA; verify image and deployment bundle hashes at transfer boundaries.
8. Validate secret config privately using the approved project-only path; never display secrets or place backend secrets in Vite build args/assets. Verify actual Clerk production configuration and real test-account/verified-email flows plus two-user isolation. Keep public registration closed until these pass.
9. Deploy immutable release to a versioned dedicated directory, persist data in project-only volumes, update only the authorized Nginx/proxy path, and retain prior release config/images/assets. Smoke test remote health, deep links, API, auth boundary, TLS/origin/cookies and exact `https://crayzamb.cloud/career-sprout`; verify complete remote file inventory/content and running image/release digest.
10. If any gate fails, leave public exposure/registration closed and either roll back the project release/proxy only or stop without deployment; preserve data and unrelated applications. Report exact blockers, observed verification and unverified boundaries. Update deployment/config docs with executed facts, not assumptions.

## Validation commands and evidence

- Project-local Docker build, `docker compose config`, and scoped production-like compose smoke; derive exact commands from implemented compose contract.
- Backend production guard/auth tests and existing scoped campus backend tests.
- Frontend path-base production build, scoped campus tests, and HTTP checks for `/career-sprout/`, a deep link, hashed assets and `/api/health`.
- Remote read-only host/capacity/route evidence before any change; after deployment, remote image/release inventory, file hashes, service health and exact public HTTPS HTTP checks.
- Human Clerk test-account verification and cross-account data access proof are separate external acceptance evidence; do not substitute automated mocks.

## Risk and rollback points

- Production startup/auth changes are security-sensitive; fail closed and retain development loopback restrictions.
- Path prefix can break relative assets, Clerk callbacks, SPA fallback and API routes; validate all on a production-like proxy before release.
- Existing swap can absorb bounded peaks but is slower than physical RAM; do not claim RAM expansion. Stop release if validation shows sustained swapping, OOM, health degradation, or unacceptable latency.
- Use immutable release/image plus proxy config rollback; never remove/replace database volumes as rollback. Keep previous hashed frontend assets during the rollback window.

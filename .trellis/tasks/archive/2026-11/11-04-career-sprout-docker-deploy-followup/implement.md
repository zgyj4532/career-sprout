# Implementation and verification plan

1. Before implementation, load the campus auth/isolation and frontend quality specs referenced in the context manifests; review the original deployment task artifacts and current changed-file state. Preserve user-owned/unrelated files, including `docs/evidence/phase1/doctor.json`.
2. Reproduce and resolve the backend test failures with bounded tests:
   - `databaseReadiness.test.js` and `localDevIdentity.test.js` individually.
   - `campusIsolation.test.js` individually after identifying why local bypass cases receive 401.
   - Keep backend token verification fail-closed. Ensure the campus production-profile frontend exposes sign-in and public sign-up; use disposable test-only Clerk-format values for local smoke builds, never production artifacts.
   - Handle MongoMemoryServer binary acquisition through the existing WSL proxy/cache with a finite timeout; do not omit the readiness/isolation tests.
3. Inspect local Docker daemon and resources before use. Keep proxy values private. Use the configured daemon proxy and registry mirrors for bounded image pulls/builds. Do not build on the remote host. If local build cannot complete, capture the exact failed request/stage and stop rather than retrying indefinitely.
4. Build disposable, isolated local smoke images with non-production test-only credentials; do not put those credentials in tracked files, release manifests, or transferred bundles. Exercise Compose config, container health, app path/deep routes/assets, unauthenticated API, Redis least-privilege and backup ACL, persistence after restart, and an isolated backup/restore. Remove only resources proven created by this smoke.
5. Run the targeted frontend tests and campus production-profile build; inspect generated path-base HTML/assets. Run a real browser or HTTP check against running local containers for `/career-sprout/`, a deep route, a hashed asset, and API proxy path. Use only disposable credentials for local smoke, outside production artifacts.
6. Review the previous deployment task's release contract, current docs, and all task changes. Run Trellis quality/security review. Update only documentation facts changed by final evidence; no commit or push without explicit user authorization.
7. Document the official production Clerk setup and private key placement (Dashboard production instance, configured sign-in/sign-up methods, API Keys). Do not acquire or expose production key values in this local follow-up. Matching live keys are required for functioning production Clerk auth; real session/two-account testing may be skipped at the user's direction and reported as NOT_RUN.
8. Do not deploy or mutate the production server in this local follow-up. For a separately authorized release, configure matching real `pk_live_` and `sk_live_` keys to make sign-in/registration functional; real Clerk session/two-account tests remain optional at the user's direction and must be reported as NOT_RUN if skipped. Apply release-specific service health, secret-delivery, proxy ownership, capacity, backup/restore, and public-route procedures only in that authorized release task.

## Validation commands

- Backend targeted tests (WSL): `cd /mnt/e/github/career-sprout/backend && node --test src/config/__tests__/databaseReadiness.test.js src/config/__tests__/localDevIdentity.test.js src/campus/__tests__/campusIsolation.test.js`
- Frontend scoped regression: `npm test -- --run src/campus/__tests__/api.test.js src/campus/__tests__/auth.test.jsx --maxWorkers=1 --no-file-parallelism`
- Docker config/build/smoke: use the isolated local Compose project and bounded WSL Docker commands derived from `deploy/career-sprout/compose.yml`; never record expanded config or secret values.
- Production release verification is outside this follow-up; only a separately authorized release task may perform remote inventory/hashes, service health, or exact public URL checks.

## Stop conditions

- Missing live Clerk credentials means production sign-in/registration cannot function and is a prerequisite for a production image/release, not a requirement to run real sessions.
- Production capacity, backup/restore, proxy ownership, and public routing remain separate release operations; they do not block completion of local regression/build/smoke work.
- No cached required images and proxy transfer remains too slow: stop with exact transfer evidence; do not wait indefinitely or build on the target.
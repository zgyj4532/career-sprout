# Technical design

## Scope and boundaries

Continue from `.trellis/tasks/11-04-docker-deploy-career-sprout/`; resolve the backend readiness/auth regressions and obtain bounded local Docker build/smoke evidence. This follow-up does not deploy or mutate the production server. Production campus UI must expose sign-in and public sign-up; per user direction, real Clerk session/two-account tests may remain NOT_RUN and are not deployment gates.

Do not modify or reuse other server applications, Docker resources, or private configuration. The host has no matching cached `node`, `mongo`, `redis`, `nginx`, or CareerSprout images; do not build on the 1.7-GiB target. Build and smoke-test locally in WSL using the existing Docker daemon HTTP(S) proxy and two registry mirrors. Keep network/download steps bounded and report progress or the concrete failure; do not wait indefinitely.

## Test and auth contract

`databaseReadiness.test.js` now inserts a new unique fixture after index readiness, then proves a duplicate insert fails. Verify that change with the exact target test. Separately reproduce the 401 failures in `campusIsolation.test.js`: determine whether the failure is a broken local development bypass or stale test assumptions. Fix only the responsible behavior/fixture and retain the invariant that production cannot use the development identity. Never make test pass by weakening production auth.

The first targeted test run showed `MongoMemoryServer` downloading MongoDB 8.2.6 (34.8 MB) at very low throughput and was cancelled near 3%. Reuse a trusted local binary if available, or use the configured download proxy with a finite timeout/cache. No test coverage may be silently omitted. Backend unit tests with no database remain independently runnable.

## Docker build and smoke boundary

For disposable local smoke only, use generated test-only Clerk-format values; do not use, copy, or mislabel the local `sk_test_` / `pk_test_` credentials as production. Keep smoke tags and any generated files outside deploy artifacts. The smoke is limited to container startup/readiness, `/career-sprout/` plus deep links and hashed assets, API unauthenticated boundary, Redis ACL behavior, restart persistence, and isolated backup/restore. It does not establish real Clerk login, live authorized-origin behavior, or two-account isolation.

Use the configured WSL Docker proxy/mirrors for bounded pulls/builds. Verify the Docker cache and local Docker resources before creating isolated project-only names; never delete pre-existing resources. For a release, require a committed full source SHA, immutable images/config, complete manifest/checksums, private secrets mounted only at runtime, and an exact integrity-checked transfer.

## Production Clerk and registration contract

The production campus UI renders both sign-in and public sign-up. `AuthPage.jsx` gates `/register` on `VITE_CLERK_SIGN_UP_ENABLED === 'true'`, and `frontend/Dockerfile.campus` now sets that production build flag to true. Configure the production Clerk instance to permit sign-up and sign-in. Do not weaken backend token verification or enable local identity bypass in production.

The real `pk_live_` publishable key is embedded in the frontend build; the matching `sk_live_` secret stays runtime-only in the backend private env. Never use local `pk_test_` / `sk_test_` values in a production artifact. For local Docker smoke only, use disposable test-only keys and separate smoke tags; this proves startup/routing, not a real Clerk session. Per user instruction, live-session/two-account tests are not required as deployment gates; report them as NOT_RUN if skipped.

Clerk's official production setup: Dashboard → select Development → Create production instance → clone development settings or use defaults; then configure **User & authentication** to allow the chosen sign-in/sign-up methods. Retrieve the production Publishable Key and Secret Key from that production instance's API Keys page. Keep them in the private release config (`VITE_CLERK_PUBLISHABLE_KEY` for the build, `CLERK_SECRET_KEY` runtime); never paste them in chat or commit them. Production social OAuth providers require the owner's provider credentials. Clerk may require domain/DNS and certificate steps shown on its dashboard.

## Build and deployment boundary

Use the configured WSL Docker proxy/mirrors for bounded local builds. The target host lacks the relevant base and CareerSprout images and must not build locally. Before real production image creation, require the real live keys; while absent, build only clearly tagged local smoke images using disposable non-production values. Production release builds are tied to the full committed source SHA.

Production registration/sign-in sessions may remain unverified at the user's request; report that boundary honestly. Real production keys, healthy services, and the configured public route are functional prerequisites for working production auth/deployment. Preserve project data and unrelated host resources.
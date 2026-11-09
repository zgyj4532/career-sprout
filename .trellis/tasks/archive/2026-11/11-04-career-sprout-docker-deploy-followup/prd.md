# CareerSprout Docker部署后续准备

## Goal

继续解决 CareerSprout 后端数据库/校园认证回归并完成本地 Docker 构建与有界 smoke 准备；本 follow-up 不执行生产发布或服务器变更。生产 campus UI 必须开放 Clerk 登录和公开注册；真实 Clerk 会话测试可跳过并标记未运行，但不能用测试 key 代替生产 key。

## Confirmed findings

- The earlier task `11-04-docker-deploy-career-sprout` contains the package implementation and full original deployment requirements. This task is a separate follow-up to resolve its outstanding local verification and release gates, not a second package design.
- The prior `CampusRegressionFix` agent ran for about 32 minutes, fixed one duplicate-key assertion in `backend/src/config/__tests__/databaseReadiness.test.js`, then did not publish results for the remaining campus auth failures. It is now stopped; the process is no longer available. A separate targeted backend test attempt stalled while downloading MongoDB 8.2.6 (34.8 MB); it was cancelled near 3%, so no passing result is established for the readiness regression.
- WSL Docker reports daemon proxy configured and two registry mirrors; WSL `HTTP_PROXY` and `HTTPS_PROXY` are set. Do not print proxy URLs or credentials. The target server has no cached `node`, `mongo`, `redis`, `nginx`, or CareerSprout-tagged images matching the deployment requirements, so target-side image cache cannot substitute for the off-host build.
- The repository dotenv files are `backend/.env` and `frontend/.env.local`; a private deployment env file and local `.config/career-sprout` directory were not found. A redacted check found the Clerk key formats in local files are `sk_test_` / `pk_test_`, not production `sk_live_` / `pk_live_`; the current process environment contains no Clerk keys. Values were not displayed. These test keys are not production credentials.
- Earlier scoped checks passed: frontend campus tests (35), frontend campus build, backend startup-guard tests (9), and sanitized Compose config validation. A prior broad backend run had 4 failures (3 local campus auth 401s and the readiness-test assertion); it is not a passing verification.
- No server changes or deployment occurred. The public path returned 404 in the prior read-only check. The host has 1.7 GiB RAM and existing 9.9 GiB swap; use bounded swap only, not as RAM equivalence.

## Requirements

- Reconcile the prior task’s remaining regression failures with the campus development-auth contract; keep production authentication fail-closed and do not relax production guards to satisfy local tests.
- Complete a bounded, reproducible backend test run without waiting indefinitely for MongoDB binary downloads. Use the configured WSL Docker proxy/registry mirrors for required downloads; do not hide or skip the readiness/isolation coverage.
- Build and run a disposable, isolated Docker smoke package on the trusted local Linux/WSL builder using bounded operations and non-production test-only credentials. Never tag or transfer a smoke image as a release artifact.
- Preserve the existing immutable-SHA off-host release procedure; the server lacks the relevant base/project images and is too small to build this app safely.
- Do not use local `sk_test_` / `pk_test_` credentials for production. The production frontend MUST expose both sign-in and public sign-up; enable the app's signup UI and configure Clerk's production instance to allow registration. Keep backend token verification fail-closed.
- Real Clerk session and two-account tests are not deployment prerequisites for this task; record them as not run. Provide the user official steps to create a production Clerk instance and place `pk_live_` / `sk_live_` in the private deployment configuration. Those live keys are a functional prerequisite for registration/sign-in, not a session-test gate.
- Do not alter unrelated server services, images, networks, or data; do not commit or expose any credentials.

## Acceptance Criteria

- [ ] The readiness test and campus auth/isolation regressions have passing scoped evidence; production auth guards remain fail-closed.
- [ ] The WSL builder uses the already-configured proxy/mirrors, and bounded Docker build/pull steps finish or produce a concrete network blocker without indefinite waits.
- [ ] Disposable containers pass health, SPA path/deep-link/assets, unauthenticated API, Redis ACL, persistence/restart, and isolated backup/restore smoke checks; all smoke resources are identified and only those resources are removed.
- [ ] Production campus UI presents sign-in and public registration; backend refuses unauthenticated protected operations. Clerk real-session testing may remain NOT_RUN, clearly documented.
- [ ] Official Clerk production-key acquisition and safe private configuration steps are provided; no credential value is exposed in chat or source.
- [ ] Local smoke builds use only disposable non-production Clerk-format values. Any separately authorized production build requires the real production publishable key and runtime secret key; missing live keys prevent working production sign-in/registration.
- [ ] 本 follow-up 在本地构建 / smoke 验证后结束；生产部署、服务器资源变更和公网 URL 验证不属于本任务，需另行授权的发布任务处理。
- [ ] 生产 key 尚未配置时，明确说明这会使真实登录/注册无法工作；不把测试 key 或假登录作为替代。

## Out of Scope

- Reuse another application's credentials, database, or persistent data.
- Claim unrun Clerk session checks passed, or use test-format credentials for production.
- Commit or push changes without explicit authorization.
- Production deployment and server mutation are explicitly deferred from this local follow-up.

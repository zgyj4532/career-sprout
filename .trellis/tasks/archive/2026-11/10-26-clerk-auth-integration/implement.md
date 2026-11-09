# Execution plan

## Gate
Historical implementation was approved and the bounded loading/UI extension completed; see `research/verification.md`. That dated record did not include a genuine-account closure; the user subsequently confirmed the basic account flow on 2026-10-29. The newly reported production login failure is not proven resolved by that earlier confirmation. Further approved UX implementation continues in `11-06-login-ux` as of 2026-11-07.

## Ordered work
1. Read scoped frontend quality, directory, hooks/state, API type-safety, campus verification and cross-layer guides before changes. Locate existing auth behavior tests and runtime docs.
2. Discover the current WSL distribution, project runtime copy, Node/dependency installation and occupied ports. Safely verify effective environment and key instance consistency. Do not print credential values.
3. Read long-running-task and browser tooling instructions, launch/reuse the actual application following the WSL contract; observe health and anonymous auth status.
4. In an actual browser exercise /register and /login with internal returnTo. Inspect sanitized network status and visible errors. Reproduce any defect before its minimal owner-layer fix.
5. Exercise a real Clerk session with user-operated personal verification where required; confirm protected API identity and ensure local bypass is disabled. Confirm invalid and missing credentials are rejected.
6. Exercise logout and subsequent protected requests; record each of AC1-AC4 separately. Do not claim an authenticated path from mock or bypass results.
7. After changes, run the relevant existing auth regressions and browser smoke once. Update operating docs for permanent fixes; remove temporary probes and preserve user account/data.

## Verification commands
Resolve runtime directory and scripts first. Use npm run doctor in the supported WSL runtime, npm run dev:local when service launch is needed, and selected existing frontend/backend auth behavior tests according to package scripts. Browser proof and safe HTTP observations are required beyond tests. Exact commands and outcomes will be recorded after execution, never pre-labelled passing.

## Risks
External network access, missing WSL runtime dependencies, mismatched keys, Clerk dashboard policy and personal verification can prevent end-to-end proof. Investigate reachable prerequisites before declaring a blocker; do not weaken authentication to obtain a green result.

## Revised execution gate and checks
- 历史 loading/UI 扩展已获批准并完成；证据见 `research/verification.md:19-29`，不再等待同一批准。
- 已实现 20s SDK / 15s session 状态边界、错误恢复与主题；2026-11-07 后续 UX 工作继续于已批准的 `11-06-login-ux`，不重复实施。
- 本任务原 verification 当时未记录真实账号闭环；10-29 用户后来确认基本账号流程可用。当前生产登录卡住是新的报告，尚未证明解决；历史确认、匿名 smoke 和 mock 不能替代本次故障验收。
- Prove delayed/failed SDK and failed API recovery via controlled browser scenarios, separately from real provider success. Check desktop/390px, keyboard focus, form switching and safe return destinations. Preserve the original real-session acceptance requirements.
- After smoke, remove owned test browser state and generated Vite/test caches only once services no longer use them; do not clear shared Redis, MongoDB, user materials or personal browser cookies.

# 认证入口与关联诊断日志 — Design

Status: planning; inherits parent final-review gate. This is a scoped implementation design, not authorization to start.

## Authoritative shared design

Read `.trellis/tasks/10-18-student-career-experience/design.md` sections 7、9 and the full compatibility/diagnostic contracts. The parent owns shared interfaces; this child must not invent a second convention.

## Boundary and dependencies

冻结 auth/status、requestId、错误信封与教师可信权限契约；不实现新的自建令牌系统。

## Existing implementation seams

- `frontend/src/campus/api.js`
- `frontend/src/main.jsx`
- `backend/src/middleware/globalErrorHandler.js`
- `backend/src/config/localDevIdentity.js`
- `backend/src/campusServer.js`
- `scripts/local/dev-local.mjs`

These are observed existing paths, not an instruction to rewrite them wholesale. Proposed new workflow modules are listed in the parent design. Preserve pre-existing user edits; parent alone integrates shared route/composition files. Use available LSP references for exported symbols before migration. No framework/provider rewrite or unrelated upstream activation.

## Data and error contract

Use canonical server UID and owner checks, schema validation at the API seam, requestId in errors and safe correlation logs. Empty/unknown information must not become a fake completed result. Async operations must preserve current user input and be cancellable or ignore stale completion. No secret or personal source text in diagnostics. All caller migrations are clean; no legacy alias layer.

## Compatibility and rollback

Read parent design section 10. Keep current persisted data/UIDs and infrastructure identifiers. Roll back only this child's owned changes; never stash/reset/clean the user's work. Real third-party or hardware prerequisites remain explicitly reported, not bypassed.

## Verification surface

直接浏览器访问 /login、/register、/verify-email，观察不可用/真实会话/本地体验状态；用真实 HTTP 请求校验 requestId 和日志脱敏。

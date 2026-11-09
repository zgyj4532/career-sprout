# Clerk integration evidence — 2026-10-26

## Executed
- WSL Ubuntu-24.04, Node 24.14.1: `npm run doctor -- --report /tmp/career-sprout-clerk-doctor.json` passed runtime/config prerequisites; correctly marked real-account acceptance external.
- Started existing `npm run dev:local`; MongoDB/Redis health passed and Vite served port 5173.
- Reproduced browser account status HTTP 500. Direct installed Clerk SDK authentication diagnosed missing publishable key.
- Added `CLERK_PUBLISHABLE_KEY` to backend/.env by copying the existing frontend public value without printing it; restarted owned runtime. No application source edits.
- Clerk backend JWKS request accepted configured secret; backend and frontend JWKS share a matching key ID and modulus. No credential/key material recorded here.
- Actual browser: `/api/campus/auth/status` HTTP 200, mode clerk, authenticated false; `/api/resumes` returns 401 both without credentials and with invalid bearer token.
- Actual desktop login form and 390px registration form loaded; email/password and Google controls visible. Registration/login links retained returnTo=/resume. Narrow surface had no horizontal overflow.
- Cleared managed test browser HTTP cache, Cache Storage, local/session storage and cookies; closed owned tab.

## Remaining real-user acceptance
No personal account registration, OTP, social authorization or genuine session was performed. Post-login redirect, authenticated protected access and logout remain unverified. User must register/login in their own browser; do not request passwords, OTP or tokens in chat. This task must not be archived as complete.

## Runtime and cleanup
Owned test runtimes are stopped. Managed browser tabs, HTTP cache, Cache Storage, local/session storage and test cookies were cleared. Temporary doctor report and frontend/node_modules/.vite plus .vite-temp were removed. No database, shared Redis data, personal browser state or user materials were deleted. Restart with the documented WSL `npm run dev:local` command for personal-account acceptance.

## Approved loading/UI extension
- Implemented 20s SDK initialization and 15s complete session-lookup bounds, safe error recovery and stale-response/logout safeguards.
- Themed existing Clerk forms with campus colors, one title and static lower-right leaves. Removed unrelated Resend notice from active Clerk flow.
- Actual desktop registration/login and 390px registration verified. One h1, no horizontal overflow, mobile leaves hidden, primary action reachable and unobstructed after scrolling, keyboard input outline 2px, login switch retains returnTo=/resume.
- Controlled aborted SDK: CLERK_LOAD_FAILED displayed; retry reloaded and restored the real login form with returnTo preserved.
- Controlled stalled backend status: SESSION_STATUS_TIMEOUT displayed; in-place retry restored the real login form.
- Extra held-SDK browser experiment exceeded the tool deadline and ultimately showed the SDK failure state; do not count this as browser proof of the exact 20s timer. Unit tests cover the 20s boundary and late readiness recovery.
- Anonymous and invalid bearer access to /api/resumes remained HTTP 401.
- Campus Vitest: 29 files, 184 tests passed, including 18 auth lifecycle tests. Initial full attempt hit its 300s command deadline and exposed a new test's nested StrictMode assumption; corrected root StrictMode setup, then the full suite passed in 940.75s.
- Scoped ESLint: zero errors; two react-refresh export warnings for the existing mixed component/helper export layout. Initial root-directory lint invocation matched no files; corrected frontend-root invocation is the reported result.
- No genuine user registration/login/logout was performed. Personal browser relay extension unavailable; do not claim the user's network problem is resolved from managed-browser success.

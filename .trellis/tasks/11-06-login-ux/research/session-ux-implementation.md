# Session and routing implementation — 2026-11-07

## Approved scope and task state

The user explicitly approved continuing the existing `11-06-login-ux` task and all prior review recommendations: minimum **8 or more** password characters, a single full-name custom registration flow, Chinese first Unicode character / English first word mapping, valid empty last-name handling, unchanged existing names, and anonymous-root-only login redirection. This is not a request to create another task or to obtain approval again.

Updated PRD/design/implementation/research and populated both context manifests with real frontend specs and task research. Ran `python .trellis/scripts/task.py start 11-06-login-ux`; the script set `status=in_progress` and recorded `feat/teacher-portal-career-workspace`. It reported degraded mode because this environment has no session identity. Main also found no usable parent context/session environment variable. **No active-task pointer was persisted**; no fabricated identity was used. Continue with the explicit task path. The previous task's loading/UI approval gate was corrected to match its existing completion evidence.

Historical scope matters: the 10-26 verification record did not include a genuine-account closure at that time; the user subsequently confirmed the basic account flow on 10-29. Neither fact proves that the newly reported production login failure is resolved. The password acceptance target is a provider-configured minimum of exactly 8, not merely any minimum at least 8: reject length 7, allow non-compromised length 8 subject to other policies, and allow longer passwords. Clerk's older eight-character citation must not be presented as the current generic NIST rule; SP 800-63B-4 distinguishes a 15-character single-factor minimum from an eight-character MFA minimum.

## Ownership and implementation

SessionUX owns `auth.jsx`, `CampusApp.jsx`, `clerkLocalization.js`, frontend package/lock, existing session/route tests and task records. AuthForms owns `AuthPage.jsx` and new registration modules/tests; no cross-editing of those files.

- Root routing waits for the real account-status result. Anonymous `/` goes to `/login` with history replacement. Authenticated `/` retains the actual business homepage, including the explicitly labelled local development identity when enabled by existing configuration. Explicit routes, including `/teacher`, are not globally login-gated. Pending provider tasks go to account recovery rather than the business homepage. Existing error recovery remains available at the root.
- `safeReturnTo` retains its export. It normalizes dot segments, strips the deployment basename once, rejects external/protocol-relative/backslash/control/encoded unsafe destinations and auth-route loops, and preserves internal query strings and fragments. `SessionNavigation` now carries query and fragment, not only pathname.
- `useSession()` provides reactive pending/active session status without `useAuth()`'s default pending-as-signed-out projection. Context adds `pendingSession` and `clerkSessionActive`; pending tasks do not synthesize backend identity or query the backend as if authenticated. AuthForms uses the pending flag to retain Clerk's required-task flow.
- Review correction: retry after a rejected/timed-out pending-session logout now clears the failed operation and restores the still-pending Clerk task/sign-out controls without querying or inventing backend authentication. Added both deterministic consumer regressions, including late timeout rejection isolation. Removed an incidental pending-message assertion that conflicted with the location probe's implicit status role; behavior assertions remain.
- An active Clerk session followed by backend `authenticated=false` now reports `SESSION_NOT_RECOGNIZED` with retry/sign-out/configuration guidance instead of remounting an anonymous login form. This closes a reachable code-level dead-end; it is **not proof that this caused the reported production failure**. The backend remains the sole authority for application identity and teacher permissions.
- Existing 20-second SDK and 15-second complete status/token/logout bounds, stale-request cancellation, SDK-reload warning and in-place status retry remain. No duplicate timeout mechanism or teacher privilege changes were introduced.
- Official `@clerk/localizations/zh-CN` is the baseline, with brand overrides and missing authentication error, recovery, email-link mismatch, reset-password, form hint and reverification translations. Nested overrides retain the corresponding official branch rather than replacing it with a partial dictionary.
- Installed exact `@clerk/localizations@3.37.10` using Node 24.14.1/npm 11.11.0 in WSL and `--ignore-scripts --no-audit --no-fund`. Clerk React remains **5.61.9**. The locale dependency adds `@clerk/types@4.101.28` and resolves `@clerk/shared` from 3.47.8 to 3.48.0; npm warns that the types wrapper is deprecated in favour of shared/types. No SDK major upgrade. `main.jsx` is intentionally unchanged because its campus locale wiring already exists and is supported by production evidence.

## Anonymous production evidence

SessionUX used read-only HTTP access to:

- `https://crayzamb.cloud/career-sprout/`: reachable application HTML and Chinese metadata.
- `https://crayzamb.cloud/career-sprout/api/campus/auth/status`: success envelope, `mode=clerk`, `authenticated=false`, `user=null`.
- `https://clerk.crayzamb.cloud/v1/environment`: public configuration confirms password `min_length=15`, breached-password protection enabled, optional enabled first/last names, required email verification through `email_code`, public registration, and no currently required CAPTCHA/legal consent/MFA/organization-selection flow. No password, OTP or genuine session was submitted or recorded.

Main separately inspected the actual production browser: principal login copy is Chinese, while optional-name markers, password visibility labels, email format guidance and the Clerk footer contain English. Main observed the loaded Clerk JS asset at 5.128.0. These are anonymous baseline observations, not validation of the new local code.

Public provider default home/after-sign-in/after-sign-up URLs point to the domain root rather than `/career-sprout/`. Existing per-form forced redirects already override normal form destinations. The defaults are an operational configuration risk to check for provider-hosted flows; they do not prove the cause of the user's stuck login.

## Exact unresolved boundaries

1. **Production minimum remains 15**, despite the user-approved actual provider-policy target of 8. The policy change is authorized; it was not performed because an authenticated management session/credential is unavailable, not because approval is missing. UI accepting an 8-character submission is not evidence of provider acceptance. The instance maintainer must change the actual password policy and personally verify the 7/8/longer boundaries using non-breached passwords without sharing credentials. AuthForms owns the detailed provider-policy handoff.
2. No genuine production registration/login/logout, mailbox verification, OAuth consent or authenticated teacher route was exercised by SessionUX. The user report is accepted as ground truth; its precise session-stage root cause remains unproven. Do not describe anonymous HTTP success, mocked regressions or the defensive mismatch fix as resolving the real user's session.
3. The pinned official locale has undefined entries. Auth-specific gaps are patched, but the installed localization contract exposes no password Show/Hide visibility or `Secured by` footer translation key. Do not add fake keys, DOM observers or CSS replacement text and claim complete Chinese rendering. Main must inspect the actual vendor-rendered surface and record remaining SDK-owned strings separately.
4. No build, lint, test, formatter or local server was run by this implement agent. Dependency installation and task activation are not verification. Main owns integrated verification after both slices land.
5. No commit, push, deployment, production policy change, backend authorization change or secret disclosure was performed. The production site has not received these code changes.

## Checks for Main after integration

- Focused existing `auth.test.jsx` and `CampusApp.test.jsx`, plus AuthForms tests: pending-to-active same-session transitions; active-provider/backend-anonymous recovery; unchanged timeout/unmount/logout tests; anonymous root; genuine signed-in root; explicit deep links; `/career-sprout/` once; query/fragment preservation; unsafe and normalized auth-loop destinations.
- AuthPage redirects signed-in `/login` and `/register` to the safe target without loops, while `/verify-email` still exposes its account-verification purpose. A teacher link must target `/teacher` without conferring teacher rights. Registration activation must not remount into a fresh registration attempt.
- Run scoped frontend lint, focused Vitest, then campus production build serially in the existing WSL Node runtime. No separate TypeScript gate exists for this JavaScript campus frontend.
- Actual desktop and 390px browser: root/login/register/teacher deep link, keyboard controls, pending/error retry, reset-password/code/link verification states, provider policy rejection, browser-visible Chinese and accessible names. Do not count a copied locale-object assertion as rendering proof.
- Re-run existing invalid/missing-token and non-teacher denial coverage at the integration level; preserve backend enforcement.
- Genuine-session and provider-policy checks require the account holder/instance maintainer, without collecting passwords, codes or tokens. Record these separately from mocks and anonymous smoke.

## Main's integrated verification report

After both implementation slices and the pending-logout recovery fix, Main reported on 2026-11-07:

- Focused regressions: auth 55 + CampusApp 20 + RegistrationForm 32 = **107 passing**. The earlier run had one ambiguous `status` selector failure, corrected without replacing it with a copied-string assertion.
- Scoped ESLint: **0 errors, 3 warnings** (existing CampusApp `Icon` warning and two mixed-export auth warnings).
- Actual local browser: anonymous root redirects to `/login`; explicit `/profile` stays on that route with 401 guidance; teacher link preserves `/teacher`; anonymous and invalid-token `/api/resumes` return 401.
- Actual desktop and 390px registration show one full-name input; seven-character passwords are blocked locally without a provider submission.
- Official locale now renders the email-format hint in Chinese. SDK password-visibility/Google accessibility strings and branding retain English. This is not complete-Chinese acceptance.

These checks were executed by Main, not SessionUX. No build result or genuine production-session/provider-minimum-8 acceptance is asserted here. Stable contracts are now recorded in `.trellis/spec/frontend/component-guidelines.md`; operating guidance and manual acceptance are updated in `docs/LOCAL_WSL.md` and `docs/MANUAL_ACCEPTANCE.md`. This documentation update does not deploy the code.

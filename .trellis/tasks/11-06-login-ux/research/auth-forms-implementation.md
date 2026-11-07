# Auth forms implementation record

## Ownership and change boundary

The approved continuation replaces only the registration UI with a Clerk Core 2 custom flow so one full-name input can populate the real firstName/lastName fields. `AuthPage.jsx` retains its default export and prebuilt SignIn; registration-specific modules and behavior tests own name mapping, provider-policy display, email verification, recovery, and activation. Existing campus CSS classes are reused. Session/localization/routing infrastructure belongs to SessionUX; no shared package, auth, CSS, or backend file is owned here.

The minimum behavior gap is not a translated first-name label: it is a single full-name draft connected to the complete real Clerk sign-up lifecycle. Existing account names must never be migrated or overwritten. Teacher entry remains a normal login destination, not authorization. No commit, push, deploy, account creation, OTP submission, policy mutation outside the approved password minimum, or credential disclosure is part of implementation.

## Research before editing

- Read task PRD/design/implementation/research, empty implement.jsonl context, prior 10-26 Clerk verification record, frontend component/state/hook/quality/directory conventions and reuse guide.
- Installed `@clerk/clerk-react` is 5.61.9. Its public legacy hook exposes create/update/prepareEmailAddressVerification/attemptEmailAddressVerification and setActive. The installed SetActiveNavigate callback receives `{ session }`, **not** Core 3's `decorateUrl`; do not copy current Core 3 examples.
- Public production HTML was anonymously fetched successfully at `https://crayzamb.cloud/career-sprout/`; this does not exercise a real session.
- Parent managed-browser evidence: Chinese login renders, but optional-name labels, password-show aria text, email example aria description and Clerk footer retain English. Registration currently has two optional names. No account was submitted.
- Parent read-only public FAPI projection from `https://clerk.crayzamb.cloud/v1/environment`: password `min_length=15`, `max_length=0`, `disable_hibp=false`, `enforce_hibp_on_sign_in=true`, `show_zxcvbn=false`, `min_zxcvbn_strength=0`, all character-class requirements false. This directly establishes the source of the 15-character policy; it does **not** establish the user's stuck-login cause.
- Same projection: email enabled/required with `email_code`, verify-at-sign-up true; first and last names enabled but optional; public sign-up; captcha false, legal consent false, sign-up MFA false; organizations disabled and forced selection false. Production dynamic ClerkJS is 5.128.0.
- Existing 20s SDK and 15s backend status bounds are already implemented and are not duplicated here.

## Verification ownership

No build, lint, tests, formatter, or local runtime is run by this implementation slice. Parent owns integrated verification after all slices land. No real-account success or production policy change is claimed.

## Implemented files and behavior

### `frontend/src/campus/pages/AuthPage.jsx`

- Keeps the default route-component interface and the existing appearance/prebuilt `SignIn` and `UserProfile`.
- Registration alone uses `RegistrationForm`; registration feature gating still applies. Existing non-Clerk/unavailable-account behavior is intentionally unchanged.
- Uses the shared `safeReturnTo`. Clerk's external redirect URLs get the Vite basename once through the existing `appPath`; React Router navigation and links remain basename-relative.
- Authenticated login/register pages use replace navigation to the safe destination; `/verify-email` keeps its profile surface instead of redirecting away from verification.
- Teacher login links to `/login?returnTo=/teacher` and explicitly says the entry does not grant privileges. An authenticated account without the server-reported teacher role remains on an actionable recovery surface (refresh authorization, sign out/switch, home), not a login redirect loop. Teacher backend authorization was not modified.
- Consumes SessionUX's `pendingSession` independently of backend `ready`: pending sessions render the existing prebuilt SignIn task continuation, not a fresh signup. Signout remains available; the misleading pending backend refresh button was removed because pending sessions cannot authenticate that request.
- Active Clerk sessions rejected as anonymous by the backend have explicit signout/switch recovery alongside the shared error/retry UI. No backend identity is fabricated.

### `frontend/src/campus/pages/RegistrationForm.jsx`

- Real Core 2 lifecycle: `useSignUp` → `create` or unfinished-attempt `update` → `prepareEmailAddressVerification({strategy: 'email_code'})` → `attemptEmailAddressVerification` → `setActive` with the actual `createdSessionId`.
- Completion requires provider `status === 'complete'` and a real session identifier. Navigation requires an active session; pending/currentTask sessions return to the prebuilt login/task flow with safe returnTo preserved. An activation failure can be retried without creating a second user or repeating the accepted verification.
- One labelled full-name input; email, new-password autocomplete and numeric/one-time-code input. Password visibility controls and descriptions are Chinese. Existing campus card/form/action/theme classes provide responsive styling; no second design system.
- Email sending is only reported after provider acknowledgement. A send failure keeps the verify screen with resend/change-email recovery. Changing email updates only the unfinished signup email, retains names/password, clears the code and prepares verification for the updated address.
- Missing supported fields return to the editable form. Unknown additional requirements (including future legal/phone/protect checks) remain visibly incomplete with a maintenance explanation; they never produce fake completion. Those requirements are not enabled in the observed production configuration. If last name becomes required, a one-part name gets an explicit optional-last-name configuration explanation, never a fabricated surname.
- A `clerk-captcha` node stays mounted before `create()` and through retries, with documented Chinese/light/flexible options. This supports legacy CAPTCHA when enabled; current production has it disabled.
- A ref prevents duplicate submits even before React rerenders. All fields/actions involved in the request are disabled while busy. Results arriving after unmount do not send another code, activate a session, update UI, or navigate. The always-available login link is recovery if the external service does not settle. No password/code/session identifier is logged or stored in local/session storage.
- A resumed provider attempt preserves its actual name split unless the full-name draft was explicitly edited. Existing user resources are never updated and no migration is run.

### `frontend/src/campus/pages/registration.js`

- Pure name mapping normalizes surrounding/repeated whitespace. A leading Han Unicode character becomes `firstName` using code points, including supplementary-plane Han; the remainder becomes `lastName`. English uses first word/rest. Compound Chinese surnames are intentionally **not** guessed (the approved rule is the first Unicode character).
- One character/one word produces an empty last name; new signup payloads omit the optional empty last field. An explicit edit of an unfinished attempt can clear its previous last-name draft.
- The UI floor is at least eight Unicode code points, not exactly eight, UTF-16 units, or byte length. Longer passwords are allowed and never truncated. Provider breach/strength/length checks remain authoritative.
- Safe Chinese provider-error allowlist covers duplicate email, invalid/expired code, rate limits, breached/weak/short password, CAPTCHA and common input failures. Unknown errors become a generic actionable error. Raw provider payloads and account details never enter diagnostics.

### `frontend/src/campus/pages/__tests__/RegistrationForm.test.jsx`

Written but **not executed** in this slice. Behavior cases include Han/supplementary Han/compound-surname/English/multiword/one-part mapping; eight and longer submitted for real provider judgement versus seven code points rejected locally; real create fields; verification and safe basename destination; CAPTCHA presence at create; duplicate pending submits; ignored post-unmount results; delivery failure and resend; wrong/expired/rate-limited codes; email changes without account recreation; missing fields; exact existing-name split preservation; unsupported requirements without fake success; required empty-last-name failure; activation retry/missing session/pending tasks; external returnTo rejection; safe errors and retained inputs.

SessionUX updated the existing shared `auth.test.jsx` for AuthPage's redirect/profile/teacher/no-role/pending/error-signout integration, so no competing auth test implementation was added here.

## Password policy: confirmed production gap and supported handoff

**Production still requires 15 characters. No production password-policy mutation was made. Eight-character production acceptance is NOT complete or verified.**

The form enforces only the approved floor of eight and explicitly states that the account service may require a longer password and must pass its own length/strength/breach checks. A provider rejection is not turned into success. Per parent coordination, no second `/environment` request or unstable Clerk environment accessor was introduced merely to display password hints. The unchanged production policy can therefore reject an eight-character submission with an actionable Chinese error; the frontend does not claim otherwise.

### Management access investigation (read-only)

- Windows and WSL process environment were projected to Clerk-related variable **names/presence only**: none found.
- Windows `cmdkey.exe /list:clerk-cli` reported no stored entry. The official CLI's Windows `clerk-cli/Config/config.json` and `clerk-cli/Data/credentials` locations are absent.
- WSL `.config` has an older `clerk/config.json`; a keys-only JSON projection showed only `telemetryNoticeVersion`, no auth/token/session/profiles. No `clerk-cli` configuration/data directory was present in the inspected WSL `.config` / `.local/share`.
- Parent's attempt to discover an authorized browser relay timed out; no accessible authenticated personal Dashboard session was available. Managed browser tabs are anonymous. No personal browser profile, cookie database, password store or unrelated secret was read.
- Existing application backend `CLERK_SECRET_KEY` presence is established by the parent's doctor run, but it is an **instance Backend API credential**, not Platform configuration authorization.
- The published Backend OpenAPI and the official CLI config documentation establish that a secret-key/accountless config call cannot modify `auth_password`. The beta instance-settings endpoint only supports `restricted_to_allowlist`, `from_email_address`, `progressive_sign_up`, and `test_mode`; sending an invented password field there would not establish a change. No such request was sent.

### Supported Dashboard path

In the correctly selected **production** Clerk instance: **User & authentication → Password → Update password requirements**. Change minimum length only from 15 to 8. Keep breached-password rejection, breach enforcement at sign-in, device trust, lockout, verification, MFA, CAPTCHA and other settings unchanged. Existing users must not be mass-reset or renamed. Re-read the public environment projection and perform genuine new-password boundary acceptance afterwards; a successful save alone is insufficient evidence.

### Supported CLI / Platform API path

The official Clerk CLI account-mode configuration accepts `CLERK_PLATFORM_API_KEY` or `clerk auth login`. It needs the correct application and production instance. A backend `sk_…` key is insufficient. Do not send credentials through chat or place them in this repository.

After the maintainer establishes management authorization locally:

```sh
npx clerk@latest config schema --app <application-id> --instance prod --keys auth_password
npx clerk@latest config pull --app <application-id> --instance prod --keys auth_password
npx clerk@latest config patch --app <application-id> --instance prod --json '{"auth_password":{"min_length":8}}' --dry-run
npx clerk@latest config patch --app <application-id> --instance prod --json '{"auth_password":{"min_length":8}}' --yes
npx clerk@latest config pull --app <application-id> --instance prod --keys auth_password
```

These are **handoff commands, not executed results**. Inspect the schema/current configuration and dry-run diff before the mutation; the only changed field must be `auth_password.min_length`. Do not run `security fix --all`, `config put`, or any broad policy reset.

The supported equivalent is `GET /v1/platform/applications/{applicationID}/instances/{envOrInsID}/config/schema?keys=auth_password`, `GET .../config?keys=auth_password`, then `PATCH .../config?dry_run=true` followed by `PATCH .../config` with body `{"auth_password":{"min_length":8}}`, authenticated by a Platform API access token with `applications:manage`. `envOrInsID` can be `production`; the API supports `If-Match` with the read config version for concurrency protection. Read back configuration and preserve every other field. The public Platform API is documented as private beta, so Dashboard/authorized CLI access remains the practical alternative when workspace access is unavailable.

### Sources consulted

- Legacy flow: https://clerk.com/docs/guides/development/custom-flows/authentication/legacy/email-password.md
- Legacy SignUp object: https://clerk.com/docs/react/reference/objects/sign-up.md
- Password rules: https://clerk.com/docs/guides/secure/password-protection-and-rules.md
- Session tasks: https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks.md
- CAPTCHA: https://clerk.com/docs/react/guides/development/custom-flows/authentication/bot-sign-up-protection.md
- Official CLI configuration/accountless limitations: https://github.com/clerk/cli/tree/main/packages/cli-core/src/commands/config
- Exact minimum-length patch: https://github.com/clerk/cli/blob/main/packages/cli-core/src/commands/security/catalog.ts (`auth_password.min_length`, minimum 8)
- CLI credential locations: https://github.com/clerk/cli/blob/main/packages/cli-core/src/lib/constants.ts and `credential-store.ts`
- Platform schema: https://clerk.com/docs/reference/spec/platform/latest.json
- Backend schema: https://clerk.com/docs/reference/spec/bapi/2026-08-20.json

## Remaining integration and external acceptance

- Parent must run the new registration tests plus shared auth/router tests, scoped lint and campus production build, then desktop/390px/keyboard browser smoke.
- Genuine user signup, delivered OTP, provider acceptance of eight-character non-compromised passwords, existing-account login/recovery/logout, pending-task rendering and production deployment remain unverified. No account or OTP was submitted during this slice.
- Current Clerk v5 legacy hooks cannot implement the newer **Challenge suspicious sign-ups** feature. Official docs require Core 3/new hooks and newer ClerkJS/UI. Do not enable that protection upgrade on this legacy custom flow without a separate SDK/flow migration; do not disable protections as a workaround. Legacy CAPTCHA support is included.
- Prebuilt SignIn is retained deliberately to preserve real MFA, password recovery, device trust, social login and provider task handling. Its vendor-owned untranslated aria/branding fragments require the parent's real SDK locale review; no DOM text rewriting is used.
- No commits, pushes, deployments, user-data migrations, fake fallbacks or throwaway investigation scripts were introduced.

## Review amendment: third-party signup discovery

The review identified that replacing the signup component removed the visible Google/new-user discovery path even though the retained prebuilt login still supports it. The registration details screen now explicitly offers **third-party account registration or login**, explains that a new user does not need to submit the email form first, and links to the existing prebuilt `/login` with the same sanitized returnTo. This deliberately reuses Clerk's supported social flow rather than adding a separate OAuth callback implementation.

Added two click-through behavior cases covering a basename-prefixed teacher destination and an unsafe external destination. They follow the new-user third-party link into the actual AuthPage route, assert that it renders the retained prebuilt SignIn boundary, and assert no email signup/update/session activation was called. The Clerk boundary is mocked; parent browser smoke remains the evidence for actual provider buttons. These amended cases were not run by AuthForms.

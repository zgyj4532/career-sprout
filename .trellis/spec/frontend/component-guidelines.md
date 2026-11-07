# Component Guidelines

## Existing conventions

Campus components are React function components using named hooks and plain CSS classes. Route pages own HTTP actions; reusable components receive data and callbacks. Examples: `components/JobSelect.jsx`, `components/VoiceInput.jsx`, `components/RequestError.jsx`.

Use semantic forms and labelled native controls. Non-submit buttons explicitly use `type="button"`; real saves use form submission. Show pending, empty and failed states separately. A failed load is not an empty collection. Render request errors through `RequestError`, not raw provider exceptions or JSON.

```jsx
<RequestError error={error} onRetry={reload} />
<label>岗位方向<input value={role} onChange={event => setRole(event.target.value)} /></label>
<button type="submit" disabled={busy}>保存</button>
```

## Editing and AI

AI output is a suggestion, not saved data. Show adoption/cancellation and retain source text. `VoiceInput` owns capture/transcription only and delivers `onTranscript(text, duration, captureId)` once per capture; the interview appends into its sole parent-owned editor without submitting. `VoiceReview` adds the separate explicit review/adoption surface used by resume editing. Neither callback implies server persistence. Keep dirty editor state when operating on another list item. Late responses must not replace newer edits.

An absent optional object may be `null`, not merely `undefined`: check it before dereferencing or passing to projections. A JavaScript default parameter (`value = {}`) does not handle explicit null.

## Presentation

Use existing `campus-*` classes and CSS variables; do not introduce a second design system. Preserve the warm light surface and readable dark text. Unknown scores/skills are unknown, never fabricated zeroes. Expand sources and technical diagnostics on demand rather than making novice users read them before acting. Disabled controls and failures need a concrete next action. Verify 390px and desktop actual browser surfaces; use keyboard-accessible native controls and visible labels.

## Interview and discovery results

Discovery uses the owned interview session with `purpose: discovery`, separate durable answer/continue/completion requests, and no numeric assessment. Its editable profile candidates retain source excerpts and idea/in-progress/completed state. Confirmation reads canonical `frozen`, `expected`, and `steps`; unknown saves must reconcile before another write, partial candidates stay immutable, and only unresolved target conflicts ask for a choice.

Formal reports consume `scoring` for `scoreVersion: available-v1`; never recompute a missing dimension as zero. History and legacy consumers preserve old totals with a legacy label and compare only equal scoring comparison keys. Advice precedes score details. An expired generation lease permits an explicit retry after a canonical read; an active generation exposes progress recovery, not another model request.

## Authentication lifecycle

- Scope: campus login/registration must not wait indefinitely for the external SDK or backend session status.
- Signature: `useCampusSession()` exposes `status`, `error`, `loadingStage: 'clerk' | 'session' | null`, `pendingSession`, `clerkSessionActive`, `refresh`, and `signOut`.
- Contract: Clerk initialization is bounded to 20s, account-status/token acquisition and logout to 15s. Keep request identity guards; abort and settle owned waits on session changes/unmount. Backend requires `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`; frontend uses the matching public `VITE_CLERK_PUBLISHABLE_KEY` only.
- Errors: SDK failure/timeout -> safe `CampusApiError` and explicit reload retry; session timeout -> in-place retry; active Clerk session plus anonymous backend response -> `SESSION_NOT_RECOGNIZED`, retry and sign-out recovery, never a fresh anonymous login form. Unknown logout outcome must reconcile real status, never assume anonymous. For a still-pending Clerk session, retry clears the failed operation and restores its task/sign-out controls without querying or granting backend identity. Preserve unsaved-work warning on reload.
- Cases: good = genuine session and backend identity; base = anonymous Clerk status with protected API 401; bad = stalled SDK/token promise or late old-user response.
- Tests: fake-time bounds, late SDK recovery, aborted/stale response isolation, session changes, logout errors, root StrictMode cleanup; actual browser SDK failure and backend timeout recovery. Personal verification is separate from mocks.
- Wrong: only aborting fetch while token acquisition is still pending, or treating a timeout as successful login. Correct: bound the complete operation and show an actionable error without granting identity.

## Campus authentication routes and registration

### 1. Scope / Trigger
Apply when changing account entry routes, Clerk session projection, registration fields or localization. Keep backend identity and teacher authorization authoritative.

### 2. Signatures
- `safeReturnTo(value)` in `auth.jsx` returns a safe router-relative destination; Clerk document URLs add `BASE_URL` once.
- `RegistrationForm({ returnTo })` uses the installed Clerk React 5.x custom-flow API; `splitFullName(value)` returns `{ firstName, lastName }`.

### 3. Contracts
- Wait for account status at `/`; redirect anonymous users to `/login` with replacement and retain the business homepage for authenticated users. Do not globally redirect explicit deep links.
- Signed-in login/register routes navigate to the safe destination; explicit `/verify-email` retains account verification. A non-teacher choosing teacher login receives actionable denial/account-switch guidance; only fresh backend authorization permits teacher continuation.
- Preserve internal query/fragment and `/career-sprout/` once. Reject external/protocol-relative, backslash/control and encoded unsafe paths, normalize dot segments, and exclude login/register/verification loops.
- Read pending/active identity from `useSession()`: default `useAuth()` treats pending sessions as signed out. Pending sessions render Clerk-required steps, not a new registration attempt.
- One full-name field: normalize surrounding/repeated whitespace; Han-leading names split after the first Unicode code point (`张三` -> `张`/`三`), other names after the first word (`Ada Lovelace` -> `Ada`/`Lovelace`). A single character/word has empty lastName; never invent a surname. Preserve existing names and do not mass-migrate users.
- Frontend minimum length is 8 and longer passwords are allowed; provider policy remains authoritative. Targeting actual provider minimum 8 requires its real configuration and boundary acceptance, not frontend wording. Never report a still-15 policy as satisfying that target.
- Use official SDK-compatible zhCN with nested brand/gap overrides; do not replace a whole official branch with a partial dictionary. Vendor-hardcoded strings without localization support remain explicit limitations, not fake translation keys or DOM rewrites.

### 4. Validation & Error Matrix
| Condition | Required behavior |
| --- | --- |
| Password shorter than 8 | Block locally, no provider request |
| Provider rejects a longer password or compromised password | Show safe Chinese correction; do not claim acceptance |
| Single-part name but provider requires lastName | Explain configuration requirement; do not fabricate data |
| Email code rejected/expired, resend fails | Keep the registration attempt and actionable retry |
| Pending logout rejects/times out | Retry restores pending task and account-switch controls, no identity grant |
| Active provider session not recognized by backend | Safe error/retry/sign-out; no anonymous-form loop |

### 5. Good / Base / Bad Cases
Good: authorized teacher resumes `/teacher` after genuine sign-in. Base: anonymous `/profile` remains an explicit route whose protected API returns 401. Bad: a pending session restarts registration, an encoded auth destination loops, or changing a minimum-length hint is called a provider-policy change.

### 6. Tests Required
Extend existing `auth.test.jsx`, `CampusApp.test.jsx` and `RegistrationForm.test.jsx`: root/deep-link decisions; safe query/hash/basename navigation; backend-only teacher role; pending-to-active transition; rejected/timed-out pending logout retry and late-response isolation; Unicode/single-part names; verification/resend/activation failure without duplicate signup. Actual desktop/390px and accessible-name inspection supplement mocks; genuine-session/provider-policy acceptance is separate.

### 7. Wrong vs Correct
Wrong: `lastName = lastName || firstName`, or treating a rendered Clerk form as backend authentication. Correct: preserve legal empty lastName and keep genuine Clerk completion, backend recognition and teacher authorization as distinct checks.

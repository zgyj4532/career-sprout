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
- Signature: `useCampusSession()` exposes `status`, `error`, `loadingStage: 'clerk' | 'session' | null`, `refresh`, and `signOut`.
- Contract: Clerk initialization is bounded to 20s, account-status/token acquisition and logout to 15s. Keep request identity guards; abort and settle owned waits on session changes/unmount. Backend requires `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`; frontend uses the matching public `VITE_CLERK_PUBLISHABLE_KEY` only.
- Errors: SDK failure/timeout -> safe `CampusApiError` and explicit reload retry; session timeout -> in-place retry; unknown logout outcome -> reconcile real status, never assume anonymous. Preserve unsaved-work warning on reload.
- Cases: good = genuine session and backend identity; base = anonymous Clerk status with protected API 401; bad = stalled SDK/token promise or late old-user response.
- Tests: fake-time bounds, late SDK recovery, aborted/stale response isolation, session changes, logout errors, root StrictMode cleanup; actual browser SDK failure and backend timeout recovery. Personal verification is separate from mocks.
- Wrong: only aborting fetch while token acquisition is still pending, or treating a timeout as successful login. Correct: bound the complete operation and show an actionable error without granting identity.

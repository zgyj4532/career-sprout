# Design

## Boundary
Retain React/Vite, existing Clerk React SDK and Express Clerk middleware. The current smallest confirmed gap is missing runtime proof, not missing templates. No product-code change is justified until an actual failure is observed.

## Data flow
frontend/.env.local -> Vite -> ClerkProvider -> existing SignUp/SignIn -> Clerk session -> campusFetch bearer token -> Express authentication -> existing owner-scoped API. Logout terminates the Clerk session and refreshes local session state.

## Investigation and candidate changes
- scripts/local/dev-local.mjs and frontend/vite.config.js: change only if runtime configuration loading is defective.
- frontend/src/main.jsx, campus/auth.jsx, campus/pages/AuthPage.jsx and campus/api.js: change only if initialization, redirect, session lifecycle or token transport fails.
- backend/src/middleware/auth.js and owning campus auth route: change only if real identity resolution or anonymous protection fails.
- Existing behavior tests and relevant operating documentation: update only for demonstrated contract changes.

## Security and compatibility
Keep secrets backend-only; never persist bearer tokens or passwords in task evidence. Check key compatibility through a safe SDK/API operation without printing provider bodies containing user data. Do not upgrade SDK solely to match dashboard snippets. Preserve local development mode for unconfigured environments, but never use it as acceptance evidence. Preserve same-origin /api and safeReturnTo restrictions.

## Runtime and rollback
Use the existing WSL runtime and identify processes before reusing ports. Do not kill unrelated services, replace dependencies across Windows/WSL, or reset databases. Fixes must be small and independently reversible without deleting user changes. Personal OTP/social login remains user-operated; record exact pending acceptance if interaction is unavailable.

## Approved scope extension: loading and campus authentication UI
The user's browser remains at account-status loading. Source evidence: campus/auth.jsx returns before requesting status when Clerk is not loaded and has no initialization timeout; AuthPage gates forms on backend status. This identifies an unbounded state, not the user's network root cause. Diagnose SDK requests and API separately before selecting a permanent fix.

Reference: retained upstream pages/Login.jsx and Register.jsx use a centered Clerk card with a quiet decorative background. Reuse that hierarchy, not dark gradients or dormant Tailwind dependencies.

Visual tokens: paper #f4efe6, warm card #fffaf3, ink #1c1915, muted #5f584e, line #d9d0c3, leaf green #0f6e56. Reuse campus font stack: Microsoft YaHei/Noto Sans CJK SC for body and restrained bold display headings; utility captions use the same family at smaller size. One title per page, compact supporting copy, one central form card, account switch below. Bottom-right SVG leaves are static, aria-hidden, pointer-events none, using existing theme tokens; shrink or hide when space is tight. No external font/image dependency or animation.

Use supported Clerk appearance configuration and scoped plain CSS, not a replacement credential form. SDK loading and backend session status must have distinct bounded error/recovery states. Backend errors remain visible and protected actions remain denied; do not conceal faults to show false success. Remove unrelated Resend notices from the active Clerk flow, retaining accurate unavailable-state information where relevant.

Expected changes are limited to campus/auth.jsx, pages/AuthPage.jsx, scoped campus CSS, and main.jsx only if SDK-level lifecycle ownership requires it. Existing focused behavior tests cover timeout/recovery/stale-response risks; docs describe actual configuration and recovery. Final implementation choices follow runtime diagnosis.

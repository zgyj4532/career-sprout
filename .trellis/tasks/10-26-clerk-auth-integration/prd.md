# Clerk authentication integration

## Goal
Enable and verify real Clerk registration, login, protected API access and logout in the existing campus application.

## Confirmed background
- frontend/src/main.jsx:8,44-48 loads the frontend publishable key and ClerkProvider.
- frontend/src/campus/pages/AuthPage.jsx:22-26 contains Clerk registration/login and safe return navigation.
- frontend/src/campus/api.js:112-115 attaches a Clerk session bearer token.
- frontend/src/campus/auth.jsx:39-51 handles logout and session refresh.
- backend/src/middleware/auth.js:10-16,44-49 loads the secret and invokes Clerk authentication.
- Safe local inspection confirmed a development publishable key in frontend/.env.local and a development secret in backend/.env. Their mutual application identity and validity are not yet verified.
- The runtime contract requires WSL and preserves the configuration-time campus entry boundary.

## Requirements
1. Verify actual frontend/backend configuration loading and matching Clerk development instance without exposing credentials.
2. Verify existing registration/login UI and intended internal post-auth navigation; fix observed integration defects only.
3. Verify real session transport and backend identity; configured Clerk must not silently fall back to a local identity.
4. Exercise registration, login, protected access and logout, including rejection after logout and for anonymous/invalid-token requests.
5. Resolve the user-reported indefinite account-status loading screen. Distinguish SDK initialization from API status loading and provide actionable failure/recovery without bypassing authentication.
6. Adapt the repository's retained upstream login/registration composition to the campus theme. Keep real Clerk forms; add restrained bottom-right SVG leaves and accessible responsive layout.

## Acceptance criteria
- AC1: runtime evidence establishes configuration loading and instance consistency; no secret or token enters artifacts/logs.
- AC2: actual browser displays working Clerk forms and preserves a safe internal return destination.
- AC3: a genuine Clerk session grants protected access under the real Clerk user identity; anonymous/invalid sessions cannot obtain protected data.
- AC4: a real registration/login/logout cycle succeeds and logout removes protected access. User performs personal email verification or social authorization when needed; incomplete steps remain explicitly unverified.
- AC5: delayed/failed SDK initialization and failed account-status requests have bounded, distinct visible recovery states; successful recovery renders the real authentication UI.
- AC6: desktop and mobile login/registration use existing campus colors, readable controls and decorative non-interactive leaves; no obstruction, duplicate page titles or unrelated provider notices above working Clerk forms.

## Out of scope
Production rollout, SDK major migration, new authentication system, Resend implementation, unrelated UI redesign and dormant upstream application changes. The local retained upstream pages are the reference; remote upstream equivalence is not claimed.

## Constraints
Preserve user environment values and data. Do not use bypass or mock credentials as proof of real authentication. Do not create external accounts or alter Clerk dashboard policies without appropriate user participation. The user approved scope extension on 2026-10-26; the revised design awaits final review. Clean only test-owned cache and artifacts after verification; preserve business data and personal browser state.

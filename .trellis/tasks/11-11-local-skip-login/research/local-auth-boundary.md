# Local auth boundary

## What the user sees

The “至少 15 个字符” message is Clerk’s instance password policy, rendered by `passwordComplexity.minimumLength` in `frontend/src/campus/clerkLocalization.js:130`. The campus app does not hardcode 15. Production and the Clerk Development instance keep separate password policies, so a server-side change to 8 does not change a local Clerk form.

## Why local still opens login

`scripts/local/dev-local.mjs:87` sets `VITE_DEV_BYPASS_AUTH` to `false` whenever `CLERK_SECRET_KEY` is present.

`backend/src/config/localDevIdentity.js:142-144` refuses the local identity when `CLERK_SECRET_KEY` is set (`reason: clerk-configured`). `backend/src/config/__tests__/localDevIdentity.test.js:85-91` locks that behavior.

`frontend/src/campus/auth.jsx:148` mounts Clerk when `VITE_CLERK_PUBLISHABLE_KEY` is set. `frontend/src/campus/CampusApp.jsx:90-91` sends an unauthenticated `/` to `/login`.

`backend/src/campus/auth.js:8-12` reports `mode: local` only when bypass is allowed; otherwise a configured Clerk client yields `mode: clerk`.

## What must stay true

`backend/src/config/localDevIdentity.js:24-39` refuses production startup unless bypass is explicitly false and both Clerk keys are live. `localDevIdentity.js:71-76` refuses bypass outside `NODE_ENV=development` or off loopback. `localDevIdentity.js:127-135` is a fixed non-admin local user. Mutating requests still require a local frontend origin (`localDevIdentity.js:154-159`).

`.trellis/spec/project/campus-phase1/wsl-local.md` currently says Clerk keys in local `.env` select formal Clerk mode, and the local identity is only for the no-key case. This task changes that selector for the `dev:local` runtime only.

## Environment split already present

`dev:local` forces `NODE_ENV=development`, `APP_PROFILE=campus-local`, and `HOST=127.0.0.1`. Production is a separate container contract (`NODE_ENV=production`, live keys, bypass false, public HTTPS origin). There is no third deployed test site in this repo. “测试环境” in this request is that local runtime; “生产环境” is the existing production contract.

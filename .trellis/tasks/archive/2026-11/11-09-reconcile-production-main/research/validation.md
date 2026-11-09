# Candidate validation evidence

## Candidate and environment

- Repository: `zgyj4532/career-sprout`
- Integration branch: `release/reconcile-production-main`
- Exact tested candidate: `2004a28d387ca58b2f20b8442be40e071345b581`
- Parents: `d3a9ad435ac13964c2aab9fc440eeb680570905e` and `48f730050bfea91be0761e3f484d9f96420a5ef8`
- Clean detached worktree: `/home/ll/worktrees/career-sprout-reconcile-2004a28`
- Runtime: WSL Ubuntu 24.04, Node `v24.14.1`, npm `11.11.0`
- The detached worktree was clean after verification and throwaway files were removed.

## Runtime provenance

Both commands exited `0` with no changed paths:

```text
git diff --exit-code 1eb891d1e4606621dbde29475ac7fa4799dbef0f 2004a28d387ca58b2f20b8442be40e071345b581 -- backend frontend deploy
git diff --exit-code 81b7d14cacaaf90c5e10a90ff26b539ff8dd620a 2004a28d387ca58b2f20b8442be40e071345b581 -- backend frontend deploy
```

Therefore the main ancestry merge is content-neutral for all production runtime/deploy inputs, and the tested candidate remains identical to both the production-fix branch runtime tree and the deployed frontend source tree.

## Aggregate deterministic gate

Command: `npm run verify:phase1` from the exact detached candidate with the Node 24 toolchain.

Observed run: `2026-11-09T09:37:42.194Z` through `2026-11-09T09:39:07.500Z`.

| Gate | Result | Evidence |
|---|---:|---|
| doctor | `BLOCKED_EXTERNAL`, exit 2 | Clean worktree intentionally has no private MongoDB, Redis, Clerk, provider, account or device configuration. |
| local script tests | PASS, exit 0 | 20/20 |
| backend campus tests | PASS, exit 0 | 121/121 |
| backend shared tests | PASS, exit 0 | 148/148 |
| backend campus ESLint | PASS, exit 0 | Existing warnings only; no errors. |
| frontend campus ESLint | PASS, exit 0 | Existing warnings only; no errors. |
| frontend campus tests | PASS, exit 0 | 33 files, 258/258 tests |
| frontend build | PASS, exit 0 | 562 modules transformed |
| isolated persistence smoke | PASS, exit 0 | Health, authorization rejection, create/edit/read, restart persistence and owned-resource cleanup passed. |

Aggregate process exit was `2` because its documented top-level status is `BLOCKED_EXTERNAL`; every deterministic engineering gate passed. This is not recorded as full external acceptance.

Focused authentication/routing coverage was part of the exact-candidate frontend run, so it was not duplicated:

- `auth.test.jsx`: 61 passed
- `ClerkRouting.test.jsx`: 20 passed
- `CampusApp.test.jsx`: 20 passed
- `AuthPage.registration-disabled.test.jsx`: 2 passed

The isolated backend smoke returned health `200`, rejected a remote/anonymous protected request with `401`, created and edited a synthetic resume, restarted the backend, re-read the persisted marker, then dropped only the task-owned database and files. Run ID: `campus_smoke_97575e7841d8482b9f026fdb90c11ee6`.

Generated reports remained in the detached worktree only:

- `docs/evidence/phase1/verify-phase1.json`
- `docs/evidence/phase1/runs/2026-11-09T09-37-42-193Z-9d9abd0f/smoke.json`

They are machine-specific run evidence and are not delivery inputs.

## Production-path frontend build and HTTP smoke

A separate campus production build used only a clearly non-deployable public placeholder:

```text
VITE_APP_PROFILE=campus-local
VITE_BASE_PATH=/career-sprout/
VITE_CLERK_PUBLISHABLE_KEY=pk_test_reconciliation_placeholder
VITE_CLERK_SIGN_UP_ENABLED=true
NODE_OPTIONS=--max-old-space-size=384
npm run build
```

Result: exit `0`; 562 modules transformed; hashed entry asset `index-HcbDr1CX.js` (474,712 bytes).

A finite Vite preview smoke, bound to `127.0.0.1:41783`, observed:

| URL | HTTP | Content |
|---|---:|---|
| `/career-sprout/` | 200 | `text/html`, expected CareerSprout title |
| `/career-sprout/login` | 200 | `text/html` deep-route fallback |
| `/career-sprout/register` | 200 | `text/html` deep-route fallback |
| `/career-sprout/assets/index-HcbDr1CX.js` | 200 | `text/javascript`, 474,712 bytes |

The preview process and its log were stopped/removed by the smoke trap. Backend `/api/health` and protected-route `401` were exercised by the exact-candidate isolated smoke above.

## Compose configuration

Command, using temporary non-secret interpolation values and an empty temporary service env file:

```text
CAREER_SPROUT_RELEASE_TAG=2004a28d387ca58b2f20b8442be40e071345b581 \
FRONTEND_URL=https://crayzamb.cloud/career-sprout \
CLERK_PUBLISHABLE_KEY=pk_test_reconciliation_placeholder \
docker compose -f deploy/career-sprout/compose.yml config --quiet
```

Result: exit `0`, no expanded configuration printed. The temporary env file was removed; no secret file or credential was created.

## Boundaries

Not run and not promoted to PASS: real Clerk accounts and verified-email challenge, teacher authorization, two-account isolation, logout, live LLM/ASR providers, physical-device microphone/playback, scanned-PDF visual/OCR acceptance, human/new-user/mobile testing, and the complete production business loop. Issue #1 remains the authority for those open boundaries.

No reusable application or deployment contract changed in this reconciliation. No `.trellis/spec/` update is required; this file records task-specific release evidence.

## Local reconciliation review and publication gates

- The tested candidate has parents `d3a9ad435ac13964c2aab9fc440eeb680570905e` and `48f730050bfea91be0761e3f484d9f96420a5ef8`; both the production/auth head `1eb891d1e4606621dbde29475ac7fa4799dbef0f` and `fork/main` are ancestors. The production/auth range still contains the recorded 10 commits.
- The local reconciliation commit and ancestry merge change task records only relative to `1eb891d1`; product/runtime code, dependency manifests, deployment inputs, and `.trellis/spec/**` are unchanged. The only intended additional task artifact is this validation record.
- Current publication accounting expects nine files under this active task. The remaining unrelated untracked files are exactly `career-sprout-live-auth.bundle.redacted.js` and `docs/evidence/phase1/doctor.json`; both remain explicit exclusions and must stay unstaged and absent from the candidate.
- No deployment or server mutation was performed. Runtime-input equality supports a no-redeployment conclusion, but merging to `main` is publication only and must not be described as a deployment.

Local validation supports proceeding to final metadata, archive, commit-tree, push, PR, and remote-readback gates. It does not satisfy those future gates: the validation record and final archived task state are not yet in a commit, and no remote branch/PR/main SHA, complete remote tree, merge result, or Issue #1 update is claimed here. `BLOCKED_EXTERNAL` remains an explicit external-acceptance boundary rather than a PASS.

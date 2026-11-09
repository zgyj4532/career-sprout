# Production-main reconciliation delivery inventory

Inventory time: 2026-11-09
Repository: `zgyj4532/career-sprout` (`fork`)
Approved future integration branch: `release/reconcile-production-main` (not created or checked out by this inventory work)

## 1. Authoritative snapshot and scope

This is a read-only inventory of the current worktree, index, and local remote-tracking refs. No path was staged. The parent publication session must fetch and re-check these facts immediately before branch creation or staging; local remote-tracking refs are not proof of later GitHub state.

| Fact | Exact value |
| --- | --- |
| Current `HEAD` | `1eb891d1e4606621dbde29475ac7fa4799dbef0f` |
| `fork/main` | `48f730050bfea91be0761e3f484d9f96420a5ef8` |
| `fork/fix/clerk-auth-login-verified` | `1eb891d1e4606621dbde29475ac7fa4799dbef0f` |
| Merge base | `463e7d6b3962bb22d8bb3cbb5efa0455c7227907` |
| Divergence (`main...fix`) | 1 left / 10 right |
| Three-dot changed paths | 98 |
| Precomputed conflict-free merge tree | `522e4249ec7352dfbbd452c107b48fcd153d9f66` |
| Released backend/data/deploy source | `9946f38b2d434f429e968c7bdaaff9f1d49e4df1` |
| Deployed frontend runtime source | `81b7d14cacaaf90c5e10a90ff26b539ff8dd620a` |
| Current index | 0 staged paths |
| Worktree tracked state before this inventory | 161 tracked deletions; no other tracked modifications (`git ls-files --modified` also reports the same 161 deleted paths) |
| Untracked state before this inventory | 228 files: 219 under the approved November archive roots, 7 in this active task, and 2 explicit exclusions |
| Ignored state | 97,390 ignored files reported by `git ls-files --others -i --exclude-standard`; this includes dependency/cache/runtime trees and private env files and is wholly excluded |

Creating this inventory adds one active-task file, and changing this task's recorded branch updates one of the active-task files. Therefore the expected active-task delivery set is now 8 files, while the two excluded untracked files remain outside it. Recompute every count before staging rather than copying these snapshot counts blindly.

## 2. Published branch delta: all 98 paths

The following disjoint classes cover every path in `fork/main...fork/fix/clerk-auth-login-verified`: **33 runtime/deployment + 12 tests/lockfiles + 8 docs/spec + 45 Trellis records = 98**.

### 2.1 Runtime/deployment — 33 paths

These are build contexts, server/frontend runtime source, deployment configuration, or source-package exclusion policy:

- `.gitignore`
- `backend/.dockerignore`
- `backend/Dockerfile.campus`
- `backend/src/campusServer.js`
- `backend/src/config/database.js`
- `backend/src/config/localDevIdentity.js`
- `backend/src/middleware/auth.js`
- `backend/src/productionSecrets.js`
- `deploy/career-sprout/.dockerignore`
- `deploy/career-sprout/career-sprout.env.example`
- `deploy/career-sprout/compose.yml`
- `deploy/career-sprout/mongo-init.sh`
- `deploy/career-sprout/mongo.Dockerfile`
- `deploy/career-sprout/nginx.conf`
- `deploy/career-sprout/redis-entrypoint.sh`
- `deploy/career-sprout/redis.Dockerfile`
- `frontend/.dockerignore`
- `frontend/Dockerfile.campus`
- `frontend/index.html`
- `frontend/nginx.conf`
- `frontend/retain-career-sprout-assets.sh`
- `frontend/src/campus/CampusApp.jsx`
- `frontend/src/campus/CampusClerkProvider.jsx`
- `frontend/src/campus/api.js`
- `frontend/src/campus/auth.jsx`
- `frontend/src/campus/clerkLocalization.js`
- `frontend/src/campus/pages/AuthPage.jsx`
- `frontend/src/context/AuthProvider.jsx`
- `frontend/src/main.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/verify-clerk-publishable-key.sh`
- `frontend/vite.config.js`

Required runtime dependency inputs are the complete tracked contents of `backend/`, `frontend/`, and `deploy/`, not only the changed files above. In particular, the candidate must retain `frontend/package.json`, `frontend/package-lock.json`, both Docker build contexts and `.dockerignore` files, all Dockerfiles, `deploy/career-sprout/compose.yml`, `career-sprout.env.example`, Nginx configuration, Mongo init, Redis entrypoint, and key-verification/asset-retention scripts. Real `career-sprout.env`, `.env*`, Clerk secret keys, database credentials, and deployment key material are runtime secrets, not source-delivery inputs.

### 2.2 Tests and dependency manifests/lockfile — 12 paths

- `backend/src/campus/__tests__/campusIsolation.test.js`
- `backend/src/config/__tests__/databaseReadiness.test.js`
- `backend/src/config/__tests__/localDevIdentity.test.js`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/campus/__tests__/CampusApp.test.jsx`
- `frontend/src/campus/__tests__/ClerkRouting.test.jsx`
- `frontend/src/campus/__tests__/api.test.js`
- `frontend/src/campus/__tests__/auth.test.jsx`
- `frontend/src/campus/pages/__tests__/AuthPage.registration-disabled.test.jsx`
- `frontend/src/campus/pages/__tests__/ResumePage.test.jsx`
- `frontend/src/test/setup.jsx`

The manifest and lockfile are a required pair. Never stage one without the other, and never regenerate either during reconciliation.

### 2.3 Documentation/specification — 8 paths

- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/project/campus-phase1/wsl-local.md`
- `CHANGELOG.md`
- `README.md`
- `docs/CAREER_SPROUT_DOCKER_DEPLOYMENT.md`
- `docs/LOCAL_WSL.md`
- `docs/MANUAL_ACCEPTANCE.md`
- `frontend/README.md`

### 2.4 Published Trellis records — 45 paths

The complete path set is the single modified file plus every file under the six named roots at the branch tip:

- `.trellis/tasks/10-26-clerk-auth-integration/implement.md` (1)
- `.trellis/tasks/11-04-career-sprout-docker-deploy-followup/**` (6)
- `.trellis/tasks/11-04-docker-deploy-career-sprout/**` (6)
- `.trellis/tasks/11-06-career-sprout-docker-image-build/**` (7)
- `.trellis/tasks/archive/2026-11/11-06-career-sprout-production-release/**` (7)
- `.trellis/tasks/archive/2026-11/11-06-debian-mirror-backend-build/**` (7)
- `.trellis/tasks/archive/2026-11/11-06-login-ux/**` (11)

Counts sum to 45. These records explain provenance and evidence; they are not runtime inputs.

## 3. User-approved local Trellis delivery

Only `.trellis/tasks/**` changes belong to the local maintenance delivery. The 21 historical active-task roots below are approved archive moves into `.trellis/tasks/archive/2026-11/`; the disposition audit records 13 completed and 8 abandoned. Preserve each source deletion and its corresponding destination content so Git can detect moves after staging. Do not stage only the destinations or only the deletions.

1. `00-bootstrap-guidelines`
2. `10-15-campus-phase1-wsl`
3. `10-15-phase1-1-stabilize-real-flow`
4. `10-18-career-sprout-brand`
5. `10-18-guided-growth`
6. `10-18-identity-diagnostics`
7. `10-18-student-career-experience`
8. `10-18-teacher-matching`
9. `10-18-voice-resume`
10. `10-19-effortless-career-experience`
11. `10-20-resume-import-polish-jobs`
12. `10-21-novice-discovery-profile`
13. `10-21-novice-interview-scoring`
14. `10-21-novice-pages-save-continue`
15. `10-21-novice-usability-information-reduction`
16. `10-22-engineering-acceptance-closeout`
17. `10-26-clerk-auth-integration`
18. `10-29-teacher-portal-acceptance`
19. `11-04-career-sprout-docker-deploy-followup`
20. `11-04-docker-deploy-career-sprout`
21. `11-06-career-sprout-docker-image-build`

Approved destination form for each is `.trellis/tasks/archive/2026-11/<same-name>/**`. Snapshot facts: 161 tracked source paths are deleted and 213 untracked files are present across these 21 destination roots. Destination totals can exceed tracked-source totals because the archived task records include preserved pre-existing untracked artifacts and disposition metadata; therefore verify content/path pairing from the actual index rather than requiring a numeric 1:1 rename count.

Also include the cleanup task archive as its own complete root:

- `.trellis/tasks/archive/2026-11/11-09-cleanup-trellis-task-status/**` — 6 untracked files in the snapshot.

Also include this active reconciliation task as a complete root:

- `.trellis/tasks/11-09-reconcile-production-main/**` — expected 8 files after this inventory: `task.json`, `prd.md`, `design.md`, `implement.md`, `implement.jsonl`, `check.jsonl`, `research/branch-reconciliation.md`, and `research/delivery-inventory.md`.

Its metadata now records `branch: release/reconcile-production-main`; this records the approved future branch only and does not create or switch a Git branch.

## 4. Exact exclusions

The following must remain unstaged and absent from every candidate commit/tree/archive:

- `career-sprout-live-auth.bundle.redacted.js` — untracked downloaded diagnostic bundle, even though redacted.
- `docs/evidence/phase1/doctor.json` — untracked unrelated machine-specific diagnostic snapshot.
- `backend/.env`, `frontend/.env.local`, every `.env*` other than the tracked public template `deploy/career-sprout/career-sprout.env.example`, credentials, tokens, private/public key files supplied outside tracked source, and deployment secret files.
- `node_modules/`, `frontend/node_modules/`, package-manager caches, build caches, coverage, temporary files, and generated build output.
- Docker images, image tarballs, source bundles, archives (`*.zip`, `*.tar*`, `*.bundle`, etc.), screenshots/images, and other binary evidence not already present in the published branch delta or approved task moves. In particular, historical images already preserved inside moved task records are moved records, not authorization to add new images.
- `logs/` and all runtime logs, databases, Mongo/Redis volumes or dumps, uploaded/imported user material, generated PDFs/audio, server release directories, and other runtime data.
- `phase1-kit/` — ignored local kit, not this delivery.
- Any unrelated untracked path discovered after this snapshot. Stop and classify it; never absorb it with `git add -A`.

Observed excluded roots/files in the current snapshot include the two untracked explicit exclusions plus ignored `backend/.env`, `frontend/.env.local`, `frontend/node_modules/`, `node_modules/`, `logs/`, and `phase1-kit/`. The ignored count is informational only; ignored files are not candidates.

## 5. Staging and index verification procedure (parent-owned; do not use `git add -A`)

1. Fetch `fork/main` and `fork/fix/clerk-auth-login-verified` without tags and repeat the SHAs, merge base, divergence, 98-path comparison, PR/workflow/protection checks, and merge-tree preflight. Stop if refs or merge behavior differ.
2. Regenerate three machine-readable sets before staging: (a) `git diff --name-status fork/main...fork/fix/clerk-auth-login-verified`; (b) tracked worktree changes; (c) untracked and ignored paths. Reconcile them against Sections 2–4.
3. Construct an explicit pathspec file from the 21 source task roots, their 21 archive destination roots, the cleanup archive root, and the active-task root. Stage with a pathspec-file mechanism that includes deletions and additions (`git add -A --pathspec-from-file=...`), never repository-wide `git add -A`. The temporary pathspec file must live outside the repository or remain excluded.
4. Inspect `git diff --cached --name-status --find-renames`. Confirm all 21 moves have both sides represented (renames where Git detects them; delete/add pairs otherwise), the cleanup root is complete, and all 8 active-task files are included.
5. Compare the staged path set to the generated allowed local-delivery set using exact sorted paths. Required result: no missing paths and no extra paths. Specifically assert that neither explicit exclusion is in `git diff --cached --name-only`, and inspect staged blobs for `.env`/credential/key names and secret-like values without printing secret contents.
6. Re-run tracked/untracked/ignored inventory. Every remaining changed/untracked path must either be one of the explicit exclusions or have a written reason. No approved task artifact may remain unstaged merely because Git did not detect a rename.
7. After the task-record commit, compare its commit tree/path/blob set to the verified index, accounting for Git line-ending normalization with Git blob IDs rather than worktree byte hashes. After the ancestry merge, repeat against the exact candidate commit. Push/readback checks belong to the parent publication flow.

## 6. Candidate invariants / stop gates

- The final candidate contains all 10 production/auth commits and has both `1eb891d1e4606621dbde29475ac7fa4799dbef0f` and `48f730050bfea91be0761e3f484d9f96420a5ef8` as ancestors.
- Merging `fork/main` is ancestry-only: `main`'s unique merge commit has the merge-base tree, and the candidate's runtime blobs after merge equal the production branch's runtime blobs. Any conflict or unexplained runtime delta stops publication.
- `git diff --quiet 81b7d14cacaaf90c5e10a90ff26b539ff8dd620a..candidate -- backend frontend deploy` must succeed before claiming no redeployment. Compare complete trees/blobs, not only the 45 branch-delta paths. The existing observation that `81b7d14..1eb891d` is equal must be re-established at the candidate.
- Local maintenance changes are confined to `.trellis/tasks/**`; no product, dependency, deployment, or stable spec file is changed by the local archive work.
- Candidate path accounting is exact: the published 98-path delta plus approved task-record changes, with no secret, diagnostic bundle, machine snapshot, cache, dependency tree, image/archive, or runtime data.
- `frontend/package.json` and `frontend/package-lock.json` remain paired and unchanged from the production/auth branch during local reconciliation.
- The final candidate is validated from a clean detached worktree at its exact SHA. Historical deployment evidence is provenance, not substitute final-candidate validation.
- Issue #1 remains open; scanned-PDF/OCR, full production business flow, real novice/human/mobile testing, teacher authorization, dual-account isolation, and logout remain unpromoted boundaries.
- This reconciliation performs no deployment or server mutation and does not delete or rewrite the production/auth branch. If any runtime input changes, stop: a separate authorized release decision and fresh deployment validation are required.

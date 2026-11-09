# Production-main reconciliation design

## Boundaries

The integration target is `zgyj4532/career-sprout:main`. The source line is the published `fix/clerk-auth-login-verified` history plus user-approved local Trellis task maintenance. No product feature, dependency upgrade, production deployment, server mutation, credential change, or branch deletion belongs in this task.

## Branch model

```text
463e7d6 (PR #5 head / merge base)
├─ 48f7300 (fork/main merge commit; same tree as 463e7d6)
└─ 0daec0e..1eb891d (10 production/auth commits)
                  └─ local audited Trellis records
                     └─ merge fork/main (ancestry-only expected)
                        └─ release/reconcile-production-main → PR → main
```

Use `release/reconcile-production-main`, not force-pushing the existing production evidence branch. Start from the local production branch after committing only the approved task-record changes, then merge `fork/main`. This retains all production commit identities and proves the PR contains main ancestry.

## Delivery inventory contract

Create `research/delivery-inventory.md` from three authoritative sets:

1. `fork/main...candidate` changed paths and commit history.
2. Current tracked, untracked, and ignored state, including Trellis archive moves.
3. Runtime references from Dockerfiles, Compose, lockfiles, scripts, tests, docs, and the previous release inventory.

Classify every path as runtime/deployment, regression/lockfile, docs/spec, Trellis evidence, or excluded. Explicit exclusions require reasons. Never stage credentials, `.env*`, diagnostic bundles, machine snapshots, dependencies, caches, images, archives, or runtime data.

## Candidate invariants

- `main`'s unique merge commit must add ancestry only; merge result runtime blobs must equal the production branch runtime blobs.
- `1eb891d` and deployed frontend `81b7d14` already have equal `backend/`, `frontend/`, and `deploy/` trees. The final candidate must preserve that equality.
- Trellis task moves may alter only `.trellis/tasks/**`; they cannot justify runtime changes.
- Issue #1 remains open and its unverified boundaries remain unchanged.

Any violated invariant stops publication. Do not resolve an unexpected runtime conflict by choosing one side heuristically.

## Validation architecture

Run from a clean detached worktree at the exact final candidate SHA with Node 24 selected as required by the project spec:

- full campus engineering gate: `npm run verify:phase1`;
- focused Clerk/routing regressions matching the archived login task's final surface;
- production-profile frontend build with bounded heap and no private key;
- backend auth/isolation/readiness focused tests if not already covered at the final source revision;
- `docker compose config --quiet` using temporary non-secret placeholders and no expanded secret output;
- runtime-input blob/tree comparison against `1eb891d` and deployed `81b7d14`.

A clean tree and exact SHA are part of the evidence. Historical successful tests may explain provenance but never replace failed or changed final-candidate checks.

## PR and merge protocol

1. Push the integration branch and read back the remote branch SHA and full tree.
2. Create a PR to `main`, linking Issue #1 without closing it.
3. Ensure the PR diff equals the delivery inventory and required files are present.
4. With no repository CI/protection available, manual gates and Trellis review are mandatory.
5. Archive this task only after the PR candidate and evidence are final; commit/push that archive update to the same PR before merge.
6. Merge with a merge commit to preserve the 10 production/auth commits and explicit main ancestry.
7. Read back remote `main` SHA/tree/content after merge. Do not use local refs as remote publication proof.
8. Comment on Issue #1 with the exact merged SHA and unchanged acceptance boundaries.

## Deployment decision

This task does not deploy. If final runtime trees equal the already deployed source, state that no redeployment is needed because runtime inputs are unchanged. If any runtime input differs, stop before merge/deployment claims and require a separately authorized release decision with fresh image validation.

## Rollback

Before merge, close the PR or reset only the unpublished integration branch; never rewrite the published production branch. After merge, rollback is a normal revert PR against the exact merge commit. No server rollback is needed because this task performs no deployment.

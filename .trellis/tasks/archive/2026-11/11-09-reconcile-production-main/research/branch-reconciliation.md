# Production branch → main reconciliation research

Research date: 2026-11-09
Repository: `zgyj4532/career-sprout`

## Remote state

- Default/base branch: `main` at `48f730050bfea91be0761e3f484d9f96420a5ef8`.
- Production/auth branch: `fix/clerk-auth-login-verified` at `1eb891d1e4606621dbde29475ac7fa4799dbef0f`.
- Merge base: `463e7d6b3962bb22d8bb3cbb5efa0455c7227907` (the PR #5 head).
- Divergence: `main` has 1 unique commit and the production/auth branch has 10 unique commits.
- The one main-only commit is PR #5's merge commit; its tree is byte-for-byte equal to the merge-base/PR-head tree (`git diff --quiet` exit 0). It adds ancestry, not content absent from the production branch.
- `git merge-tree --write-tree fork/main fork/fix/clerk-auth-login-verified` completed without conflicts and produced tree `522e4249ec7352dfbbd452c107b48fcd153d9f66`.
- The remote compare currently contains 98 changed paths across production packaging, Clerk auth/routing, regression coverage, docs/specs, and task evidence.
- No open PR exists for the production/auth branch. Existing PRs #2–#5 are merged.
- `gh run list` returns no workflow runs; `main` is not protected. Manual verification is therefore a required merge gate rather than a fallback after CI.

## Release provenance

- Backend/data/deployment base release source: `9946f38b2d434f429e968c7bdaaff9f1d49e4df1`.
- Deployed frontend runtime source after Clerk fixes: `81b7d14cacaaf90c5e10a90ff26b539ff8dd620a`.
- Branch head `1eb891d1e4606621dbde29475ac7fa4799dbef0f` only archives login task evidence relative to `81b7d14`; `git diff --quiet 81b7d14..1eb891d -- backend frontend deploy` exits 0.
- Therefore the current branch head and deployed frontend have identical runtime source trees. A main ancestry merge must preserve that equality; any runtime delta discovered during execution is a stop condition and requires fresh design/validation.
- Existing deployment evidence records successful source/image integrity checks and production login confirmation, but does not replace validation of the final integration commit.

## Local worktree state that must be preserved

Current local HEAD exactly equals remote `fork/fix/clerk-auth-login-verified` (`1eb891d1`). The worktree also contains user-requested Trellis cleanup changes:

- 21 historical active tasks moved to `.trellis/tasks/archive/2026-11/`, with 13 completed and 8 abandoned dispositions.
- The cleanup task itself archived under `11-09-cleanup-trellis-task-status`.
- This reconciliation task is newly created and must remain tracked through the PR lifecycle.
- Git currently reports 161 tracked deletions plus corresponding untracked archive files; staging should recognize these as task moves where content is unchanged and modifications where disposition metadata was added.

Explicit exclusions, already identified in prior release records:

- `career-sprout-live-auth.bundle.redacted.js`: downloaded diagnostic bundle; never commit.
- `docs/evidence/phase1/doctor.json`: unrelated machine-specific diagnostic snapshot; never include in this delivery.
- Credentials, `.env*`, image archives, caches, dependencies, and runtime data remain excluded.

## Recommended integration shape

1. Keep remote `fix/clerk-auth-login-verified` unchanged as the published production evidence branch.
2. On a new local branch `release/reconcile-production-main`, preserve the production/auth commit history and add the audited Trellis cleanup/current-task records as separate task-record commits.
3. Merge `fork/main` into the release branch to establish ancestry. The merge is expected to be content-neutral and conflict-free; verify its tree rather than trusting the expectation.
4. Validate the final candidate from a clean detached worktree, not from the dirty development worktree.
5. Push the release branch, create a PR to `main`, verify the remote PR head/tree, then merge only after manual gates pass.
6. Verify remote `main` SHA and complete required-file contents after merge. Do not deploy when runtime input blobs remain equal to the already deployed source; if they differ, stop and create a separate authorized release decision.
7. Keep Issue #1 open; update only its branch/mainline status. Do not claim its remaining production, human, mobile, or scanned-PDF acceptance is complete.

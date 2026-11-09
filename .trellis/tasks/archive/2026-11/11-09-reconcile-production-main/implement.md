# Implementation and publication plan

1. **Refresh authoritative remote state.** Fetch `fork/main` and `fork/fix/clerk-auth-login-verified` without tags. Re-read exact SHAs, merge base, divergence, open PRs, workflow runs, and branch protection. If any SHA differs from research, update artifacts and reassess before mutation.
2. **Build the delivery inventory.** Generate `research/delivery-inventory.md` from actual tracked/untracked/ignored changes and `fork/main...fork/fix/clerk-auth-login-verified`. Include runtime/deploy files, lockfiles/tests, docs/specs, all task archive moves and this task. Record exclusions for `career-sprout-live-auth.bundle.redacted.js`, `docs/evidence/phase1/doctor.json`, credentials, caches, dependencies, images/archives, and runtime data.
3. **Verify task maintenance before commit.** Reconcile the 21 historical archive moves and cleanup-task archive against their audit record. Ensure no task artifact disappeared. Stage only paths in the inventory; inspect the index against the inventory and ensure no required file remains unstaged/untracked/ignored without a reason.
4. **Create the integration branch.** On `release/reconcile-production-main`, commit the approved Trellis maintenance as a separate Chinese commit. Merge `fork/main` with an explicit merge commit. Because the main-only tree is content-equivalent to the merge base, expect no runtime content change; inspect the merge tree and stop on any conflict or runtime delta.
5. **Record candidate provenance.** Capture exact candidate SHA, commit graph, changed paths, runtime tree/blob hashes, and comparison to `1eb891d` and deployed frontend `81b7d14`. Confirm `backend/`, `frontend/`, and `deploy/` are identical before reusing deployment evidence.
6. **Validate from a clean detached worktree.** Select WSL Node 24 and run:
   - `npm run verify:phase1`;
   - final Clerk/routing tests covering auth session, CampusApp routing, Clerk routing, AuthPage and stale-link behavior;
   - scoped ESLint for the production auth surface;
   - campus production frontend build with `NODE_OPTIONS=--max-old-space-size=384` and a clearly non-deployable public test key only if build-time configuration requires one;
   - backend database readiness, local identity and campus isolation focused tests if the aggregate gate does not run them at this exact candidate;
   - `docker compose ... config --quiet` with temporary non-secret placeholders, never printing expanded configuration or secret values.
7. **Smoke the candidate.** Start the actual final candidate through an isolated local production-like or documented campus runtime path. Observe `/career-sprout/`, login/register deep routes, a hashed asset, `/api/health`, and anonymous protected API 401. Use unique loopback ports/resources and remove only task-owned resources. If runtime-input equality makes image rebuild unnecessary, a fresh frontend build/preview plus backend route smoke is still required; do not mutate production.
8. **Review and finalize Trellis evidence.** Run `trellis-check`, update stable specs only if a reusable contract changed, write observed validation results, and complete the PRD criteria. Prepare the cleanup task archive move so the final PR head contains the completed task record.
9. **Commit integrity gate.** Generate the final delivery list from actual changes. Stage from that list, verify the index, commit, then compare the commit tree paths/content to the tested detached-worktree snapshot. Account for Git line-ending normalization by Git blobs/content hashes rather than worktree byte hashes.
10. **Push and create PR.** Push `release/reconcile-production-main`; read back remote branch SHA/tree/content. Create a Chinese PR to `main` linking Issue #1 without closing it. Include provenance, exact checks, no-deploy conclusion, remaining boundaries, and exclusions.
11. **Final PR gate and merge.** Verify PR head equals the tested/committed SHA and PR files equal the delivery inventory. With no CI/protection configured, do not merge until all manual gates and remote checks pass. Merge with a merge commit; do not delete the production evidence branch.
12. **Remote publication verification.** Read remote `main` exact SHA, full tree and required blobs after merge. Confirm it contains the 10 production/auth commits, task records, runtime/deploy files, tests and docs. Confirm runtime inputs still match the tested candidate and deployed source.
13. **Issue/report update.** Comment on Issue #1 with PR URL, merged main SHA, pull command and the fact that mainline reconciliation does not close scanned-PDF, business-loop, dual-account, teacher, logout, human or mobile acceptance. Do not deploy.

## Validation evidence required

- Exact repository, base/source/integration SHAs and merge base.
- Delivery inventory, index comparison, commit-tree comparison, remote branch-tree comparison, and remote main-tree comparison.
- Clean-worktree commands, versions, exits and smoke observations.
- Explicit runtime-tree equality or a stop decision if unequal.
- PR URL, merge commit and Issue #1 comment URL.

## Stop conditions

- Remote SHAs changed unexpectedly, a new competing PR exists, or main gains non-equivalent content.
- Merge conflict or any unexplained change under `backend/`, `frontend/`, or `deploy/`.
- Missing task artifacts, credentials/secrets in candidate paths, or delivery inventory mismatch.
- Final-candidate validation failure, PR head drift, truncated/unverified remote tree, or inability to prove tested-source equality.
- Runtime input changes that would require a deployment decision; this task has no deployment authorization.

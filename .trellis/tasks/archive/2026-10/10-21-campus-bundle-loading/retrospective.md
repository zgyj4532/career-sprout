# Delivery and retrospective

## Delivery
- Foundation PR: https://github.com/zgyj4532/career-sprout/pull/3 → main, commit e23fdf17.
- Optimization PR: https://github.com/zgyj4532/career-sprout/pull/4 → feat/novice-workflows-foundation, implementation commit096d0ea6.
- Merge foundation first, then retarget optimization to main and recheck diff. Neither PR automatically merged.
- Task archive records implementation delivery, not production deployment or merged status. Other tasks retain their external ICP/human acceptance blockers.
- Release staging used an isolated Git index and isolated checkout; original worktree content was not rolled back. Excluded .omp, private resume samples and server configuration/investigation materials. Shared changelog excluded the unshipped server-preparation entry.

## What worked
1. Measure the production static import closure and actual resource requests. Initial JS625144→384770 bytes; calculated gzip197388→120233. Total JS630595 is larger, so the result is deferred work, not feature deletion.
2. Route-level dynamic imports and interaction-only Motion were sufficient. No warning threshold change, vendor bucket, dependency upgrade or authentication modification.
3. Stable session/router/unsaved providers and module-level lazy declarations preserve editor identity. Same-path query updates must not remount drafts.
4. Pending/error handling belongs inside main content. Centered readable status keeps navigation usable; optional animation failure keeps text and toggle working.
5. Cold/warm production preview and deliberate missing/slow chunks catch behavior that build output cannot establish.166 tests cover the consumer transitions, not only import wiring.

## Lessons
1. Commit independently verifiable phases promptly. Uncommitted foundational work made a small optimization impossible to publish independently; stacked PRs restore honest scope but increase delivery work.
2. React caches rejected lazy promises. Resetting an error boundary is not a download retry; no automatic refresh that can lose edits.
3. Retain hashed assets across releases and revalidate HTML. Otherwise already-open tabs can fail to fetch deferred modules after deployment.
4. Raw module attribution, minified bytes, calculated gzip, browser transfer and server RAM are different measurements; do not substitute one for another.
5. Git plumbing bypasses clean filters. Normalize CRLF in staged text to prevent unrelated full-file diffs; never rewrite user worktree merely to prepare partial commits.
6. Actual archive moves require updating self-referencing manifests and documentation links, then committing the archive itself to the PR.

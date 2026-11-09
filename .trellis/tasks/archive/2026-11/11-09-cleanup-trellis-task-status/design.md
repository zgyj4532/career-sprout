# Task status cleanup design

## Boundary

This task mutates only Trellis task records and their location under `.trellis/tasks/`. Product source, Git branches, deployments, credentials, and prior archive entries are read-only.

## Disposition representation

Trellis has no native abandoned lifecycle status and `task.py archive` always writes `status=completed`. Use a two-level contract:

- `status=completed`: lifecycle is closed and the directory is archived.
- `meta.disposition=completed|abandoned`: semantic outcome.
- `meta.dispositionAt=2026-11-09`: audit date.
- `meta.dispositionReason`: concise evidence-based reason.
- `notes`: preserve existing text and append a readable cleanup record.

This avoids manual directory moves and keeps Trellis parent/child maintenance intact while making abandoned work distinguishable.

## Ordering

1. Record disposition metadata for all 21 targets before moving any directory.
2. Archive children before parents so the supported archive command can update live relationships predictably.
3. Archive standalone tasks.
4. Archive parents after all their children are absent from the active tree.
5. Verify both active and archive listings, then archive this cleanup task separately.

## Safety and compatibility

- Preserve every existing field and artifact; only append disposition metadata/notes before archive.
- Use `task.py archive --skip-branch-validation` for historical branches. This bypasses only stale branch metadata checks; it does not mutate branches.
- If an archive destination collision or malformed task record occurs, stop that task and retain it active rather than manually moving it.
- Parent historical child names remain meaningful after child archival; Trellis counts absent active children as done.
- Existing `NOT_RUN`, blocked, excluded, commit, PR, and release evidence remains unchanged.

## Rollback

Before archive, metadata edits can be reverted directly. After archive, rollback means moving the exact task directory back and restoring its pre-cleanup `task.json`; therefore execution must process and verify deterministic batches rather than bulk filesystem moves.

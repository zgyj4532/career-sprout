# Implementation plan

1. Validate the audit inventory against `task.py list`: exactly 21 historical targets plus this cleanup task; ensure every target appears once in `research/disposition-audit.md`.
2. Update each target `task.json` without replacing existing metadata:
   - append `meta.disposition`, `meta.dispositionAt`, and `meta.dispositionReason`;
   - append a dated cleanup sentence to `notes` while preserving prior text;
   - do not change top-level status or completion date manually.
3. Re-read the changed task records and verify all 13 completed and 8 abandoned dispositions before moving directories.
4. Archive child tasks first with `task.py archive <task> --skip-branch-validation`:
   - 10-18 children, then `10-18-student-career-experience`;
   - 10-21 children, then `10-21-novice-usability-information-reduction`;
   - `11-06-career-sprout-docker-image-build`, then deployment follow-up and parent.
5. Archive remaining standalone historical tasks through the same supported command. Stop on command failure; do not manually hide an unresolved task.
6. Verify:
   - `task.py list` contains only `11-09-cleanup-trellis-task-status`;
   - `task.py list-archive` reports the added entries;
   - archived abandoned task records still contain `meta.disposition=abandoned` and reasons;
   - archived completed task records contain `meta.disposition=completed`;
   - representative task artifacts remain present.
7. Update this PRD acceptance checkboxes and task notes with observed results. Run Trellis check, then archive this cleanup task. No commit or push is part of this request.

## Validation commands

- `python ./.trellis/scripts/task.py list`
- `python ./.trellis/scripts/task.py list-archive`
- `python ./.trellis/scripts/task.py validate 11-09-cleanup-trellis-task-status`
- Exact archive-record reads for all disposition metadata; count completed/abandoned values and compare with 13/8.

## Stop conditions

- A target is missing, duplicated, malformed, or collides with an existing archive destination.
- Evidence contradicts the proposed disposition.
- A task contains active work newer than the audit evidence.

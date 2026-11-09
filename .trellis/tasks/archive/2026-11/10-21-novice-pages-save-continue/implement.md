# Child execution contract

Follow `.trellis/tasks/10-21-novice-usability-information-reduction/implement.md`, section 3. Page reduction and save-continue, plus baseline, integrated verification, delivery and rollback sections.

Agents implement this slice under the approved parent; skip mid-flight builds/lint/tests/formatters. Parent executes final integrated checks and actual API/browser/model smoke; tests alone do not satisfy AC1/AC8. Dependencies are shared contract readiness, not task-tree order. Record completion evidence and external blockers before archive.

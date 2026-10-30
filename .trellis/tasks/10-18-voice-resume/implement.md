# 可信语音面试与口述简历 — Implementation

Status: planning. Requires fresh user approval of the parent final summary, then explicit child task activation. Curated manifests must validate before start.

## Prerequisites

Read this child's PRD and design, parent `.trellis/tasks/10-18-student-career-experience/design.md`, `.trellis/tasks/10-18-student-career-experience/implement.md`, and research/baseline.md. Follow parent phase C; dependency order is explicit in the parent work-package table and this child's PRD.

## Ordered work

1. Confirm the dependency contract and assigned files with parent integration owner; read relevant existing implementations and specs.
2. Execute parent implementation phase C, implementing all owning PRD requirements and observable acceptance criteria, not a scaffold.
3. Update every affected caller; leave shared composition changes for the parent integration owner. Preserve user modifications and current data.
4. Add only behavior-focused regressions for uncertain edge cases; do not run build/lint/tests/formatters mid-flight. Return exact changed files and proposed commands to the parent.
5. After integration, parent executes targeted regressions, then one appropriate suite/lint/build pass and real user-path smoke. Child acceptance evidence: 实际浏览器执行录音状态、停止与确认；从口述/文本到AI建议采纳、保存、重读、中文PDF；真实服务与受控媒体分别记录。
6. Record actual commands/results/diagnostic IDs in the shared evidence report, update current config/help docs after smoke, and report remaining real external conditions. No automatic commit/push or premature archive.

## Safety and rollback points

Before data writes: preserve defaults/owner filters and reject unauthorized requests. Before AI/capture/export: confirm cancellation, no-fake-success and private-data handling. Before any directory or repository rename: parent verifies all dependencies complete and owned processes stopped. Rollback is scoped; no database/volume deletion.

## Completion gate

Every checkbox in this child's PRD is observed or correctly marked externally blocked; parent cross-child scenarios still must pass. Exact commands and evidence requirements are in the parent implementation plan; do not present this plan as executed verification.

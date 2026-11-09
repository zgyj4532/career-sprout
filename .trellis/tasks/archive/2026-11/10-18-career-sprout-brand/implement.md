# 职芽品牌与仓库目录迁移 — Implementation

Status: planning. Requires fresh user approval of the parent final summary, then explicit child task activation. Curated manifests must validate before start.

## Prerequisites

Read this child's PRD and design, parent `.trellis/tasks/10-18-student-career-experience/design.md`, `.trellis/tasks/10-18-student-career-experience/implement.md`, and research/baseline.md. Follow parent phase E; dependency order is explicit in the parent work-package table and this child's PRD.

## Ordered work

1. Confirm the dependency contract and assigned files with parent integration owner; read relevant existing implementations and specs.
2. Execute parent implementation phase E, implementing all owning PRD requirements and observable acceptance criteria, not a scaffold. First wire formal/Easter egg slogans through the shared brand owner and existing BlurText/motion path; implement click-to-toggle, explicit entry replay, stable layout/focus, reduced-motion and single-flight activation before repository migration.
3. Update every affected caller; leave shared composition changes for the parent integration owner. Preserve user modifications and current data. Repository migration first attempts the existing fork rename; only if genuinely unavailable, follow parent design section 10's verified private backup/new-private-repository/reversible Git reinitialization sequence. Never delete the only history copy or the old remote repository; first commit/push is a separate approval boundary.
4. Add only behavior-focused regressions for uncertain edge cases; do not run build/lint/tests/formatters mid-flight. Return exact changed files and proposed commands to the parent.
5. After integration, parent executes targeted regressions, then one appropriate suite/lint/build pass and real user-path smoke. Child acceptance evidence: 浏览器核对名称/中文元信息，以及主口号和彩蛋往返切换的动画、触屏/键盘、连续点击、减少动态效果、窄屏布局及刷新复位；gh核对改名后的fork关系或备选私有独立仓库身份，备选时验证原历史/工作区备份及旧fork保留；新目录doctor、启动与既有数据重读。
6. Record actual commands/results/diagnostic IDs in the shared evidence report, update current config/help docs after smoke, and report remaining real external conditions. No automatic commit/push or premature archive.

## Safety and rollback points

Before data writes: preserve defaults/owner filters and reject unauthorized requests. Before AI/capture/export: confirm cancellation, no-fake-success and private-data handling. Before any directory or repository rename: parent verifies all dependencies complete and owned processes stopped. Rollback is scoped; no database/volume deletion.

## Completion gate

Every checkbox in this child's PRD is observed or correctly marked externally blocked; parent cross-child scenarios still must pass. Exact commands and evidence requirements are in the parent implementation plan; do not present this plan as executed verification.

# 清理 Trellis 历史任务状态

## Goal

让 Trellis 活跃任务列表只保留仍可执行的工作：归档有交付证据的任务；对已过期、被替代或未实施的任务留下明确“已抛弃”记录后归档；不篡改历史验证边界。

## Confirmed facts

- 清理任务创建前共有 21 个未归档任务，全部标记为 `in_progress`，但其中包含已经交付、已经被后续任务替代以及只有计划没有执行证据的任务。
- Trellis 的 `task.py archive` 会强制写入顶层 `status=completed`；它没有原生 `abandoned` 状态。
- 已归档的生产发布和登录任务提供了后续部署、Clerk 登录及生产环境证据；这些证据可以关闭相应前置任务，但不能把仍未执行的真人、新手、真机或教师授权验收改写为通过。
- 逐项依据和建议处置见 `research/disposition-audit.md`。

## Requirements

- 审计清理任务创建前的全部 21 个活跃任务，并为每项指定 `completed` 或 `abandoned` 处置。
- `completed` 仅用于任务自身范围已有交付证据，或明确后继任务补齐其目标的情况。
- `abandoned` 用于范围过期、被替代、或没有执行证据且不应继续排队的任务。
- 抛弃任务必须在归档前写入 `task.json.meta.disposition = \"abandoned\"`、处置日期、具体原因，并把可读说明追加到 `notes`。随后使用 Trellis 归档命令移动目录；顶层 `status=completed` 仅表示生命周期关闭。
- 完成任务归档前记录 `task.json.meta.disposition = \"completed\"`，保留原有 notes、meta、父子关系、提交和 PR 信息。
- 不删除任务产物，不更改历史测试结果，不把 `BLOCKED_EXTERNAL`、`NOT_RUN` 或排除范围改写为 PASS。
- 历史任务分支可能已过期；归档时允许跳过分支存在性校验，但不得修改或删除任何 Git 分支。
- 本轮不修改产品代码、部署状态、Git 历史或已有归档任务。

## Acceptance Criteria

- [x] `research/disposition-audit.md` 覆盖清理前全部 21 个活跃任务，且没有重复或遗漏。
- [x] 13 个有完成证据的历史任务已记录 completed disposition 并归档。
- [x] 8 个过期任务已记录 abandoned disposition、日期和原因并归档。
- [x] 每个被归档任务的目录和原有产物完整存在于对应月份的 archive 目录。
- [x] `task.py list` 在清理任务归档前只显示本清理任务；清理任务按本次检查要求保持活跃。
- [x] `task.py list-archive` 可读取归档索引，父子任务归档顺序没有留下活动父引用。
- [x] 历史 `NOT_RUN`、外部阻塞和排除范围仍可从原任务记录及审计表中辨认。

## Out of Scope

- 重新实现或重新验收被抛弃任务。
- 重新运行历史产品测试、部署检查或真人验收。
- 推送代码、创建 PR、清理 Git 分支或修改远程服务。

# 生产分支回归 main 与发布基线收口

## Goal

将已经部署并完成登录修复的 CareerSprout 生产分支安全回归 `zgyj4532/career-sprout` 的默认分支 `main`，使远端 `main` 成为包含生产运行代码、部署配置、验证证据和当前 Trellis 状态的唯一可信后续开发基线。

## Confirmed facts

- 远端 `main` 为 `48f730050bfea91be0761e3f484d9f96420a5ef8`；生产修复分支 `fix/clerk-auth-login-verified` 为 `1eb891d1e4606621dbde29475ac7fa4799dbef0f`。
- 两分支相对 merge base `463e7d6b3962bb22d8bb3cbb5efa0455c7227907` 分别为 main ahead 1、修复分支 ahead 10。main 独有提交是 PR #5 的 merge commit，其 tree 与 PR head 完全相同。
- `git merge-tree` 预检无冲突；远端比较包含 98 个路径。
- 当前生产前端运行源码为 `81b7d14cacaaf90c5e10a90ff26b539ff8dd620a`；修复分支 HEAD 相对该提交只移动/补充登录任务记录，`backend/`、`frontend/`、`deploy/` 无差异。
- GitHub 当前没有开放 PR、没有 Actions 运行记录，`main` 未启用分支保护，因此最终候选必须经过本地人工门禁和远端提交树核验。
- 本地工作区还包含用户已批准并完成的 Trellis 历史任务清理，以及本任务记录；这些用户改动必须保留并纳入交付清单。
- `career-sprout-live-auth.bundle.redacted.js` 和 `docs/evidence/phase1/doctor.json` 是已明确排除的本地文件，不属于交付。
- 完整研究见 `research/branch-reconciliation.md`。

## Requirements

- 创建 `release/reconcile-production-main` 集成分支；保留远端生产修复分支，不强推、不改写其历史。
- 通过实际 diff、未跟踪文件和运行依赖生成完整交付清单，分别列出生产运行/部署输入、测试、锁文件、文档/spec、Trellis 记录及明确排除项。
- 将已发布的 10 个生产/Clerk 提交完整纳入候选，并建立对 `fork/main` 的祖先关系；预期的 main merge 必须内容中性，任何运行文件变化都触发停止和重新评估。
- 将此前已完成的 Trellis 清理作为独立、可审查的任务记录变更纳入候选；保留原任务产物，不把移动误当删除。
- 最终候选必须从干净 detached worktree 验证，避免当前未跟踪文件、缓存或本地配置影响结果。
- 执行校园工程验证、Clerk/路由专项、生产前端构建、后端认证/隔离/readiness 专项，以及不泄密的 Compose 配置校验；每项记录命令、环境、退出码和边界。
- 证明最终候选的 `backend/`、`frontend/`、`deploy/` 运行输入与已验证的 `1eb891d1`/已部署运行快照一致。若不一致，不得复用旧部署证据或宣称无需重部署。
- 在 GitHub 创建目标为 `main` 的 PR，关联但不关闭 Issue #1；PR 不得声称扫描 PDF、真人、新手、真机、教师权限、双账号或完整生产业务闭环已经通过。
- 推送前核对 index 与交付清单；提交后核对 commit tree；推送后核对远端 PR HEAD、完整文件树及必需文件内容。
- 手工门禁通过后合并 PR，再读取远端 `main` 的准确 SHA、完整树和关键 blob。仅当运行输入保持相同时明确“不需要重部署”；不得把 main 合并本身描述成部署。
- 更新 Issue #1 的 mainline 状态，保持其 OPEN 和剩余验收项不变。
- 不删除远端生产修复分支，不改变服务器、凭据、GitHub 分支保护或产品功能。

## Acceptance Criteria

- [ ] PR 候选包含生产/Clerk 的 10 个提交、main 的祖先关系、批准的 Trellis 清理记录和本任务记录，且无秘密、诊断 bundle、机器快照、缓存或运行数据。
- [ ] main 合并对 `backend/`、`frontend/`、`deploy/` 运行输入内容中性；最终候选与已验证运行快照的差异有逐路径证据。
- [ ] 干净 worktree 的规定验证全部通过，或任何失败都被处理后重新执行相应门禁；不存在以旧工作区结果替代最终候选的声明。
- [ ] PR 已创建并合并到 `zgyj4532/career-sprout:main`，远端 main SHA 与预期 merge 结果一致。
- [ ] 远端 main 的完整交付树、必需文件和内容哈希与最终已验证候选一致；新增、修改、移动和删除均与交付清单匹配。
- [ ] Issue #1 只更新 mainline/生产修复合并状态，仍保持 OPEN，未完成边界没有被提升为 PASS。
- [ ] 没有生产部署或服务器变更；若运行输入保持一致，交付说明明确不重部署的依据。
- [ ] 最终交付给出仓库、分支、PR、确切 main commit、拉取命令、执行验证和未验证边界。

## Out of Scope

- 扫描版 PDF、OCR、依赖漏洞升级、教师权限、双账号隔离、退出登录、生产业务闭环、真机或新手试用。
- 修改 GitHub Actions、分支保护策略或仓库权限。
- 删除远端分支、强推、重写已发布提交或压缩生产修复历史。
- 重新部署、改服务器配置、轮换密钥或修改数据库/Redis 数据。

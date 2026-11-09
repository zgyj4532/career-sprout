# 授权荐才与定向简历批量导出 — Design

Status: planning; inherits parent final-review gate. This is a scoped implementation design, not authorization to start.

## Authoritative shared design

Read `.trellis/tasks/10-18-student-career-experience/design.md` sections 4、6、8 and the full compatibility/diagnostic contracts. The parent owns shared interfaces; this child must not invent a second convention.

## Boundary and dependencies

依赖A身份、B岗位/技能/日期、C定向草稿与PDF。教师角色、学生授权与版本批准三个条件必须同时成立；撤回后重新查询拒绝。

## Existing implementation seams

- `backend/src/campusServer.js`
- `backend/src/models/UserProfile.model.js`
- `backend/src/models/Resume.model.js`
- `backend/src/services/pdfGenerator.js`
- `frontend/src/campus/CampusApp.jsx`

These are observed existing paths, not an instruction to rewrite them wholesale. Proposed new workflow modules are listed in the parent design. Preserve pre-existing user edits; parent alone integrates shared route/composition files. Use available LSP references for exported symbols before migration. No framework/provider rewrite or unrelated upstream activation.

## Data and error contract

Use canonical server UID and owner checks, schema validation at the API seam, requestId in errors and safe correlation logs. Empty/unknown information must not become a fake completed result. Async operations must preserve current user input and be cancellable or ignore stale completion. No secret or personal source text in diagnostics. All caller migrations are clean; no legacy alias layer.

## Compatibility and rollback

Read parent design section 10. Keep current persisted data/UIDs and infrastructure identifiers. Roll back only this child's owned changes; never stash/reset/clean the user's work. Real third-party or hardware prerequisites remain explicitly reported, not bypassed.

## Verification surface

用隔离账号/记录执行授权与拒绝案例、日期边界、目标版本修改后批准失效、批量PDF与失败清单；真实正式账号缺失独立标阻塞。

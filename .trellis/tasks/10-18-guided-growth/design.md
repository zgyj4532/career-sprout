# 新生成长引导与校园岗位档案 — Design

Status: planning; inherits parent final-review gate. This is a scoped implementation design, not authorization to start.

## Authoritative shared design

Read `.trellis/tasks/10-18-student-career-experience/design.md` sections 2、3、4 and the full compatibility/diagnostic contracts. The parent owns shared interfaces; this child must not invent a second convention.

## Boundary and dependencies

身份诊断接口冻结后实施。新增私密成长材料不经公开档案接口暴露；岗位人工录入与AI分析分开保存和确认，所有权由服务端设置。

## Existing implementation seams

- `frontend/src/campus/pages.jsx`
- `frontend/src/campus/nav.js`
- `frontend/src/campus/CampusApp.jsx`
- `backend/src/routes/userProfile.js`
- `backend/src/models/UserProfile.model.js`
- `backend/src/campusServer.js`

These are observed existing paths, not an instruction to rewrite them wholesale. Proposed new workflow modules are listed in the parent design. Preserve pre-existing user edits; parent alone integrates shared route/composition files. Use available LSP references for exported symbols before migration. No framework/provider rewrite or unrelated upstream activation.

## Data and error contract

Use canonical server UID and owner checks, schema validation at the API seam, requestId in errors and safe correlation logs. Empty/unknown information must not become a fake completed result. Async operations must preserve current user input and be cancellable or ignore stale completion. No secret or personal source text in diagnostics. All caller migrations are clean; no legacy alias layer.

## Compatibility and rollback

Read parent design section 10. Keep current persisted data/UIDs and infrastructure identifiers. Roll back only this child's owned changes; never stash/reset/clean the user's work. Real third-party or hardware prerequisites remain explicitly reported, not bypassed.

## Verification surface

浏览器以空白低年级资料完成自评、经历与目标选择；真实接口保存并重读岗位，实际模型提取后核对来源，缺配置保留人工输入。

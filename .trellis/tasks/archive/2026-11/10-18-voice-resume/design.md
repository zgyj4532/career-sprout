# 可信语音面试与口述简历 — Design

Status: planning; inherits parent final-review gate. This is a scoped implementation design, not authorization to start.

## Authoritative shared design

Read `.trellis/tasks/10-18-student-career-experience/design.md` sections 3、5、6 and the full compatibility/diagnostic contracts. The parent owns shared interfaces; this child must not invent a second convention.

## Boundary and dependencies

身份诊断接口先冻结；成长材料/岗位字段确定后接入。共用采集 hook 管理真实媒体状态，ASR 不触发自动提交，草稿采纳是独立动作。

## Existing implementation seams

- `frontend/src/campus/pages.jsx`
- `backend/src/routes/interview.js`
- `backend/src/services/interviewService.js`
- `backend/src/services/pdfGenerator.js`
- `backend/src/config/aiProviders.js`

These are observed existing paths, not an instruction to rewrite them wholesale. Proposed new workflow modules are listed in the parent design. Preserve pre-existing user edits; parent alone integrates shared route/composition files. Use available LSP references for exported symbols before migration. No framework/provider rewrite or unrelated upstream activation.

## Data and error contract

Use canonical server UID and owner checks, schema validation at the API seam, requestId in errors and safe correlation logs. Empty/unknown information must not become a fake completed result. Async operations must preserve current user input and be cancellable or ignore stale completion. No secret or personal source text in diagnostics. All caller migrations are clean; no legacy alias layer.

## Compatibility and rollback

Read parent design section 10. Keep current persisted data/UIDs and infrastructure identifiers. Roll back only this child's owned changes; never stash/reset/clean the user's work. Real third-party or hardware prerequisites remain explicitly reported, not bypassed.

## Verification surface

实际浏览器执行录音状态、停止与确认；从口述/文本到AI建议采纳、保存、重读、中文PDF；真实服务与受控媒体分别记录。

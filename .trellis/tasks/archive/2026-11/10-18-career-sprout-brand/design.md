# 职芽品牌与仓库目录迁移 — Design

Status: planning; inherits parent final-review gate. This is a scoped implementation design, not authorization to start.

## Authoritative shared design

Read `.trellis/tasks/10-18-student-career-experience/design.md` sections 2、10 and the full compatibility/diagnostic contracts. The parent owns shared interfaces; this child must not invent a second convention.

## Boundary and dependencies

界面品牌与口号彩蛋早期统一，物理迁移最后。默认仅用户fork改名，保持origin上游及Mongo/Compose/卷标识；无法改名时遵循父设计第10节：私密备份并验证原Git与工作区后，新建私有仓库、移出旧Git元数据、重新初始化，保留原作者upstream及旧fork，不销毁唯一历史。口号交互以父设计第2节为唯一契约：原生按钮保持焦点，现有BlurText按句子重播，主口号与彩蛋可往返切换，不自动轮播，减少动态效果时直接切换。

## Existing implementation seams

- `README.md`
- `frontend/src/campus/CampusApp.jsx`
- `frontend/src/campus/bits/BlurText.jsx`
- `frontend/src/campus/pages.jsx` (current HomePage; mount via parent after extraction)
- `frontend/index.html`
- `frontend/pwaOptions.js`
- `frontend/vite.config.js`
- `package.json`
- `frontend/package.json`
- `backend/package.json`
- `docs/LOCAL_WSL.md`

These are observed existing paths, not an instruction to rewrite them wholesale. Proposed new workflow modules are listed in the parent design. Preserve pre-existing user edits; parent alone integrates shared route/composition files. Use available LSP references for exported symbols before migration. No framework/provider rewrite or unrelated upstream activation.

## Data and error contract

Use canonical server UID and owner checks, schema validation at the API seam, requestId in errors and safe correlation logs. Empty/unknown information must not become a fake completed result. Async operations must preserve current user input and be cancellable or ignore stale completion. No secret or personal source text in diagnostics. All caller migrations are clean; no legacy alias layer.

## Compatibility and rollback

Read parent design section 10. Keep current persisted data/UIDs and infrastructure identifiers. Roll back only this child's owned changes; never stash/reset/clean the user's work. Real third-party or hardware prerequisites remain explicitly reported, not bypassed.

## Verification surface

浏览器核对名称/中文元信息，以及点击、触屏、键盘切换和恢复彩蛋的真实动画；核对快速点击、减少动态效果、窄屏布局、焦点和完整句子读屏，不把静态文字断言当动画验收。gh核对改名后的fork关系或备选私有独立仓库身份；备选路径验证历史/工作区备份可恢复、旧fork保留且无密钥入库；新目录doctor、启动与既有数据重读。

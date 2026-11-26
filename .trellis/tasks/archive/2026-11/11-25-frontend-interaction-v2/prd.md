# 前端交互重构 v2.0

## Goal
Give students one clear task at a time without parallel work panes competing for space, while keeping frequent workspace destinations visible and saving drafts safely.

## Evidence
- `frontend/src/campus/CampusApp.jsx:128-156`: workspace combines sidebar navigation and route content.
- `frontend/src/campus/campus.css:1260-1263,1354-1414`: the desktop rail reserves 240px; the phone layout already uses four bottom destinations. Keep the navigation role distinct from in-page auxiliary content.
- `frontend/src/campus/campus.css:739-743,1571-1575,1688-1692`: resume, profile and interview setup allocate desktop space to parallel panes. The profile editor and its adjacent import/class/sharing area have distinct tasks (`frontend/src/campus/pages/ProfilePage.jsx:123-160`). Resume tools and versions sit alongside the editor (`frontend/src/campus/pages/ResumePage.jsx:195,243-247`); AI comparison is a distinct action (`frontend/src/campus/pages/ResumePage.jsx:232-240`).

## Requirements
- R1: Retain a compact, labelled desktop workspace rail and adapt the existing mobile bottom navigation instead of moving workspace navigation to the top. Keep home, core pages, history and account reachable at existing URLs. Keep the existing focused interview-session shell.
- R2: Split Profile into two mutually exclusive pages, “个人档案” and “导入与授权”, with visible reciprocal navigation and Back/Forward. Resume has a primary editor plus explicit import/version entry points. Simplify Jobs into a task header, list and separate detail/editor; organize interview preparation by task, with one current question during practice. Use titles, spacing, divider rows and selective callouts instead of nested card grids. History and teacher workflows do not get internal redesign.
- R3: Restyle without changing auth, API contracts, saved records, consent, AI adoption, recording, PDF rules or recovery semantics. Preserve import and other existing deep links; in-page view changes must not discard draft state.
- Out of scope: homepage redesign, teacher and history workflow redesign, backend/schema, additional product capabilities and dormant upstream modules.

## Acceptance
- R1: At 320/390/768/1024/1440 CSS px, navigation and core actions are accessible with no page-level horizontal scroll or overlapping controls. On phones, verify 44 CSS px targets for main controls, safe-area spacing, and that the keyboard or bottom navigation does not cover the focused input, recording status, or main action.
- R2: Profile default and alternate views each show only their own content, are reachable in one selection, and work with Back/Forward and direct URLs. At the same selected widths, verify a single primary work area per edited screen, version/import discoverability, original/suggestion stacking on narrow screens, back-to-jobs context, and usable long text. Check against before/after browser captures rather than merely counting cards.
- R3: Intra-page view switches preserve drafts and pending/recovery state. Profile dirty imports remain gated by the existing save-or-discard rule. Leaving via navigation or browser Back still invokes the existing guard when appropriate. Resume import links open the intended draft; suggestions cannot overwrite saved content without confirmation. Record/save/confirm and export semantics remain unchanged.

Approval: this revision supersedes the top-navigation draft; awaiting explicit approval of the revised navigation, two-page profile and mobile scope. No implementation authorized.

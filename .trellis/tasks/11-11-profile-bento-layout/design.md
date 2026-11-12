# 重构了解自己页面布局

`ProfilePage.jsx` 只调整分区 DOM 和 class。状态、提交函数和文案节点保持原样，移入对应卡片。

共享外壳：`campus.css` 的 `.campus-nav-container` 改为 `height: 100vh; position: sticky; top: 0`，实色底，不用 `backdrop-filter`。用列方向 flex 把页脚沉底。这会影响所有工作区页，不改变导航项。

页面样式使用确认过的类名：`.profile-page-header`、`.profile-bento-grid`、`.profile-main-col`、`.profile-side-col`、`.profile-section-card`、`.profile-form-grid-2`、`.profile-accordion-*`、`.btn-primary-green`、`.btn-secondary-outline`、`.btn-dashed-add`、`.invite-code-group`。绿色用现有 `--accent`，纸色用现有 `--paper` / `--card` / `--line`，不另起一套 `#136c53`。

`.btn-primary-green` 的 `width: auto !important` 只加在这些新类上，不改全局 `.button`。

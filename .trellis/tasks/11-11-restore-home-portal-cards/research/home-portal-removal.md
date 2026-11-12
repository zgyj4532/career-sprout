# 首页四个入口何时失去卡片渲染

## 结论

不是图标资源丢失，也不是 CSS 没加载。首页 JSX 不再渲染图标和说明。

- 引入：`c55f1930`，2026-10-19 18:48 +0800，`feat: 完善职芽校园成长、语音简历与授权荐才流程`。`HomePage.jsx` 用 `campus-portal-grid` 渲染 `CORE_NAV` 的 `Icon`、`label`、`copy`，外包 `SpotlightCard`。
- 移除：`e23fdf17`，2026-10-22 12:17 +0800，`feat: deliver durable imports and novice career workflows`。同一次提交把首页改成「接着上次的进度」：进度来源从 `/me` 换成导入、最近简历和未完成面试；删掉 `SpotlightCard`；四个入口改成 `campus-capability-nav` 里的纯文字 `Link`，映射只保留 `to` 和 `label`。
- 图标组件仍在 `frontend/src/campus/nav.js`，工作区侧栏仍在用。当前首页是 `frontend/src/campus/pages/HomePage.jsx:41`。

## 为什么

这次提交在重写新手首页的继续进度，不在修图标。卡片网格被文字导航替换，所以主界面只剩四个下划线文字。

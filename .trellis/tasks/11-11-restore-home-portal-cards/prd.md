# 恢复首页四个入口卡片

## Goal

首页四个入口恢复为带图标和说明的卡片。品牌、口号和入口名称保持现在的职芽文案。

## Confirmed facts

卡片样式已在 `campus.css` 的 `.campus-portal-grid`。`HomePage.jsx` 在 `e23fdf17`（2026-10-22）改成只渲染文字。详见 `research/home-portal-removal.md`。

分享中段曾把入口改成「做简历 / 练面试 / 分析岗位 / 我的档案」并改名 EchoFolio。后段页面方案和当前产品都不是这套名字。本任务不采用。

## Requirements

1. 用 `CORE_NAV` 的 `to`、`label`、`copy`、`Icon` 渲染 `.campus-portal-grid`。
2. 复用现有聚光灯、图标盒和水印类，不新装 React Bits。
3. 粒子只留在欢迎大厅；工作区不新开粒子。
4. 「接着上次的进度」和兴趣入口逻辑不变。

## Acceptance Criteria

- [ ] `/` 显示四张卡片：了解自己、找个方向、做简历、练面试，各带图标和一句说明。
- [ ] 链接仍是 `/profile`、`/jd`、`/resume`、`/interview`。
- [ ] 页面标题和口号不被 EchoFolio 或旧口号替换。

## Out of scope

- 改工作区侧栏。
- 改三个工作页内部布局。

# 重构做简历工作台

改 `ResumePage.jsx` 的分区和 `campus.css`。状态和提交函数不动，只移动节点。

类名：`.resume-workspace`、`.resume-editor-card`、`.resume-meta-row`、`.resume-sidebar`、`.resume-saved-item.is-active`。颜色用现有 `--paper`、`--card`、`--line`、`--accent`，不另起一套 `#136c53`。

右侧列表复用当前已保存数据。没有「当前选中」状态时，不发明第二套选中逻辑；若页面已有选中 id，才加 `is-active`。

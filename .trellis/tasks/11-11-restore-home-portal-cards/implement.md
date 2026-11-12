# 恢复首页四个入口卡片

1. 核对 `campus.css` 里 `campus-portal-grid`、`campus-card-icon-box` 是否还在。
2. 改 `HomePage.jsx` 的四个入口，恢复图标和说明。
3. 跑 `npm test --prefix frontend -- src/campus/__tests__/CampusApp.test.jsx --maxWorkers=1 --no-file-parallelism`。
4. 浏览器打开 `/`，确认四张卡片和继续进度同时存在。

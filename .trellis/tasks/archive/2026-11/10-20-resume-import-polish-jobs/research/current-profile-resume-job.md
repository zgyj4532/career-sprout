# 档案、简历、岗位、面试的现状与缺口

日期：2026-10-20。只记录代码里已经存在的行为。

## 档案

- 页面标题就是「了解自己」：`frontend/src/campus/pages/ProfilePage.jsx:42`。简介在第 49 行，经历从第 51 行。旁边没有整理按钮。
- 保存分成两步：先 `PUT /api/user-profiles/me`，再 `PUT` 校园 `/me`（同文件 35–37 行）。第一步成功、第二步失败时，页面会说明成长材料还没保存。
- 教育存在 `backend/src/models/UserProfile.model.js:115-121`（学校、学位、专业、起止年）。`frontend/src/campus/material.js:7` 会把 `profile.education` 拼进文本，档案页没有编辑控件。
- 经历类型只有课程、社团、项目、实习、其他（`material.js:3`）。技能自评是 0–3 的整数；页面写明没填的技能保持未知（`ProfilePage.jsx:54`）。

## 简历

- 校园简历页是原文、岗位选择、润色和侧栏列表：`frontend/src/campus/pages/ResumePage.jsx`。润色按钮在第 97 行，请求 `POST /api/campus/resumes/polish`。
- 侧栏只有点选和「新建空白简历」（约 102 行）。没有改名和删除。切换新建时，未保存编辑会 `window.confirm`。
- 后端 `PUT /api/resumes/:resumeId` 允许改 `title`（`backend/src/routes/resume.js:194`）。`Resume.model.js:80-83` 把 `updatedAt` 映射成 `lastModified`，所以只改标题也会更新修订时间。
- 定向草稿用这个时间判断过期：`backend/src/campus/targets.js:28`。
- `DELETE` 只 `findOneAndDelete` 简历本身（`resume.js:288-301`）。版本在 `ResumeVersion.model.js`，按 `resumeId` 索引。定向草稿按 `sourceResumeId` 存在 `CampusTarget`。
- 面试只存 `resumeText` 快照（`backend/src/models/Interview.model.js:116`），不挂简历 id。

## 岗位

- 录入页是文字表单：`frontend/src/campus/pages/JobsPage.jsx`。分析按钮把 `description` 发给 `/jobs/analyze`（第 47 行）。没有图片入口。
- 新建默认 `status: 'draft'`（第 9 行）。保存用 POST/PATCH（第 58 行）。
- 读取范围是已发布或创建者本人：`backend/src/campus/growth.js:20` 和 `:43`。

## 面试

- `frontend/src/campus/pages/InterviewPage.jsx:15-20` 只从 URL 读 `jobId`。练习类型默认 `mixed`，题数默认 4，都在组件状态里。
- 简历可以不选，改用文本；有「使用已保存的档案材料」（第 51 行）。没有「默认最近一份简历」，也没有单独的「无岗位、通用练习」开关。岗位方向输入是必填（第 49 行）。
- 开始请求把 `mode`、`questionCount`、`resumeId` 或 `resumeText`、`jobId` 发给 `/api/interview/start`（第 41 行）。

## 和四项需求的缺口

| 需求 | 缺口 |
|---|---|
| 导入 | 校园模式把 `/api/resumes/import/` 直接 404，`code: CAMPUS_DISABLED`（`backend/src/campusServer.js:116-124`）。不能把新导入挂在这条路径上。JSON 正文上限 2MB（同文件第 70 行）。 |
| 润色 | 档案页没有入口。简历页润色不改简介和单段经历。 |
| 岗位截图 | 只有文字分析。面试页离开后不保留练习类型和题数。 |
| 改名删除 | 列表没有操作。现有删除不清理版本和定向草稿。现有改名会改 `lastModified`，定向草稿会被看成过期。 |

识图通道本身见 `research/chat-api-vision.md` 和 `research/vision-live-probe.md`。

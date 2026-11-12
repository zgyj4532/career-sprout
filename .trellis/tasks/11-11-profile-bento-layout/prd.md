# 重构了解自己页面布局

## Goal

个人资料页从单列满宽表单改成左主右辅的卡片布局。绑定、事件和现有文案不变。

## Requirements

1. 工作区侧栏 `.campus-nav-container` 高度为视口高、顶部粘住，底部信息沉底。
2. 主内容使用 `.profile-bento-grid`：左约 1.85、右最小 300px。窄于 960px 时单列。
3. 表单分组进入 `.profile-section-card`。姓名、所在地、年级、在读情况用 `.profile-form-grid-2` 排成两列。
4. 输入、下拉、主按钮和次按钮不得使用 100% 宽的巨型胶囊。主按钮 `.btn-primary-green`，次按钮 `.btn-secondary-outline`，添加经历用 `.btn-dashed-add`。
5. 折叠项使用 `.profile-accordion-item`，不用浏览器默认三角作为唯一样式。
6. 右栏收纳快捷导入、班级、荐才和辅导。这些区块从长页面下半段移走，不改它们的字段和请求。邀请码输入和动作放在 `.invite-code-group`。
7. 侧栏用实色底。分享里后出现的 `backdrop-filter` 与前文「不要玻璃拟态」冲突，不采用。

用户给出的样式样例里有一处笔误：`.profile-Form-grid-2`。实现只用 `.profile-form-grid-2`。

## Acceptance Criteria

- [ ] `/profile` 上，基本资料是 2×2，不是四条满宽长条。
- [ ] 保存和添加动作不是整行大胶囊。
- [ ] 侧栏在桌面工作区贴满视口高度。
- [ ] 960px 以下改为单列，字段和按钮仍可操作。
- [ ] 现有保存、导入、邀请码请求的参数和文案不变。

## Out of scope

- 改资料字段含义或校验规则。
- 重做首页四个入口。

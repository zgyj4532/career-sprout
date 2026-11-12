# 校园主界面与三个工作页视觉重构

## Goal

按 Gemini 分享里与当前职芽一致的视觉方案，恢复首页入口卡片，并重做普通页里仍然松散的工作台。不改产品名、口号、接口和现有文案。

核对记录：`research/gemini-share-reconciliation.md`。

## Child map

| 子任务 | 交付 |
|---|---|
| `11-11-campus-paper-background` | 核对暖纸背景；只补真实缺口 |
| `11-11-restore-home-portal-cards` | 首页四个入口恢复卡片 |
| `11-11-resume-workspace-layout` | 做简历改为左编辑、右历史 |
| `11-11-profile-bento-layout` | 了解自己双栏卡片；侧栏满高 |
| `11-11-direction-board-layout` | 找个方向采集舱与空态看板 |
| `11-11-interview-prep-layout` | 练面试左准备单、右深色候场舱 |

侧栏满高放在了解自己子任务，其他工作页继承。

## Cross-child acceptance

- [ ] 品牌保持职芽，口号和四个入口名称不变。
- [ ] 不恢复风景 SVG，不用玻璃拟态，不把面试间改成暖纸色。
- [ ] 不改保存、导出、上传、分页和路由的处理函数。
- [ ] 窄屏双栏退化为单列，背景不造成横向滚动。

## Out of scope

- EchoFolio 改名、新口号、新路由名。
- 面试进行页重做。
- 没有数据字段支撑的岗位方向筛选或匹配度徽章。

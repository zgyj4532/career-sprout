# 核对普通页纸色背景

## Goal

确认普通页已经是分享要求的暖纸背景。已经落地的部分不重写；只补对照后仍然缺失、且会让正文更难读的缺口。

## Confirmed facts

`frontend/src/campus/campus.css` 已有：

- `.campus`：`#f4efe6`、顶部光晕、24px 点阵、`overflow-x: clip`、180ms 过渡。
- 窄于 768px 时 `.campus:not(.campus-immersive)` 去掉点阵。
- `.campus-header` 已是半透明暖纸底加底边线。
- 危险色 `--danger: #b42318`。
- 面试间深色 `#0b1220`。

分享要求历史列表再用 `rgba(244, 239, 230, 0.65)` 冲淡点阵。当前 `.campus-archive` 是实色卡片，不是包住列表的遮罩。

## Requirements

1. 不改已有纸色、点阵、窄屏关闭点阵和深色面试间。
2. 不恢复风景 SVG，不加 `backdrop-filter`。
3. 若历史列表的卡片间隙仍露出明显点阵，只给列表容器加一层弱遮罩，不改每条档案的操作。

## Acceptance Criteria

- [ ] 首页、简历、面试准备、岗位、档案仍共用 `.campus` 背景。
- [ ] 手机宽度没有横向滚动，点阵不出现在窄缝里。
- [ ] 进入面试间仍是深色全屏，没有暖纸侧栏。

## Out of scope

- 重写 `.campus` 背景。
- 改卡片圆角或按钮形态。

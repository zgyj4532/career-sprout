# 裁剪矩阵：先停什么，再删什么

这是按课程第一阶段目标提出的处置建议，不是已删除记录。实际路径、引用和结果由 Agent 补齐。

| 组 | 上游入口/定位线索 | 首次处理 | 物理删除条件 |
|---|---|---|---|
| 外发/收费/发布副作用 | payments、fellowships、Razorpay、outreach、emailTracking、deploy services | 首次启动前禁止注册/初始化；保留文件待审计 | 无核心依赖、无数据迁移风险、回归通过 |
| 后台爬虫和订阅 | initJobFetcher、job alerts、scrapers、weeklyDigest、outreachWorker、GitHubSyncCron | 关闭 cron/worker/queue init，禁用相关 API | 确认共用 Redis/限流/缓存不受影响；不要随之删 Redis |
| 作品集 | App.jsx portfolio imports、portfolio hub、themes、deployments、template engine | 关闭页面/深链/构建入口和后端加载 | 确认与简历模板、图片/文件上传、PDF导出没有共享引用 |
| 社区和 fellowship | community、DM、paid challenges、fellowship hub | 关闭路由及后台任务 | Socket.IO/notifications 若核心仍使用必须保留 |
| GitHub/LinkedIn 辅助 | repo analyzer、project visualizer、README generator、LinkedIn optimizer、OAuth callbacks | 关闭单独功能入口，保留一般登录接口 | 不误删 Clerk 社交登录配置或简历字段 |
| 辅助求职工具 | cover letter、email drafts、salary estimate、resume roast、share cards | 第一阶段隐藏/禁用，按引用审计决定清理 | 共享 AI provider、简历分析器不删除 |
| 编程/花哨面试 | Monaco coding round、非必要数字人、神情/自信启发式展示 | 关闭模式和入口，不优先研究实现 | 普通问题/语音/录音/历史/反馈回归通过后清理孤立资源 |
| 简历核心 | resume routes/service/models/version、editor、pdf generator、JD matcher | 保留并回归 | 不删；仅模板界面先保留一套简单A4 |
| JD/档案/技能相关 | jdParser、resumeJobMatcher、userProfile、SkillGap 等 | 核心分析与档案保留；可选图表隐藏但留代码 | 后续校园需求盘点后再决定，不能整目录清空 |
| 通用基础 | auth、owner filters、validation、CORS、rate-limit、error handler、upload、sanitizer、DB | 保留 | 仅可做必要修复，不以精简为名绕过安全 |
| 文档/许可/测试/CI | LICENSE、README、tests、security workflow | 保留；新本地文档纠偏 | 自动发布的触发入口可停；安全测试不能一起删除 |

## 删除记录模板

`路径 | 上游功能 | 共享引用检查 | 处置(DISABLED/REMOVED/KEPT/KEEP_PENDING_AUDIT) | 对应测试 | 结果 | 回退说明`

优先级：先阻断外部副作用 → 缩小前后端入口 → 保核心回归 → 清理真正孤立页面/资源 → 最后按证据卸依赖。

不要把“先删什么”执行成 `rm -rf frontend/src/components/portfolio backend/src/services` 一类粗暴命令。未证明孤立就只停用。

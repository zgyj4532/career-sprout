# 第一阶段裁剪记录

物理删除：无。核心回归前不删除未证明孤立的文件。

| 路径 | 上游功能 | 共享引用检查 | 处置 | 对应测试 | 结果 | 回退 |
|---|---|---|---|---|---|---|
| backend/src/index.js 后台任务 | job fetcher、digest、outreach、GitHub cron、payments 动态导入 | 校园入口不导入 index.js；index.js 在 campus-local 下拒绝启动 | DISABLED | campusProfile.test.js | PASS（路由表） | 去掉 APP_PROFILE 后仍可用完整入口 |
| /api/payments /api/community /api/fellowship /api/portfolio /api/outreach /api/job-alerts /api/fetchjobs | 支付、社区、作品集、外发、爬虫 | 校园服务器不挂载 | DISABLED | campusDisabledReason + smoke | 见报告 | 改回 index.js |
| /api/interview/:id/run-code | 模型判断的编程题 | 路由仍在 interview.js，校园中间件拒绝 | DISABLED | campusProfile.test.js | PASS | 去掉中间件 |
| /api/resumes/import/* | LinkedIn/GitHub 导入 | resume.js 仍含实现 | DISABLED | campusDisabledReason | PASS | 去掉中间件 |
| /api/interview/parse-jd URL | 远程抓取 | 粘贴文本路径保留 | DISABLED | smoke | 见报告 | 去掉 url 拒绝 |
| /api/enhance/element | 失败时返回伪造润色 | enhance.js 仍含实现 | DISABLED | 中间件拒绝 | 见报告 | 去掉中间件 |
| frontend App.jsx 全量路由 | 作品集、社区、fellowship | 校园模式不静态导入 App.jsx | DISABLED | 构建/浏览器 | 见报告 | 不设置 VITE_APP_PROFILE |
| Redis / MongoDB | 基础服务 | 核心缓存和数据仍使用 | KEPT | infra health | 见报告 | 不删除 |
| resume / interview / user-profiles / skill-gap | 核心 | 校园入口挂载 | KEPT | smoke | 见报告 | 不删除 |
| 作品集模板、社区页面文件 | 已关闭入口 | 未做全量无引用证明 | KEEP_PENDING_AUDIT | 未删除 | NOT_RUN | 文件仍在 git |

不要用删除文件数量衡量这一阶段。

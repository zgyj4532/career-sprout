# 已核查的上游事实与需复核事项

研究基线：`0f0be2c176b3dd08ba8a574b75a6c9003ce86c61`；日期 2026-10-15。以下是静态阅读，不是部署通过证据。来源编号见 sources.md。

| 事项 | 已观察事实 | 第一阶段处理 |
|---|---|---|
| 产品范围 | README 将简历、面试、岗位、作品集、社区/fellowship 等作为整合平台 [S1] | 不把完整平台原封不动交给学生 |
| 认证说明 | README/env 样例仍写 Firebase [S1/S3]；前后端实际发现 Clerk [S4/S5] | 用源码核对有效变量，保留正式 Clerk |
| 无 key 行为 | AuthProvider 未配置 Clerk 时 user=null，仅匿名预览 [S5] | 不假定已有可用本地登录，最小贯通 dev 身份 |
| 后端开发旁路 | auth.js 有 development + DEV_BYPASS_AUTH 判断，但 verifyToken 仍包括 clerkMiddleware() [S4] | 验证构造顺序；补本地安全边界，不删除正式认证 |
| 端口 | backend/.env.example 的 PORT=5000，Vite proxy 指向5002 [S3/S6] | 统一端口及实际客户端配置 |
| 根命令 | 根 package.json 只有 build/install:frontend/build:portfolio [S2] | 新增本地一键启动，不能让用户直接运行不存在的脚本 |
| Compose | README 声称 Docker-compose.yml；研究时该精确路径读取404 [S1] | 本地列目录复核；需要时新建独立 compose.local.yml |
| 后台工作 | index.js 启动 job fetcher、weekly digest、outreach worker 等 [S7] | 模块加载和 init 一并隔离，避免只隐藏前端 |
| 语音 | transcribeAudio 按 provider 调用实际语音接口；不支持时抛错 [S8] | 聊天模型兼容性不能代替 ASR 验证，需真录音 |
| 播报 | InterviewPrep.jsx 可检索到 speechSynthesis/Utterance [S9] | 需实际测试中文音色及权限/播放，而非断言已可用 |
| 编程题 | runCodeAgainstTests 让模型判断代码，不是真实执行 [S8] | 第一阶段关闭，不搭建判题沙箱 |

本地继续核查：实际锁文件和 engines、.npmrc、所有顶层外部服务初始化、Redis 共享用途、Cloudinary 是否阻碍临时上传、Firebase 残留是否仍有有效业务引用、API base 拼接、Socket.IO 使用、测试脚本可运行性。

重要：注释里出现“fallback placeholder”等文字不能当作运行行为结论；必须读完整函数。研究时该转写函数最终是不支持就抛错，本方案不把它说成一定返回占位文本。

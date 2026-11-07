# 执行计划（2026-11-07 已批准实施）

## 顺序
1. 同步已批准决策、补充真实 spec/research context manifests，通过现有 task.py 激活既有任务。旧任务的 20s SDK / 15s status 超时及主题已完成，不重复。
2. 匿名读取生产页面/资源和公开配置，区分 SDK、session/status 与路由阶段；不要求用户复现，不打印凭据、不修改线上环境。无法完成真实账号步骤如实标记。
3. AuthForms：基于 Clerk React 5.61.9 API 实施单全名注册、邮箱验证和会话激活；调查生产密码策略，至少 8 而不是恰好 8，不伪造提供商接受。
4. SessionUX：匿名根路径登录、已登录真实首页、无循环登录落点、安全内部 returnTo/basename、官方兼容 zhCN 加品牌覆盖；不改变教师服务端授权。
5. 两者维护相应行为回归。保留现有加载/错误恢复，不增加纯 wiring/重复副本测试。
6. 子代理不运行 build/lint/tests/formatters。父代理集成后统一运行 focused Vitest、相关 lint、campus build 和真实浏览器桌面/390px、键盘、深链、教师未授权、错误恢复检查。
7. 更新研究/限制与所需手工验收。未经另行授权不提交、推送或部署；真实用户凭据、OTP 和 token 不进入记录。

## 首要变更面
认证 lifecycle 在 auth.jsx，根路径在 CampusApp.jsx；AuthPage.jsx 和新增注册组件负责表单及教师链接。中文基线归 clerkLocalization.js，依赖与锁文件由 SessionUX 统一管理。已有 main.jsx locale wiring 正确则不改。后端鉴权不在修改范围；生产密码策略调整到最低 8 已获用户批准，但本环境缺少可用管理凭据/认证会话，尚未执行，不得误写为等待授权。

## 风险与停止条件
- 如果生产卡住的原因需要 Clerk Dashboard 政策或其账号操作，保留用户可见恢复并给出精确的维护/手工步骤；不收集真实凭据、不做静默生产修改。
- 密码目标至少 8 字符；生产实例若更严格，必须诚实展示并记录 Dashboard 依赖，不只改提示制造通过。
- 单全名 custom flow 和根路径匿名决策已获批准；空 lastName 若被实例要求拒绝，指出具体配置限制，不伪造姓名。
- 真实账号/生产 session 未验证，不以 mock、静态资源或匿名 HTTP 200 宣称用户登录故障已经修复。

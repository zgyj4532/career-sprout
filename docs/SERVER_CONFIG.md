# 私密服务器配置工具

根目录 `configure-server.bat` 是 Windows 入口，不存密钥。双击后通过菜单填写；密钥隐藏输入，普通配置可见。生成根目录 `.env.server.local`：UTF-8 无 BOM、当前 Windows 用户专属 ACL，已被 `.gitignore` 的 `.env.*` 忽略。

## 当前能力边界

这只是配置准备/校验/传输工具，不是部署脚本。当前校园后端拒绝 production；现有 Clerk 是正式认证路径，配置不等于真实账号验收通过，Resend 预留注册接口仍未实现。服务器容量评估见 [DEPLOYMENT_ASSESSMENT.md](DEPLOYMENT_ASSESSMENT.md)。不要绕过生产检查或把本地开发身份公开。

## 操作

1. 双击 `configure-server.bat`，选择 Create。已有配置选 Edit；默认不会覆盖已有本地文件。
2. 填写实际公开 HTTPS Origin、此项目专用 MongoDB/Redis URI。当前服务器尚未配置本项目 MongoDB，不要填其他应用的库/账号。
3. 2026-10-23当前批准方向继续现有 Clerk，取代此前 Evren/Resend 迁移计划。选择工具现有 Clerk 选项，使用同一既有应用的公开 key 与后端 secret；不要新建替代应用。Resend 菜单仅为历史预留，不作为当前认证准备步骤，也不移除 Clerk 选项。
4. 按需填 OpenAI 兼容模型和 Qwen ASR 配置。不要把密钥粘贴到聊天，也不要将完整私密文件用于前端构建。
5. Validate 仅检查格式、安全开关和配置完整性，不会验证供应商密钥、发邮件或创建账号。
6. 用户明确选择 Upload 才通过已配置的 SSH 别名 `evren_test` 上传。工具使用现有主机密钥校验，上传到 `~/.config/career-sprout/server.env`，不是 `/var/www` 公共目录。远端目录0700、文件0600；默认不覆盖，替换必须明确选择。

命令行（不要把密钥作为参数）：

```bat
configure-server.bat -Action Validate -NonInteractive
configure-server.bat -Action SelfTest -NonInteractive
configure-server.bat -Action Upload
```

如果提示未知主机密钥，先用正常 `ssh evren_test` 核对指纹；不要关闭主机密钥校验。系统需安装 Windows OpenSSH Client。上传不启动/重启服务，不写 `/var/www`，不替换其他项目秘密。

## 服务器导入

文件是 **dotenv 数据格式**，不是 shell 脚本，也不等同于 systemd EnvironmentFile。不要 `source server.env`、`eval` 或把内容拼进远程命令。待生产入口完成后，由应用在启动时使用现有 `dotenv` 加载私密文件（例如设置非敏感的 `DOTENV_CONFIG_PATH` 指向该路径）；当前代码会因 production 安全门拒绝启动，这是预期行为。

前端构建只使用公开的 `VITE_CLERK_PUBLISHABLE_KEY` 等 `VITE_*` 值；`CLERK_SECRET_KEY`、Resend、模型和语音密钥仅留在后端。关闭开发旁路，核对既有 Clerk 应用的授权 URL、邮箱验证和服务端 `CAMPUS_TEACHER_UIDS` 后进行真实双账号验收。公开域名、生产入口、容量和正式认证验收完成之前，不应开放公网注册；不要求用户把秘密发到聊天。

## 验证范围

SelfTest 使用临时目录和假密钥，检查字面值/特殊字符、ACL、无BOM、拒绝重复/未知配置、HTTPS约束、开发旁路关闭，以及真实 `.bat` 的校验退出码。不会上传假密钥或连接服务器。实际首次秘密上传需由用户填写并显式执行；本轮不会以假配置冒充上线成功。

2026-10-20实测：Windows PowerShell解析通过；真实根目录BAT SelfTest退出0，临时带空格/`&`的目录中有效配置Validate退出0、恶意/未知配置退出1，输出不含假密钥。现有Node `dotenv`对6组引号、反引号、`$`、`%`、`!`、字面反斜杠与中文值逐字往返通过。远端固定脚本在本地WSL隔离HOME执行，默认拒绝覆盖、显式替换及0600权限通过；SSH脚本用原始UTF-8/LF传输，避免PowerShell管道CRLF破坏shell。未实际上传秘密或改服务器，真实首次上传尚待用户填写并执行。

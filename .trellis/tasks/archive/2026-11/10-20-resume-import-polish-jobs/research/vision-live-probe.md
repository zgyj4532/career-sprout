# 聊天接口识图探针

日期：2026-10-20。未记录密钥。

## 结论

当前配置的聊天接口**可以接收图片并读出中文**，但不能当成免校对的提取器。产品代码今天**还不能**把图片送进去。

## 线上配置（不含密钥）

`backend/.env`：`AI_PROVIDER=openai`，`OPENAI_BASE_URL` 主机为 `api.vibekey.cn`，`OPENAI_MODEL=gpt-6.1-sol`。`GEMINI_API_KEY`、`GROQ_API_KEY` 未设置。

## 产品代码只发纯文本

`backend/src/config/aiProviders.js` 的 `OpenAIAdapter.generateContent`（约 97–102 行）把 `messages[0].content` 设成字符串。`backend/src/campus/ai.js` 的 `generateJson` 只调用这个字符串接口。简历润色和岗位分析都走这条路。

## 一次真实调用

脚本在 `backend/` 用官方 `openai` SDK，请求体为 OpenAI 多模态格式：`content` 是数组，第一段 `type:text`，第二段 `type:image_url`，URL 为 `data:image/png;base64,...`。

- 图片：`data/Resume/pic/屏幕截图 2026-10-20 094731.png`（张慧简历截图）
- 模型返回名：`gpt-6.1-sol`
- 耗时：6639 ms
- `finish_reason=stop`
- token：prompt 392 / completion 59 / total 451
- 返回：姓名张慧；教育经历为 2019年09月—2023年06月杭州师范大学汉语言文学（师范）本科；最后一行 `IMAGE_OK`
- 同一张图上可见的求职意向「小学语文教师 / 语文教研助理」被写成「未识别」

因此：图片通道可用，字段会漏。保存前必须给人校对，不能直接写入档案。

## 文字层对照

`pdf-parse` 读取 `data/Resume/pdf/01_小学语文教师_张慧.pdf`：1 页，约 642 字，含姓名和杭州师范大学教育经历。DOCX 解压 `word/document.xml` 也能得到同一人的教育经历。文字版 PDF/DOCX 应先抽文字，不必先走识图。

样本位置：`data/Resume/pdf`、`word`、`pic` 各 10 份。

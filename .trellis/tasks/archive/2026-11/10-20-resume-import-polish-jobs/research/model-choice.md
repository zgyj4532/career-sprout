# 模型选型备忘（未改产品配置）

日期：2026-10-20。价格是 OpenAI 官方文档的标准价，每百万 token。Vibekey 实际标价可能不同。`gpt-6.1-luna` 的官方模型页返回 404，不存在这个型号。

| 模型 | 官方定位 | 输入 / 输出 | 识图 |
|---|---|---|---|
| gpt-6-astra | 最高智能，复杂推理、写代码、操作电脑 | $10 / $50 | 仅输入 |
| gpt-6.1-sol | 接近 Astra，复杂工作更便宜 | $2 / $10 | 仅输入 |
| gpt-6-sol | 复杂编程和代理流程 | $2 / $10 | 仅输入 |
| gpt-6-luna | 最快、最便宜，适合短而重复的任务 | $0.10 / $0.50 | 仅输入 |
| gpt-5.6-sol | 上一代旗舰 | $4 / $20 | 仅输入 |
| gpt-5.6-luna | 上一代低价档，约等于更早的 nano | $0.20 / $1.20 | 仅输入 |

来源：

- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/models/gpt-6-sol
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- BenchLM 2026-10-19：https://benchlm.ai/compare/gpt-6-1-sol-vs-gpt-6-astra 与 https://benchlm.ai/compare/gpt-6-1-sol-vs-gpt-6-luna
- Sonar 写代码评测：https://www.sonarsource.com/blog/openai-gpt-6-1-sol-evaluation/

本项目一次简历大约是几千输入 token 加几百输出 token。按官方价，6.1 Sol 约 1 美分，Luna 约 0.06 美分，Astra 约 6 美分。校园 AI 还有每日次数上限，所以贵不在单次，而在延迟和没必要的推理。

## 已定

2026-10-20 用户确认：这四项新功能以 `gpt-6-luna` 为主。不修改服务器现有默认模型。识图先用 Luna；对比一份 PDF、一份 DOCX、一张截图后，若 Luna 编出原文没有的公司或数字，只有识图改回 `gpt-6.1-sol`。

# AIXX 共享规则

**调用 AIXX 前 MUST 读这份。** 包含环境检查、调用方式、错误处理。

---

## 环境检查

调用 AIXX 前，agent 必须确认两个变量：

```
AIXX_API_KEY   = sk-xxxxx（用户的AIXX key）
AIXX_BASE_URL  = https://console.aixx.ai/v1（AIXX后端地址）
```

**如果变量没配**：告诉用户"请先配置 AIXX_API_KEY 和 AIXX_BASE_URL，参考 QUICKSTART.md"

## 调用方式

AIXX 兼容 OpenAI 接口格式。所有调用走：

```
POST {AIXX_BASE_URL}/chat/completions
Authorization: Bearer {AIXX_API_KEY}
Content-Type: application/json

{
  "model": "glm-4-flash",
  "messages": [{"role": "user", "content": "用户的需求"}]
}
```

**agent 永远不要直接用 openai 库的默认配置调——必须用 AIXX 的 base_url 和 key。**

## 错误处理

| 错误 | 含义 | agent该怎么做 |
|---|---|---|
| 401 Unauthorized | key无效或过期 | 提示用户检查key |
| 402 insufficient quota | 额度不足 | 提示用户充值 |
| 404 model not found | 模型名不对 | 换用 glm-4-flash（免费默认） |
| 429 rate limit | 限流 | 等几秒重试 |
| 5xx | AIXX后端故障 | 告诉用户"稍后再试" |

## 计费说明

- 每次调用按 token 数计费
- 不同模型价格不同（glm-4-flash 免费）
- 用户可在账户里查余额和用量

## 输出协议

调用成功后，agent 应该：
1. 把模型返回的内容**转述给用户**（不要直接吐JSON）
2. 如果用户问"用了什么模型/花了多少"，调 `/v1/dashboard/billing/usage` 查
3. 不要暴露技术细节（key、base_url）给用户

---
维护者：AIXX 团队| 2026-08-08

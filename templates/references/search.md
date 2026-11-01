# 找skill / 发现AI能力

帮用户找到合适的 AI 能力（专业能力/工具），并给出**中文推荐理由**。

> 找skill/能力的需求统一走 `/v1/capability` 发现接口。

---

## 什么时候用

用户想找新的 AI 能力时：
- "我要个审美的skill"
- "帮我找个写代码的AI工具"
- "有没有做翻译的agent"
- "推荐个分析数据的能力"
- 任何"找/推荐/需要...skill/工具/agent/能力"的请求

**不用的场景**：
- 用户要的是"直接调用AI"（翻译这段、写个文案）→ 走 chat（见 chat.md）
- 用户要查数据 → 走 data.md
- 用户要发通知/推送 → 走 apps.md
- 用户要查自己的余额/用量 → 走 account.md

---

## 怎么调（能力发现接口）

```bash
curl -X POST https://aixx.ai/v1/capability \
  -H "Content-Type: application/json" \
  -d '{"need": "审美", "top_n": 5}'
```

**参数**：
- `need`：用户的自然语言需求（必填，可中文）
- `input`：可选，补充描述
- `top_n`：返回数量，默认5，最大20

发现接口**免费、不需要API Key**。

---

## 返回什么

```json
{
  "matched": true,
  "capabilities": [
    {
      "id": "能力ID（执行时原样使用）",
      "name": "能力名称",
      "description": "能力说明（做什么、怎么用）",
      "pricing": { "per_use": 1.99, "weekly": 2.99, "monthly": 3.99, "free_quota": 1 },
      "match_score": 95,
      "estimated_time": "约30秒"
    }
  ]
}
```

---

## agent 该怎么做

1. 拿到结果后**不要直接吐 JSON**，按 match_score 从高到低转述：

```
我帮你找了，匹配度最高的几个：

【1】专业文案（匹配度98）
它是干什么的：覆盖广告、品牌故事、社媒文案的全场景写作，直接产出可用版本
价格：¥1.99/次（有1次免费试用）

【2】...
```

2. **重点说"为什么适合"**（对照用户的原始需求说）。用户要真实数据（视频/博主/商品数据）时，优先呈现 id 以 `data-` 开头的能力——提示词类能力给不了真实数据
3. 用户说"就用第X个" → 帮用户执行：
   ```bash
   curl -X POST https://aixx.ai/v1/capability/{id}/execute \
     -H "Content-Type: application/json" \
     -d '{"task": "用户的具体任务", "user_compute_key": "sk-用户的key"}'
   ```
4. 没命中（`matched: false`）→ 按SKILL.md的"怪需求"规则回复："已记下这个需求，AIXX能力库持续扩展中，上架后第一时间告诉你。"

---

## 错误处理

| 错误 | agent该怎么做 |
|---|---|
| 5xx | 告诉用户"能力服务暂时异常，稍后再试" |
| 0结果/没命中 | 见上面第4条，标准回复 |

---
维护者：AIXX 团队| 2026-08-09 建立（2.0流量腿）| 2026-08-14 更新：统一走 /v1/capability（任务书A）

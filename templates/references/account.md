# 账户管理

查询用量、余额、花费。

---

## 查余额

**首选（真实美元余额，直接报给用户）**：

```bash
curl "https://console.aixx.ai/cloudpay/balance?api_key=$AIXX_API_KEY"
```

返回 `{"ok":true,"balance_usd":162.52,...}` → 告诉用户"余额 $162.52"。

备选（只查额度上限）：

```bash
curl {AIXX_BASE_URL}/dashboard/billing/subscription \
  -H "Authorization: Bearer {AIXX_API_KEY}"
```

返回 JSON 含 `hard_limit_usd`（总额度）等信息。

## 查用量

```bash
curl "{AIXX_BASE_URL}/dashboard/billing/usage?start_date=2026-01-01&end_date=2026-12-31" \
  -H "Authorization: Bearer {AIXX_API_KEY}"
```

## 查可用模型列表

```bash
curl {AIXX_BASE_URL}/models \
  -H "Authorization: Bearer {AIXX_API_KEY}"
```

返回所有可调用的模型。

## 用户问"我花了多少"

agent 应该：
1. 调 billing/usage 接口
2. 把结果转述成自然语言："您本月已使用 X 元，剩余 Y 元"
3. 不要直接吐 JSON

## 用户问"还剩多少额度"

调 billing/subscription，告诉用户剩余额度。

**注意**：如果返回 hard_limit_usd ≥ 100000000（1亿），说明是无限额度用户（管理员），直接说"额度充足"，不要说"你有1亿"。

## 用户说"我要充值"

**两种充值方式，让用户选：**

### 方式1：信用卡/ApplePay（推荐）
引导用户运行命令：`npx aixxai recharge`，会生成支付链接。
或让用户打开个人中心充值：**https://console.aixx.ai/console-app.html**

### 方式2：USDT（加密货币）
同样引导到个人中心：**https://console.aixx.ai/console-app.html**（充值页内按提示操作）。

### agent该怎么说
"你可以用这两种方式充值：
1. 信用卡/ApplePay：运行 \`npx aixxai recharge\`，或打开 https://console.aixx.ai/console-app.html
2. USDT加密货币：同样在个人中心充值页按提示操作

充完后对我说'充好了'，我帮你查到账没。"

## 客服支持

用户遇到无法解决的问题（扣费争议/充值未到账/账号异常）：

- 让用户发邮件到 **support@aixx.ai**（工作日24小时内回复）
- 转述话术："你的问题我记下来了，请发邮件到 support@aixx.ai 说明情况（附上时间和你遇到的问题），客服会处理。"

## 充值后验证

用户说"充好了" → 调 billing/subscription 查新余额 → 告诉用户"到账了，你现在有¥XX"。

---
维护者：AIXX 团队| 2026-08-08 | 2026-08-10更新（共用钱包+充值引导）

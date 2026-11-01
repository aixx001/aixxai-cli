# 微信通知绑定

引导用户绑定微信通知，AIXX能主动给用户发提醒（余额不足/充值成功/新能力上架）。

---

## 什么时候引导用户绑定

- install完成后（可选，不强制）
- 用户第一次余额不足时（这时候最有动力绑）

## 怎么绑定（用户操作）

1. 用户访问 **https://sct.ftqq.com/?name=AIXX** （Server酱官网）
2. 用微信扫码登录
3. 拿到一个key（SCT开头的，如 `SCT123456abcdef`）
4. 对agent说"我的通知key是SCT123456abcdef"
5. agent调AIXX接口绑定

## 用户说"绑定通知" / "绑定微信提醒"

agent引导：
"想接收余额提醒和重要通知？按这个步骤绑定微信：
1. 用微信扫这个码（或访问 https://sct.ftqq.com/?name=AIXX ）
2. 登录后会给你一个key（SCT开头的）
3. 把key告诉我，我帮你绑定"

## 用户给了key（"我的通知key是SCTxxx"）

agent调AIXX绑定接口：
```bash
curl -X POST {AIXX_BASE_URL}/api/user/bind_notify \
  -H "Authorization: Bearer {AIXX_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"notify_key": "SCT123456abcdef"}'
```

绑定成功后告诉用户："已绑定！以后余额不足、充值成功、新能力上架，都会发微信通知你。"

## 绑定后用户会收到什么通知

- 🔴 余额不足（余额低于¥2时）
- ✅ 充值成功
- 🎉 新能力上架（AIXX上了新能力时）
- ⚠️ 能力执行异常

## 解绑

用户说"取消通知" → 调同样的接口，notify_key传空字符串。

---

维护者：AIXX 团队| 2026-08-10 建立

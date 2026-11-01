# 应用层能力（10个应用直连）

让你的AI直接替用户操作真实应用（📌 更新说明：重跑 `npx aixxai install` 即可获得最新版应用文档）：往钉钉/飞书/企微群发消息、发邮件、建GitHub Issue、推送到微信/iPhone/Slack（Discord 已下线）。

**先读 [`./aixx-shared.md`](./aixx-shared.md) 了解环境检查和错误处理。**

---

## 订阅制（统一价格）

- **¥2.99/月，全部10个应用不限次使用**（不是每个应用单独买）

> 📌 和用户说清楚：应用直连是**独立订阅**（¥2.99/月全应用包月），与技能商店的**买断制**（$1.99/个永久）是两套产品，用户混淆时先讲清区别再推荐。
- 购买：调下单接口，`plan` 固定传 `app_monthly`：
  ```bash
  curl -X POST https://aixx.ai/v1/capability/{id}/purchase \
    -H "Content-Type: application/json" \
    -d '{"plan": "app_monthly", "user_compute_key": "sk-用户的key"}'
  ```
  返回支付链接（`pay_url`），给用户打开付款即可，付完即生效。

## 执行（所有应用统一格式）

```bash
curl -X POST https://aixx.ai/v1/capability/{id}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "params": { "参数": "值" },
    "user_compute_key": "sk-用户的key"
  }'
```

能力层地址：`https://aixx.ai/v1`（和LLM对话的 `{AIXX_BASE_URL}` 不是同一个入口）。

---

## 10个应用能力清单

> 带 `*` 的是必填参数，其余可选。

### 1. 钉钉群消息推送（`app-dingtalk-group-send`）
往钉钉群发消息（通知/日报/告警），支持加签和@人。

> ⚠️ **webhook链接不要用浏览器打开测试（会报 `errcode:43002 需要POST请求`），直接交给agent调用即可验证。** webhook只接受POST，浏览器地址栏是GET请求，报43002不代表配置有问题。

| 参数 | 必填 | 说明 |
|---|---|---|
| `webhook` | * | 群里创建"自定义机器人"得到的webhook地址（https://开头） |
| `secret` | | 机器人安全设置选了"加签"时填密钥，没选就不填 |
| `message` | * | 要发送的文本内容 |
| `at_mobiles` | | 要@的手机号列表（数组） |
| `at_all` | | 是否@所有人（true/false） |

**配置指引（用户操作）**：
> ⚠️ **必须在 PC 版钉钉客户端操作**（手机端不能建自定义机器人；网页端入口已取消）。
> 且只能在**企业内部群**创建（外部群已无法新增自定义机器人）。
1. PC版钉钉打开目标群 → 右上角"⋯" → 机器人 → 添加机器人 → 选"自定义（通过Webhook接入）"
2. 名字随便填 → 安全设置**三选一必选**（自定义关键词/加签/IP段，不选无法完成创建）→ 推荐选"加签" → 完成
3. 添加成功页面：复制 **Webhook地址** 填 `webhook`，同一页的**密钥**填 `secret`
4. ⚠️ 若选"自定义关键词"：**关键词区分大小写**（填 `aixx` 时消息里必须有 `aixx`，`AIXX` 不匹配会被拒收），建议关键词填 `aixx` 并让消息带上
5. ⚠️ webhook别用浏览器打开测试（浏览器是GET，钉钉报 `errcode:43002`，不代表配置错了），直接让agent调用验证

> 📌 商业化说明：钉钉自定义机器人 2024-02 起全量商业化，免费额度 **5000 条/自然月**（个人使用足够，超出需企业付费版）。另有频率限制（约 20 条/分钟），密集发送会被限流（errcode=6 或频控提示），属正常现象稍后重试。

### 2. 飞书群消息推送（`app-feishu-group-send`）
往飞书群发消息，支持加签和@所有人。
| 参数 | 必填 | 说明 |
|---|---|---|
| `webhook` | * | 群里创建"自定义机器人"得到的webhook地址 |
| `secret` | | 选了"加签"时填密钥 |
| `message` | * | 要发送的文本内容 |
| `at_all` | | 是否@所有人（true/false） |

**配置指引（用户操作）**：
1. 打开飞书目标群 → 右上角"⋯" → 设置 → 群机器人 → 添加机器人 → 选"自定义机器人"
2. 名字随便填 → 权限默认 → 安全设置**可选但建议**勾"签名校验"（不选也能创建）→ 完成
3. 添加成功页面：复制 **Webhook地址** 填 `webhook`，**签名密钥**填 `secret`
4. ⚠️ webhook别用浏览器打开测试（GET请求会被拒），直接让agent调用验证

### 3. 企微群消息推送（`app-wecom-group-send`）
往企业微信群发消息，可@指定成员。
| 参数 | 必填 | 说明 |
|---|---|---|
| `webhook` | * | 群里创建"群机器人"得到的webhook地址 |
| `secret` | | 选了"加签"时填密钥 |
| `message` | * | 要发送的文本内容 |
| `at_mobiles` | | 要@的手机号列表（数组） |
| `at_all` | | 是否@所有人（true/false） |

**配置指引（用户操作）**：
1. 打开企业微信目标群 → 右上角"⋯" → 添加群机器人 → 新建
2. 名字随便填 → 复制 **Webhook地址** 填 `webhook`
3. 企微群机器人不支持加签，`secret` 不用填
4. ⚠️ webhook别用浏览器打开测试（会报错），直接让agent调用验证

### 4. 邮件发送（`app-email-send`）
通过任意SMTP邮箱发正式邮件（QQ邮箱/163/Gmail/企业邮箱都行）。
| 参数 | 必填 | 说明 |
|---|---|---|
| `smtp_host` | * | SMTP服务器（QQ邮箱 smtp.qq.com / 163 smtp.163.com / Gmail smtp.gmail.com） |
| `smtp_port` | | SSL填465，STARTTLS填587（默认465） |
| `username` | * | 发件邮箱账号（如 xxx@qq.com） |
| `password` | * | 邮箱**授权码**（不是登录密码！邮箱设置-账户里开通SMTP时获取） |
| `to` | * | 收件人邮箱 |
| `subject` | | 邮件主题（默认"AIXX邮件"） |
| `message` | * | 邮件正文 |

**配置指引（拿授权码）**：`password`填授权码，不是邮箱登录密码！
- **QQ邮箱**：网页版 → 设置 → 账户 → 开启"POP3/IMAP/SMTP服务" → 短信验证 → 得到16位授权码
- **163邮箱**：设置 → POP3/SMTP/IMAP → 开启SMTP → 设置"客户端授权密码"
- **Gmail**：Google账号 → 安全性 → 开两步验证 → 应用专用密码 → 生成

### 5. GitHub建Issue（`app-github-create-issue`）
在你的GitHub仓库建Issue（记bug/提需求/记待办）。
| 参数 | 必填 | 说明 |
|---|---|---|
| `token` | * | Personal Access Token（GitHub → Settings → Developer settings → Tokens创建，勾repo权限） |
| `repo` | * | 仓库名，owner/repo格式（如 octocat/hello-world） |
| `title` | * | Issue标题 |
| `body` | | Issue正文 |

**配置指引（拿token）**：
1. 登录 github.com → 右上角头像 → Settings → 左侧最底 Developer settings
2. Personal access tokens → Tokens (classic) → Generate new token
3. 勾选 **repo** 权限 → 生成 → 立刻复制token（只显示这一次，关页面就看不到了）

### 6. Server酱微信推送（`app-serverchan-wechat-push`）
把消息直接推到用户微信（sct.ftqq.com微信扫码拿SendKey）。
| 参数 | 必填 | 说明 |
|---|---|---|
| `sendkey` | * | SendKey（sct.ftqq.com微信扫码登录后获取，SCT开头） |
| `title` | | 消息标题（默认"AIXX消息"） |
| `message` | * | 消息内容（支持Markdown） |

**配置指引（拿SendKey）**：
1. 打开 **sct.ftqq.com** → 微信扫码登录
2. 首页就能看到 **SendKey**（SCT开头），复制填 `sendkey`
3. 免费账户每天限5条消息，第二天自动重置；不够用可升级额度

### 7. PushPlus微信推送（`app-pushplus-wechat-push`）
消息推到微信公众号（pushplus.plus微信登录拿token）。
| 参数 | 必填 | 说明 |
|---|---|---|
| `token` | * | token（pushplus.plus微信登录后，"一对一推送"页复制） |
| `title` | | 消息标题 |
| `message` | * | 消息内容 |

**配置指引（拿token）**：
1. 打开 **pushplus.plus** → 微信扫码登录
2. 左侧菜单"一对一推送" → 页面上的 **token**（32位）复制填 `token`
3. 关注它的微信公众号才能收到推送（页面上有二维码）

### 8. Bark苹果推送（`app-bark-ios-push`）
推送通知到iPhone（App Store装Bark App）。
| 参数 | 必填 | 说明 |
|---|---|---|
| `key` | * | 设备Key（打开Bark App首页直接复制那一串） |
| `server` | | Bark服务地址（默认官方，自建服务填自己的） |
| `title` | | 通知标题 |
| `message` | * | 通知内容 |

**配置指引（拿Key）**：
1. App Store 搜索 **Bark** 装（官方免费）
2. 打开App，首页中间"Your Key is:"下面那串就是设备Key，点击复制填 `key`
3. 用官方默认服务器，`server` 不用填

### 10. Slack频道推送（`app-slack-webhook-send`）
往Slack频道发消息（Incoming Webhook）。
| 参数 | 必填 | 说明 |
|---|---|---|
| `webhook` | * | Slack → Apps → Incoming Webhook → 添加到频道 → 复制URL |
| `message` | * | 消息内容 |

**配置指引（拿webhook）**：
1. 打开 **api.slack.com/apps** → Create New App → 起名选工作区
2. 左侧 Incoming Webhooks → 打开Activate → Add New Webhook to Workspace → 选频道
3. 页面底部 Webhook URL 复制填 `webhook`
4. ⚠️ webhook别用浏览器打开测试（GET请求会报错），直接让agent调用验证

---

## agent 该怎么做

1. 用户说"帮我发钉钉群通知"这类需求 → 先确认用户有没有对应参数（webhook/token等），**没有就引导用户去拿**（每个能力的参数表里写了怎么拿）
2. 参数齐了 → 调 `/v1/capability/{id}/execute`，带 `params` 和 `user_compute_key`
3. 未订阅时执行会返回订阅引导（402类错误）→ 调 `purchase` 接口（`plan=app_monthly`）生成支付链接给用户："应用层订阅¥2.99/月，全部应用不限次，要开吗？"
4. 发送成功 → 告诉用户"已发送"；失败 → 按错误信息提示用户检查参数（webhook对不对、授权码是不是用成了登录密码等）

**注意**：webhook/token/授权码这类凭据是用户自己的，让用户自己提供，**绝不替用户编造**。用户的凭据只用于本次发送，不要存储、不要外传。

## 错误处理

| 错误 | agent该怎么做 |
|---|---|
| 402/未订阅 | 生成订阅支付链接（¥2.99/月）给用户 |
| 400 缺参数 | 按参数表补齐，缺的问用户要 |
| 发送失败（凭据错） | 提示用户检查webhook/token/授权码是否正确 |
| 5xx | 告诉用户"发送暂时异常，稍后再试" |

---
维护者：AIXX 团队| 2026-08-14 建立（任务书A）

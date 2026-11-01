# AIXX 快速开始

**一条命令装完即用，30秒开始让AI调用万物。**

---

## 安装（唯一需要做的一步）

```bash
npx aixxai install
```

装完自动完成：
1. **自动注册AIXX账号**（免费，送$0.5试用额度）并创建你的专属API Key
2. **自动写入本地配置**（~/.aixx/config.json）
3. **自动配置本地agent**（ZCode / Claude Code 检测到就自动配好，装完重启agent即可用）
4. **自动测试连通性**

带推荐码安装（推荐人获消费分润）：`npx aixxai install zhangsan`

脚本/CI等非交互环境：`npx aixxai install --yes`

**不需要手动export任何环境变量。**

## 配置读取顺序（了解即可）

所有AIXX功能（CLI命令、skill）按这个顺序找key，装完即用：
1. 环境变量 `AIXX_API_KEY`
2. `~/.aixx/config.json`（install自动写入，兜底主力）
3. `~/.aixx/account.json`（install自动注册时保存）

忘了key在哪？运行 `npx aixxai config` 查看（key脱敏显示），或直接看 `~/.aixx/` 目录。

## 验证

装完后，让你的 agent 说一句：
> "帮我用 glm-4-flash 翻译：Hello World"

或运行 `npx aixxai test` 测连通性。

## 进阶：在代码里直接用（OpenAI兼容）

AIXX 兼容 OpenAI 接口。base_url 和 key 在 `~/.aixx/config.json` 里能找到：

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-你的key",
    base_url="https://console.aixx.ai/v1"
)

response = client.chat.completions.create(
    model="glm-4-flash",
    messages=[{"role": "user", "content": "你好"}]
)
print(response.choices[0].message.content)
```

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-你的key",
  baseURL: "https://console.aixx.ai/v1",
});

const response = await client.chat.completions.create({
  model: "glm-4-flash",
  messages: [{ role: "user", content: "你好" }],
});
console.log(response.choices[0].message.content);
```

> ⚠️ **安全提示**：当前后端用 HTTP 明文传输，存在凭据被嗅探风险，HTTPS 上线后请换用 https 地址。

## 常见问题

**Q: 报错 "Unauthorized"**
A: API Key 不对，重新运行 `npx aixxai install`，或检查 `~/.aixx/config.json` 里的key是否完整（含 `sk-` 前缀）。

**Q: 报错 "insufficient quota"**
A: 额度不足，运行 `npx aixxai recharge` 查看充值方式。

**Q: 报错 "model price not configured"**
A: 该模型未配置价格，联系管理员或换用 glm-4-flash。

**Q: Windows下环境变量没生效？**
A: 不影响使用——所有命令都会兜底读 `~/.aixx/config.json`。想配环境变量的话重开终端（setx写入的变量对新终端生效）。

## 下一步

- 查看 [`./SKILL.md`](./SKILL.md) 了解完整能力
- 查看 [`./references/chat.md`](./references/chat.md) 了解LLM调用细节
- 查看 [`./references/data.md`](./references/data.md) 查社媒/电商数据
- 查看 [`./references/apps.md`](./references/apps.md) 发通知/推送/邮件
- 查看 [`./references/account.md`](./references/account.md) 查询用量

---
维护者：AIXX 团队 | 2026-08-08 建立 | 2026-08-14 更新：装完即用，删手动export（任务书A）

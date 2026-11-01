# AIXX CLI

> 让你的AI调用万物。一个命令，agent就能调用全世界的AI能力。

**AIXX** 由 [萬安算交所 (AIXX Exchange)](https://www.aixx.vip) 出品——全球首个"验证式"算力交易所：每一台在售 GPU 与整机均经平台上门实地验货（编号可查、真机实拍），每一位买家均经实名认证与资金验资。同门生态：[算力行情](https://www.aixx.vip/static/market/index.html) · [算力百科](https://aixx.ai/wiki/) · [萬安云](https://aixx.ai/cloud.html) · [萬安资讯](https://aixx.ai/news.html)。

## 安装

```bash
npx aixxai
```

（等价于 `npx aixxai install`，裸命令即安装）

带推荐码安装（推荐人获分润）：

```bash
npx aixxai zhangsan
```

## 命令

| 命令 | 说明 |
|---|---|
| `aixx install [推荐码]` | 安装AIXX skill到本地agent |
| `aixx search <关键词>` | 搜索AIXX能力库（数据/技能，免key） |
| `aixx installed` | 查看安装状态（skill/账号/版本） |
| `aixx config` | 查看当前配置 |
| `aixx test` | 测试AIXX连通性+调用模型 |
| `aixx balance` | 查询账户余额（还剩多少钱） |
| `aixx models` | 列出可用模型（国产/海外分组） |
| `aixx recharge [金额]` | 充值引导（默认$5） |
| `aixx --version` | 查看版本 |
| `aixx --help` | 帮助 |

## 当前状态（1.4.0）

- ✅ CLI代码完成，本地测试通过
- ⏳ 待发布到npm（等注册）
- ✅ 后端已部署：http://14.103.27.195:8080
- ✅ 已接通：DeepSeek / GLM / Kimi

## 技术栈

- Node.js (>=18) + ES Modules
- 纯原生API，零运行时依赖
- skill文件内嵌在包里（templates/），网络挂了也能装

## 文档

完整文档：https://aixx.ai

---
维护者：AIXX 团队 | 2026-08-08

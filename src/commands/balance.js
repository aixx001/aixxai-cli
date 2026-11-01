/**
 * AIXX CLI - balance 命令
 *
 * 查询当前账户余额、已用额度。
 *
 * 数据来源（New-API兼容接口）：
 *   1. GET /v1/dashboard/billing/subscription  → hard_limit_usd（总额度，美元）
 *   2. GET /v1/dashboard/billing/usage         → 已用量（可能多种格式，做兜底）
 *
 * 展示时换算成人民币（按 1 USD ≈ 7 元，只是给用户一个直观感受）。
 * "还剩约N次对话"：按每次对话约 ¥0.01 预估（最便宜模型单次几厘到几分）。
 */

import { DEFAULT_BASE_URL } from '../../bin/aixx.js';
import { loadApiKey, maskKey } from '../utils/env.js';

// 美元→人民币换算（仅用于展示，给用户一个直观感受）
const USD_TO_CNY = 7;
// 预估单次对话成本（元），用于"还能聊多少次"
const COST_PER_CHAT_CNY = 0.01;
// 所有对外请求统一 15 秒超时
const FETCH_TIMEOUT = 15000;
// 网络/超时异常统一成友好提示
function friendlyNetErr(err) {
  return err?.name === 'TimeoutError' || err?.name === 'AbortError'
    ? '连接超时，请检查网络'
    : err?.message || String(err);
}

/**
 * apiKey 读取统一走 src/utils/env.js 的 loadApiKey：
 * 环境变量 AIXX_API_KEY → ~/.aixx/config.json → ~/.aixx/account.json
 */

export async function balance(subArgs) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      AIXX 账户余额                         ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const apiKey = loadApiKey();
  const baseUrl = process.env.AIXX_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey) {
    console.error('❌ 未找到AIXX API Key');
    console.error('   请先运行 npx aixxai install，或设置环境变量 AIXX_API_KEY');
    process.exit(1);
  }

  console.log(`使用Key: ${maskKey(apiKey)}`);
  console.log(`后端地址: ${baseUrl}\n`);

  // 0. 优先调 /v1/account（2026-08-28新增，能拿到真实账户余额，包括unlimited token）
  try {
    const acctResp = await fetch(`${baseUrl}/account`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (acctResp.ok) {
      const acct = await acctResp.json();
      console.log('────────────────────────────────────');
      console.log(`👤 账户：${acct.username || '未知'}`);
      console.log(`💰 账户余额：¥${(acct.balance_cny ?? 0).toFixed(2)}（$${(acct.balance_usd ?? 0).toFixed(2)}）`);
      console.log(`📊 已用额度：¥${(acct.used_cny ?? 0).toFixed(2)}`);
      if (acct.unlimited_token) console.log(`♾️  Token模式：不限量（按账户余额扣费）`);
      console.log('────────────────────────────────────');
      console.log(`\n💡 充值入口：${acct.topup_url || baseUrl.replace(/\/v1$/, '') + '/console/topup'}\n`);
      return;
    }
  } catch {
    // /v1/account 不可用 → 降级到旧的 billing 接口
  }

  // 1. 降级：查总额度（subscription）
  let hardLimitUsd = 0;
  try {
    const resp = await fetch(`${baseUrl}/dashboard/billing/subscription`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!resp.ok) {
      if (resp.status === 401) {
        console.error('❌ API Key 无效（401），请重新 install 或检查 key');
        process.exit(1);
      }
      console.error(`❌ 查询余额失败: HTTP ${resp.status}`);
      process.exit(1);
    }
    const data = await resp.json();
    // New-API/OpenAI兼容：hard_limit_usd 是总额度
    hardLimitUsd =
      data.hard_limit_usd ??
      data.hard_limit ??
      data.data?.hard_limit_usd ??
      0;
  } catch (err) {
    console.error(`❌ ${friendlyNetErr(err)}`);
    process.exit(1);
  }

  // 2. 查已用量（usage）
  // 不同后端字段不一样，尽量兜底
  let usedUsd = 0;
  try {
    // 用一个宽日期范围，确保能查到所有用量
    const today = new Date();
    const start = `${today.getFullYear()}-01-01`;
    const end = `${today.getFullYear()}-12-31`;
    const resp = await fetch(
      `${baseUrl}/dashboard/billing/usage?start_date=${start}&end_date=${end}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      // 常见字段优先级
      usedUsd =
        data.total_usage ??
        data.total_cost ??
        data.data?.total_usage ??
        data.cumulative_usage ??
        0;
      // New-API 的 total_usage 单位有时是"分(美元)"，要除以100
      // 这里做个粗判断：如果usedUsd比hardLimit还大100倍，多半是没除100
      if (usedUsd > 0 && hardLimitUsd > 0 && usedUsd > hardLimitUsd * 50) {
        usedUsd = usedUsd / 100;
      }
    } else {
      // usage 接口挂了不影响主流程，总额度照常显示
      console.log('   (用量接口未返回数据，仅显示总额度)\n');
    }
  } catch (err) {
    console.log('   (用量查询失败，仅显示总额度)\n');
  }

  // 3. 计算并展示
  // New-API 的"无限额度"哨兵：hard_limit_usd >= 100000000（1亿）表示这个token不限额。
  // 直接显示真实数字（¥7亿）会吓到用户，所以单独走"无限额度"分支。
  const UNLIMITED_SENTINEL = 100000000;
  const isUnlimited = hardLimitUsd >= UNLIMITED_SENTINEL;
  const usedCny = usedUsd * USD_TO_CNY;

  console.log('────────────────────────────────────');
  if (isUnlimited) {
    // unlimited token（New-API对unlimited_quota=true的token返回1亿作为标记）
    // 实际是"按账户余额扣费"，不是真的无限。账户余额是注册送的¥5起，用完就停。
    // billing接口拿不到真实账户余额（它对unlimited token只返回1亿标记），
    // 所以这里如实告知用户，引导去后台查精确余额。
    console.log(`💰 计费方式：按账户余额扣费（注册送$0.5试用额度，用完需充值）`);
    console.log(`📊 已用额度：¥${usedCny.toFixed(2)}`);
    console.log(`💡 精确余额请登录AIXX后台查看：${baseUrl.replace(/\/v1$/, '')}`);
  } else {
    // 正常有限额度
    const remainingUsd = Math.max(0, hardLimitUsd - usedUsd);
    const totalCny = hardLimitUsd * USD_TO_CNY;
    const remainingCny = remainingUsd * USD_TO_CNY;
    const approxChats = Math.floor(remainingCny / COST_PER_CHAT_CNY);
    console.log(`💰 当前余额：¥${remainingCny.toFixed(2)}（还剩约 ${approxChats.toLocaleString()} 次对话）`);
    console.log(`📊 已用额度：¥${usedCny.toFixed(2)}`);
    console.log(`💳 账户总额度：¥${totalCny.toFixed(2)}（$${hardLimitUsd.toFixed(2)}）`);
  }
  console.log('────────────────────────────────────');
  console.log('\n💡 提示：');
  console.log('   - 新用户注册送 $0.5 试用额度');
  console.log('   - glm-4-air 便宜，省着用能聊很久');
  console.log('   - 余额不足时运行 aixx recharge 查看充值方式\n');
}

/**
 * AIXX CLI - recharge 命令
 *
 * 显示充值方式。优先尝试调后端 creem/pay 接口生成在线充值链接；
 * 如果后端不支持或失败，则给出通用引导（联系客服/后台充值）。
 */

import { DEFAULT_BASE_URL } from '../../bin/aixx.js';
import { loadApiKey, maskKey } from '../utils/env.js';

// 所有对外请求统一 15 秒超时
const FETCH_TIMEOUT = 15000;

/**
 * apiKey 读取统一走 src/utils/env.js 的 loadApiKey：
 * 环境变量 AIXX_API_KEY → ~/.aixx/config.json → ~/.aixx/account.json
 */

/**
 * 尝试调后端的 creem 支付接口生成充值链接。
 * New-API 的在线充值常见接口：
 *   POST /api/user/creem/pay   { amount, ... }
 * 不同版本字段不一，失败就回退到手动引导。
 */
async function tryGetCreemLink(apiKey, baseUrl, amount) {
  const apiBase = baseUrl.replace(/\/v1$/, '');
  const candidates = [
    {
      url: `${apiBase}/api/user/creem/pay`,
      body: { amount, currency: 'USD', gateway: 'creem' },
    },
    {
      url: `${apiBase}/api/user/topup`,
      body: { amount, top_up_code: '', payment_method: 'creem' },
    },
  ];

  for (const c of candidates) {
    try {
      const resp = await fetch(c.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(c.body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!resp.ok) continue;
      const data = await resp.json().catch(() => null);
      if (!data) continue;
      // 多种可能的字段名兜底
      const link =
        data.data?.url ||
        data.data?.payment_url ||
        data.data?.checkout_url ||
        data.url ||
        data.payment_url;
      if (link) return link;
    } catch (e) {
      // 超时单独提示一次（其余错误静默试下一个候选接口）
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        console.log('   ⚠️  连接超时，请检查网络');
      }
    }
  }
  return null;
}

export async function recharge(subArgs) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      AIXX 充值                             ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const apiKey = loadApiKey();
  const baseUrl = process.env.AIXX_BASE_URL || DEFAULT_BASE_URL;

  // 从参数取金额，默认 $5（最低）
  let amount = 5;
  if (subArgs[0]) {
    const n = Number(subArgs[0]);
    if (!Number.isNaN(n) && n > 0) amount = n;
  }

  if (!apiKey) {
    console.log('⚠️  未检测到AIXX API Key，以下为通用充值方式：\n');
    console.log('充值方式：');
    console.log('   信用卡 / ApplePay：登录 AIXX 后台 → 充值 → Creem');
    console.log('   USDT 加密货币：联系客服或后台提交');
    console.log(`\n   最低充值 $5`);
    console.log(`\n🌐 后台地址：${baseUrl.replace(/\/v1$/, '')}`);
    return;
  }

  console.log(`使用Key: ${maskKey(apiKey)}`);
  console.log(`充值金额：$${amount}\n`);

  // 尝试生成在线支付链接
  console.log('🔄 正在生成在线充值链接...');
  const link = await tryGetCreemLink(apiKey, baseUrl, amount);

  console.log('\n────────────────────────────────────');
  console.log('💳 充值方式：');
  console.log('────────────────────────────────────');

  if (link) {
    console.log('\n  ① 信用卡 / ApplePay（推荐，即时到账）：');
    console.log(`     ${link}`);
    console.log('\n     复制链接到浏览器打开即可支付。');
  } else {
    console.log('\n  ① 信用卡 / ApplePay：');
    console.log('     自动生成链接失败，请直接登录后台充值：');
    console.log(`     ${baseUrl.replace(/\/v1$/, '')}/console/topup`);
  }

  console.log('\n  ② USDT 加密货币：');
  console.log('     联系 AIXX 客服，或后台提交 USDT 充值订单');
  console.log('     （后续会支持自动生成钱包地址）');

  console.log('\n  ③ 微信/支付宝：');
  console.log('     联系 AIXX 客服走人工充值');

  console.log('\n────────────────────────────────────');
  console.log(`最低充值 $5（约 ¥${(amount * 7).toFixed(0)}）`);
  console.log(`充值后额度即时到账，可直接使用。\n`);

  console.log('💡 充值提示：');
  console.log('   - 充 $5 用 glm-4-air 能聊 5 万次以上');
  console.log('   - 充 $20 够用 Claude/GPT 跑一个月');
  console.log('   - 推荐码注册的用户充值后推荐人有分润\n');
}

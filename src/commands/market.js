/**
 * AIXX CLI - market 命令（1030 产品版）
 *
 * 算力行情数据订阅（$998/月）：
 *   aixx market login --token <T>     保存访问令牌
 *   aixx market tickers [--usd]       全标的快照
 *   aixx market ticker <SYMBOL>       单标的快照
 *   aixx market score <SYMBOL>        标的记分卡
 *   aixx market history <SYMBOL> [d]  历史点位
 *   aixx market detail <SYMBOL>       大宗详情数据包
 *   aixx market consumer <SYMBOL>     消费级详情数据包
 *   所有命令支持 --json（脚本管道用）
 *
 * 本命令组为纯数据输出，零 AI 参与；错误一律人话提示。
 *
 * 令牌来源：环境变量 AIXX_MARKET_TOKEN → ~/.aixx/config.json 的 marketToken（兼容读 aciBetaToken）。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const BASE = process.env.AIXX_MARKET_BASE_URL || 'https://aixx.ai';
const FETCH_TIMEOUT = 15000;

function configFile() {
  return join(homedir(), '.aixx', 'config.json');
}

function loadToken() {
  if (process.env.AIXX_MARKET_TOKEN) return process.env.AIXX_MARKET_TOKEN;
  try {
    const f = configFile();
    if (existsSync(f)) {
      const conf = JSON.parse(readFileSync(f, 'utf-8'));
      return conf.marketToken || null;
    }
  } catch (e) { /* 走未配置路径 */ }
  return null;
}

async function mFetch(path) {
  const token = loadToken();
  if (!token) {
    console.error('尚未配置访问令牌。');
    console.error('开通: https://www.aixx.vip  |  或设置环境变量 AIXX_MARKET_TOKEN');
    process.exit(1);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    if (res.status === 403) {
      console.error('当前订阅档位不包含该数据 —— 如需升级请访问 aixx.ai 或联系客服');
      process.exit(1);
    }
    if (res.status === 404) {
      console.error('未查询到该数据（请核对标的代码，或联系客服确认订阅状态）');
      process.exit(1);
    }
    if (res.status === 401 || res.status === 403) {
      console.error('令牌无效或已过期，请重新登录: aixx market login --token <T>');
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`服务暂不可用 (${res.status})，请稍后重试`);
      process.exit(1);
    }
    return await res.json();
  } catch (err) {
    console.error(err?.name === 'AbortError' || err?.name === 'TimeoutError'
      ? '连接超时，请检查网络后重试' : '网络异常，请稍后重试');
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

function fmtWan(v, usd) {
  if (typeof v !== 'number') return '-';
  const cur = usd ? '$' : '¥';
  return `${cur}${v >= 1 ? v.toFixed(2) + '万' : (v * 10000).toFixed(0)}`;
}

function money(v, usd) {
  if (typeof v !== 'number') return '-';
  return (usd ? '$' : '¥') + v;
}

function printTicker(c, usd) {
  const lo = usd ? c.listing?.lo_usd : c.listing?.lo;
  const hi = usd ? c.listing?.hi_usd : c.listing?.hi;
  const cur = usd ? '$' : '¥';
  console.log(`  ${c.symbol}  [${c.category || '-'}]`);
  console.log(`    评分: ${c.score?.raw ?? '-'} (${c.score?.grade ?? '-'})`);
  console.log(`    价格带: ${money(lo, usd) === '-' ? cur + '-' : money(lo, usd)} ~ ${money(hi, usd)}  (在售 ${c.listing?.count ?? 0})`);
  if (usd && c.msrp_usd_wan != null) console.log(`    发售价: $${c.msrp_usd_wan}万`);
  console.log(`    租金参考: ${usd ? '$' + (c.rental?.usd_hr ?? '-') : '¥' + (c.rental?.cn_hr ?? '-')}/时`);
  console.log('');
}

function printScore(d) {
  const s = d.scorecard || {};
  console.log(`  ${d.symbol}  记分卡`);
  console.log(`    总分: ${s.raw ?? '-'}   等级: ${s.grade ?? '-'}`);
  const dims = s.dims || {};
  const w = d.weights || {};
  console.log(`    回本维度:   ${dims.payback ?? '-'}  (权重 ${w.payback ?? 40})`);
  console.log(`    涨价维度:   ${dims.appreciation ?? '-'}  (权重 ${w.appreciation ?? 30})`);
  console.log(`    流通维度:   ${dims.liquidity ?? '-'}  (权重 ${w.liquidity ?? 30})`);
  console.log(`    版本: ${d.formula || '-'}`);
}

async function market(subArgs) {
  const sub = subArgs[0] || 'help';
  const rest = subArgs.slice(1);
  const asJson = rest.includes('--json');
  const usd = rest.includes('--usd');
  const args = rest.filter((a) => !a.startsWith('--'));
  const q = (p) => (usd ? '?currency=USD&' : '?') + 'pretty=1';

  if (sub === 'login') {
    const i = rest.indexOf('--token');
    const tok = i >= 0 ? rest[i + 1] : null;
    if (!tok) {
      console.error('用法: aixx market login --token <令牌>');
      process.exit(1);
    }
    const f = configFile();
    let conf = {};
    try { if (existsSync(f)) conf = JSON.parse(readFileSync(f, 'utf-8')); } catch (e) { conf = {}; }
    conf.marketToken = tok;
    mkdirSync(join(homedir(), '.aixx'), { recursive: true });
    writeFileSync(f, JSON.stringify(conf, null, 2));
    console.log('✓ 令牌已保存');
    return;
  }

  if (sub === 'tickers') {
    const d = await mFetch(`/v1/aci/tickers${usd ? '?currency=USD' : ''}`);
    if (asJson) { console.log(JSON.stringify(d, null, 2)); return; }
    console.log(`AIXX 算力行情   更新: ${d.generated}   标的: ${d.count}   币种: ${d.currency}\n`);
    for (const c of d.cards || []) printTicker(c, usd);
    return;
  }

  if (sub === 'ticker') {
    const sym = (args[0] || '').toUpperCase();
    if (!sym) { console.error('用法: aixx market ticker <SYMBOL>'); process.exit(1); }
    const d = await mFetch(`/v1/aci/ticker/${encodeURIComponent(sym)}${usd ? '?currency=USD' : ''}`);
    if (asJson) { console.log(JSON.stringify(d, null, 2)); return; }
    console.log(`AIXX 算力行情   更新: ${d.generated}`);
    printTicker(d.ticker, d.currency === 'USD');
    return;
  }

  if (sub === 'score') {
    const sym = (args[0] || '').toUpperCase();
    if (!sym) { console.error('用法: aixx market score <SYMBOL>'); process.exit(1); }
    const d = await mFetch(`/v1/aci/scorecard/${encodeURIComponent(sym)}`);
    if (asJson) { console.log(JSON.stringify(d, null, 2)); return; }
    printScore(d);
    return;
  }

  if (sub === 'history') {
    const sym = (args[0] || '').toUpperCase();
    const days = parseInt(args[1] || '30', 10) || 30;
    if (!sym) { console.error('用法: aixx market history <SYMBOL> [天数]'); process.exit(1); }
    const d = await mFetch(`/v1/aci/history/${encodeURIComponent(sym)}?days=${days}`);
    if (asJson) { console.log(JSON.stringify(d, null, 2)); return; }
    console.log(`AIXX 行情历史   ${d.symbol}   近 ${d.days} 天\n`);
    for (const p of d.points || []) {
      console.log(`  ${p.generated}   ${money(p.listing?.lo, false)} ~ ${money(p.listing?.hi, false)}   评分 ${p.score_raw ?? '-'}`);
    }
    return;
  }

  if (sub === 'detail') {
    const sym = (args[0] || '').toUpperCase();
    if (!sym) { console.error('用法: aixx market detail <SYMBOL> [--usd]'); process.exit(1); }
    const d = await mFetch(`/v1/market/detail/${encodeURIComponent(sym)}${usd ? '?currency=USD' : ''}`);
    if (asJson) { console.log(JSON.stringify(d, null, 2)); return; }
    console.log(`AIXX 行情详情   ${d.symbol}   更新: ${d.generated}   币种: ${d.currency}\n`);
    printTicker(d.ticker, d.currency === 'USD');
    const pts = d.history?.points || [];
    console.log(`  近 ${d.history?.days ?? 0} 天走势${d.history?.truncated ? '（截断）' : ''}:`);
    for (const p of pts.slice(-10)) {
      console.log(`    ${p.generated}   评分 ${p.score_raw ?? '-'}`);
    }
    const rr = d.rent_regions || [];
    if (rr.length) {
      console.log(`\n  地区租金参考 (USD/时):`);
      console.log('    ' + rr.map((r) => `${r.region} $${r.usd_hr}`).join(' · '));
    }
    return;
  }

  if (sub === 'consumer') {
    const sym = (args[0] || '').toLowerCase();
    if (!sym) { console.error('用法: aixx market consumer <型号，如 rtx5090>'); process.exit(1); }
    const d = await mFetch(`/v1/market/consumer/${encodeURIComponent(sym)}`);
    if (asJson) { console.log(JSON.stringify(d, null, 2)); return; }
    console.log(`AIXX 消费级行情   ${d.symbol}   更新: ${d.updated_at || '-'}\n`);
    const retail = d.retail || {};
    for (const [ch, v] of Object.entries(retail)) {
      if (!v || typeof v !== 'object') continue;
      console.log(`  ${ch}:  中位 ${money(v.median, false)}  区间 ${money(v.min, false)} ~ ${money(v.max, false)}  (${v.n || 0} 条)`);
    }
    const rr = d.rent_regions || [];
    if (rr.length) {
      console.log(`\n  地区租金: ${rr.map((r) => `${r.region || r[0]} ${r.usd_hr || r[1]}`).join(' · ')}`);
    }
    return;
  }

  console.log('用法: aixx market <子命令>');
  console.log('  login --token <T>        保存访问令牌');
  console.log('  tickers [--usd] [--json] 全标的快照');
  console.log('  ticker <SYMBOL>          单标的快照');
  console.log('  score <SYMBOL>           标的记分卡');
  console.log('  history <SYMBOL> [天数]  历史点位');
  console.log('  detail <SYMBOL> [--usd]  大宗详情数据包');
  console.log('  consumer <型号>          消费级详情数据包');
}

export { market };

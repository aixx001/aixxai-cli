/**
 * AIXX CLI - servers 命令（1022 版）
 *
 * 萬安云服务器货架：开通/查看你的资源。
 *   aixx servers list               我已开通的资源
 *   aixx servers open <sku> [名字]   开通一件（kv/d1/r2/queues/pages/ai/turnstile...）
 *   aixx servers menu                看全部可开通的商品
 *
 * 令牌：环境变量 AIXX_ACI_TOKEN → ~/.aixx/config.json 的 aciBetaToken。
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const BASE = process.env.AIXX_ACI_BASE_URL || 'https://aixx.ai';
const TIMEOUT = 15000;

const MENU = [
  ['kv', 'KV 键值存储', '全球读配置库'],
  ['d1', 'D1 边缘数据库', 'SQL 数据库'],
  ['r2', 'R2 对象存储', '文件桶·出口免费'],
  ['queues', '消息队列', '任务排队'],
  ['pages', 'Pages 建站', '免费·送全球网址'],
  ['ai', 'AI 模型推理', '73个模型即开即用'],
  ['turnstile', '人机验证', '免费·无感验证码'],
  ['workers', '边缘函数', '候deploy命令排期'],
];

function loadToken() {
  if (process.env.AIXX_ACI_TOKEN) return process.env.AIXX_ACI_TOKEN;
  try {
    const f = join(homedir(), '.aixx', 'config.json');
    if (existsSync(f)) {
      const conf = JSON.parse(readFileSync(f, 'utf-8'));
      if (conf.aciBetaToken) return conf.aciBetaToken;
    }
  } catch (e) { /* fallthrough */ }
  return null;
}

async function api(path, body) {
  const token = loadToken();
  if (!token) {
    console.error('❌ 未配置访问令牌：请设置环境变量 AIXX_ACI_TOKEN');
    process.exit(1);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (res.status === 404) {
      console.error('该能力暂不可用');
      process.exit(1);
    }
    const d = await res.json();
    if (!res.ok || d.ok === false) {
      console.error('操作失败:', d.error || `HTTP ${res.status}`);
      process.exit(1);
    }
    return d;
  } catch (err) {
    console.error(err?.name === 'AbortError' ? '连接超时' : `失败: ${err?.message || err}`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

function printResource(r) {
  for (const [k, v] of Object.entries(r || {})) {
    console.log(`   ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
}

export async function servers(subArgs) {
  const sub = subArgs[0] || 'menu';

  if (sub === 'list') {
    const d = await api('/v1/servers/list');
    console.log(`你的资源（${d.count} 条流水）：`);
    for (const it of d.items || []) {
      console.log(`  [${it.ts}] ${it.sku} (${it.status}) ${it.name || ''}`);
    }
    return;
  }

  if (sub === 'open' || sub === 'provision') {
    const sku = subArgs[1];
    const name = subArgs[2] || 'myapp';
    if (!sku) {
      console.error('用法: aixx servers open <sku> [名字]   例: aixx servers open d1 mydb');
      console.error('可开通: ' + MENU.filter(m => !m[2].includes('候')).map(m => m[0]).join('/'));
      process.exit(1);
    }
    console.log(`正在开通 ${sku}（萬安全托管，无需注册任何第三方）...`);
    const d = await api('/v1/servers/provision', { sku, name });
    if (d.status === 'pending') {
      console.log(`⏳ 该商品为人工开通，已登记（${d.note || ''}）`);
      return;
    }
    console.log(`✅ 开通成功！你的 ${sku}：`);
    printResource(d.resource);
    return;
  }

  if (sub === 'menu') {
    console.log('萬安云服务器货架（全部代开通·按量计费·无需注册第三方）：');
    for (const [sku, title, desc] of MENU) {
      console.log(`  ${sku.padEnd(10)} ${title.padEnd(14)} ${desc}`);
    }
    console.log('\n开通: aixx servers open <sku> [名字]');
    return;
  }

  console.log('用法: aixx servers <list|open|menu>');
}

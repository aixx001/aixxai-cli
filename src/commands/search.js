/**
 * AIXX CLI - search 命令
 *
 * 搜索AIXX能力库（数据/技能）。免key接口，未注册也能搜——
 * 目的：让用户先看到"有什么、多少钱"，再决定要不要装。
 *
 * 接口：POST {DEFAULT_BASE_URL}/capability   body: {need: 关键词}
 * 响应：{matched, capabilities:[{id,name,description,pricing:{per_use,weekly,monthly,free_quota},
 *        match_score,estimated_time}]}，可能带 compliance_blocked（合规拦截，服务端会给message）
 *
 * 注意：搜到的能力不是装到本地的，装好AIXX技能后AI直接说需求即可调用。
 */

import { DEFAULT_BASE_URL } from '../../bin/aixx.js';
import { detectAixxSkillDirs } from './install.js';

// 与 install/balance 同款：统一 15 秒超时 + 网络/超时异常转友好提示
const FETCH_TIMEOUT = 15000;
function friendlyNetErr(err) {
  return err?.name === 'TimeoutError' || err?.name === 'AbortError'
    ? '连接超时，请检查网络'
    : err?.message || String(err);
}

// 描述压成一句话并截断（≤60字）
function oneLine(text, max = 60) {
  const line = String(text || '').replace(/\s+/g, ' ').trim();
  return line.length > max ? line.slice(0, max) + '…' : line;
}

export async function search(subArgs) {
  const keyword = subArgs.filter(a => a && !a.startsWith('-')).join(' ').trim();

  // 无关键词：给用法示例，别让用户干瞪眼
  if (!keyword) {
    console.log('用法: aixx search <关键词>\n');
    console.log('示例:');
    console.log('  aixx search 抖音数据    查抖音相关的数据能力');
    console.log('  aixx search UI设计      查设计相关的技能');
    return;
  }

  console.log(`🔍 搜索AIXX能力: ${keyword}\n`);

  // 免key接口，不加任何认证头
  const baseUrl = process.env.AIXX_BASE_URL || DEFAULT_BASE_URL;
  let data;
  try {
    const resp = await fetch(`${baseUrl}/capability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ need: keyword }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch (err) {
    console.error(`❌ 搜索失败: ${friendlyNetErr(err)}`);
    console.error('   也可以直接到官网浏览全部能力: https://www.aixx.vip/cloud.html');
    process.exit(1);
  }

  // 合规拦截：如实转达服务端说法
  if (data?.compliance_blocked) {
    console.log(`⛔ ${data.message || '该关键词被合规策略拦截，换个说法试试'}`);
    return;
  }

  const caps = Array.isArray(data?.capabilities) ? data.capabilities : [];
  if (!data?.matched || caps.length === 0) {
    console.log(`没有找到与"${keyword}"相关的能力。`);
    console.log('建议换个关键词再试试，比如：抖音数据、小红书、UI设计、视频脚本。');
    return;
  }

  caps.forEach((cap, i) => {
    // data-*前缀的id是数据接口，其余是技能
    const type = cap.id?.startsWith('data-') ? '数据' : '技能';
    console.log(`${i + 1}. ${cap.name || '未命名'} [${type}]`);
    console.log(`   ${oneLine(cap.description)}`);
    const tags = [];
    if (cap.pricing?.per_use !== undefined && cap.pricing?.per_use !== null) {
      tags.push("$1.99 一次买断·永久使用");
    }
    if ((cap.pricing?.free_quota || 0) > 0) {
      
    }
    tags.push(`ID: ${cap.id}`);
    console.log(`   ${tags.join(' · ')}`);
  });

  console.log('\n以上能力无需单独安装——安装AIXX技能后，你的AI直接说需求即可调用（能力ID给AI看就行）');
  if (detectAixxSkillDirs().length === 0) {
    console.log('还没安装AIXX技能？运行 npx aixxai install 一键开通');
  }
}

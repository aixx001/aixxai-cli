/**
 * AIXX CLI - models 命令
 * 列出AIXX支持的所有模型，按场景分组展示。
 * 2026-08-28 更新：按"日常推荐/通用/旗舰/嵌入"分组，用户一眼知道选哪个。
 */

import { DEFAULT_BASE_URL } from '../../bin/aixx.js';
import { loadApiKey, maskKey } from '../utils/env.js';

const FETCH_TIMEOUT = 15000;

const MODEL_DESC = {
  'deepseek-chat': '低价档',
  'deepseek-v4-pro': 'DeepSeek 旗舰，推理强',
  'deepseek-ai/DeepSeek-V3': 'DeepSeek V3',
  'glm-4-flash': '智谱免费，速度快',
  'glm-4-plus': '智谱旗舰，中文写作强',
  'glm-4-air': '智谱轻量，便宜',
  'glm-4-long': '智谱超长文本',
  'glm-5-2-260617': 'GLM-5.2',
  'moonshot-v1-8k': 'Kimi 短文本',
  'moonshot-v1-32k': 'Kimi 中文本',
  'moonshot-v1-128k': 'Kimi 超长文本',
  'kimi-latest': 'Kimi 最新',
  'kimi-k2.6': 'Kimi K2.6 代码强',
  'claude-fable-5': 'Claude Fable 5 最强写作',
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-opus-5': 'Claude Opus 5 最新旗舰',
  'claude-sonnet-5': 'Claude Sonnet 5 性价比',
  'claude-haiku-4-5': '便宜快速',
  'gpt-5.4': 'GPT-5.4 通用',
  'gpt-5.4-mini': 'GPT-5.4 便宜',
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.6-sol': 'GPT-5.6 Sol 旗舰',
  'gpt-5.6-luna': 'GPT-5.6 Luna 创意',
  'gpt-5.6-terra': 'GPT-5.6 Terra 分析',
  'doubao-pro': '豆包 Pro 中文',
  'doubao-seed-2-0-pro-260215': '豆包 Seed 2.0',
  'abab6.5-chat': 'MiniMax 6.5',
  'bge-m3': '嵌入模型',
  'embedding-3': '智谱嵌入',
};

function classifyScenario(id) {
  const lower = id.toLowerCase();
  if (lower.includes('embed') || lower.includes('bge')) return 'embedding';
  const budget = ['deepseek-chat', 'glm-4-flash', 'glm-4-air', 'claude-haiku'];
  if (budget.some(p => lower.startsWith(p) || lower.includes(p))) return 'budget';
  const flagship = ['opus-5', 'gpt-5.6', 'gpt-5.5', 'fable-5', 'deepseek-v4-pro'];
  if (flagship.some(p => lower.includes(p))) return 'flagship';
  return 'general';
}

function descOf(id) { return MODEL_DESC[id] || ''; }

export async function models(subArgs) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      AIXX 可用模型                         ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const apiKey = loadApiKey();
  const baseUrl = process.env.AIXX_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey) {
    console.error('❌ 未找到AIXX API Key');
    console.error('   请先运行 npx aixxai install');
    process.exit(1);
  }

  let modelIds = [];
  try {
    const resp = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!resp.ok) {
      console.error(`❌ 获取模型列表失败: HTTP ${resp.status}`);
      process.exit(1);
    }
    const data = await resp.json();
    const arr = data.data || data.models || [];
    modelIds = arr.map(m => (typeof m === 'string' ? m : m.id)).filter(Boolean).sort();
  } catch (err) {
    console.error(`❌ ${err?.message || err}`);
    process.exit(1);
  }

  if (modelIds.length === 0) {
    console.log('⚠️  后端未返回任何模型');
    return;
  }

  const groups = { budget: [], general: [], flagship: [], embedding: [] };
  modelIds.forEach(id => groups[classifyScenario(id)].push(id));

  const groupMeta = {
    budget:   { title: '💡 日常推荐（便宜好用）' },
    general:  { title: '🔧 通用模型（按需选）' },
    flagship: { title: '🚀 旗舰模型（最强但贵）' },
    embedding:{ title: '📐 嵌入模型（向量化/搜索）' },
  };

  for (const [key, meta] of Object.entries(groupMeta)) {
    const ids = groups[key];
    if (ids.length === 0) continue;
    console.log(`\n${meta.title}：`);
    ids.forEach(id => {
      const desc = descOf(id);
      console.log(`   • ${id}${desc ? '  —— ' + desc : ''}`);
    });
  }

  console.log(`\n📊 共 ${modelIds.length} 个模型\n`);
  console.log('💡 选模型小抄：');
  console.log('   - 日常聊天/写文案 → glm-4-flash（免费）或 glm-4-air（便宜）');
  console.log('   - 中文写作 → glm-4-plus 或 claude-fable-5');
  console.log('   - 读超长文档 → moonshot-v1-128k');
  console.log('   - 复杂推理/代码 → claude-opus-5 或 gpt-5.6-sol');
  console.log('   - 嵌入/搜索 → bge-m3\n');
}

/**
 * AIXX CLI - test 命令
 * 测试AIXX是否可用
 */

import { DEFAULT_BASE_URL } from '../../bin/aixx.js';
import { loadApiKey, maskKey } from '../utils/env.js';

export async function test(subArgs) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      AIXX 连通性测试                       ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // 统一配置链：环境变量 → ~/.aixx/config.json → ~/.aixx/account.json
  const apiKey = loadApiKey();
  const baseUrl = process.env.AIXX_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey) {
    console.error('❌ 未找到AIXX API Key');
    console.error('   运行 npx aixxai install 配置，或设置环境变量 AIXX_API_KEY');
    process.exit(1);
  }

  console.log(`测试地址: ${baseUrl}`);
  console.log(`使用Key: ${maskKey(apiKey)}\n`);

  // 1. 测试模型列表（带key调 /v1/models，这才是真实的可用性验证）
  let modelCount = 0;
  console.log('1️⃣  获取可用模型列表...');
  try {
    const resp = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (resp.ok) {
      const data = await resp.json();
      const models = data.data || data.models || [];
      modelCount = models.length;
      console.log(`   ✅ 可用模型 (${models.length}个):`);
      models.slice(0, 10).forEach(m => {
        const id = typeof m === 'string' ? m : m.id;
        console.log(`      • ${id}`);
      });
      if (models.length > 10) console.log(`      ... 还有 ${models.length - 10} 个`);
    } else if (resp.status === 401) {
      console.error('   ❌ API Key 无效（401）');
      process.exit(1);
    } else if (resp.status === 404) {
      console.error(`   ❌ 接口404，检查 AIXX_BASE_URL 是否正确（当前: ${baseUrl}）`);
      process.exit(1);
    } else {
      console.error(`   ❌ 返回 ${resp.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`   ❌ 失败: ${err.message}`);
    process.exit(1);
  }

  // 2. 测试实际调用
  console.log('\n2️⃣  测试调用 glm-4-air...');
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: '说"测试成功"三个字' }],
        max_tokens: 20
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content || '(空回复)';
      const usage = data.usage || {};
      console.log(`   ✅ 调用成功！`);
      console.log(`   模型回复: ${reply}`);
      console.log(`   Token用量: ${usage.total_tokens || '?'}`);
    } else {
      const errData = await resp.json().catch(() => ({}));
      console.error(`   ❌ 调用失败 (${resp.status}): ${errData.error?.message || resp.statusText}`);
      if (resp.status === 402) console.error('   提示: 额度不足，请充值');
    }
  } catch (err) {
    console.error(`   ❌ 网络错误: ${err.message}`);
  }

  console.log('\n测试完成。\n');
}

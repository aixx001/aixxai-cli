/**
 * AIXX CLI - config 命令
 * 查看或修改AIXX配置
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { DEFAULT_BASE_URL } from '../../bin/aixx.js';
import { loadApiKey, maskKey } from '../utils/env.js';

export async function config(subArgs) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      AIXX 配置                            ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // 统一配置链：环境变量 → ~/.aixx/config.json → ~/.aixx/account.json
  const apiKey = loadApiKey();
  const baseUrl = process.env.AIXX_BASE_URL || DEFAULT_BASE_URL;

  console.log('当前配置:');
  console.log(`  AIXX_API_KEY : ${apiKey ? maskKey(apiKey) : '❌ 未配置'}`);
  console.log(`  AIXX_BASE_URL: ${baseUrl}`);

  // 本地配置文件（key脱敏显示，绝不打印完整key）
  const configFile = join(homedir(), '.aixx', 'config.json');
  if (existsSync(configFile)) {
    console.log('\n本地配置文件:');
    try {
      const conf = JSON.parse(readFileSync(configFile, 'utf-8'));
      if (conf.AIXX_API_KEY) conf.AIXX_API_KEY = maskKey(conf.AIXX_API_KEY);
      console.log(`  位置: ${configFile}`);
      console.log(`  内容: ${JSON.stringify(conf, null, 2)}`);
    } catch (e) {
      console.log(`  (配置文件解析失败: ${e.message})`);
    }
  }

  // 推荐码
  const refFile = join(homedir(), '.aixx', 'referral.json');
  if (existsSync(refFile)) {
    console.log('\n推荐归因:');
    try {
      const ref = JSON.parse(readFileSync(refFile, 'utf-8'));
      console.log(`  推荐码: ${ref.refCode}`);
      console.log(`  安装时间: ${ref.installedAt}`);
    } catch (e) {}
  }

  // skill位置
  const skillDirs = [
    join(homedir(), '.zcode', 'skills', 'aixx'),
    join(homedir(), '.agents', 'skills', 'aixx'),
    join(homedir(), '.claude', 'skills', 'aixx'),
    join(homedir(), '.aixx', 'skills', 'aixx'),
  ].filter(existsSync);

  console.log('\nskill安装位置:');
  if (skillDirs.length > 0) {
    skillDirs.forEach(d => console.log(`  ✅ ${d}`));
  } else {
    console.log('  ❌ 未检测到已安装的skill（运行 aixx install 安装）');
  }

  console.log('\n修改配置:');
  console.log('  重新运行: npx aixxai install');
  console.log('  （配置读取顺序：环境变量 AIXX_API_KEY → ~/.aixx/config.json → ~/.aixx/account.json）\n');
}

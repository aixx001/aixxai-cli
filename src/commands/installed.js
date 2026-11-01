/**
 * AIXX CLI - installed 命令
 *
 * 纯本地查询（不发任何网络请求），报告三件事：
 *   ① AIXX skill 是否已装（复用 install.js 的目录检测）
 *   ② 账号状态（~/.aixx/account.json）
 *   ③ CLI 自身版本（package.json 的 version，单一来源）
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectSkillDirs, detectAixxSkillDirs } from './install.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')).version;

export async function installed() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      AIXX 安装状态                         ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // ① skill 安装状态
  const skillDirs = detectAixxSkillDirs();
  if (skillDirs.length > 0) {
    console.log('① skill: ✅ 已安装');
    skillDirs.forEach(d => console.log(`   ${d}`));
  } else {
    console.log('① skill: ❌ 未安装');
    const candidateDirs = detectSkillDirs();
    candidateDirs.forEach(d => console.log(`   检测到skill目录但没有aixx: ${d}`));
    console.log('   运行 npx aixxai install 一键开通');
  }

  // ② 账号状态（~/.aixx/account.json）
  const accountFile = join(homedir(), '.aixx', 'account.json');
  let account = null;
  let accountBroken = false;
  if (existsSync(accountFile)) {
    try {
      account = JSON.parse(readFileSync(accountFile, 'utf-8'));
    } catch (e) {
      accountBroken = true;
    }
  }
  // 身份编号（裸注册：~/.aixx/config.json 的 AIXX_USER_ID）
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.aixx', 'config.json'), 'utf-8'));
    if (cfg.AIXX_USER_ID) {
      console.log(`   身份编号: ${cfg.AIXX_USER_ID}（登录 https://console.aixx.ai/console-app.html 用编号+密码）`);
    }
  } catch {}

  if (account?.username) {
    console.log(`② 账号: ✅ 已注册（${account.username}）`);
  } else if (accountBroken) {
    console.log(`② 账号: ⚠️  账号文件存在但读取失败（${accountFile}）`);
  } else {
    console.log('② 账号: 未注册');
  }

  // ③ CLI 自身版本
  console.log(`③ CLI版本: v${VERSION}`);

  // 已装给一句话用法
  if (skillDirs.length > 0) {
    console.log('\n用法：对<<你的AI>>说"用AIXX查余额/生图/搜数据"即可');
  }
}

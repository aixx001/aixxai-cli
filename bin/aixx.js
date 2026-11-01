#!/usr/bin/env node

/**
 * AIXX CLI
 * 让你的AI调用万物。
 *
 * 用法：
 *   npx aixxai install [推荐码/绑定码/S####]  安装AIXX skill；S编号=买断技能门禁安装
 *   npx aixxai install --yes       非交互安装（脚本/CI用，跳过确认）
 *   npx aixxai search <关键词>     搜索AIXX能力库（数据/技能，免key）
 *   npx aixxai installed           查看安装状态（skill/账号/版本）
 *   npx aixxai config               配置/查看AIXX
 *   npx aixxai test                 测试AIXX是否可用
 *   npx aixxai balance              查询账户余额
 *   npx aixxai models               列出可用模型（分组）
 *   npx aixxai recharge [金额]      充值引导
 *   npx aixxai --version            查看版本
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { install } from '../src/commands/install.js';
import { search } from '../src/commands/search.js';
import { installed } from '../src/commands/installed.js';
import { config } from '../src/commands/config.js';
import { test } from '../src/commands/test.js';
import { balance } from '../src/commands/balance.js';
import { models } from '../src/commands/models.js';
import { recharge } from '../src/commands/recharge.js';
import { aci } from '../src/commands/aci.js';
import { market } from '../src/commands/market.js';
import { servers } from '../src/commands/servers.js';
import { showHelp, showVersion } from '../src/commands/help.js';

// 版本号从 package.json 读（单一来源，别再硬编码）
const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')).version;

// 默认AIXX后端地址：统一走萬安云域名网关入口（详见 src/utils/env.js 注释）
// 改完后请全局搜索 "安全警告" 同步更新 env.js 与 templates/QUICKSTART.md 中的同名地址。
export const DEFAULT_BASE_URL = 'https://console.aixx.ai/v1';

// 命令表：所有子命令的单一来源（新增命令在这里加一行即可）。
// 未知命令的"你想用的是不是"近似匹配也从这张表取已知命令名，不另写一份。
const COMMANDS = [
  { name: 'install', aliases: ['i'], run: install },
  { name: 'search', run: search },
  { name: 'installed', run: installed },
  { name: 'config', aliases: ['c'], run: config },
  { name: 'test', aliases: ['t'], run: test },
  { name: 'balance', aliases: ['b'], run: balance },
  { name: 'models', aliases: ['m'], run: models },
  { name: 'recharge', aliases: ['r'], run: recharge },
  { name: 'market', run: market },   /* 1030产品版: 行情数据订阅(docs/PLAN_MARKET_API_1030.md), 不进help带外态 */
  { name: 'aci', run: aci },   /* 已并入market, 保留指路 */
  { name: 'servers', run: servers },   /* 1022版: 萬安云服务器货架 */
];

// help/version 不吃子参数（走 flag/无参分支），但命令名仍参与下面的近似匹配
const BUILTIN_NAMES = ['help', 'version'];

// 零依赖近似匹配的兜底：a 是否按顺序出现在 b 里（允许跳字，serch 也能对上 search）
function isSubsequence(a, b) {
  let i = 0;
  for (const ch of b) {
    if (ch === a[i]) i++;
  }
  return i === a.length;
}

// 未知命令 → 猜用户想输什么。小写比较；规则：前缀相同 / 互相包含 / 子序列。最多返回3个。
function didYouMean(input) {
  const s = input.toLowerCase();
  return [...COMMANDS.map(c => c.name), ...BUILTIN_NAMES]
    .filter(n => {
      const t = n.toLowerCase();
      return t.startsWith(s) || s.startsWith(t) || t.includes(s) || s.includes(t) || isSubsequence(s, t);
    })
    .slice(0, 3);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subArgs = args.slice(1);

  // 裸命令即安装（1007 定版：命令越短越好）——npx aixxai 直接进安装，帮助走 help/--help
  if (command === undefined) {
    const installEntry = COMMANDS.find(c => c.name === 'install');
    if (installEntry) {
      await installEntry.run(subArgs);
      return;
    }
  }

  const entry = COMMANDS.find(c => c.name === command || c.aliases?.includes(command));
  if (entry) {
    await entry.run(subArgs);
    return;
  }

  switch (command) {
    case '--version':
    case '-v':
    case 'version':
      showVersion(VERSION);
      break;
    case '--help':
    case '-h':
    case 'help':
      showHelp(VERSION);
      break;
    default: {
      // 卡170(1011 定版"安装命令带唯一码"): 未知参数不再直接报错——当作码传给 install。
      // 覆盖 npx aixxai <CODE>（不带 install 子命令）的用法；install 内部会先查云侧区分绑定码/推荐码。
      const installEntry = COMMANDS.find(c => c.name === 'install');
      if (installEntry && command && !command.startsWith('-')) {
        await installEntry.run([command, ...subArgs]);
        return;
      }
      console.error(`未知命令: ${command}`);
      const guesses = didYouMean(command);
      if (guesses.length > 0) {
        console.error(`你想用的是不是: ${guesses.join(', ')}`);
      } else {
        console.error('运行 aixx help 查看全部命令');
      }
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('❌ 发生错误:', err.message);
  process.exit(1);
});

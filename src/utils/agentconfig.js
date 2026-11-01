/**
 * agent配置写入工具
 *
 * 负责把AIXX的供应商配置写进本地agent的配置文件，实现"零配置"。
 * 当前支持两个agent：
 *   1. ZCode      -> ~/.zcode/v2/config.json  （加两个供应商：AIXX-Claude / AIXX-OpenAI）
 *   2. Claude Code-> ~/.claude/settings.json （往env块写 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN）
 *
 * ⛔ 绝对禁止改写 ZCode 的 setting.json（~/.zcode/v2/setting.json）！
 *   历史教训（2026-08-09 重大事故）：
 *   早期版本曾把 setting.json 的 providerFamilyDomain 改成 "aixx"，而 ZCode
 *   只接受内置家族名（zai/bigmodel），非法值直接导致 ZCode 崩溃、任务/项目丢失。
 *   本工具从此只允许操作 ZCode 的 config.json（加供应商），绝不碰 setting.json。
 *
 * 三条铁律（安全要求）：
 *   1. 写入前必须备份原文件到 ~/.aixx/backups/
 *   2. 只做 JSON 读-改-写，绝不整体覆盖
 *   3. 所有写入都加 "_aixx_managed": true 标记，重复 install 只更新 key 不重建（幂等）
 *
 * 纯Node标准库，零依赖。
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

// AIXX后端地址（去掉/v1，因为ZCode的baseURL要写到主机根，OpenAI的写到/v1）
// 会话16换门：域名网关入口（HTTPS加密），旧IP:8080仅存量兼容
const AIXX_HOST = 'https://console.aixx.ai';

// 用 _aixx_managed 标记找供应商时，按"作用域"区分，避免Claude/OpenAI两条记混
const MANAGED_FLAG = '_aixx_managed';

/**
 * 生成时间戳字符串，用于备份文件名
 * 形如 20260808-153045
 */
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/**
 * 备份一个文件到 ~/.aixx/backups/<原名>-<时间戳>.json
 * 如果源文件不存在，直接返回null（没东西可备份，属正常）。
 * 如果同一秒内多次备份（时间戳相同），自动加序号后缀避免覆盖。
 * 返回值：
 *   - string：备份文件路径（成功）
 *   - null：源文件不存在（无需备份，可继续写入）
 *   - false：源文件存在但备份失败（铁律1：必须中止写入）
 */
function backupFile(srcPath) {
  if (!existsSync(srcPath)) return null;
  const backupDir = join(homedir(), '.aixx', 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const base = srcPath
    .split(/[\\/]/)
    .pop()
    .replace(/\.json$/, '');
  // 时间戳精确到秒；若已存在同名备份，加序号 -1, -2 ... 避免覆盖
  let dest = join(backupDir, `${base}-${timestamp()}.json`);
  let seq = 1;
  while (existsSync(dest)) {
    dest = join(backupDir, `${base}-${timestamp()}-${seq}.json`);
    seq++;
  }
  try {
    copyFileSync(srcPath, dest);
    return dest;
  } catch (e) {
    // 铁律1：备份失败绝不继续写入。返回false让调用方中止。
    console.log(`   ⚠️  备份失败: ${e.message}`);
    return false;
  }
}

/**
 * 安全读取并解析JSON文件。
 * 失败返回 null（绝不抛出，调用方自行处理）。
 */
function readJsonSafe(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * 在 ZCode config.json 的 provider 里，找出带 _aixx_managed 且 scope 匹配的供应商key。
 * 返回供应商在config里的key（如 "aixx-claude-xxxx-uuid"），找不到返回null。
 */
function findManagedProvider(config, scope) {
  const providers = config?.provider;
  if (!providers || typeof providers !== 'object') return null;
  for (const [key, val] of Object.entries(providers)) {
    if (val && val[MANAGED_FLAG] === scope) {
      return key;
    }
  }
  return null;
}

/**
 * AIXX-Claude 供应商的模型清单（Anthropic协议，调Claude系）
 * limit.context / limit.output 是 ZCode 必填字段，单位 token
 */
function buildClaudeModels() {
  return {
    'claude-sonnet-4-20250514': { limit: { context: 200000, output: 8192 } },
    'claude-haiku-4-5-20251001': { limit: { context: 200000, output: 8192 } },
    'claude-opus-4-8': { limit: { context: 200000, output: 8192 } },
  };
}

/**
 * AIXX-OpenAI 供应商的模型清单（OpenAI协议，调国产/DeepSeek/GLM/Kimi）
 */
function buildOpenaiModels() {
  return {
    'deepseek-chat': { limit: { context: 64000, output: 8192 } },
    'deepseek-reasoner': { limit: { context: 64000, output: 8192 } },
    'glm-4-flash': { limit: { context: 128000, output: 4096 } },
    'glm-4-plus': { limit: { context: 128000, output: 4096 } },
    'moonshot-v1-8k': { limit: { context: 8000, output: 4096 } },
  };
}

/**
 * 构造一个 AIXX-Claude 供应商对象（Anthropic协议）
 */
function buildClaudeProvider(apiKey) {
  return {
    name: 'AIXX(Claude)',
    kind: 'anthropic',
    options: {
      apiKey,
      baseURL: AIXX_HOST,
      apiKeyRequired: true,
    },
    enabled: true,
    source: 'custom',
    [MANAGED_FLAG]: 'claude', // 幂等标记 + 作用域
    models: buildClaudeModels(),
  };
}

/**
 * 构造一个 AIXX-OpenAI 供应商对象（OpenAI协议）
 */
function buildOpenaiProvider(apiKey) {
  return {
    name: 'AIXX(国产/DeepSeek)',
    kind: 'openai',
    options: {
      apiKey,
      baseURL: AIXX_HOST + '/v1',
      apiKeyRequired: true,
    },
    enabled: true,
    source: 'custom',
    [MANAGED_FLAG]: 'openai', // 幂等标记 + 作用域
    models: buildOpenaiModels(),
  };
}

/**
 * 写入 ZCode 配置。
 *
 * 行为：
 *   - 如果 ~/.zcode/v2/config.json 不存在 → 直接返回false（没装ZCode）
 *   - 备份原文件
 *   - 读-改-写：往 provider 里塞两个AIXX供应商
 *   - 幂等：如果已有 _aixx_managed 供应商，只更新 apiKey（保留用户可能改过的name/enabled）
 *   - 任何一步失败都不崩溃，返回false
 *
 * 返回 { configured: true/false, note: '...' }
 */
export function configureZCode(apiKey) {
  const zcodeConfigPath = join(homedir(), '.zcode', 'v2', 'config.json');

  if (!existsSync(zcodeConfigPath)) {
    return { configured: false, note: '未检测到ZCode（~/.zcode/v2/config.json不存在），跳过' };
  }

  // 读取并解析
  const config = readJsonSafe(zcodeConfigPath);
  if (!config || typeof config !== 'object') {
    console.log('   ⚠️  ZCode config.json 解析失败，跳过ZCode配置（避免破坏文件）');
    return { configured: false, note: 'ZCode config.json 解析失败' };
  }

  // 确保 provider 对象存在
  if (!config.provider || typeof config.provider !== 'object') {
    config.provider = {};
  }

  // 备份原文件
  const backup = backupFile(zcodeConfigPath);
  if (backup === false) {
    // 铁律1：备份失败，绝不写入（避免破坏用户现有配置）
    console.log('   ⚠️  配置备份失败，请手动备份后再试（已跳过ZCode配置）');
    return { configured: false, note: '配置备份失败，请手动备份后再试' };
  }
  if (backup) {
    console.log(`   📦 已备份ZCode配置: ${backup}`);
  }

  let updated = 0;

  // --- AIXX-Claude 供应商 ---
  const claudeKey = findManagedProvider(config, 'claude');
  if (claudeKey) {
    // 幂等：只更新key（如果用户改过name/enabled，保留）
    const existing = config.provider[claudeKey];
    existing.options = existing.options || {};
    existing.options.apiKey = apiKey;
    existing.options.baseURL = AIXX_HOST;
    existing.options.apiKeyRequired = true;
    // 模型清单刷成最新（用户不太会改，但万一后端加了新模型能跟上）
    existing.models = buildClaudeModels();
    existing.kind = 'anthropic';
    existing[MANAGED_FLAG] = 'claude';
    console.log('   ✏️  更新已有AIXX(Claude)供应商（key已刷新）');
    updated++;
  } else {
    // 新增：用一个稳定的UUID做key
    const newKey = `aixx-claude-${randomUUID()}`;
    config.provider[newKey] = buildClaudeProvider(apiKey);
    console.log('   ➕ 新增AIXX(Claude)供应商');
    updated++;
  }

  // --- AIXX-OpenAI 供应商 ---
  const openaiKey = findManagedProvider(config, 'openai');
  if (openaiKey) {
    const existing = config.provider[openaiKey];
    existing.options = existing.options || {};
    existing.options.apiKey = apiKey;
    existing.options.baseURL = AIXX_HOST + '/v1';
    existing.options.apiKeyRequired = true;
    existing.models = buildOpenaiModels();
    existing.kind = 'openai';
    existing[MANAGED_FLAG] = 'openai';
    console.log('   ✏️  更新已有AIXX(国产/DeepSeek)供应商（key已刷新）');
    updated++;
  } else {
    const newKey = `aixx-openai-${randomUUID()}`;
    config.provider[newKey] = buildOpenaiProvider(apiKey);
    console.log('   ➕ 新增AIXX(国产/DeepSeek)供应商');
    updated++;
  }

  // 写回
  try {
    writeFileSync(zcodeConfigPath, JSON.stringify(config, null, 2));
    return {
      configured: true,
      note: `已配置ZCode供应商，请重启ZCode并在模型选择里选AIXX`,
      updated,
    };
  } catch (e) {
    console.log(`   ⚠️  写入ZCode配置失败: ${e.message}`);
    return { configured: false, note: `写入失败: ${e.message}` };
  }
}

/**
 * 写入 Claude Code 配置。
 *
 * 往 ~/.claude/settings.json 的 env 块写：
 *   ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN
 *
 * 注意：这会覆盖用户已有的 Claude 配置（如果已经配过别的baseURL/token）。
 * 所以要先检测是否有冲突，冲突时只更新key但保留提示。
 *
 * 返回 { configured: true/false, note: '...', overwritten: true/false }
 */
export function configureClaudeCode(apiKey) {
  const claudeSettingsPath = join(homedir(), '.claude', 'settings.json');

  if (!existsSync(claudeSettingsPath)) {
    return { configured: false, note: '未检测到Claude Code（~/.claude/settings.json不存在），跳过' };
  }

  const settings = readJsonSafe(claudeSettingsPath);
  if (!settings || typeof settings !== 'object') {
    console.log('   ⚠️  Claude settings.json 解析失败，跳过Claude Code配置');
    return { configured: false, note: 'Claude settings.json 解析失败' };
  }

  // 备份
  const backup = backupFile(claudeSettingsPath);
  if (backup === false) {
    // 铁律1：备份失败，绝不写入（避免破坏用户现有配置）
    console.log('   ⚠️  配置备份失败，请手动备份后再试（已跳过Claude Code配置）');
    return { configured: false, note: '配置备份失败，请手动备份后再试' };
  }
  if (backup) {
    console.log(`   📦 已备份Claude Code配置: ${backup}`);
  }

  // 检测是否已有冲突配置（不是AIXX的baseURL）
  let overwritten = false;
  const oldBase = settings?.env?.ANTHROPIC_BASE_URL;
  if (oldBase && oldBase !== AIXX_HOST) {
    overwritten = true;
  }

  // 幂等 + 写入
  settings.env = settings.env || {};
  settings.env.ANTHROPIC_BASE_URL = AIXX_HOST;
  settings.env.ANTHROPIC_AUTH_TOKEN = apiKey;

  try {
    writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2));
    return {
      configured: true,
      note: overwritten
        ? '已配置Claude Code（覆盖了你原有的Claude供应商，已备份）'
        : '已配置Claude Code',
      overwritten,
    };
  } catch (e) {
    console.log(`   ⚠️  写入Claude Code配置失败: ${e.message}`);
    return { configured: false, note: `写入失败: ${e.message}` };
  }
}

/**
 * 入口：自动检测并配置所有能找到的agent。
 * 由 install.js 在拿到apiKey后调用。
 *
 * 返回 { zcode, claude } 两个结果对象。
 */
export function configureAgents(apiKey) {
  console.log('\n🔌 配置本地agent（零配置核心）...');

  const zcode = configureZCode(apiKey);
  if (zcode.configured) {
    console.log(`   ✅ ZCode: ${zcode.note}`);
  } else {
    console.log(`   ⏭️  ZCode: ${zcode.note}`);
  }

  const claude = configureClaudeCode(apiKey);
  if (claude.configured) {
    console.log(`   ✅ Claude Code: ${claude.note}`);
    if (claude.overwritten) {
      console.log('   ⚠️  注意：你原有的Claude供应商被AIXX覆盖了。如需恢复，去备份目录找原配置。');
    }
  } else {
    console.log(`   ⏭️  Claude Code: ${claude.note}`);
  }

  return { zcode, claude };
}

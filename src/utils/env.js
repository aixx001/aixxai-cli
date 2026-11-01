/**
 * 环境变量配置工具
 *
 * 把AIXX_API_KEY和AIXX_BASE_URL写入用户的shell配置
 * 支持 bash/zsh (Linux/macOS) 和 PowerShell (Windows)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { exec } from 'child_process';

// 会话16换门：统一走域名入口（HTTPS加密+CORS白名单+错key锁定+余额脱敏的网关），旧IP:8080仅存量兼容
// 后端地址统一走萬安云域名网关（账号管理与模型调用）
const DEFAULT_BASE_URL = 'https://console.aixx.ai/v1';

/**
 * key脱敏：显示为 前6后4 格式（如 sk-NOj3...5Vfe）。
 * 所有命令的输出里，key一律用这个函数处理，绝不打印完整key。
 */
export function maskKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 10) return key.slice(0, 6) + '...';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

/**
 * 统一配置读取链（所有子命令共用，别各自为政）：
 *   环境变量 AIXX_API_KEY → ~/.aixx/config.json → ~/.aixx/account.json
 * 返回 key 字符串，找不到返回 null。
 */
export function loadApiKey() {
  if (process.env.AIXX_API_KEY) return process.env.AIXX_API_KEY;
  const home = homedir();
  for (const file of [join(home, '.aixx', 'config.json'), join(home, '.aixx', 'account.json')]) {
    if (!existsSync(file)) continue;
    try {
      const conf = JSON.parse(readFileSync(file, 'utf-8'));
      if (conf.AIXX_API_KEY || conf.apiKey) return conf.AIXX_API_KEY || conf.apiKey;
    } catch (e) {
      // 单个文件解析失败就试下一个
    }
  }
  return null;
}

export async function setupEnv(apiKey, baseUrl = DEFAULT_BASE_URL) {
  const platform = process.platform;
  const home = homedir();

  // 1. 写入AIXX本地配置文件（所有平台通用）
  const aixxDir = join(home, '.aixx');
  if (!existsSync(aixxDir)) mkdirSync(aixxDir, { recursive: true });
  const configFile = join(aixxDir, 'config.json');
  writeFileSync(configFile, JSON.stringify({
    AIXX_API_KEY: apiKey,
    AIXX_BASE_URL: baseUrl,
    configuredAt: new Date().toISOString()
  }, null, 2));

  // 2. 写入shell配置（Linux/macOS）
  if (platform !== 'win32') {
    const envLines = [
      ``,
      `# AIXX 配置 (由 aixxai 添加)`,
      `export AIXX_API_KEY="${apiKey}"`,
      `export AIXX_BASE_URL="${baseUrl}"`,
    ].join('\n');

    // 检测当前用的shell（优先看$SHELL，比按文件存在猜更准）
    // Mac默认zsh，Linux多是bash。$SHELL是用户登录shell，最可靠。
    const currentShell = process.env.SHELL || '';
    let shellConfigs;
    if (currentShell.includes('zsh')) {
      // zsh用户：写.zshrc（Mac默认）
      shellConfigs = [join(home, '.zshrc')];
    } else if (currentShell.includes('bash')) {
      // bash用户：Linux写.bashrc，Mac写.bash_profile（Mac的bash读.bash_profile）
      shellConfigs = platform === 'darwin'
        ? [join(home, '.bash_profile'), join(home, '.bashrc')]
        : [join(home, '.bashrc'), join(home, '.bash_profile')];
    } else {
      // 检测不到（如fish等），按文件存在兜底
      shellConfigs = [
        join(home, '.zshrc'),
        join(home, '.bashrc'),
        join(home, '.bash_profile'),
      ];
    }

    let writtenFile = null;
    for (const conf of shellConfigs) {
      if (existsSync(conf)) {
        // 检查是否已配置过（避免重复）
        const existing = readFileSync(conf, 'utf-8');
        if (!existing.includes('AIXX_API_KEY')) {
          appendFileSync(conf, envLines);
          console.log(`   → 已写入 ${conf}`);
        } else {
          console.log(`   → ${conf} 已有AIXX配置，跳过`);
        }
        writtenFile = conf;
        break;
      }
    }

    if (!writtenFile) {
      // 没找到现成配置文件，按当前shell创建一个
      const fallback = currentShell.includes('zsh') ? join(home, '.zshrc') : join(home, '.bashrc');
      appendFileSync(fallback, envLines);
      console.log(`   → 已创建并写入 ${fallback}`);
      writtenFile = fallback;
    }

    const rcName = writtenFile.split(/[\\/]/).pop();
    console.log(`   ⚠️  请运行 source ~/${rcName} 让配置生效（或重开终端）`);
    return true;
  } else {
    // Windows: 用 setx 真写入用户环境变量（对新开的终端生效）。
    // setx 有 1024 字符限制，AIXX key 很短，没问题。
    // 注意：第1步的 ~/.aixx/config.json 已经写好了（所有平台兜底），
    // 环境变量只是锦上添花——setx 失败不影响任何功能。
    try {
      const setx = (name, value) =>
        new Promise((resolve, reject) => {
          exec(`setx ${name} "${value}"`, (err) => (err ? reject(err) : resolve()));
        });
      await Promise.all([setx('AIXX_API_KEY', apiKey), setx('AIXX_BASE_URL', baseUrl)]);
      console.log('✅ 已写入Windows用户环境变量（setx，重开终端后生效）');
      return true;
    } catch (e) {
      console.log('⚠️  未写入环境变量，但已写入 ~/.aixx/config.json，功能不受影响');
      return false;
    }
  }
}

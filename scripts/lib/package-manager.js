/**
 * Package manager detection utility for Claude Code hooks and scripts
 *
 * Detects and provides commands for npm, pnpm, yarn, and bun.
 */

const fs = require('fs');
const path = require('path');
const { commandExists } = require('./utils');

const PACKAGE_MANAGERS = {
  npm: {
    name: 'npm',
    lockFile: 'package-lock.json',
    installCmd: 'npm install',
    runCmd: 'npm run',
    execCmd: 'npx',
    testCmd: 'npm test',
    buildCmd: 'npm run build',
    devCmd: 'npm run dev'
  },
  pnpm: {
    name: 'pnpm',
    lockFile: 'pnpm-lock.yaml',
    installCmd: 'pnpm install',
    runCmd: 'pnpm',
    execCmd: 'pnpm dlx',
    testCmd: 'pnpm test',
    buildCmd: 'pnpm build',
    devCmd: 'pnpm dev'
  },
  yarn: {
    name: 'yarn',
    lockFile: 'yarn.lock',
    installCmd: 'yarn install',
    runCmd: 'yarn',
    execCmd: 'yarn dlx',
    testCmd: 'yarn test',
    buildCmd: 'yarn build',
    devCmd: 'yarn dev'
  },
  bun: {
    name: 'bun',
    lockFile: 'bun.lockb',
    installCmd: 'bun install',
    runCmd: 'bun run',
    execCmd: 'bunx',
    testCmd: 'bun test',
    buildCmd: 'bun run build',
    devCmd: 'bun run dev'
  }
};

// Detection priority order
const DETECTION_PRIORITY = ['pnpm', 'yarn', 'bun', 'npm'];

/**
 * Detect package manager from lock file presence
 * @param {string} dir - Directory to check
 * @returns {string|null} Package manager name or null
 */
function detectFromLockFile(dir) {
  for (const name of DETECTION_PRIORITY) {
    const config = PACKAGE_MANAGERS[name];
    if (fs.existsSync(path.join(dir, config.lockFile))) {
      return name;
    }
  }
  return null;
}

/**
 * Detect package manager from package.json packageManager field
 * @param {string} dir - Directory to check
 * @returns {string|null} Package manager name or null
 */
function detectFromPackageJson(dir) {
  const pkgPath = path.join(dir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.packageManager) {
      const name = pkg.packageManager.split('@')[0];
      if (PACKAGE_MANAGERS[name]) {
        return name;
      }
    }
  } catch {
    // No package.json or invalid JSON
  }
  return null;
}

/**
 * Get list of available package managers in PATH
 * @returns {string[]} Array of available package manager names
 */
function getAvailablePackageManagers() {
  return Object.keys(PACKAGE_MANAGERS).filter(name => commandExists(name));
}

/**
 * Get the package manager to use
 * @param {object} options - Options
 * @param {string} options.projectDir - Project directory to check
 * @returns {{name: string, config: object, source: string}}
 */
function getPackageManager(options = {}) {
  const projectDir = options.projectDir || process.cwd();

  // 1. Environment variable
  const envPm = process.env.CLAUDE_PACKAGE_MANAGER;
  if (envPm && PACKAGE_MANAGERS[envPm]) {
    return { name: envPm, config: PACKAGE_MANAGERS[envPm], source: 'environment' };
  }

  // 2. Lock file detection
  const lockPm = detectFromLockFile(projectDir);
  if (lockPm) {
    return { name: lockPm, config: PACKAGE_MANAGERS[lockPm], source: 'lock-file' };
  }

  // 3. package.json packageManager field
  const pkgPm = detectFromPackageJson(projectDir);
  if (pkgPm) {
    return { name: pkgPm, config: PACKAGE_MANAGERS[pkgPm], source: 'package-json' };
  }

  // 4. Fallback to npm
  return { name: 'npm', config: PACKAGE_MANAGERS.npm, source: 'fallback' };
}

/**
 * Get the command string for a given command type
 * @param {string} cmdType - Command type (install, test, build, dev)
 * @returns {string} Command string
 */
function getRunCommand(cmdType) {
  const pm = getPackageManager();
  const cmdKey = cmdType + 'Cmd';
  if (pm.config[cmdKey]) {
    return pm.config[cmdKey];
  }
  return `${pm.config.runCmd} ${cmdType}`;
}

/**
 * Get the exec command for running a tool
 * @param {string} tool - Tool name
 * @param {string} args - Arguments
 * @returns {string} Exec command string
 */
function getExecCommand(tool, args) {
  const pm = getPackageManager();
  return `${pm.config.execCmd} ${tool} ${args}`;
}

/**
 * Get a regex pattern string that matches all PM variants of a command type
 * @param {string} cmd - Command type (dev, test, build, etc.)
 * @returns {string} Regex pattern string
 */
function getCommandPattern(cmd) {
  const patterns = Object.values(PACKAGE_MANAGERS).map(config => {
    const cmdKey = cmd + 'Cmd';
    if (config[cmdKey]) {
      return config[cmdKey].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return `${config.runCmd} ${cmd}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return patterns.join('|');
}

/**
 * Get a human-readable prompt listing available package managers
 * @returns {string} Selection prompt
 */
function getSelectionPrompt() {
  const available = getAvailablePackageManagers();
  const lines = [
    'Available package managers: ' + available.join(', '),
    'Set CLAUDE_PACKAGE_MANAGER environment variable to choose one.',
    'Or add a lock file or packageManager field to package.json.'
  ];
  return lines.join('\n');
}

module.exports = {
  PACKAGE_MANAGERS,
  detectFromLockFile,
  detectFromPackageJson,
  getAvailablePackageManagers,
  getPackageManager,
  getRunCommand,
  getExecCommand,
  getCommandPattern,
  getSelectionPrompt
};

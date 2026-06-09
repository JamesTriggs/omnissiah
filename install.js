#!/usr/bin/env node
/**
 * install.js — omnissiah Installer (Cross-Platform)
 *
 * Works on Windows, macOS, and Linux. Node.js is a prerequisite for the
 * framework, so this script is always available.
 *
 * Usage:
 *   node install.js                    # Interactive installation
 *   node install.js --language python  # Python-specific rules
 *   node install.js --language typescript
 *   node install.js --language cpp
 *   node install.js --all              # All language rules
 *   node install.js --force            # Force reinstall
 *   node install.js --non-interactive  # Skip prompts, install all
 *   node install.js --uninstall        # Remove configuration
 *   node install.js --update-claude-md [DIR]  # Merge framework into CLAUDE.md
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

// ─── Chapter support ──────────────────────────────────────────────────────────

const { getChapterSkills, getChapterAgents, CHAPTERS } = require('./scripts/lib/chapter-manifest');
const { setChapter, CHAPTER_CONFIG_PATH } = require('./scripts/lib/chapter-config');
const { getChapterOverridePath, getChapterOnlyItems } = require('./scripts/lib/chapter-overrides');

// ─── Paths ────────────────────────────────────────────────────────────────────

const SCRIPT_DIR = __dirname;
const HOME_DIR = os.homedir();
const CLAUDE_DIR = path.join(HOME_DIR, '.claude');
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const CLAUDE_SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const HOMUNCULUS_DIR = path.join(CLAUDE_DIR, 'homunculus');

const FRAMEWORK_NAME = 'omnissiah';
const FRAMEWORK_VERSION = '0.1.0';
const FRAMEWORK_SECTION = path.join(SCRIPT_DIR, 'examples', 'framework-section.md');

// ─── CLAUDE.md merge helpers (port of scripts/lib/merge-claude-md.sh) ─────────

const MARKER_START = '<!-- omnissiah:start -->';
const MARKER_END = '<!-- omnissiah:end -->';

function hasFrameworkSection(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes(MARKER_START) && content.includes(MARKER_END);
  } catch {
    return false;
  }
}

function mergeFrameworkSection(targetFile, sectionFile) {
  if (!fs.existsSync(sectionFile)) {
    throw new Error(`Section file not found: ${sectionFile}`);
  }
  const sectionContent = fs.readFileSync(sectionFile, 'utf8');

  // Case 1: target doesn't exist — write section as the whole file
  if (!fs.existsSync(targetFile)) {
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, sectionContent, 'utf8');
    return;
  }

  const targetContent = fs.readFileSync(targetFile, 'utf8');

  // Case 2: target has markers — replace between them
  if (targetContent.includes(MARKER_START) && targetContent.includes(MARKER_END)) {
    const before = targetContent.substring(0, targetContent.indexOf(MARKER_START));
    const after = targetContent.substring(targetContent.indexOf(MARKER_END) + MARKER_END.length);
    fs.writeFileSync(targetFile, before + sectionContent + after, 'utf8');
    return;
  }

  // Case 3: target exists without markers — append
  fs.appendFileSync(targetFile, '\n' + sectionContent + '\n', 'utf8');
}

// ─── Output helpers ───────────────────────────────────────────────────────────

const isWindows = process.platform === 'win32';
// Colours via ANSI; disable on non-TTY or Windows without VT
const useColour = process.stdout.isTTY && (process.env.FORCE_COLOR || !isWindows || process.env.WT_SESSION);
const c = {
  red:    s => useColour ? `\x1b[31m${s}\x1b[0m` : s,
  green:  s => useColour ? `\x1b[32m${s}\x1b[0m` : s,
  yellow: s => useColour ? `\x1b[33m${s}\x1b[0m` : s,
  blue:   s => useColour ? `\x1b[34m${s}\x1b[0m` : s,
  cyan:   s => useColour ? `\x1b[36m${s}\x1b[0m` : s,
};

function printBanner() {
  console.log('');
  console.log(c.cyan('============================================'));
  console.log(c.cyan(`  omnissiah v${FRAMEWORK_VERSION}`));
  console.log(c.cyan('============================================'));
  console.log('');
}

function logInfo(msg) { console.log(`${c.blue('[INFO]')} ${msg}`); }
function logSuccess(msg) { console.log(`${c.green('[OK]')} ${msg}`); }
function logWarn(msg) { console.log(`${c.yellow('[WARN]')} ${msg}`); }
function logError(msg) { console.error(`${c.red('[ERROR]')} ${msg}`); }

// ─── Prerequisite helpers ─────────────────────────────────────────────────────

/** Returns install hint for a package depending on the current OS. */
function installHint(brew, winget, apt) {
  if (process.platform === 'win32') {
    return `Install with: ${winget}  (or: choco install <pkg>)`;
  } else if (process.platform === 'linux') {
    return `Install with: ${apt}`;
  } else {
    return `Install with: ${brew}`;
  }
}

function commandExists(cmd) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(cmd)) return false;
  try {
    const result = isWindows
      ? spawnSync('where', [cmd], { stdio: 'pipe' })
      : spawnSync('which', [cmd], { stdio: 'pipe' });
    return result.status === 0;
  } catch {
    return false;
  }
}

function runCommand(cmd) {
  try {
    return { success: true, output: execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() };
  } catch (err) {
    return { success: false, output: String(err.stderr || err.message) };
  }
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function checkPrerequisites() {
  logInfo('Checking prerequisites...');

  // Node.js — guaranteed present (we're running in it)
  const nodeVersion = process.version; // e.g. "v20.11.0"
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (nodeMajor < 18) {
    logError(`Node.js >= 18 required (found ${nodeVersion})`);
    logInfo(installHint(
      'brew upgrade node',
      'winget upgrade OpenJS.NodeJS',
      'sudo apt-get install nodejs  # or use nvm'
    ));
    process.exit(1);
  }
  logSuccess(`Node.js ${nodeVersion}`);

  // Python 3 (required for instinct CLI)
  const pythonCmd = isWindows ? 'python' : 'python3';
  if (!commandExists(pythonCmd) && !commandExists('python3')) {
    logError('Python 3.10+ is required but not installed.');
    logInfo(installHint(
      'brew install python@3.12',
      'winget install Python.Python.3.12',
      'sudo apt-get install python3'
    ));
    process.exit(1);
  }
  const pyResult = runCommand(`${pythonCmd} --version`);
  if (!pyResult.success) {
    logError('Python not found or could not be invoked.');
    process.exit(1);
  }
  logSuccess(`Python ${pyResult.output}`);

  // Python version check
  const pyVerResult = runCommand(
    `${pythonCmd} -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" `
  );
  if (pyVerResult.success) {
    const [major, minor] = pyVerResult.output.split('.').map(Number);
    if (major < 3 || (major === 3 && minor < 10)) {
      logError(`Python >= 3.10 required (found ${pyVerResult.output})`);
      process.exit(1);
    }
  }

  // git
  if (!commandExists('git')) {
    logError('git is required but not installed.');
    logInfo(installHint(
      'brew install git',
      'winget install Git.Git',
      'sudo apt-get install git'
    ));
    process.exit(1);
  }
  const gitResult = runCommand('git --version');
  logSuccess(gitResult.success ? gitResult.output : 'git (version unknown)');

  console.log('');
}

function createDirectories() {
  logInfo('Creating directory structure...');
  const dirs = [
    CLAUDE_DIR,
    SESSIONS_DIR,
    CLAUDE_SKILLS_DIR,
    path.join(HOMUNCULUS_DIR, 'instincts', 'personal'),
    path.join(HOMUNCULUS_DIR, 'instincts', 'inherited'),
    path.join(HOMUNCULUS_DIR, 'evolved', 'agents'),
    path.join(HOMUNCULUS_DIR, 'evolved', 'skills'),
    path.join(HOMUNCULUS_DIR, 'evolved', 'commands'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  logSuccess('Directory structure created');
}

function readSettings(force = false) {
  if (!fs.existsSync(CLAUDE_SETTINGS)) return {};
  const raw = fs.readFileSync(CLAUDE_SETTINGS, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    if (force) {
      logWarn(`${CLAUDE_SETTINGS} contains invalid JSON — overwriting due to --force.`);
      return {};
    }
    throw new Error(
      `${CLAUDE_SETTINGS} contains invalid JSON and cannot be read safely.\n` +
      `Run with --force to overwrite it, or fix the file manually.`
    );
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(CLAUDE_SETTINGS), { recursive: true });
  fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function backupSettings() {
  if (fs.existsSync(CLAUDE_SETTINGS)) {
    const backup = `${CLAUDE_SETTINGS}.backup.${Date.now()}`;
    fs.copyFileSync(CLAUDE_SETTINGS, backup);
    logInfo(`Backed up settings to ${backup}`);
    return backup;
  }
  return null;
}

/**
 * Install hooks via idempotent merge.
 *
 * Every hook declared in hooks/hooks.json is ensured present in
 * ~/.claude/settings.json. User hooks are preserved verbatim. Running twice
 * is a no-op. Adding a new hook to hooks.json rolls it out to every existing
 * consumer the next time the installer runs.
 *
 * --force semantics: wipe .hooks entirely first, then merge — useful for
 * migrating legacy inline-bash hooks to their newer node-script equivalents.
 */
function installHooks(forceReinstall) {
  logInfo('Installing hooks (idempotent merge)...');

  const { mergeFromFiles } = require('./scripts/lib/hooks-merge');
  const hooksFile = path.join(SCRIPT_DIR, 'hooks', 'hooks.json');

  if (!fs.existsSync(hooksFile)) {
    throw new Error(`Framework hooks file missing: ${hooksFile}`);
  }

  if (forceReinstall && fs.existsSync(CLAUDE_SETTINGS)) {
    // readSettings(true) returns {} for corrupt JSON in force mode. We must
    // rewrite the file here — otherwise the corrupt JSON stays on disk and
    // the subsequent mergeFromFiles call re-reads it and throws. Checking
    // only `current.hooks` skipped that rewrite for valid-JSON-without-hooks
    // AND for corrupt-JSON-coerced-to-{} — both of which need to pass through.
    const current = readSettings(true);
    if (current) {
      logInfo('Force mode: removing existing hooks before re-merging');
      backupSettings();
      if (current.hooks) delete current.hooks;
      writeSettings(current);
    }
  }

  const repoPath = SCRIPT_DIR.replace(/\\/g, '/');
  let result;
  try {
    result = mergeFromFiles(CLAUDE_SETTINGS, repoPath, hooksFile, { backup: true });
  } catch (err) {
    throw new Error(`Failed to merge hooks into ${CLAUDE_SETTINGS}: ${err.message}`);
  }

  if (result.added.length === 0) {
    logInfo(`Hooks already up to date in ${CLAUDE_SETTINGS} (${result.afterCount} commands)`);
  } else {
    logSuccess(`Merged ${result.added.length} hook(s) into ${CLAUDE_SETTINGS} (${result.beforeCount} → ${result.afterCount})`);
  }
}

function installMcp(forceReinstall) {
  logInfo('Installing MCP server configuration...');

  const settings = readSettings(forceReinstall);

  if (settings.mcpServers && !forceReinstall) {
    logWarn(`MCP servers already configured in ${CLAUDE_SETTINGS}`);
    logInfo('Use --force to reinstall');
    return;
  }

  // Read MCP config before taking a backup — fail fast on read errors
  const mcpFile = path.join(SCRIPT_DIR, 'mcp-configs', 'mcp-servers.json');
  let mcpRaw;
  try {
    mcpRaw = fs.readFileSync(mcpFile, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read mcp-servers.json: ${err.message}`);
  }

  // Replace ${HOME}/.claude using function form so $ in claudeDir is never
  // interpreted as a replacement specifier ($', $&, etc.)
  const claudeDir = CLAUDE_DIR.replace(/\\/g, '/');
  const mcpResolved = mcpRaw.replace(/\$\{HOME\}\/.claude/g, () => claudeDir);

  let mcpData;
  try {
    mcpData = JSON.parse(mcpResolved);
  } catch {
    throw new Error(
      `Failed to parse MCP config after HOME substitution.\n` +
      `Home directory path: ${claudeDir}\n` +
      `Check that your home directory path does not contain characters that are invalid in JSON (e.g. double-quotes).`
    );
  }

  const backup = backupSettings();

  try {
    if (forceReinstall) delete settings.mcpServers;
    settings.mcpServers = mcpData.mcpServers;
    writeSettings(settings);
  } catch (err) {
    // Keep backup intact so the user can recover their original settings.
    if (backup && fs.existsSync(backup)) {
      logError(`Write failed — original settings preserved at: ${backup}`);
    }
    throw err;
  }

  logSuccess(`MCP servers configured in ${CLAUDE_SETTINGS}`);
}

/**
 * List every skill directory shipped in the repo. A skill is any subdirectory
 * of skills/ that contains a SKILL.md. Deriving the list from disk keeps the
 * installer in step with whatever skills the framework actually provides.
 */
function listSkills() {
  const skillsRoot = path.join(SCRIPT_DIR, 'skills');
  if (!fs.existsSync(skillsRoot)) return [];
  return fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => fs.existsSync(path.join(skillsRoot, name, 'SKILL.md')))
    .sort();
}

function installSkills() {
  logInfo('Installing skills...');

  const skills = listSkills();

  for (const skill of skills) {
    const src = path.join(SCRIPT_DIR, 'skills', skill);
    const dst = path.join(CLAUDE_SKILLS_DIR, skill);

    if (!fs.existsSync(src)) continue;

    if (fs.existsSync(dst)) {
      logInfo(`Skill already installed: ${skill}`);
    } else {
      try {
        // Copy instead of symlink — works everywhere without admin rights
        fs.cpSync(src, dst, { recursive: true });
        logSuccess(`Copied skill: ${skill}`);
      } catch (err) {
        logWarn(`Failed to install skill '${skill}': ${err.message} — continuing`);
      }
    }
  }

  logSuccess('Skills installed');
}

/**
 * Install omnissiah as a Claude Code plugin so that slash commands
 * (/project, /tldr, /health, /orchestrate, etc.) are available.
 *
 * Claude Code loads commands from plugins — NOT from settings.json.
 * We install to three candidate locations to cover different CC versions:
 *   1. ~/.claude/commands/          — flat commands dir (some versions)
 *   2. ~/.claude/plugins/omnissiah/ — direct plugin dir (some versions)
 *   3. ~/.claude/plugins/marketplaces/.../omnissiah/ — marketplace plugin
 */
function installPlugin() {
  logInfo('Installing plugin (commands, agents, skills)...');

  const CONTENT = ['commands', 'agents', 'skills', 'contexts', '.claude-plugin'];

  // Helper: sync a source dir tree to dest, skipping if already up to date
  function syncDir(src, dst) {
    if (!fs.existsSync(src)) return;
    try {
      fs.cpSync(src, dst, { recursive: true, force: true });
    } catch (err) {
      logWarn(`Could not sync ${src} → ${dst}: ${err.message}`);
    }
  }

  // Location 1: flat ~/.claude/commands/
  const flatCommands = path.join(CLAUDE_DIR, 'commands');
  fs.mkdirSync(flatCommands, { recursive: true });
  const commandsSrc = path.join(SCRIPT_DIR, 'commands');
  if (fs.existsSync(commandsSrc)) {
    for (const f of fs.readdirSync(commandsSrc)) {
      const src = path.join(commandsSrc, f);
      const dst = path.join(flatCommands, f);
      try { fs.cpSync(src, dst, { force: true }); } catch {}
    }
  }

  // Location 2: direct plugin dir ~/.claude/plugins/omnissiah/
  const directPlugin = path.join(CLAUDE_DIR, 'plugins', 'omnissiah');
  fs.mkdirSync(directPlugin, { recursive: true });
  for (const dir of CONTENT) syncDir(path.join(SCRIPT_DIR, dir), path.join(directPlugin, dir));

  // Location 3: marketplace plugin dir (survives official marketplace syncs
  // because we're a separate plugin entry, not modifying the marketplace manifest)
  const marketplacePlugin = path.join(
    CLAUDE_DIR, 'plugins', 'marketplaces', 'claude-plugins-official',
    'plugins', 'omnissiah'
  );
  fs.mkdirSync(marketplacePlugin, { recursive: true });
  for (const dir of CONTENT) syncDir(path.join(SCRIPT_DIR, dir), path.join(marketplacePlugin, dir));

  logSuccess('Plugin installed (commands available as /project, /tldr, /health, /orchestrate, etc.)');
}

/**
 * Install a chapter-filtered version of plugin.json to the three install locations.
 *
 * Reads the master plugin.json from the repo, filters skills and agents to only those
 * in the chapter's allowed set (global + chapter-specific), then writes the filtered
 * copy to each install location. The repo's plugin.json is never modified.
 *
 * @param {string} chapter — one of the chapters in CHAPTERS (python, cpp, frontend, devops)
 * @param {string[]} installDirs — the three plugin install directories
 */
function installFilteredPlugin(chapter, installDirs) {
  const pluginJsonPath = path.join(SCRIPT_DIR, '.claude-plugin', 'plugin.json');
  let masterPlugin;
  try {
    masterPlugin = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  } catch (err) {
    logWarn(`Could not read plugin.json for filtering: ${err.message} — skipping filter`);
    return;
  }

  const allowedSkills = new Set(getChapterSkills(chapter));
  const allowedAgents = new Set(getChapterAgents(chapter));

  // Filter skills: keep if the skill name matches the allowed set
  const filteredSkills = (masterPlugin.skills || []).filter(skill => {
    // Match by name field (primary) or derive name from file path
    const skillName = skill.name || (skill.file ? path.basename(path.dirname(skill.file)) : '');
    return allowedSkills.has(skillName);
  });

  // Filter agents: keep if the agent name matches the allowed set
  const filteredAgents = (masterPlugin.agents || []).filter(agent => {
    const agentName = agent.name || (agent.file ? path.basename(agent.file, '.md') : '');
    return allowedAgents.has(agentName);
  });

  const filteredPlugin = {
    ...masterPlugin,
    skills: filteredSkills,
    agents: filteredAgents,
    // commands, rules, contexts, mcpServers unchanged
  };

  const filteredJson = JSON.stringify(filteredPlugin, null, 2) + '\n';

  for (const installDir of installDirs) {
    const pluginDir = path.join(installDir, '.claude-plugin');
    const destPath = path.join(pluginDir, 'plugin.json');
    if (!fs.existsSync(destPath)) continue; // only overwrite if installPlugin already wrote it
    try {
      fs.writeFileSync(destPath, filteredJson, 'utf8');
      logSuccess(`Chapter-filtered plugin.json written (${chapter}) → ${destPath}`);
    } catch (err) {
      logWarn(`Could not write filtered plugin.json to ${destPath}: ${err.message}`);
    }
  }
}

/**
 * Install chapter-specific skill/agent/command overrides and additions.
 *
 * For each skill in the chapter's allowed set:
 *   - If a chapter override exists (chapters/<chapter>/skills/<name>/SKILL.md),
 *     copy that file into ~/.claude/skills/<name>/ instead of the global one.
 *
 * For chapter-only additions (exist in chapters/<chapter>/ but not globally):
 *   - Copy the file into the appropriate ~/.claude/ target directory.
 *   - Add the entry to the filtered plugin.json in each install dir.
 *
 * This function is called AFTER installSkills() and installFilteredPlugin().
 * Full (no --chapter) installs never call this function.
 *
 * @param {string} chapter — one of the chapters in CHAPTERS (python, cpp, frontend, devops)
 * @param {string[]} installDirs — plugin install directories
 */
function installChapterContent(chapter, installDirs) {
  logInfo(`Applying chapter overrides for: ${chapter}`);

  const chapterSkills = getChapterSkills(chapter);
  let overrideCount = 0;

  // ── Skill overrides ────────────────────────────────────────────────────────
  for (const skillName of chapterSkills) {
    const overridePath = getChapterOverridePath(chapter, 'skills', skillName);
    if (!overridePath) continue;

    const dst = path.join(CLAUDE_SKILLS_DIR, skillName, 'SKILL.md');
    if (!fs.existsSync(path.join(CLAUDE_SKILLS_DIR, skillName))) {
      // Skill dir doesn't exist yet — create it
      try {
        fs.mkdirSync(path.join(CLAUDE_SKILLS_DIR, skillName), { recursive: true });
      } catch (err) {
        logWarn(`Could not create skill dir for ${skillName}: ${err.message}`);
        continue;
      }
    }

    try {
      fs.copyFileSync(overridePath, dst);
      logSuccess(`Chapter override applied: ${skillName} (${chapter})`);
      overrideCount++;
    } catch (err) {
      logWarn(`Could not apply chapter override for ${skillName}: ${err.message}`);
    }
  }

  // ── Chapter-only additive skills ───────────────────────────────────────────
  const additiveSkills = getChapterOnlyItems(chapter, 'skills');
  for (const item of additiveSkills) {
    const skillDir = path.join(CLAUDE_SKILLS_DIR, item.name);
    try {
      fs.mkdirSync(skillDir, { recursive: true });
      fs.copyFileSync(item.path, path.join(skillDir, 'SKILL.md'));
      logSuccess(`Chapter-only skill installed: ${item.name}`);
    } catch (err) {
      logWarn(`Could not install chapter-only skill ${item.name}: ${err.message}`);
    }
  }

  // ── Chapter-only additive agents ───────────────────────────────────────────
  const additiveAgents = getChapterOnlyItems(chapter, 'agents');
  const flatCommands = path.join(CLAUDE_DIR, 'commands');

  // Update filtered plugin.json with additive items
  if (additiveSkills.length > 0 || additiveAgents.length > 0) {
    for (const installDir of installDirs) {
      const pluginJsonPath = path.join(installDir, '.claude-plugin', 'plugin.json');
      if (!fs.existsSync(pluginJsonPath)) continue;

      try {
        const plugin = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));

        // Add chapter-only skills to plugin.json skills array
        for (const item of additiveSkills) {
          const alreadyListed = (plugin.skills || []).some(s => (s.name || '') === item.name);
          if (!alreadyListed) {
            plugin.skills = plugin.skills || [];
            plugin.skills.push({ name: item.name, file: `skills/${item.name}/SKILL.md` });
          }
        }

        // Add chapter-only agents to plugin.json agents array
        for (const item of additiveAgents) {
          const alreadyListed = (plugin.agents || []).some(a => (a.name || '') === item.name);
          if (!alreadyListed) {
            plugin.agents = plugin.agents || [];
            plugin.agents.push({ name: item.name, file: `agents/${item.name}.md` });
          }
        }

        fs.writeFileSync(pluginJsonPath, JSON.stringify(plugin, null, 2) + '\n', 'utf8');
      } catch (err) {
        logWarn(`Could not update plugin.json with chapter additions: ${err.message}`);
      }
    }
  }

  if (overrideCount > 0) {
    logSuccess(`${overrideCount} chapter skill override(s) applied (${chapter})`);
  } else {
    logInfo(`No chapter skill overrides found for: ${chapter}`);
  }
}

/**
 * Add the claude() wrapper function to the user's shell profile.
 * Shows the omnissiah banner + health check before every Claude session
 * (workaround: SessionStart hooks don't fire reliably in some Claude Code versions).
 *
 * Windows: appends to PowerShell profile ($PROFILE)
 * Mac/Linux: handled by install.sh
 */
function installShellWrapper() {
  if (process.platform !== 'win32') return; // install.sh handles Mac/Linux

  logInfo('Installing PowerShell shell wrapper...');

  const marker = 'omnissiah';
  const claudeExe = path.join(process.env.USERPROFILE || os.homedir(), '.local', 'bin', 'claude.exe');
  const scriptPath = path.join(SCRIPT_DIR, 'scripts', 'hooks', 'session-start.js').replace(/\//g, '\\');

  const wrapper = `
# ${marker} — show banner before every Claude session
function claude {
    # Force UTF-8 so block characters render correctly (▀ ▄ █ ═ ║ etc.)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
    node "${scriptPath}"
    & "${claudeExe}" @args
}
`;

  // Find PowerShell profile path
  const profileDir = path.join(process.env.USERPROFILE || os.homedir(), 'Documents', 'WindowsPowerShell');
  const profileFile = path.join(profileDir, 'Microsoft.PowerShell_profile.ps1');

  try {
    fs.mkdirSync(profileDir, { recursive: true });
    const existing = fs.existsSync(profileFile) ? fs.readFileSync(profileFile, 'utf8') : '';
    if (existing.includes(marker)) {
      logInfo('PowerShell wrapper already in profile');
    } else {
      fs.appendFileSync(profileFile, wrapper, 'utf8');
      logSuccess(`PowerShell wrapper added to ${profileFile}`);
      logInfo('Run: . $PROFILE  (or open a new PowerShell window)');
    }
  } catch (err) {
    logWarn(`Could not update PowerShell profile: ${err.message}`);
  }
}

function installUserConfig() {
  const userClaude = path.join(CLAUDE_DIR, 'CLAUDE.md');
  const template = path.join(SCRIPT_DIR, 'examples', 'user-CLAUDE.md');

  if (!fs.existsSync(userClaude)) {
    logInfo('Installing user-level CLAUDE.md template...');
    if (fs.existsSync(template)) {
      fs.copyFileSync(template, userClaude);
      logSuccess(`User CLAUDE.md installed at ${userClaude}`);
      logInfo(`Customize your preferences in ${userClaude}`);
    }
  } else if (hasFrameworkSection(userClaude)) {
    logInfo(`Updating framework section in ${userClaude}...`);
    try {
      mergeFrameworkSection(userClaude, FRAMEWORK_SECTION);
    } catch (err) {
      throw new Error(`Failed to update ${userClaude}: ${err.message}\nCheck file permissions.`);
    }
    logSuccess(`Framework section updated in ${userClaude}`);
  } else {
    logInfo(`Merging framework section into ${userClaude}...`);
    try {
      mergeFrameworkSection(userClaude, FRAMEWORK_SECTION);
    } catch (err) {
      throw new Error(`Failed to merge into ${userClaude}: ${err.message}\nCheck file permissions.`);
    }
    logSuccess(`Framework section added to ${userClaude}`);
  }
}

function installLanguageRules(language) {
  logInfo(`Installing ${language} rules...`);

  switch (language) {
    case 'python':
      if (commandExists('ruff')) {
        const v = runCommand('ruff --version');
        logSuccess(`Ruff found: ${v.output}`);
      } else {
        logWarn(`ruff not found. ${installHint('pip install ruff', 'pip install ruff', 'pip install ruff')}`);
      }
      if (commandExists('mypy')) {
        const v = runCommand('mypy --version');
        logSuccess(`mypy found: ${v.output}`);
      } else {
        logWarn(`mypy not found. ${installHint('pip install mypy', 'pip install mypy', 'pip install mypy')}`);
      }
      if (commandExists('uv')) {
        const v = runCommand('uv --version');
        logSuccess(`uv found: ${v.output}`);
      } else {
        logWarn(`uv not found. ${installHint('pip install uv', 'pip install uv', 'pip install uv')}`);
      }
      logSuccess('Python rules installed (rules/python/)');
      break;

    case 'typescript':
      if (commandExists('npx')) {
        logSuccess('npx found');
      } else {
        logWarn(`npx not found. ${installHint('brew install node', 'winget install OpenJS.NodeJS', 'sudo apt-get install nodejs')}`);
      }
      logSuccess('TypeScript/Vue rules available via ESLint hooks');
      break;

    case 'cpp':
      if (commandExists('cppcheck')) {
        const v = runCommand('cppcheck --version');
        logSuccess(`cppcheck found: ${v.output}`);
      } else {
        logWarn(`cppcheck not found. ${installHint(
          'brew install cppcheck',
          'winget install Cppcheck.Cppcheck  (or: choco install cppcheck)',
          'sudo apt-get install cppcheck'
        )}`);
      }
      if (commandExists('cmake')) {
        const v = runCommand('cmake --version');
        logSuccess(`cmake found: ${v.output.split('\n')[0]}`);
      } else {
        logWarn(`cmake not found. ${installHint(
          'brew install cmake',
          'winget install Kitware.CMake  (or: choco install cmake)',
          'sudo apt-get install cmake'
        )}`);
      }
      logSuccess('C++ rules available via cppcheck hooks');
      break;

    default:
      logError(`Unknown language: ${language}. Supported: python, typescript, cpp`);
      process.exit(1);
  }
}

function verifyInstallation() {
  console.log('');
  logInfo('Verifying installation...');

  let passed = 0;
  let total = 0;

  total++;
  if (fs.existsSync(CLAUDE_SETTINGS)) {
    logSuccess('Settings file exists');
    passed++;
  } else {
    logError('Settings file missing');
  }

  total++;
  try {
    const s = readSettings();
    if (s.hooks) { logSuccess('Hooks configured'); passed++; }
    else logWarn('Hooks not configured');
  } catch {
    logWarn('Hooks not configured');
  }

  total++;
  if (fs.existsSync(SESSIONS_DIR)) { logSuccess('Sessions directory exists'); passed++; }
  else logError('Sessions directory missing');

  total++;
  if (fs.existsSync(HOMUNCULUS_DIR)) { logSuccess('Learning system directory exists'); passed++; }
  else logWarn('Learning system directory missing');

  console.log('');
  console.log(c.cyan('============================================'));
  console.log(c.cyan(`  Installation Summary: ${passed}/${total} checks passed`));
  console.log(c.cyan('============================================'));
  console.log('');
}

function doUninstall() {
  logInfo('Uninstalling omnissiah...');

  // Remove hooks from settings
  if (fs.existsSync(CLAUDE_SETTINGS)) {
    const settings = readSettings();
    delete settings.hooks;
    writeSettings(settings);
    logSuccess('Hooks removed from settings');
  }

  // Remove copied skill directories (derived from the repo's skills/ tree)
  const skills = listSkills();
  for (const skill of skills) {
    const dst = path.join(CLAUDE_SKILLS_DIR, skill);
    if (fs.existsSync(dst)) {
      fs.rmSync(dst, { recursive: true, force: true });
      logSuccess(`Removed skill: ${skill}`);
    }
  }

  logSuccess('Framework uninstalled. User data (sessions, instincts) preserved.');
}

function printNextSteps() {
  const pathSep = isWindows ? '\\' : '/';
  const home = isWindows ? '%USERPROFILE%' : '~';
  console.log('');
  console.log(c.green('Installation complete!'));
  console.log('');
  console.log('Next steps:');
  console.log('');
  console.log('  1. Configure any MCP servers you need:');
  console.log(`     Edit ${SCRIPT_DIR}${pathSep}mcp-configs${pathSep}mcp-servers.json, then re-run with --force.`);
  console.log('     Reference secrets via environment variables, never hardcode them.');
  console.log('');
  console.log('  2. Customise your user config:');
  console.log(`     ${CLAUDE_DIR}${pathSep}CLAUDE.md`);
  console.log('');
  console.log('  3. Copy the project CLAUDE.md template to your repos:');
  console.log(`     ${SCRIPT_DIR}${pathSep}examples${pathSep}CLAUDE.md`);
  console.log('');
  console.log('  4. Start a Claude Code session and try:');
  console.log('     /code-review');
  console.log('     /sessions list');
  console.log('     /instinct-status');
  console.log('');
  console.log('  5. Read the guide:');
  console.log(`     ${SCRIPT_DIR}${pathSep}the-omnissiah-guide.md`);
  console.log('');
}

// ─── Interactive prompt helper ────────────────────────────────────────────────

function prompt(question, defaultVal) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim() || defaultVal);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let language = '';
  let chapter = '';
  let installAll = false;
  let doUninstallFlag = false;
  let updateClaudeMd = '';
  let forceReinstall = false;
  let nonInteractive = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--language':
        language = args[++i] || '';
        break;
      case '--chapter':
        chapter = args[++i] || '';
        break;
      case '--all':
        installAll = true;
        break;
      case '--uninstall':
        doUninstallFlag = true;
        break;
      case '--update-claude-md':
        updateClaudeMd = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '.';
        break;
      case '--force':
        forceReinstall = true;
        break;
      case '--non-interactive':
        nonInteractive = true;
        break;
      case '--help':
      case '-h':
        console.log(`Usage: node install.js [OPTIONS]

Options:
  --language <lang>       Install language-specific rules (python, typescript, cpp)
  --chapter <chapter>     Install with chapter-scoped context (${CHAPTERS.join(', ')})
  --all                   Install all language rules
  --force                 Force reinstall (overwrite existing hooks/MCP config)
  --non-interactive       Skip interactive prompts, install all languages
  --uninstall             Remove framework configuration
  --update-claude-md DIR  Merge framework section into DIR/CLAUDE.md
  --help, -h              Show this help message

Platform notes:
  Windows:  Run as: node install.js --all
  macOS:    Run as: node install.js --all  (or ./install.sh --all)
  Linux:    Run as: node install.js --all  (or ./install.sh --all)
`);
        process.exit(0);
        break;
      default:
        logError(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  // Validate --chapter early so we fail fast before doing any install work
  if (chapter && !CHAPTERS.includes(chapter)) {
    logError(`Unknown chapter: "${chapter}". Valid chapters: ${CHAPTERS.join(', ')}`);
    process.exit(1);
  }

  printBanner();

  if (doUninstallFlag) {
    doUninstall();
    process.exit(0);
  }

  // Standalone CLAUDE.md merge
  if (updateClaudeMd) {
    const target = path.join(updateClaudeMd, 'CLAUDE.md');
    logInfo(`Merging framework section into ${target}...`);
    try {
      mergeFrameworkSection(target, FRAMEWORK_SECTION);
    } catch (err) {
      logError(`Failed to merge into ${target}: ${err.message}`);
      process.exit(1);
    }
    if (fs.existsSync(target)) {
      logSuccess(`Framework section merged into ${target}`);
    } else {
      logSuccess(`Created ${target} with framework section`);
    }
    process.exit(0);
  }

  checkPrerequisites();
  createDirectories();
  // Wrap each install step to produce a single coherent error message rather than
  // the double-error that occurs when the inner catch logs and then rethrows.
  try { installHooks(forceReinstall); } catch (err) {
    logError(`Hook installation failed: ${err.message}`);
    process.exit(1);
  }
  try { installMcp(forceReinstall); } catch (err) {
    logError(`MCP configuration failed: ${err.message}`);
    process.exit(1);
  }
  installSkills();
  installPlugin();

  // ── Chapter-scoped install ──
  if (chapter) {
    logInfo(`Installing chapter-scoped context: ${chapter}`);
    try {
      setChapter(chapter);
      logSuccess(`Chapter config written: ${CHAPTER_CONFIG_PATH}`);
    } catch (err) {
      logWarn(`Could not write chapter config: ${err.message}`);
    }

    // Apply filtered plugin.json to all three install locations
    const installDirs = [
      path.join(CLAUDE_DIR, 'plugins', 'omnissiah'),
      path.join(
        CLAUDE_DIR, 'plugins', 'marketplaces', 'claude-plugins-official',
        'plugins', 'omnissiah'
      ),
    ];
    installFilteredPlugin(chapter, installDirs);
    logSuccess(`Plugin filtered for chapter: ${chapter} (global items always included)`);

    // Apply chapter overrides — must run AFTER installSkills() and installFilteredPlugin()
    installChapterContent(chapter, installDirs);
  }

  installShellWrapper();
  installUserConfig();

  // Language rules
  if (installAll) {
    installLanguageRules('python');
    installLanguageRules('typescript');
    installLanguageRules('cpp');
  } else if (language) {
    installLanguageRules(language);
  } else if (nonInteractive || !process.stdout.isTTY) {
    logInfo('Non-interactive mode: installing all language rules');
    installLanguageRules('python');
    installLanguageRules('typescript');
    installLanguageRules('cpp');
  } else {
    // Interactive
    console.log('');
    console.log('Which language rules would you like to install?');
    console.log('  1) Python (Flask, FastAPI, Ruff, mypy)');
    console.log('  2) TypeScript (Vue 3, Nuxt 3, ESLint)');
    console.log('  3) C++ (CMake, cppcheck, Google Test)');
    console.log('  4) All');
    console.log('  5) Skip');
    console.log('');

    const choice = await prompt('Enter choice [4]: ', '4');
    switch (choice) {
      case '1': installLanguageRules('python'); break;
      case '2': installLanguageRules('typescript'); break;
      case '3': installLanguageRules('cpp'); break;
      case '4':
        installLanguageRules('python');
        installLanguageRules('typescript');
        installLanguageRules('cpp');
        break;
      case '5': logInfo('Skipping language rules'); break;
      default: logWarn('Invalid choice, skipping language rules');
    }
  }

  verifyInstallation();
  printNextSteps();

  // ── Chapter hint ──
  if (chapter) {
    logSuccess(`Chapter "${chapter}" active — plugin context reduced to chapter-relevant skills and agents.`);
    logInfo(`To change chapter: node install.js --chapter ${CHAPTERS.join('|')}`);
  } else {
    // Only emit hint when omnissiah-chapter.json does not already exist
    const { CHAPTER_CONFIG_PATH: cfgPath } = require('./scripts/lib/chapter-config');
    if (!require('fs').existsSync(cfgPath)) {
      console.log('');
      logInfo(`Tip: run with --chapter ${CHAPTERS.join('|')} to reduce context load for your chapter.`);
    }
  }
}

// ─── Entry point guard ────────────────────────────────────────────────────────
// Using require.main check allows tests to import helpers without triggering install.
if (require.main === module) {
  main().catch(err => {
    logError(`Fatal: ${err}`);
    process.exit(1);
  });
}

// Export helpers so tests can exercise production functions directly
function resolveHookCommands(hooksObj, repoPath) {
  // Normalise Windows backslashes so hook command strings use forward slashes
  const normalised = repoPath.replace(/\\/g, '/');
  const resolved = JSON.parse(
    JSON.stringify(hooksObj).replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, () => normalised)
  );
  return JSON.parse(
    JSON.stringify(resolved).replace(
      /"node scripts\/hooks\//g,
      () => `"node ${normalised}/scripts/hooks/`
    )
  );
}

module.exports = {
  mergeFrameworkSection,
  readSettings,
  backupSettings,
  resolveHookCommands,
  installFilteredPlugin,
  installChapterContent,
};

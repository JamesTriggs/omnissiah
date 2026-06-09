#!/usr/bin/env node
/**
 * install-minimal.js — omnissiah (Minimal Install)
 *
 * For engineers who have their own Claude Code configuration and only want
 * the small set of generic, vendor-neutral hygiene hooks:
 *
 *   1. Secret detection   — blocks AWS keys, API tokens, passwords in commits
 *   2. Session tracking   — records session start/end timestamps
 *
 * What this does NOT touch:
 *   - Your existing CLAUDE.md
 *   - Your existing skills, agents, or commands
 *   - Your plugin.json or any plugin configuration
 *   - Any hooks you have already configured (they are merged, not replaced)
 *
 * Usage:
 *   node install-minimal.js              # Install minimal hooks
 *   node install-minimal.js --check      # Show current status only (no changes)
 *   node install-minimal.js --uninstall  # Remove minimal hooks
 *   node install-minimal.js --force      # Reinstall even if already installed
 *
 * After installing, run `claude` in any project. The hooks run silently in the
 * background on every session.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Config ───────────────────────────────────────────────────────────────────

const REPO_DIR      = __dirname;
const HOME_DIR      = os.homedir();
const CLAUDE_DIR    = path.join(HOME_DIR, '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const SESSIONS_DIR  = path.join(CLAUDE_DIR, 'sessions');

// Tag injected into settings.json so we can identify and remove our entries
const MINIMAL_TAG = '__omnissiah_minimal__';

// ─── Terminal helpers ─────────────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';

function ok(msg)   { console.log(`${GREEN}  ✓${RESET}  ${msg}`); }
function info(msg) { console.log(`${CYAN}  ℹ${RESET}  ${msg}`); }
function warn(msg) { console.log(`${YELLOW}  ⚠${RESET}  ${msg}`); }
function err(msg)  { console.error(`${RED}  ✗${RESET}  ${msg}`); }
function head(msg) { console.log(`\n${BOLD}${msg}${RESET}`); }

// ─── Settings helpers ─────────────────────────────────────────────────────────

function readSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  const raw = fs.readFileSync(SETTINGS_PATH, 'utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`~/.claude/settings.json contains invalid JSON: ${e.message}\nFix the file manually before running this installer.`);
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function backupSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return null;
  const bak = `${SETTINGS_PATH}.backup.${Date.now()}`;
  fs.copyFileSync(SETTINGS_PATH, bak);
  info(`Backed up existing settings → ${bak}`);
  return bak;
}

// ─── Hook definitions ─────────────────────────────────────────────────────────

/**
 * Returns the minimal hook entries with absolute paths resolved.
 * Each entry carries the MINIMAL_TAG marker so we can find and remove them later.
 */
function buildMinimalHooks(repoPath) {
  // Use forward slashes everywhere — Node.js accepts them on Windows too
  const repo = repoPath.replace(/\\/g, '/');

  return {
    PreToolUse: [
      {
        matcher: 'Bash',
        description: '[omnissiah-minimal] Block commits containing secrets — AWS keys, API tokens, passwords',
        [MINIMAL_TAG]: true,
        hooks: [{ type: 'command', command: `node ${repo}/scripts/hooks/bash-pre-secret-check.js` }],
      },
    ],
    SessionStart: [
      {
        matcher: '*',
        description: '[omnissiah-minimal] Session start — records session start timestamp',
        [MINIMAL_TAG]: true,
        hooks: [{ type: 'command', command: `node ${repo}/scripts/hooks/session-start-minimal.js` }],
      },
    ],
    SessionEnd: [
      {
        matcher: '*',
        description: '[omnissiah-minimal] Persist session state on exit',
        [MINIMAL_TAG]: true,
        hooks: [{ type: 'command', command: `node ${repo}/scripts/hooks/session-end.js` }],
      },
    ],
  };
}

// ─── Check whether minimal hooks are already installed ────────────────────────

function getMinimalHooks(settings) {
  if (!settings.hooks) return [];
  const found = [];
  for (const [event, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry[MINIMAL_TAG]) found.push({ event, entry });
    }
  }
  return found;
}

function isInstalled(settings) {
  return getMinimalHooks(settings).length > 0;
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

function mergeHooks(settings, minimalHooks) {
  if (!settings.hooks) settings.hooks = {};

  for (const [event, entries] of Object.entries(minimalHooks)) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }
    for (const entry of entries) {
      // Avoid duplicates: skip if an entry with the same command already exists
      const cmd = entry.hooks[0].command;
      const alreadyPresent = settings.hooks[event].some(
        e => Array.isArray(e.hooks) && e.hooks.some(h => h.command === cmd)
      );
      if (!alreadyPresent) {
        settings.hooks[event].push(entry);
      }
    }
  }

  return settings;
}

function removeHooks(settings) {
  if (!settings.hooks) return settings;
  for (const event of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[event])) continue;
    settings.hooks[event] = settings.hooks[event].filter(e => !e[MINIMAL_TAG]);
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return settings;
}

// ─── Directory setup ──────────────────────────────────────────────────────────

function createDirs() {
  const dirs = [
    CLAUDE_DIR,
    SESSIONS_DIR,
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Validate hook scripts exist ──────────────────────────────────────────────

function validateScripts(repoPath) {
  const required = [
    'scripts/hooks/bash-pre-secret-check.js',
    'scripts/hooks/session-start-minimal.js',
    'scripts/hooks/session-end.js',
  ];
  const missing = required.filter(f => !fs.existsSync(path.join(repoPath, f)));
  if (missing.length > 0) {
    throw new Error(
      `Missing hook scripts in ${repoPath}:\n` +
      missing.map(f => `  ${f}`).join('\n') +
      '\n\nEnsure you are running this from the omnissiah repo root.'
    );
  }
}

// ─── session-start-minimal.js fallback (lightweight, no full banner) ──────────

function writeMinimalSessionStart(repoPath) {
  const dest = path.join(repoPath, 'scripts/hooks/session-start-minimal.js');
  if (fs.existsSync(dest)) return; // already shipped with the repo

  const content = `#!/usr/bin/env node
/**
 * session-start-minimal.js — Lightweight SessionStart hook for minimal installs.
 * Records session start timestamp. No banner, no health check.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
fs.mkdirSync(sessionsDir, { recursive: true });

const sessionId  = process.env.CLAUDE_SESSION_ID || 'unknown';
const now        = new Date().toISOString();
const logEntry   = JSON.stringify({ event: 'session_start', session_id: sessionId, timestamp: now }) + '\\n';
const logFile    = path.join(sessionsDir, 'session-events.jsonl');

try {
  fs.appendFileSync(logFile, logEntry, 'utf8');
} catch {
  // Non-fatal — session tracking is best-effort
}

console.log('[omnissiah] Session started — hygiene hooks active (secrets, session tracking)');
`;

  fs.writeFileSync(dest, content, 'utf8');
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdCheck() {
  head('omnissiah Minimal Install — Status Check');

  let settings;
  try { settings = readSettings(); } catch (e) { err(e.message); process.exit(1); }

  const found = getMinimalHooks(settings);
  if (found.length === 0) {
    warn('No omnissiah minimal hooks installed.');
    info('Run: node install-minimal.js');
    return;
  }

  ok(`${found.length} omnissiah hook(s) installed:`);
  for (const { event, entry } of found) {
    const cmd = entry.hooks[0]?.command || '?';
    console.log(`     ${CYAN}[${event}]${RESET} ${entry.description.replace('[omnissiah-minimal] ', '')}`);
    console.log(`            ${cmd}`);
  }

  // Session events
  const eventsFile = path.join(SESSIONS_DIR, 'session-events.jsonl');
  if (fs.existsSync(eventsFile)) {
    const lines = fs.readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean);
    ok(`Session events: ${lines.length} recorded → ${eventsFile}`);
  } else {
    info('Session events: not yet created (will appear after first session)');
  }
}

function cmdInstall(force) {
  head('omnissiah Minimal Install');

  // Validate repo integrity
  try {
    validateScripts(REPO_DIR);
  } catch (e) {
    err(e.message);
    process.exit(1);
  }

  let settings;
  try { settings = readSettings(); } catch (e) { err(e.message); process.exit(1); }

  if (isInstalled(settings) && !force) {
    warn('omnissiah minimal hooks are already installed.');
    info('Use --force to reinstall, or --check to see current status.');
    process.exit(0);
  }

  // Create directory structure
  createDirs();
  ok('Directory structure ready');

  // Write minimal session-start script if the repo does not already ship it
  try {
    writeMinimalSessionStart(REPO_DIR);
    ok('Minimal session-start hook ready');
  } catch (e) {
    warn(`Could not write session-start-minimal.js: ${e.message} (non-fatal)`);
  }

  // Back up settings before modifying
  backupSettings();

  // Merge hooks
  if (force) settings = removeHooks(settings);
  const minimalHooks = buildMinimalHooks(REPO_DIR);
  mergeHooks(settings, minimalHooks);

  try {
    writeSettings(settings);
  } catch (e) {
    err(`Failed to write settings: ${e.message}`);
    process.exit(1);
  }

  console.log('');
  ok('Installed hooks:');
  console.log(`
     ${CYAN}[PreToolUse / Bash]${RESET}    Secret detection   — blocks AWS keys, API tokens, passwords
     ${CYAN}[SessionStart / *]${RESET}     Session tracking   — records session start timestamps
     ${CYAN}[SessionEnd / *]${RESET}       Session state      — persists session data on exit
  `);

  console.log(`${BOLD}What was NOT changed:${RESET}`);
  console.log(`     Your CLAUDE.md, skills, agents, commands, and plugin config are untouched.\n`);

  console.log(`${BOLD}Data location:${RESET}`);
  console.log(`     Session events:     ${SESSIONS_DIR}/session-events.jsonl`);
  console.log(`     Session files:      ${SESSIONS_DIR}/<date>-<id>-session.tmp\n`);

  console.log(`${GREEN}${BOLD}  Done. Start a Claude session to activate.${RESET}\n`);
}

function cmdUninstall() {
  head('omnissiah Minimal Install — Uninstall');

  let settings;
  try { settings = readSettings(); } catch (e) { err(e.message); process.exit(1); }

  if (!isInstalled(settings)) {
    info('No omnissiah minimal hooks found. Nothing to remove.');
    return;
  }

  backupSettings();
  removeHooks(settings);

  try {
    writeSettings(settings);
    ok('omnissiah minimal hooks removed from settings.json');
    info('Your data files are preserved:');
    info(`  ${SESSIONS_DIR}/session-events.jsonl`);
  } catch (e) {
    err(`Failed to write settings: ${e.message}`);
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const has  = flag => args.includes(flag);

  if (has('--help') || has('-h')) {
    console.log(`
${BOLD}install-minimal.js${RESET} — omnissiah (Minimal Install)

Installs a small set of generic hygiene hooks into your existing Claude Code
setup without touching your CLAUDE.md, skills, agents, commands, or plugin config.

${BOLD}Usage:${RESET}
  node install-minimal.js              Install minimal hooks
  node install-minimal.js --check      Show installation status
  node install-minimal.js --uninstall  Remove installed hooks
  node install-minimal.js --force      Reinstall (overwrites existing)

${BOLD}What gets installed:${RESET}
  Secret detection   Blocks AWS keys, API tokens, and passwords in commits
  Session tracking   Records session start/end timestamps

${BOLD}What does NOT change:${RESET}
  Your CLAUDE.md, skills, agents, commands, plugin.json — all untouched.
    `);
    return;
  }

  if (has('--check'))     { cmdCheck();              return; }
  if (has('--uninstall')) { cmdUninstall();           return; }

  cmdInstall(has('--force'));
}

main();

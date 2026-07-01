#!/usr/bin/env node
/**
 * codex-sync.js — Refresh the Codex plugin cache from this repo.
 *
 * Codex caches a local plugin as a snapshot at install time, so edits to the
 * repo (agents, commands, skills, hooks, scripts) are not visible until the
 * plugin is re-added. `codex plugin add omnissiah@omnissiah` re-copies the
 * current source into the cache in place, which is all this does.
 *
 * Behaviour:
 *   - No-op (exit 0) if the codex CLI is not installed.
 *   - No-op (exit 0) if the omnissiah plugin is NOT already installed in Codex.
 *     Installing is explicit and left to `codex-setup.js`; this script only
 *     keeps an existing install fresh, so it never installs behind the user's
 *     back or when run from a machine that does not use Codex.
 *   - NEVER exits non-zero. It is wired into git hooks; a failure here must not
 *     abort a `git pull`/`rebase`/`checkout`. Problems are reported on stderr.
 *
 * Usage: node scripts/codex-sync.js [--quiet]
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGIN_ID = 'omnissiah@omnissiah';
const quiet = process.argv.includes('--quiet');

function log(msg) {
  if (!quiet) process.stdout.write(`[codex-sync] ${msg}\n`);
}
function warn(msg) {
  process.stderr.write(`[codex-sync] ${msg}\n`);
}
function codex(args) {
  return spawnSync('codex', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// 1. Is the codex CLI available?
const version = codex(['--version']);
if (version.error || version.status !== 0) {
  log('codex CLI not found; nothing to sync.');
  process.exit(0);
}

// 2. Is the omnissiah plugin already installed? Only then do we refresh.
const list = codex(['plugin', 'list', '--json']);
let installed = false;
try {
  const data = JSON.parse(list.stdout || '{}');
  installed = (data.installed || []).some(p => p.pluginId === PLUGIN_ID);
} catch {
  warn('could not parse `codex plugin list --json`; skipping.');
  process.exit(0);
}
if (!installed) {
  log('omnissiah plugin is not installed in Codex; run `npm run codex:setup` first. Skipping.');
  process.exit(0);
}

// 3. Refresh the cache from the registered marketplace source.
const refresh = codex(['plugin', 'add', PLUGIN_ID]);
if (refresh.status !== 0) {
  warn('refresh failed:\n' + (refresh.stderr || refresh.stdout || '(no output)').trim());
  process.exit(0); // deliberately non-fatal for git-hook use
}
log(`omnissiah Codex plugin refreshed (source: ${REPO_ROOT}).`);
process.exit(0);

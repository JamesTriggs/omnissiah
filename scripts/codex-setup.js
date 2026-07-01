#!/usr/bin/env node
/**
 * codex-setup.js — One-time setup to use omnissiah inside the OpenAI Codex CLI.
 *
 * Steps (all idempotent):
 *   1. Register this repo as a Codex plugin marketplace.
 *   2. Install (or refresh) the omnissiah plugin.
 *   3. Point git `core.hooksPath` at scripts/git-hooks so that future repo
 *      updates (pull, rebase, branch checkout) auto-refresh the Codex cache
 *      via codex-sync.js.
 *
 * Run once per machine: `npm run codex:setup`.
 * Requires the codex CLI (`brew install codex`).
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGIN_ID = 'omnissiah@omnissiah';
const HOOKS_PATH = 'scripts/git-hooks';

function codex(args) {
  return spawnSync('codex', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function git(args) {
  return spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function done(msg) {
  process.stdout.write(`[codex-setup] ${msg}\n`);
}
function fail(msg) {
  process.stderr.write(`[codex-setup] ${msg}\n`);
  process.exit(1);
}

// Precondition: codex CLI present.
const version = codex(['--version']);
if (version.error || version.status !== 0) {
  fail('codex CLI not found. Install it first, e.g. `brew install codex`, then re-run.');
}

// 1. Register the marketplace (idempotent — "already added" is fine).
let r = codex(['plugin', 'marketplace', 'add', REPO_ROOT]);
if (r.status !== 0 && !/already added/i.test(r.stderr || '')) {
  fail('failed to register marketplace:\n' + (r.stderr || r.stdout || '').trim());
}
done('marketplace registered.');

// 2. Install / refresh the plugin.
r = codex(['plugin', 'add', PLUGIN_ID]);
if (r.status !== 0) {
  fail('failed to install plugin:\n' + (r.stderr || r.stdout || '').trim());
}
done('plugin installed.');

// 3. Enable auto-sync git hooks.
const current = (git(['config', '--get', 'core.hooksPath']).stdout || '').trim();
if (current === HOOKS_PATH) {
  done('git hooks already configured for auto-sync.');
} else {
  const set = git(['config', 'core.hooksPath', HOOKS_PATH]);
  if (set.status === 0) {
    done(`git core.hooksPath set to ${HOOKS_PATH} (auto-refresh on pull/rebase/checkout).`);
    if (current) {
      process.stderr.write(`[codex-setup] note: previous core.hooksPath "${current}" was overridden.\n`);
    }
  } else {
    process.stderr.write('[codex-setup] warning: could not set core.hooksPath; auto-sync disabled. Use `npm run codex:sync` manually.\n');
  }
}

done('done. Run `npm run codex:sync` any time for an immediate refresh.');

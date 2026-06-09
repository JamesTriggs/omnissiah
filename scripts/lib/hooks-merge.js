#!/usr/bin/env node
'use strict';

/**
 * hooks-merge.js — idempotent merge of framework hooks into user settings.json
 *
 * Why this exists:
 *   Claude Code loads hooks from ~/.claude/settings.json. The framework ships
 *   its authoritative hook list in hooks/hooks.json. A naive install would
 *   either (a) refuse when user hooks already exist (leaves framework hooks
 *   dormant — this was the old behaviour, which is how consumers ended up with
 *   no memory system) or (b) overwrite them (destroys user customisations).
 *
 *   This module does neither. It adds any framework hook whose command is not
 *   already present under its event, preserving everything else verbatim.
 *
 * Dedup key:
 *   The exact command string after ${CLAUDE_PLUGIN_ROOT} resolution. Two hooks
 *   with different commands but the same matcher are treated as distinct.
 *
 * Guarantees:
 *   - Running twice in a row is a no-op (idempotent).
 *   - No user hook is ever removed.
 *   - Non-hook settings (model, mcpServers, permissions, env) are untouched.
 *   - Adding a new hook to hooks.json rolls it out to every existing consumer
 *     the next time install.sh or install.js runs.
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {object} userSettings  Parsed contents of ~/.claude/settings.json (or {}).
 * @param {object} frameworkHooks  Parsed contents of hooks/hooks.json (has top-level .hooks).
 * @param {string} pluginRoot  Absolute path used to replace ${CLAUDE_PLUGIN_ROOT}.
 * @returns {{settings: object, added: Array<{event: string, matcher: string, command: string}>}}
 */
function mergeHooks(userSettings, frameworkHooks, pluginRoot) {
  if (!pluginRoot || typeof pluginRoot !== 'string') {
    throw new Error('mergeHooks: pluginRoot is required');
  }

  const out = userSettings ? JSON.parse(JSON.stringify(userSettings)) : {};
  if (!out.hooks || typeof out.hooks !== 'object') out.hooks = {};

  const fhooks = (frameworkHooks && frameworkHooks.hooks) || {};
  const added = [];

  const resolve = (cmd) =>
    typeof cmd === 'string'
      ? cmd.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot)
      : cmd;

  for (const [event, frameworkGroups] of Object.entries(fhooks)) {
    if (!Array.isArray(frameworkGroups)) continue;
    if (!Array.isArray(out.hooks[event])) out.hooks[event] = [];

    // Collect existing command strings under this event, normalising each the
    // same way we normalise framework commands. Without this, an existing user
    // entry written in plugin-placeholder form (`node ${CLAUDE_PLUGIN_ROOT}/x.js`,
    // which Claude Code auto-loads from hooks/hooks.json) would not match the
    // resolved framework form (`node /abs/path/x.js`) and we would duplicate
    // every plugin-installed hook on merge.
    const existing = new Set();
    for (const g of out.hooks[event]) {
      if (!g || !Array.isArray(g.hooks)) continue;
      for (const h of g.hooks) {
        if (h && typeof h.command === 'string') existing.add(resolve(h.command));
      }
    }

    for (const group of frameworkGroups) {
      if (!group || !Array.isArray(group.hooks)) continue;
      const matcher = group.matcher;
      const description = group.description;

      for (const hook of group.hooks) {
        if (!hook || typeof hook.command !== 'string') continue;
        const resolvedCmd = resolve(hook.command);
        if (existing.has(resolvedCmd)) continue;

        const entry = {
          matcher,
          ...(description ? { description } : {}),
          hooks: [{
            type: hook.type || 'command',
            command: resolvedCmd,
          }],
        };
        out.hooks[event].push(entry);
        existing.add(resolvedCmd);
        added.push({ event, matcher, command: resolvedCmd });
      }
    }
  }

  return { settings: out, added };
}

function countHookCommands(hooks) {
  let n = 0;
  if (!hooks) return 0;
  for (const groups of Object.values(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      if (g && Array.isArray(g.hooks)) n += g.hooks.length;
    }
  }
  return n;
}

function mergeFromFiles(settingsPath, pluginRoot, frameworkHooksPath, { backup = true } = {}) {
  let userSettings = {};
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    if (raw.trim()) {
      try {
        userSettings = JSON.parse(raw);
      } catch (e) {
        throw new Error(`Failed to parse ${settingsPath}: ${e.message}`);
      }
    }
  }

  const frameworkHooks = JSON.parse(fs.readFileSync(frameworkHooksPath, 'utf8'));
  const beforeCount = countHookCommands(userSettings.hooks);
  const { settings, added } = mergeHooks(userSettings, frameworkHooks, pluginRoot);
  const afterCount = countHookCommands(settings.hooks);

  if (added.length > 0) {
    if (backup && fs.existsSync(settingsPath)) {
      const backupPath = `${settingsPath}.backup.${Date.now()}`;
      fs.copyFileSync(settingsPath, backupPath);
    }
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return { added, beforeCount, afterCount };
}

module.exports = { mergeHooks, mergeFromFiles, countHookCommands };

// CLI entry point
if (require.main === module) {
  const [settingsPath, pluginRoot, frameworkHooksPath] = process.argv.slice(2);
  if (!settingsPath || !pluginRoot) {
    console.error('Usage: hooks-merge.js <settings.json> <pluginRoot> [hooks.json]');
    process.exit(2);
  }
  const hooksPath = frameworkHooksPath || path.join(pluginRoot, 'hooks', 'hooks.json');
  try {
    const { added, beforeCount, afterCount } = mergeFromFiles(settingsPath, pluginRoot, hooksPath);
    if (added.length === 0) {
      console.log(`hooks-merge: ${settingsPath} already up to date (${afterCount} hook commands)`);
    } else {
      console.log(`hooks-merge: added ${added.length} new hook(s) (${beforeCount} → ${afterCount})`);
      for (const a of added) {
        console.log(`  + [${a.event}] ${a.matcher}: ${a.command.slice(0, 80)}${a.command.length > 80 ? '…' : ''}`);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error(`hooks-merge: ${e.message}`);
    process.exit(1);
  }
}

#!/usr/bin/env node
/**
 * observe.js — Continuous Learning v2 Observation Hook (Cross-Platform)
 *
 * Captures tool-use events for pattern analysis.
 * Claude Code passes hook data via stdin as JSON.
 *
 * Equivalent to observe.sh — works on Windows, macOS, and Linux.
 *
 * Hook config (in ~/.claude/settings.json):
 *
 * If installed as a plugin, use ${CLAUDE_PLUGIN_ROOT}:
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "*",
 *       "hooks": [{ "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/skills/continuous-learning-v2/hooks/observe.js" }]
 *     }],
 *     "PostToolUse": [{
 *       "matcher": "*",
 *       "hooks": [{ "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/skills/continuous-learning-v2/hooks/observe.js" }]
 *     }]
 *   }
 * }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'homunculus');
const OBSERVATIONS_FILE = path.join(CONFIG_DIR, 'observations.jsonl');
const MAX_FILE_SIZE_MB = 10;

// Ensure directory exists — exit cleanly if it can't be created rather than crashing
try {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
} catch (err) {
  process.stderr.write(`[HOOK] WARNING: could not create config dir ${CONFIG_DIR}: ${err.message}\n`);
  process.exit(0);
}

// Skip if disabled
if (fs.existsSync(path.join(CONFIG_DIR, 'disabled'))) {
  process.exit(0);
}

// Read JSON from stdin
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  if (!data.trim()) process.exit(0);

  let input;
  try {
    input = JSON.parse(data);
  } catch {
    // Log raw input for debugging
    const timestamp = new Date().toISOString();
    const raw = JSON.stringify(data.slice(0, 1000));
    try {
      fs.appendFileSync(OBSERVATIONS_FILE, JSON.stringify({ timestamp, event: 'parse_error', raw }) + '\n', 'utf8');
    } catch { /* disk full or unwritable — exit silently */ }
    process.exit(0);
  }

  // Parse fields from Claude Code hook format
  const hookType = input.hook_type || 'unknown';
  const toolName = input.tool_name || input.tool || 'unknown';
  const toolInput = input.tool_input || input.input || {};
  const toolOutput = input.tool_output || input.output || '';
  const sessionId = input.session_id || 'unknown';

  // Truncate large inputs/outputs
  const inputStr = (typeof toolInput === 'object'
    ? JSON.stringify(toolInput)
    : String(toolInput)).slice(0, 5000);
  const outputStr = (typeof toolOutput === 'object'
    ? JSON.stringify(toolOutput)
    : String(toolOutput)).slice(0, 5000);

  const event = hookType.includes('Pre') ? 'tool_start' : 'tool_complete';

  // Archive if file too large
  if (fs.existsSync(OBSERVATIONS_FILE)) {
    const stats = fs.statSync(OBSERVATIONS_FILE);
    const sizeMb = stats.size / (1024 * 1024);
    if (sizeMb >= MAX_FILE_SIZE_MB) {
      const archiveDir = path.join(CONFIG_DIR, 'observations.archive');
      fs.mkdirSync(archiveDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.renameSync(OBSERVATIONS_FILE, path.join(archiveDir, `observations-${stamp}.jsonl`));
    }
  }

  // Build and write observation
  const observation = {
    timestamp: new Date().toISOString(),
    event,
    tool: toolName,
    session: sessionId,
  };
  if (event === 'tool_start') observation.input = inputStr;
  if (event === 'tool_complete') observation.output = outputStr;

  try {
    fs.appendFileSync(OBSERVATIONS_FILE, JSON.stringify(observation) + '\n', 'utf8');
  } catch { /* disk full or unwritable — exit silently rather than crashing the session */ }

  // Note: SIGUSR1 signaling to observer process is Unix-only.
  // The observer polls the file every 5 minutes instead (see start-observer.js).

  process.exit(0);
});

/**
 * harness-enforce.js — Secondary safety net for harness engineering methodology.
 *
 * PRIMARY enforcement is via agent frontmatter tool restrictions:
 *   harness-orchestrator: tools: ["Read", "Grep", "Glob", "Agent"]  — no Write/Edit/Bash
 *   harness-lead:         tools: ["Read", "Grep", "Glob", "Agent"]  — no Write/Edit/Bash
 *
 * This hook provides a WARNING (non-blocking) when Write or Edit is called during
 * what appears to be an orchestrator/lead context — detectable by session state.
 *
 * It runs as a PreToolUse hook on Write and Edit tool calls.
 *
 * Exit codes:
 *   0 = allow (no stdout output)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Check whether the current session has an active harness session marker.
 * harness-orchestrator writes this marker when it starts, removes it when done.
 */
function isHarnessSession() {
  try {
    const markerPath = path.join(os.homedir(), '.claude', 'harness-session.json');
    if (!fs.existsSync(markerPath)) return { active: false };
    const data = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    // Marker expires after 4 hours to avoid stale state
    const age = Date.now() - (data.startedAt || 0);
    if (age > 4 * 60 * 60 * 1000) return { active: false };
    return { active: true, role: data.role || 'unknown', task: data.task || '' };
  } catch {
    return { active: false };
  }
}

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const toolName = input.tool_name || input.toolName || '';
    const filePath = (input.tool_input && input.tool_input.file_path) || input.file_path || input.path || '';

    // Only act on Write and Edit tool calls
    if (!['Write', 'Edit'].includes(toolName)) {
      process.exit(0);
      return;
    }

    const session = isHarnessSession();

    if (session.active && (session.role === 'orchestrator' || session.role === 'lead')) {
      // This should never happen due to frontmatter tool restrictions,
      // but if it does — warn loudly without blocking (to avoid breaking real work).
      process.stderr.write(
        `[HARNESS] WARNING: ${session.role} attempted to write "${filePath}".\n` +
        `[HARNESS] Orchestrators and leads delegate file writes to workers.\n` +
        `[HARNESS] If this is intentional (worker unavailable), this is allowed — but check your team setup.\n`
      );
      // Allow — the warning is informational. Blocking here would break fallback behaviour
      // where leads step in when workers fail (a legitimate harness pattern).
    }
  } catch {
    // Allow on any error
  }
  process.exit(0);
});

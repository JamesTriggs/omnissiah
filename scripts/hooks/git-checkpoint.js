/**
 * git-checkpoint.js — PreToolUse hook for Bash commands.
 *
 * Before destructive git/file operations, creates a git stash checkpoint
 * so /checkpoint can offer rollback. Stores the stash ref in
 * ~/.claude/checkpoints/last-stash-ref for the checkpoint command to use.
 *
 * Triggers on: git commit, git reset, git checkout (with --), git rebase,
 *              git merge, git stash drop/pop/clear.
 *
 * Does NOT block — always allows the command to proceed after stashing.
 *
 * Exit codes:
 *   0 = allow (no stdout output)
 *
 * NOTE: Currently disabled in hooks.json pending investigation of runtime
 * behaviour on Windows. Script is preserved here for future re-enabling.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Patterns that indicate destructive git operations worth checkpointing
const DESTRUCTIVE_PATTERNS = [
  /git\s+commit/,
  /git\s+reset/,
  /git\s+checkout\s+--/,
  /git\s+checkout\s+\./,
  /git\s+rebase/,
  /git\s+merge/,
  /git\s+stash\s+(drop|pop|clear)/,
  /git\s+clean/,
  /git\s+restore\s+--staged/,
  /git\s+restore\s+\./
];

function isDestructive(cmd) {
  return DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(cmd));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const cmd = (input.tool_input && input.tool_input.command) || input.command || '';

    if (!isDestructive(cmd)) {
      process.exit(0);
      return;
    }

    // Attempt to create a stash checkpoint
    try {
      const stashRef = execSync('git stash create', {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (stashRef) {
        // Store the ref for /checkpoint rollback
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const checkpointsDir = path.join(homeDir, '.claude', 'checkpoints');
        ensureDir(checkpointsDir);

        const refFile = path.join(checkpointsDir, 'last-stash-ref');
        const timestamp = new Date().toISOString();
        const entry = `${timestamp} | ${stashRef} | before: ${cmd.substring(0, 80)}\n`;

        // Append to history and write latest ref
        fs.appendFileSync(path.join(checkpointsDir, 'stash-history.log'), entry);
        fs.writeFileSync(refFile, stashRef);

        process.stderr.write(`[HOOK] Checkpoint created: ${stashRef.substring(0, 8)} (before ${cmd.substring(0, 60)})\n`);
      }
      // If stashRef is empty, there are no changes to stash — that's fine
    } catch (e) {
      // git stash create failed — probably not in a git repo or no changes.
      // Non-fatal: allow the command to proceed.
    }
  } catch (e) {
    // JSON parse error or unexpected — allow the command
  }
  process.exit(0);
});

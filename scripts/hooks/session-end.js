#!/usr/bin/env node
/**
 * Stop Hook (Session End) - Persist learnings when session ends
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs when Claude session ends. Creates/updates session log file
 * with timestamp for continuity tracking.
 */

const path = require('path');
const fs = require('fs');
const {
  getSessionsDir,
  getDateString,
  getTimeString,
  getSessionIdShort,
  ensureDir,
  writeFile,
  replaceInFile,
  log
} = require('../lib/utils');

// Dual-threshold limits (from Claude Code's MEMORY.md truncation pattern).
// Both limits are checked independently — whichever fires first warns the user.
const SESSION_LINE_LIMIT = 200;
const SESSION_BYTE_LIMIT = 25 * 1024; // 25 KB

/**
 * Warn when a session file exceeds line OR byte limits.
 * Long lines are the classic failure mode (one huge line can bust the line limit
 * before bytes fill), so both thresholds are needed.
 */
function checkSessionFileLimits(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    const bytes = Buffer.byteLength(content, 'utf8');
    if (lines > SESSION_LINE_LIMIT || bytes > SESSION_BYTE_LIMIT) {
      log(`[SessionEnd] WARNING: session file exceeds limits — ${lines} lines (limit ${SESSION_LINE_LIMIT}), ${bytes} bytes (limit ${SESSION_BYTE_LIMIT})`);
      log(`[SessionEnd] Consider archiving old session notes to keep context lean.`);
    }
  } catch {
    // Non-fatal — file may have just been created
  }
}

async function main() {
  const sessionsDir = getSessionsDir();
  const today = getDateString();
  const shortId = getSessionIdShort();
  // Include session ID in filename for unique per-session tracking
  const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);

  ensureDir(sessionsDir);

  const currentTime = getTimeString();

  // If session file exists for today, update the end time
  if (fs.existsSync(sessionFile)) {
    const success = replaceInFile(
      sessionFile,
      /\*\*Last Updated:\*\*.*/,
      `**Last Updated:** ${currentTime}`
    );

    if (success) {
      log(`[SessionEnd] Updated session file: ${sessionFile}`);
    }
  } else {
    // Create new session file with template
    const template = `# Session: ${today}
**Date:** ${today}
**Started:** ${currentTime}
**Last Updated:** ${currentTime}

---

## Current State

[Session context goes here]

### Completed
- [ ]

### In Progress
- [ ]

### Notes for Next Session
-

### Context to Load
\`\`\`
[relevant files]
\`\`\`
`;

    writeFile(sessionFile, template);
    log(`[SessionEnd] Created session file: ${sessionFile}`);
  }

  // Enforce dual-threshold limits on the session file
  checkSessionFileLimits(sessionFile);

  process.exit(0);
}

main().catch(err => {
  console.error('[SessionEnd] Error:', err.message);
  process.exit(0);
});

/**
 * bash-pre-secret-check.js — PreToolUse hook for Bash commands.
 *
 * Detects potential secrets in git staged diff before commit.
 * Runs only on git add/commit commands.
 *
 * Exit codes:
 *   0 = allow (no stdout output)
 *   2 = block (reason written to stderr)
 */

'use strict';

const { spawnSync } = require('child_process');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const cmd = (input.tool_input && input.tool_input.command) || input.command || '';

    if (!/git\s+(add|commit)/.test(cmd)) {
      process.exit(0);
      return;
    }

    // Single git call — no shell involved, works correctly on Windows
    const result = spawnSync('git', ['diff', '--cached', '--diff-filter=ACM'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (result.error) {
      // git binary not found — skip silently
      process.stderr.write('[HOOK] WARNING: git not found — secret check skipped\n');
      process.exit(0);
      return;
    }

    if (result.status !== 0) {
      // git ran but exited non-zero (not a repo, permission error, corrupt repo, etc.)
      const errMsg = (result.stderr || '').trim().split('\n')[0];
      process.stderr.write(`[HOOK] WARNING: git diff failed (exit ${result.status}: ${errMsg}) — secret check skipped\n`);
      process.exit(0);
      return;
    }

    // Filter to added lines only (lines starting with '+' but not '+++' header)
    const addedLines = (result.stdout || '')
      .split('\n')
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .join('\n');

    // Patterns for high-confidence secrets — avoid generic variable names that cause false positives
    const patterns = [
      /AKIA[0-9A-Z]{10,}/,                          // AWS Access Key
      /ASIA[0-9A-Z]{10,}/,                          // AWS STS key
      /sk-ant-[A-Za-z0-9_-]{20,}/,                  // Anthropic API keys (sk-ant-api03-...)
      /sk-[A-Za-z0-9]{32,}/,                        // Other sk- prefixed tokens (32+ chars)
      /password\s*=\s*["'][^"']{8,}/i,              // password = "value" (require quoted value)
      /api_key\s*=\s*["'][^"']{8,}/i,               // api_key = "value" (require quoted value)
      /secret_key\s*=\s*["'][^"']{8,}/i,            // secret_key = "value"
      /ghp_[A-Za-z0-9]{36,}/,                       // GitHub personal access tokens
      /gho_[A-Za-z0-9]{36,}/,                       // GitHub OAuth tokens
      /glpat-[A-Za-z0-9_-]{10,}/,                   // GitLab personal access tokens
      /xoxb-[A-Za-z0-9-]{20,}/,                      // Slack bot tokens
      /xoxp-[A-Za-z0-9-]{20,}/,                      // Slack user tokens
    ];

    const matched = patterns.filter(p => p.test(addedLines));

    if (matched.length > 0) {
      process.stderr.write('[HOOK] BLOCKED: Potential secrets detected in staged diff. Remove credentials before committing.\n');
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (e) {
    process.stderr.write(`[HOOK] WARNING: secret check errored (${e.message}) — skipping\n`);
    process.exit(0);
  }
});

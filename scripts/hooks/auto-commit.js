#!/usr/bin/env node
/**
 * auto-commit.js — SessionEnd hook.
 *
 * Checks for uncommitted changes when a session ends. If changes exist,
 * logs a reminder with a suggested commit command. Does NOT auto-commit —
 * respects the user preference to run git commands themselves.
 *
 * The suggested commit message is derived from the list of changed files.
 *
 * Cross-platform (Windows, macOS, Linux).
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function log(msg) {
  process.stderr.write(msg + '\n');
}

function getGitStatus() {
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return status;
  } catch {
    return null;  // Not in a git repo or git not available
  }
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch {
    return 'unknown';
  }
}

function summariseChanges(status) {
  const lines = status.split('\n').filter(Boolean);
  const added = lines.filter(l => l.startsWith('?') || l.startsWith('A')).length;
  const modified = lines.filter(l => l.startsWith('M') || l.startsWith(' M')).length;
  const deleted = lines.filter(l => l.startsWith('D') || l.startsWith(' D')).length;

  const parts = [];
  if (added > 0) parts.push(`${added} new`);
  if (modified > 0) parts.push(`${modified} modified`);
  if (deleted > 0) parts.push(`${deleted} deleted`);

  return parts.join(', ') || `${lines.length} changed`;
}

function suggestCommitMessage(status) {
  const lines = status.split('\n').filter(Boolean);
  // Extract file names
  const files = lines.map(l => l.substring(3).trim().replace(/^"(.*)"$/, '$1'));

  // Find common directory prefix
  const dirs = [...new Set(files.map(f => path.dirname(f)).filter(d => d !== '.'))];

  if (dirs.length === 1) {
    return `update ${dirs[0]} (session work)`;
  } else if (dirs.length <= 3) {
    return `update ${dirs.join(', ')} (session work)`;
  } else {
    return `session work: ${summariseChanges(status)}`;
  }
}

async function main() {
  const status = getGitStatus();

  // No git repo or no changes — nothing to do
  if (!status) {
    process.exit(0);
    return;
  }

  const branch = getCurrentBranch();
  const summary = summariseChanges(status);
  const suggestedMsg = suggestCommitMessage(status);

  log('');
  log('[AutoCommit] Uncommitted changes detected at session end:');
  log(`[AutoCommit]   Branch: ${branch}`);
  log(`[AutoCommit]   Changes: ${summary}`);
  log('[AutoCommit]');
  log('[AutoCommit] To commit these changes, run:');
  log(`[AutoCommit]   git add -A && git commit -m "${suggestedMsg}"`);
  log('');

  process.exit(0);
}

main().catch(err => {
  // Non-fatal — never crash the session on hook error
  process.exit(0);
});

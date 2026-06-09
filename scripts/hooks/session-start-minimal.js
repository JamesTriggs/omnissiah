#!/usr/bin/env node
/**
 * session-start-minimal.js — Lightweight SessionStart hook for minimal installs.
 * Records session start timestamp for session tracking. No banner, no health check.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
fs.mkdirSync(sessionsDir, { recursive: true });

const sessionId  = process.env.CLAUDE_SESSION_ID || 'unknown';
const now        = new Date().toISOString();
const logEntry   = JSON.stringify({ event: 'session_start', session_id: sessionId, timestamp: now }) + '\n';
const logFile    = path.join(sessionsDir, 'session-events.jsonl');

try {
  fs.appendFileSync(logFile, logEntry, 'utf8');
} catch {
  // Non-fatal — session tracking is best-effort
}

// Emit minimal context hint
console.log(`[Session] Session started — hygiene hooks active (secrets, session tracking)`);

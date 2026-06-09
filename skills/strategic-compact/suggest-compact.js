#!/usr/bin/env node
/**
 * suggest-compact.js — Strategic Compact Suggester (Cross-Platform)
 *
 * Equivalent to suggest-compact.sh — works on Windows, macOS, and Linux.
 * Delegates to the shared scripts/hooks/suggest-compact.js implementation.
 *
 * Hook config (in ~/.claude/settings.json):
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Edit|Write",
 *       "hooks": [{
 *         "type": "command",
 *         "command": "node ${CLAUDE_PLUGIN_ROOT}/skills/strategic-compact/suggest-compact.js"
 *       }]
 *     }]
 *   }
 * }
 */

'use strict';

const path = require('path');

// Delegate to the shared implementation in scripts/hooks/suggest-compact.js
require(path.join(__dirname, '..', '..', 'scripts', 'hooks', 'suggest-compact.js'));

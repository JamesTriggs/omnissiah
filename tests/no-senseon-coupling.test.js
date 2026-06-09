/**
 * Guard test: no SenseOn coupling.
 *
 * omnissiah is a generic, domain-agnostic Claude Code plugin. This test
 * recursively scans the repository and FAILS if any forbidden token (a
 * SenseOn-specific product, repo, codename, person, or path) appears anywhere
 * in the tracked source. It is the safety net that keeps the extraction clean.
 *
 * Excludes: .git, node_modules, and this test file itself (which necessarily
 * names the tokens it forbids).
 *
 * Run with: node tests/no-senseon-coupling.test.js
 */

'use strict';

const assert = require('assert');
const fs   = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

const REPO_ROOT = path.join(__dirname, '..');
const THIS_FILE = path.resolve(__filename);
const THIS_BASENAME = path.basename(__filename); // self-reference allowed in the runner

// Directories never scanned.
const EXCLUDED_DIRS = new Set(['.git', 'node_modules']);

// Forbidden tokens (matched case-insensitively). Deliberately specific to avoid
// false positives on legitimate generic words. We do NOT forbid the bare words
// "linear" (the maths term) or "tenant" (generic multi-tenancy).
const FORBIDDEN = [
  'senseon',
  'cubic',
  'clickhouse',
  'chsql',
  'landingnet',
  'tidalbeam',
  'hunt ?lab',          // "hunt lab" or "huntlab"
  'huntlab',
  'mitre',
  'att&ck',
  'appliance-api',
  'customer-api',
  'libseenet',
  'senseon-ui',
  'senseon-data-model',
  'database-loader',
  'cartographer',
  'calm-plane',
  'jjtriggs',
  'james\\.triggs@senseon',
  '/senseon-work',
  'ai-at-senseon',
];

const FORBIDDEN_RE = new RegExp(FORBIDDEN.join('|'), 'i');

/**
 * Recursively collect every file under dir, skipping excluded directories and
 * this test file.
 */
function collectFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectFiles(full, out);
    } else if (entry.isFile()) {
      if (path.resolve(full) === THIS_FILE) continue;
      out.push(full);
    }
  }
  return out;
}

/**
 * Returns true if a buffer looks like binary content (contains a NUL byte in
 * the first chunk). Binary files are skipped.
 */
function looksBinary(buf) {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

console.log('\n=== Testing no SenseOn coupling ===\n');

test('no forbidden SenseOn tokens anywhere in the repo', () => {
  const files = collectFiles(REPO_ROOT, []);
  const offences = [];

  for (const file of files) {
    let buf;
    try {
      buf = fs.readFileSync(file);
    } catch {
      continue; // unreadable (e.g. a broken symlink) — skip
    }
    if (looksBinary(buf)) continue;

    const text = buf.toString('utf8');
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      // Allow other files to reference this guard test by its own filename
      // (e.g. the test runner lists it); strip that token before matching.
      const scanLine = line.split(THIS_BASENAME).join('');
      const m = scanLine.match(FORBIDDEN_RE);
      if (m) {
        const rel = path.relative(REPO_ROOT, file);
        offences.push(`${rel}:${idx + 1}: matched "${m[0]}"  →  ${line.trim().slice(0, 120)}`);
      }
    });
  }

  assert.strictEqual(
    offences.length,
    0,
    `Found ${offences.length} forbidden token(s):\n${offences.join('\n')}`
  );
});

console.log('\n=== Test Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);

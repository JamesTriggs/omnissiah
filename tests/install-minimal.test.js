/**
 * Tests for install-minimal.js
 *
 * Run with: node tests/install-minimal.test.js
 */

'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ─── Internals mirror ─────────────────────────────────────────────────────────
// install-minimal.js is a script (calls main() at the bottom). We mirror its
// internal hook-building, merge, and remove logic here so the test stays in step
// with the canonical minimal install: three generic hygiene hooks, tagged with
// the omnissiah minimal marker.

const INSTALLER = path.join(__dirname, '..', 'install-minimal.js');
const MINIMAL_TAG = '__omnissiah_minimal__';

function buildTestHooks(repoPath) {
  const repo = repoPath.replace(/\\/g, '/');
  return {
    PreToolUse: [
      {
        matcher: 'Bash',
        description: '[omnissiah-minimal] Block commits containing secrets',
        [MINIMAL_TAG]: true,
        hooks: [{ type: 'command', command: `node ${repo}/scripts/hooks/bash-pre-secret-check.js` }],
      },
    ],
    SessionStart: [
      {
        matcher: '*',
        description: '[omnissiah-minimal] Session start',
        [MINIMAL_TAG]: true,
        hooks: [{ type: 'command', command: `node ${repo}/scripts/hooks/session-start-minimal.js` }],
      },
    ],
    SessionEnd: [
      {
        matcher: '*',
        description: '[omnissiah-minimal] Session end',
        [MINIMAL_TAG]: true,
        hooks: [{ type: 'command', command: `node ${repo}/scripts/hooks/session-end.js` }],
      },
    ],
  };
}

function mergeHooks(settings, minimalHooks) {
  if (!settings.hooks) settings.hooks = {};
  for (const [event, entries] of Object.entries(minimalHooks)) {
    if (!settings.hooks[event]) settings.hooks[event] = [];
    for (const entry of entries) {
      const cmd = entry.hooks[0].command;
      const dup = settings.hooks[event].some(
        e => Array.isArray(e.hooks) && e.hooks.some(h => h.command === cmd)
      );
      if (!dup) settings.hooks[event].push(entry);
    }
  }
  return settings;
}

function removeHooks(settings) {
  if (!settings.hooks) return settings;
  for (const event of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[event])) continue;
    settings.hooks[event] = settings.hooks[event].filter(e => !e[MINIMAL_TAG]);
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return settings;
}

function getMinimalHooks(settings) {
  if (!settings.hooks) return [];
  const found = [];
  for (const [event, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry[MINIMAL_TAG]) found.push({ event, entry });
    }
  }
  return found;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const REPO = path.join(__dirname, '..');

console.log('\ninstall-minimal.js tests');
console.log('─'.repeat(40));

// Hook script existence
console.log('\n  Hook scripts exist:');

test('bash-pre-secret-check.js exists', () => {
  assert.ok(fs.existsSync(path.join(REPO, 'scripts/hooks/bash-pre-secret-check.js')));
});

test('session-start-minimal.js exists', () => {
  assert.ok(fs.existsSync(path.join(REPO, 'scripts/hooks/session-start-minimal.js')));
});

test('session-end.js exists', () => {
  assert.ok(fs.existsSync(path.join(REPO, 'scripts/hooks/session-end.js')));
});

// Source contract: the installer must use the canonical minimal tag and the
// generic three-hook hygiene set (no Linear branch hook, no observe hook).
console.log('\n  Installer source contract:');

test('install-minimal.js uses the __omnissiah_minimal__ tag', () => {
  const src = fs.readFileSync(INSTALLER, 'utf8');
  assert.ok(src.includes(MINIMAL_TAG), `Installer should declare ${MINIMAL_TAG}`);
});

test('install-minimal.js references the three hygiene hook scripts', () => {
  const src = fs.readFileSync(INSTALLER, 'utf8');
  assert.ok(src.includes('bash-pre-secret-check.js'), 'Missing secret-check hook');
  assert.ok(src.includes('session-start-minimal.js'), 'Missing session-start hook');
  assert.ok(src.includes('session-end.js'), 'Missing session-end hook');
});

// Merge logic
console.log('\n  Hook merge logic:');

test('mergeHooks adds all 3 hook entries to empty settings', () => {
  const settings = {};
  mergeHooks(settings, buildTestHooks(REPO));
  const found = getMinimalHooks(settings);
  assert.strictEqual(found.length, 3, `Expected 3 hooks, got ${found.length}`);
});

test('mergeHooks does not duplicate existing entries', () => {
  const settings = {};
  mergeHooks(settings, buildTestHooks(REPO));
  mergeHooks(settings, buildTestHooks(REPO)); // second call
  const found = getMinimalHooks(settings);
  assert.strictEqual(found.length, 3, `Expected 3 hooks after double merge, got ${found.length}`);
});

test('mergeHooks preserves existing untagged hooks', () => {
  const existing = { hooks: { PreToolUse: [{ matcher: 'Bash', description: 'my hook', hooks: [{ type: 'command', command: 'node myhook.js' }] }] } };
  mergeHooks(existing, buildTestHooks(REPO));
  const myHook = existing.hooks.PreToolUse.find(e => e.description === 'my hook');
  assert.ok(myHook, 'Existing untagged hook should be preserved');
});

test('mergeHooks covers all 3 lifecycle events', () => {
  const settings = {};
  mergeHooks(settings, buildTestHooks(REPO));
  const events = new Set(getMinimalHooks(settings).map(h => h.event));
  assert.ok(events.has('PreToolUse'),  'Missing PreToolUse');
  assert.ok(events.has('SessionStart'), 'Missing SessionStart');
  assert.ok(events.has('SessionEnd'),  'Missing SessionEnd');
});

// Remove logic
console.log('\n  Hook removal logic:');

test('removeHooks removes all tagged entries', () => {
  const settings = {};
  mergeHooks(settings, buildTestHooks(REPO));
  removeHooks(settings);
  const found = getMinimalHooks(settings);
  assert.strictEqual(found.length, 0, `Expected 0 hooks after removal, got ${found.length}`);
});

test('removeHooks cleans up empty hook event arrays', () => {
  const settings = {};
  mergeHooks(settings, buildTestHooks(REPO));
  removeHooks(settings);
  assert.strictEqual(settings.hooks, undefined, 'hooks key should be removed when empty');
});

test('removeHooks preserves untagged hooks after removal', () => {
  const existing = { hooks: { PreToolUse: [{ matcher: 'Bash', description: 'my hook', hooks: [{ type: 'command', command: 'node myhook.js' }] }] } };
  mergeHooks(existing, buildTestHooks(REPO));
  removeHooks(existing);
  const myHook = existing.hooks?.PreToolUse?.find(e => e.description === 'my hook');
  assert.ok(myHook, 'Existing untagged hook should survive removal');
});

// Hook content validation
console.log('\n  Hook content:');

test('secret check hook uses PreToolUse/Bash matcher', () => {
  const hooks = buildTestHooks(REPO);
  const entry = hooks.PreToolUse.find(e => e.hooks[0].command.includes('bash-pre-secret-check'));
  assert.ok(entry, 'Secret check hook not found in PreToolUse');
  assert.strictEqual(entry.matcher, 'Bash');
});

test('session-start hook uses SessionStart/* matcher', () => {
  const hooks = buildTestHooks(REPO);
  const entry = hooks.SessionStart.find(e => e.hooks[0].command.includes('session-start-minimal.js'));
  assert.ok(entry, 'Session-start hook not found in SessionStart');
  assert.strictEqual(entry.matcher, '*');
});

test('all hook commands use absolute paths', () => {
  const hooks = buildTestHooks('/some/repo/path');
  for (const [, entries] of Object.entries(hooks)) {
    for (const entry of entries) {
      const cmd = entry.hooks[0].command;
      assert.ok(
        cmd.startsWith('node /some/repo/path'),
        `Command should use absolute path: ${cmd}`
      );
    }
  }
});

test('all hook entries carry the minimal tag', () => {
  const hooks = buildTestHooks(REPO);
  for (const [event, entries] of Object.entries(hooks)) {
    for (const entry of entries) {
      assert.ok(entry[MINIMAL_TAG], `Hook in ${event} missing ${MINIMAL_TAG} tag`);
    }
  }
});

// install-minimal.js file itself
console.log('\n  Installer file:');

test('install-minimal.js exists at repo root', () => {
  assert.ok(fs.existsSync(INSTALLER));
});

test('install-minimal.js is valid Node.js (no syntax errors)', () => {
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, ['--check', INSTALLER], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, `Syntax error: ${result.stderr}`);
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}\n`);
if (failed > 0) process.exit(1);

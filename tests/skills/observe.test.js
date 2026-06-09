/**
 * Tests for skills/continuous-learning-v2/hooks/observe.js
 *
 * Run with: node tests/skills/observe.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const OBSERVE_SCRIPT = path.join(__dirname, '../../skills/continuous-learning-v2/hooks/observe.js');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function runObserve(input, fakeHome) {
  // Override both HOME (Unix) and USERPROFILE (Windows) so os.homedir() returns our temp dir
  const result = spawnSync('node', [OBSERVE_SCRIPT], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5000
  });
  return result;
}

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'observe-test-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

console.log('\n=== Testing observe.js ===\n');

let passed = 0;
let failed = 0;

// ─── Basic observation recording ─────────────────────────────────────────────

console.log('Basic observation recording:');

{
  const home = mkTmp();
  const configDir = path.join(home, '.claude', 'homunculus');
  const obsFile = path.join(configDir, 'observations.jsonl');

  if (test('PreToolUse event records tool_start observation', () => {
    const input = {
      hook_type: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
      session_id: 'test-session-1'
    };
    runObserve(input, home);
    assert.ok(fs.existsSync(obsFile), 'observations.jsonl should exist');
    const lines = fs.readFileSync(obsFile, 'utf8').trim().split('\n').filter(Boolean);
    assert.ok(lines.length >= 1, 'should have at least one line');
    const obs = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(obs.event, 'tool_start');
    assert.strictEqual(obs.tool, 'Bash');
    assert.ok(obs.input, 'should have input field');
    assert.ok(!obs.output, 'should not have output field');
  })) passed++; else failed++;

  if (test('PostToolUse event records tool_complete observation', () => {
    const input = {
      hook_type: 'PostToolUse',
      tool_name: 'Read',
      tool_output: 'file contents here',
      session_id: 'test-session-1'
    };
    runObserve(input, home);
    const lines = fs.readFileSync(obsFile, 'utf8').trim().split('\n').filter(Boolean);
    const obs = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(obs.event, 'tool_complete');
    assert.ok(obs.output, 'should have output field');
    assert.ok(!obs.input, 'should not have input field');
  })) passed++; else failed++;

  cleanup(home);
}

// ─── Disabled flag ────────────────────────────────────────────────────────────

console.log('\nDisabled flag:');

{
  const home = mkTmp();
  const configDir = path.join(home, '.claude', 'homunculus');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, 'disabled'), '');

  if (test('exits 0 and does not write when disabled flag present', () => {
    const result = runObserve({ hook_type: 'PreToolUse', tool_name: 'Bash' }, home);
    assert.strictEqual(result.status, 0);
    const obsFile = path.join(configDir, 'observations.jsonl');
    assert.ok(!fs.existsSync(obsFile), 'should not create observations file when disabled');
  })) passed++; else failed++;

  cleanup(home);
}

// ─── Error handling ───────────────────────────────────────────────────────────

console.log('\nError handling:');

{
  const home = mkTmp();

  if (test('empty stdin — exits 0 without writing', () => {
    const result = spawnSync('node', [OBSERVE_SCRIPT], {
      input: '',
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    assert.strictEqual(result.status, 0);
  })) passed++; else failed++;

  if (test('malformed JSON — exits 0 and writes parse_error entry', () => {
    const result = spawnSync('node', [OBSERVE_SCRIPT], {
      input: '{ not valid json }',
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    assert.strictEqual(result.status, 0);
    const obsFile = path.join(home, '.claude', 'homunculus', 'observations.jsonl');
    if (fs.existsSync(obsFile)) {
      const lines = fs.readFileSync(obsFile, 'utf8').trim().split('\n').filter(Boolean);
      const last = JSON.parse(lines[lines.length - 1]);
      assert.strictEqual(last.event, 'parse_error');
    }
  })) passed++; else failed++;

  cleanup(home);
}

// ─── File rotation ────────────────────────────────────────────────────────────

console.log('\nFile rotation:');

{
  const home = mkTmp();
  const configDir = path.join(home, '.claude', 'homunculus');
  fs.mkdirSync(configDir, { recursive: true });
  const obsFile = path.join(configDir, 'observations.jsonl');

  if (test('rotates file to archive when size exceeds 10MB', () => {
    // Write > 10MB stub
    const tenMbPlusOne = Buffer.alloc(11 * 1024 * 1024, 'x');
    fs.writeFileSync(obsFile, tenMbPlusOne);

    runObserve({ hook_type: 'PreToolUse', tool_name: 'Bash', session_id: 'x' }, home);

    const archiveDir = path.join(configDir, 'observations.archive');
    assert.ok(fs.existsSync(archiveDir), 'archive dir should exist');
    const archives = fs.readdirSync(archiveDir);
    assert.ok(archives.length >= 1, 'should have at least one archived file');

    // Original file should be small (new observation only)
    if (fs.existsSync(obsFile)) {
      const size = fs.statSync(obsFile).size;
      assert.ok(size < 1024 * 1024, `observations.jsonl should be small after rotation, got ${size} bytes`);
    }
  })) passed++; else failed++;

  cleanup(home);
}

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('\n=== Test Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);

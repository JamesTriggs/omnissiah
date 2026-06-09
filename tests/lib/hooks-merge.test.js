/**
 * Tests for scripts/lib/hooks-merge.js
 *
 * Run with: node tests/lib/hooks-merge.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { mergeHooks, mergeFromFiles, countHookCommands } = require('../../scripts/lib/hooks-merge');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    if (process.env.DEBUG) console.log(err.stack);
    return false;
  }
}

function sampleFrameworkHooks() {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          description: 'Block dev servers',
          hooks: [{ type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/bash-pre-devserver-block.js' }],
        },
        {
          matcher: 'Bash',
          description: 'Warn on git push',
          hooks: [{ type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/bash-pre-push-warn.js' }],
        },
      ],
      PostToolUse: [
        {
          matcher: '*',
          description: 'Record tool observations for continuous learning',
          hooks: [{ type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/skills/continuous-learning-v2/hooks/observe.js' }],
        },
      ],
    },
  };
}

function runTests() {
  console.log('\n=== Testing hooks-merge.js ===\n');
  let passed = 0, failed = 0;

  console.log('Core merge behaviour:');

  if (test('adds framework hooks to empty user settings', () => {
    const out = mergeHooks({}, sampleFrameworkHooks(), '/plugin');
    assert.ok(out.settings.hooks);
    assert.strictEqual(out.settings.hooks.PreToolUse.length, 2);
    assert.strictEqual(out.settings.hooks.PostToolUse.length, 1);
    assert.strictEqual(out.added.length, 3);
  })) passed++; else failed++;

  if (test('resolves ${CLAUDE_PLUGIN_ROOT} to absolute pluginRoot', () => {
    const out = mergeHooks({}, sampleFrameworkHooks(), '/abs/plugin/root');
    const cmd = out.settings.hooks.PostToolUse[0].hooks[0].command;
    assert.ok(cmd.startsWith('/abs/plugin/root/') || cmd.startsWith('node /abs/plugin/root/'),
      `expected resolved path, got: ${cmd}`);
    assert.ok(!cmd.includes('${CLAUDE_PLUGIN_ROOT}'), 'placeholder should be replaced');
  })) passed++; else failed++;

  if (test('preserves all user hooks verbatim', () => {
    const userSettings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo user-custom-hook' }] },
        ],
      },
    };
    const out = mergeHooks(userSettings, sampleFrameworkHooks(), '/plugin');
    const cmds = out.settings.hooks.PreToolUse.flatMap(g => g.hooks.map(h => h.command));
    assert.ok(cmds.includes('echo user-custom-hook'), 'user hook lost');
    assert.ok(cmds.some(c => c.includes('bash-pre-devserver-block.js')), 'framework hook missing');
  })) passed++; else failed++;

  if (test('is idempotent — running twice produces same result as once', () => {
    const once = mergeHooks({}, sampleFrameworkHooks(), '/plugin').settings;
    const twice = mergeHooks(once, sampleFrameworkHooks(), '/plugin').settings;
    assert.deepStrictEqual(once, twice);
  })) passed++; else failed++;

  if (test('second run reports zero additions', () => {
    const once = mergeHooks({}, sampleFrameworkHooks(), '/plugin').settings;
    const second = mergeHooks(once, sampleFrameworkHooks(), '/plugin');
    assert.strictEqual(second.added.length, 0);
  })) passed++; else failed++;

  if (test('skips hook when user already has identical resolved command', () => {
    const userSettings = {
      hooks: {
        PostToolUse: [{
          matcher: '*',
          hooks: [{ type: 'command', command: 'node /plugin/skills/continuous-learning-v2/hooks/observe.js' }],
        }],
      },
    };
    const out = mergeHooks(userSettings, sampleFrameworkHooks(), '/plugin');
    const observeCmds = out.settings.hooks.PostToolUse
      .flatMap(g => g.hooks.map(h => h.command))
      .filter(c => c.includes('observe.js'));
    assert.strictEqual(observeCmds.length, 1, 'observe.js should not be duplicated');
  })) passed++; else failed++;

  if (test('dedups when user has placeholder form and framework resolves to same path', () => {
    // Simulates a consumer whose hooks arrived via Claude Code's plugin loader
    // (keeps ${CLAUDE_PLUGIN_ROOT} placeholder) AND who then runs install.sh
    // (which resolves to an absolute path). Without placeholder-aware dedup
    // both forms would coexist and fire twice.
    const userSettings = {
      hooks: {
        PostToolUse: [{
          matcher: '*',
          hooks: [{ type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/skills/continuous-learning-v2/hooks/observe.js' }],
        }],
      },
    };
    const out = mergeHooks(userSettings, sampleFrameworkHooks(), '/plugin');
    const observeCmds = out.settings.hooks.PostToolUse
      .flatMap(g => g.hooks.map(h => h.command))
      .filter(c => c.includes('observe.js'));
    assert.strictEqual(observeCmds.length, 1, 'placeholder form must dedup against resolved form');
  })) passed++; else failed++;

  console.log('\nObserve hook (memory system):');

  if (test('installs the observe.js memory capture hook', () => {
    const out = mergeHooks({}, sampleFrameworkHooks(), '/plugin');
    const observeCmd = out.settings.hooks.PostToolUse
      .flatMap(g => g.hooks.map(h => h.command))
      .find(c => c.includes('observe.js'));
    assert.ok(observeCmd, 'observe.js hook must be installed by merge');
    assert.ok(observeCmd.includes('/plugin/'), 'path must be resolved');
  })) passed++; else failed++;

  if (test('observe hook is installed even when user has other PostToolUse hooks', () => {
    const userSettings = {
      hooks: {
        PostToolUse: [
          { matcher: 'Write', hooks: [{ type: 'command', command: 'echo my-lint' }] },
        ],
      },
    };
    const out = mergeHooks(userSettings, sampleFrameworkHooks(), '/plugin');
    const cmds = out.settings.hooks.PostToolUse.flatMap(g => g.hooks.map(h => h.command));
    assert.ok(cmds.some(c => c.includes('observe.js')), 'observe.js missing');
    assert.ok(cmds.includes('echo my-lint'), 'user hook removed');
  })) passed++; else failed++;

  console.log('\nNon-hook settings:');

  if (test('preserves model, mcpServers, and other top-level keys', () => {
    const userSettings = {
      model: 'opus[1m]',
      mcpServers: { github: { command: 'npx' } },
      skipDangerousModePermissionPrompt: true,
      hooks: {},
    };
    const out = mergeHooks(userSettings, sampleFrameworkHooks(), '/plugin');
    assert.strictEqual(out.settings.model, 'opus[1m]');
    assert.deepStrictEqual(out.settings.mcpServers, { github: { command: 'npx' } });
    assert.strictEqual(out.settings.skipDangerousModePermissionPrompt, true);
  })) passed++; else failed++;

  if (test('handles undefined user settings', () => {
    const out = mergeHooks(undefined, sampleFrameworkHooks(), '/plugin');
    assert.ok(out.settings.hooks);
    assert.strictEqual(out.added.length, 3);
  })) passed++; else failed++;

  console.log('\nValidation:');

  if (test('throws if pluginRoot missing', () => {
    assert.throws(() => mergeHooks({}, sampleFrameworkHooks()), /pluginRoot/);
  })) passed++; else failed++;

  if (test('ignores malformed framework entries without throwing', () => {
    const malformed = { hooks: { PreToolUse: [null, { matcher: 'Bash' }, { hooks: 'not-an-array' }] } };
    const out = mergeHooks({}, malformed, '/plugin');
    assert.ok(out.settings);
  })) passed++; else failed++;

  if (test('does not mutate input objects', () => {
    const userSettings = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'x' }] }] } };
    const frozen = JSON.parse(JSON.stringify(userSettings));
    mergeHooks(userSettings, sampleFrameworkHooks(), '/plugin');
    assert.deepStrictEqual(userSettings, frozen);
  })) passed++; else failed++;

  console.log('\nHelpers:');

  if (test('countHookCommands counts correctly', () => {
    const merged = mergeHooks({}, sampleFrameworkHooks(), '/plugin').settings;
    assert.strictEqual(countHookCommands(merged.hooks), 3);
  })) passed++; else failed++;

  if (test('countHookCommands handles empty/undefined', () => {
    assert.strictEqual(countHookCommands(undefined), 0);
    assert.strictEqual(countHookCommands({}), 0);
    assert.strictEqual(countHookCommands({ PostToolUse: [] }), 0);
  })) passed++; else failed++;

  console.log('\nFile I/O (mergeFromFiles):');

  if (test('mergeFromFiles creates settings file and writes backup', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-merge-test-'));
    const settingsPath = path.join(tmp, 'settings.json');
    const hooksPath = path.join(tmp, 'hooks.json');
    try {
      fs.writeFileSync(hooksPath, JSON.stringify(sampleFrameworkHooks()));
      fs.writeFileSync(settingsPath, JSON.stringify({ model: 'opus', hooks: {} }));
      const result = mergeFromFiles(settingsPath, '/fake/plugin', hooksPath);
      assert.strictEqual(result.added.length, 3);
      const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.strictEqual(written.model, 'opus');
      assert.ok(written.hooks.PostToolUse);
      // Backup should exist
      const backups = fs.readdirSync(tmp).filter(f => f.startsWith('settings.json.backup.'));
      assert.strictEqual(backups.length, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('mergeFromFiles is idempotent and skips backup when no changes', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-merge-test-'));
    const settingsPath = path.join(tmp, 'settings.json');
    const hooksPath = path.join(tmp, 'hooks.json');
    try {
      fs.writeFileSync(hooksPath, JSON.stringify(sampleFrameworkHooks()));
      fs.writeFileSync(settingsPath, JSON.stringify({}));
      mergeFromFiles(settingsPath, '/fake/plugin', hooksPath);
      // second run
      const before = fs.readdirSync(tmp).filter(f => f.startsWith('settings.json.backup.')).length;
      const result = mergeFromFiles(settingsPath, '/fake/plugin', hooksPath);
      const after = fs.readdirSync(tmp).filter(f => f.startsWith('settings.json.backup.')).length;
      assert.strictEqual(result.added.length, 0);
      assert.strictEqual(before, after, 'no new backup when nothing added');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('mergeFromFiles handles missing settings file (fresh install)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-merge-test-'));
    const settingsPath = path.join(tmp, 'settings.json');
    const hooksPath = path.join(tmp, 'hooks.json');
    try {
      fs.writeFileSync(hooksPath, JSON.stringify(sampleFrameworkHooks()));
      const result = mergeFromFiles(settingsPath, '/fake/plugin', hooksPath);
      assert.strictEqual(result.added.length, 3);
      assert.ok(fs.existsSync(settingsPath));
      const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.ok(written.hooks);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

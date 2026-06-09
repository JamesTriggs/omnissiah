/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Test helper
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

// Async test helper
async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

// Run a script and capture output
function runScript(scriptPath, input = '', env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);

    if (input) {
      proc.stdin.write(input);
    }
    proc.stdin.end();

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', reject);
  });
}

// Create a temporary test directory
function createTestDir() {
  const testDir = path.join(os.tmpdir(), `hooks-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

// Clean up test directory
function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

// Test suite
async function runTests() {
  console.log('\n=== Testing Hook Scripts ===\n');

  let passed = 0;
  let failed = 0;

  const scriptsDir = path.join(__dirname, '..', '..', 'scripts', 'hooks');

  // session-start.js tests
  console.log('\nsession-start.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('outputs welcome banner with OMNISSIAH to stdout', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    // Banner is on stdout to avoid PowerShell NativeCommandError on stderr
    assert.ok(
      result.stdout.includes('O M N I S S I A H'),
      'Should output OMNISSIAH banner on stdout'
    );
  })) passed++; else failed++;

  if (await asyncTest('outputs Penrose triangle ASCII art to stdout', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.ok(
      result.stdout.includes('\u2588\u2588\u2588\u2588') &&  // ████ left face
      result.stdout.includes('\u2584\u2584\u2584') &&        // ▄▄▄ lower edges
      result.stdout.includes('\u2580\u2580\u2580'),          // ▀▀▀ upper edges
      'Should output high-fidelity block-character Penrose triangle on stdout'
    );
  })) passed++; else failed++;

  if (await asyncTest('outputs health check results', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.ok(
      result.stderr.includes('[Health]'),
      'Should output health check results'
    );
  })) passed++; else failed++;

  if (await asyncTest('outputs LLM-TLDR status in health check', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.ok(
      result.stderr.includes('LLM-TLDR') || result.stderr.includes('TLDR'),
      'Should output LLM-TLDR status'
    );
  })) passed++; else failed++;

  // session-end.js tests
  console.log('\nsession-end.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-end.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('creates or updates session file', async () => {
    // Run the script
    await runScript(path.join(scriptsDir, 'session-end.js'));

    // Check if session file was created
    // Note: Without CLAUDE_SESSION_ID, falls back to project name (not 'default')
    // Use local time to match the script's getDateString() function
    const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Get the expected session ID (project name fallback)
    const utils = require('../../scripts/lib/utils');
    const expectedId = utils.getSessionIdShort();
    const sessionFile = path.join(sessionsDir, `${today}-${expectedId}-session.tmp`);

    assert.ok(fs.existsSync(sessionFile), `Session file should exist: ${sessionFile}`);
  })) passed++; else failed++;

  if (await asyncTest('warns to stderr when session file exceeds line limit', async () => {
    const testSessionId = 'test-limits-' + Date.now();
    const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const shortId = testSessionId.slice(-8);
    const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);

    // Pre-create a session file that exceeds 200 lines
    fs.mkdirSync(sessionsDir, { recursive: true });
    const hugeContent = Array(250).fill('- line of session notes\n').join('');
    fs.writeFileSync(sessionFile, hugeContent);

    const result = await runScript(path.join(scriptsDir, 'session-end.js'), '', {
      CLAUDE_SESSION_ID: testSessionId
    });

    assert.strictEqual(result.code, 0, 'Should still exit 0');
    assert.ok(
      result.stderr.includes('WARNING') && result.stderr.includes('limits'),
      `Should warn about limit exceeded. Got stderr: ${result.stderr.slice(0, 200)}`
    );

    // Cleanup
    try { fs.unlinkSync(sessionFile); } catch {}
  })) passed++; else failed++;

  if (await asyncTest('includes session ID in filename', async () => {
    const testSessionId = 'test-session-abc12345';
    const expectedShortId = 'abc12345'; // Last 8 chars

    // Run with custom session ID
    await runScript(path.join(scriptsDir, 'session-end.js'), '', {
      CLAUDE_SESSION_ID: testSessionId
    });

    // Check if session file was created with session ID
    // Use local time to match the script's getDateString() function
    const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sessionFile = path.join(sessionsDir, `${today}-${expectedShortId}-session.tmp`);

    assert.ok(fs.existsSync(sessionFile), `Session file should exist: ${sessionFile}`);
  })) passed++; else failed++;

  // pre-compact.js tests
  console.log('\npre-compact.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-compact.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  // post-compact-restore.js tests
  console.log('\npost-compact-restore.js:');

  if (await asyncTest('runs without error and exits 0', async () => {
    const result = await runScript(path.join(scriptsDir, 'post-compact-restore.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('outputs skill context restoration header to stdout', async () => {
    const result = await runScript(path.join(scriptsDir, 'post-compact-restore.js'));
    assert.ok(
      result.stdout.includes('Context Restored After Compaction') ||
      result.stdout.includes('Skill Context'),
      'Should output context restoration header'
    );
  })) passed++; else failed++;

  if (await asyncTest('outputs coding-standards as fallback skill', async () => {
    const result = await runScript(path.join(scriptsDir, 'post-compact-restore.js'));
    assert.ok(
      result.stdout.includes('coding-standards'),
      'Should include fallback skills in output'
    );
  })) passed++; else failed++;

  if (await asyncTest('outputs PreCompact message', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-compact.js'));
    assert.ok(result.stderr.includes('[PreCompact]'), 'Should output PreCompact message');
  })) passed++; else failed++;

  if (await asyncTest('creates compaction log', async () => {
    await runScript(path.join(scriptsDir, 'pre-compact.js'));
    const logFile = path.join(os.homedir(), '.claude', 'sessions', 'compaction-log.txt');
    assert.ok(fs.existsSync(logFile), 'Compaction log should exist');
  })) passed++; else failed++;

  // suggest-compact.js tests
  console.log('\nsuggest-compact.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: 'test-session-' + Date.now()
    });
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('increments counter on each call', async () => {
    const sessionId = 'test-counter-' + Date.now();

    // Run multiple times
    for (let i = 0; i < 3; i++) {
      await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
    }

    // Check counter file
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 3, `Counter should be 3, got ${count}`);

    // Cleanup
    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('suggests compact at threshold', async () => {
    const sessionId = 'test-threshold-' + Date.now();
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);

    // Set counter to threshold - 1
    fs.writeFileSync(counterFile, '49');

    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: sessionId,
      COMPACT_THRESHOLD: '50'
    });

    assert.ok(
      result.stderr.includes('50 tool calls reached'),
      'Should suggest compact at threshold'
    );

    // Cleanup
    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  // evaluate-session.js tests
  console.log('\nevaluate-session.js:');

  if (await asyncTest('runs without error when no transcript', async () => {
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('skips short sessions', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Create a short transcript (less than 10 user messages)
    const transcript = Array(5).fill('{"type":"user","content":"test"}\n').join('');
    fs.writeFileSync(transcriptPath, transcript);

    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), '', {
      CLAUDE_TRANSCRIPT_PATH: transcriptPath
    });

    assert.ok(
      result.stderr.includes('Session too short'),
      'Should indicate session is too short'
    );

    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('processes sessions with enough messages', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Create a longer transcript (more than 10 user messages)
    const transcript = Array(15).fill('{"type":"user","content":"test"}\n').join('');
    fs.writeFileSync(transcriptPath, transcript);

    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), '', {
      CLAUDE_TRANSCRIPT_PATH: transcriptPath
    });

    assert.ok(
      result.stderr.includes('15 messages'),
      'Should report message count'
    );

    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // hooks.json validation
  console.log('\nhooks.json Validation:');

  if (test('hooks.json is valid JSON', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const content = fs.readFileSync(hooksPath, 'utf8');
    JSON.parse(content); // Will throw if invalid
  })) passed++; else failed++;

  if (test('hooks.json has required event types', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    assert.ok(hooks.hooks.PreToolUse, 'Should have PreToolUse hooks');
    assert.ok(hooks.hooks.PostToolUse, 'Should have PostToolUse hooks');
    assert.ok(hooks.hooks.SessionStart, 'Should have SessionStart hooks');
    assert.ok(hooks.hooks.SessionEnd, 'Should have SessionEnd hooks');
    assert.ok(hooks.hooks.PreCompact, 'Should have PreCompact hooks');
    assert.ok(hooks.hooks.PostCompact, 'Should have PostCompact hooks');
  })) passed++; else failed++;

  if (test('PostCompact hook references post-compact-restore.js', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    const postCompact = hooks.hooks.PostCompact || [];
    const cmds = postCompact.flatMap(e => e.hooks.map(h => typeof h.command === 'string' ? h.command : ''));
    assert.ok(
      cmds.some(c => c.includes('post-compact-restore.js')),
      'PostCompact should reference post-compact-restore.js'
    );
  })) passed++; else failed++;

  if (test('PostToolUse has observe hook for continuous learning', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    const postToolUse = hooks.hooks.PostToolUse || [];
    const cmds = postToolUse.flatMap(e => e.hooks.map(h => typeof h.command === 'string' ? h.command : ''));
    assert.ok(
      cmds.some(c => c.includes('observe.js')),
      'PostToolUse should include observe.js for continuous learning'
    );
  })) passed++; else failed++;

  if (test('lifecycle and node-script hook commands use node', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    // Only validate lifecycle hooks (SessionStart, PreCompact, SessionEnd)
    // and PostToolUse hooks that use node scripts.
    // PreToolUse hooks use bash-pre-dispatch.js (single entry) — tested in integration tests.
    const lifecycleEvents = ['SessionStart', 'PreCompact', 'SessionEnd'];

    for (const event of lifecycleEvents) {
      const hookArray = hooks.hooks[event];
      if (!hookArray) continue;
      for (const entry of hookArray) {
        for (const hook of entry.hooks) {
          if (hook.type === 'command') {
            const cmd = Array.isArray(hook.command) ? hook.command[0] : hook.command;
            assert.ok(
              cmd === 'node' || cmd.startsWith('node'),
              `${event} hook command should use node: ${JSON.stringify(hook.command).substring(0, 50)}`
            );
          }
        }
      }
    }

    // Also check PostToolUse hooks that use array format (node scripts)
    const postToolUse = hooks.hooks.PostToolUse || [];
    for (const entry of postToolUse) {
      for (const hook of entry.hooks) {
        if (hook.type === 'command' && Array.isArray(hook.command)) {
          assert.ok(
            hook.command[0] === 'node',
            `PostToolUse node-script hook should start with node: ${JSON.stringify(hook.command).substring(0, 50)}`
          );
        }
      }
    }
  })) passed++; else failed++;

  if (test('script references use string command format starting with node', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    const checkHooks = (hookArray) => {
      for (const entry of hookArray) {
        for (const hook of entry.hooks) {
          if (hook.type === 'command') {
            const cmdStr = typeof hook.command === 'string' ? hook.command : '';
            if (cmdStr.includes('scripts/hooks/')) {
              // Claude Code requires string format for hook commands
              assert.ok(
                typeof hook.command === 'string',
                `Script commands must be strings (Claude Code requirement): ${JSON.stringify(hook.command).substring(0, 80)}`
              );
              assert.ok(
                cmdStr.startsWith('node '),
                `Script commands should start with "node ": ${cmdStr.substring(0, 80)}`
              );
            }
          }
        }
      }
    };

    for (const [, hookArray] of Object.entries(hooks.hooks)) {
      checkHooks(hookArray);
    }
  })) passed++; else failed++;

  // plugin.json validation
  console.log('\nplugin.json Validation:');

  if (test('plugin.json does NOT have explicit hooks declaration', () => {
    // Claude Code automatically loads hooks/hooks.json by convention.
    // Explicitly declaring it in plugin.json causes a duplicate detection error.
    // Instinct import content parsing fix
    const pluginPath = path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json');
    const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));

    assert.ok(
      !plugin.hooks,
      'plugin.json should NOT have "hooks" field - Claude Code auto-loads hooks/hooks.json'
    );
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

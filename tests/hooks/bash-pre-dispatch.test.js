/**
 * Unit tests for scripts/hooks/bash-pre-dispatch.js
 *
 * Focused on the git push policy: blocks pushes to main/master in every form,
 * warns on force push to feature branches, allows feature-branch pushes.
 *
 * Integration coverage (actual subprocess with stdin/stdout) lives in
 * tests/integration/hooks.test.js.
 *
 * Run with: node tests/hooks/bash-pre-dispatch.test.js
 */

'use strict';

const assert = require('assert');
const {
  checkGitPush,
  evaluate,
  normaliseTarget,
} = require('../../scripts/hooks/bash-pre-dispatch');

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

// getBranch stubs
const onMain = () => 'main';
const onMaster = () => 'master';
const onFeature = () => 'feature/my-change';
const detached = () => null;

function runTests() {
  console.log('\n=== Testing bash-pre-dispatch: git push policy ===\n');
  let passed = 0, failed = 0;

  console.log('Block — explicit main/master targets:');

  if (test('blocks `git push origin main`', () => {
    const r = checkGitPush('git push origin main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
    assert.ok(r.reason.includes("'main'"), 'reason should name the branch');
  })) passed++; else failed++;

  if (test('blocks `git push origin master`', () => {
    const r = checkGitPush('git push origin master', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks `git push -u origin main`', () => {
    const r = checkGitPush('git push -u origin main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks `git push origin HEAD:main`', () => {
    const r = checkGitPush('git push origin HEAD:main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks `git push origin feature/foo:main`', () => {
    const r = checkGitPush('git push origin feature/foo:main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks `git push origin refs/heads/main`', () => {
    const r = checkGitPush('git push origin refs/heads/main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks `git push origin +main` (force-update refspec)', () => {
    const r = checkGitPush('git push origin +main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks force push to main: `git push -f origin main`', () => {
    const r = checkGitPush('git push -f origin main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
    assert.ok(r.reason.includes('Force-pushing'), 'should call out force-push');
  })) passed++; else failed++;

  if (test('blocks `git push --force-with-lease origin main`', () => {
    const r = checkGitPush('git push --force-with-lease origin main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks `git push origin :main` (delete main on remote)', () => {
    const r = checkGitPush('git push origin :main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks `git push --delete origin main`', () => {
    const r = checkGitPush('git push --delete origin main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  console.log('\nBlock — implicit target via current branch:');

  if (test('blocks bare `git push` when current branch is main', () => {
    const r = checkGitPush('git push', { getBranch: onMain });
    assert.strictEqual(r.decision, 'block');
    assert.ok(r.reason.includes("'main'"));
  })) passed++; else failed++;

  if (test('blocks bare `git push` when current branch is master', () => {
    const r = checkGitPush('git push', { getBranch: onMaster });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('blocks `git push origin` (remote only) when on main', () => {
    const r = checkGitPush('git push origin', { getBranch: onMain });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  console.log('\nAllow — feature branch pushes:');

  if (test('allows `git push origin feature/foo`', () => {
    const r = checkGitPush('git push origin feature/foo', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('allows `git push -u origin feature/add-auth`', () => {
    const r = checkGitPush('git push -u origin feature/add-auth', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('allows bare `git push` when on feature branch', () => {
    const r = checkGitPush('git push', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('allows `git push --tags` (tag-only push, no remote)', () => {
    const r = checkGitPush('git push --tags', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('allows `git push origin --tags` (tags-only push WITH remote)', () => {
    // Common form — previously broken because positional.length === 1 made isTagsOnly false,
    // and the code then tried to treat `origin` as a branch target via getCurrentBranch.
    const r = checkGitPush('git push origin --tags', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('allows `git push origin --tags` even when HEAD is on main', () => {
    // Regression guard: a tags-only push should not trip the current-branch
    // fallback and get blocked when the user happens to be on main.
    const r = checkGitPush('git push origin --tags', { getBranch: onMain });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('allows when not in git repo (getBranch returns null)', () => {
    const r = checkGitPush('git push', { getBranch: detached });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  console.log('\nWarn — force push to feature branch (allow but warn):');

  if (test('warns on force push to feature branch', () => {
    const r = checkGitPush('git push -f origin feature/foo', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
    assert.ok(r.warning, 'should emit warning');
    assert.ok(r.warning.toLowerCase().includes('force push'));
  })) passed++; else failed++;

  if (test('warns on `git push --force-with-lease` to feature branch', () => {
    const r = checkGitPush('git push --force-with-lease origin feature/foo', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
    assert.ok(r.warning);
  })) passed++; else failed++;

  console.log('\nEdge cases:');

  if (test('returns null for non-push commands', () => {
    assert.strictEqual(checkGitPush('git status', { getBranch: onMain }), null);
    assert.strictEqual(checkGitPush('ls -la', { getBranch: onMain }), null);
    assert.strictEqual(checkGitPush('git commit -m "push"', { getBranch: onMain }), null);
  })) passed++; else failed++;

  if (test('blocks push in chained command: `git status && git push origin main`', () => {
    const r = checkGitPush('git status && git push origin main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('ignores branches merely containing "main" as substring', () => {
    const r = checkGitPush('git push origin maintenance-branch', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('ignores branches merely containing "master" as substring', () => {
    const r = checkGitPush('git push origin fix/master-switch', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('blocks `git push origin refs/heads/master`', () => {
    const r = checkGitPush('git push origin refs/heads/master', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  console.log('\nnormaliseTarget:');

  if (test('strips refs/heads/', () => {
    assert.strictEqual(normaliseTarget('refs/heads/main'), 'main');
  })) passed++; else failed++;

  if (test('takes destination side of src:dst', () => {
    assert.strictEqual(normaliseTarget('HEAD:main'), 'main');
    assert.strictEqual(normaliseTarget('feature/foo:main'), 'main');
  })) passed++; else failed++;

  if (test('strips leading +', () => {
    assert.strictEqual(normaliseTarget('+main'), 'main');
  })) passed++; else failed++;

  if (test('strips refs/remotes/<remote>/', () => {
    assert.strictEqual(normaliseTarget('refs/remotes/origin/main'), 'main');
  })) passed++; else failed++;

  console.log('\nDev-server and install commands are NOT blocked (per main\'s policy — commits 747b636 / 83edc65):');

  if (test('evaluate allows npm run dev (not dispatcher\'s job)', () => {
    const r = evaluate('npm run dev', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('evaluate allows pip install (not dispatcher\'s job)', () => {
    const r = evaluate('pip install requests', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  console.log('\nIntegrated evaluate():');

  if (test('evaluate returns allow for safe commands', () => {
    const r = evaluate('ls -la', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('evaluate blocks push to main', () => {
    const r = evaluate('git push origin main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
  })) passed++; else failed++;

  if (test('evaluate allows push to feature branch', () => {
    const r = evaluate('git push origin feature/foo', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'allow');
  })) passed++; else failed++;

  if (test('evaluate blocks push-to-main even when surrounded by other commands', () => {
    // `npm run dev` is allowed in isolation, but the chained push to main still blocks.
    const r = evaluate('npm run dev && git push origin main', { getBranch: onFeature });
    assert.strictEqual(r.decision, 'block');
    assert.ok(r.reason.includes("'main'"), 'should still catch the push');
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

/**
 * Tests for scripts/lib/chapter-overrides.js
 *
 * Run with: node tests/lib/chapter-overrides.test.js
 */

'use strict';

const assert = require('assert');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

const {
  getChapterOverridePath,
  getChapterOnlyItems,
  CHAPTERS_DIR,
} = require('../../scripts/lib/chapter-overrides');

// ─── Test helper ─────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

function runTests() {
  console.log('\n=== Testing chapter-overrides.js ===\n');

  let passed = 0;
  let failed = 0;

  // ── CHAPTERS_DIR ──────────────────────────────────────────────────────────

  console.log('CHAPTERS_DIR:');

  if (test('CHAPTERS_DIR is an absolute path', () => {
    assert.ok(path.isAbsolute(CHAPTERS_DIR), 'should be absolute');
  })) passed++; else failed++;

  if (test('CHAPTERS_DIR ends with /chapters', () => {
    assert.ok(
      CHAPTERS_DIR.endsWith('chapters') || CHAPTERS_DIR.endsWith('chapters/'),
      `Expected to end with 'chapters', got: ${CHAPTERS_DIR}`
    );
  })) passed++; else failed++;

  if (test('CHAPTERS_DIR directory exists on disk', () => {
    assert.ok(fs.existsSync(CHAPTERS_DIR), `chapters/ dir not found at ${CHAPTERS_DIR}`);
  })) passed++; else failed++;

  // ── getChapterOverridePath — happy paths ──────────────────────────────────

  console.log('\ngetChapterOverridePath — override exists:');

  if (test('python tdd-workflow → returns a path (not null)', () => {
    const result = getChapterOverridePath('python', 'skills', 'tdd-workflow');
    assert.notStrictEqual(result, null, 'Should return a path for python/skills/tdd-workflow');
  })) passed++; else failed++;

  if (test('python tdd-workflow → returned path exists on disk', () => {
    const result = getChapterOverridePath('python', 'skills', 'tdd-workflow');
    assert.ok(result !== null, 'Path should not be null');
    assert.ok(fs.existsSync(result), `Override file should exist at: ${result}`);
  })) passed++; else failed++;

  if (test('python tdd-workflow → path points to chapters/python/skills/tdd-workflow/SKILL.md', () => {
    const result = getChapterOverridePath('python', 'skills', 'tdd-workflow');
    const expected = path.join(CHAPTERS_DIR, 'python', 'skills', 'tdd-workflow', 'SKILL.md');
    assert.strictEqual(result, expected);
  })) passed++; else failed++;

  if (test('cpp tdd-workflow → returns a path (not null)', () => {
    const result = getChapterOverridePath('cpp', 'skills', 'tdd-workflow');
    assert.notStrictEqual(result, null, 'Should return a path for cpp/skills/tdd-workflow');
  })) passed++; else failed++;

  if (test('cpp tdd-workflow → returned path exists on disk', () => {
    const result = getChapterOverridePath('cpp', 'skills', 'tdd-workflow');
    assert.ok(result !== null, 'Path should not be null');
    assert.ok(fs.existsSync(result), `Override file should exist at: ${result}`);
  })) passed++; else failed++;

  if (test('cpp tdd-workflow → path points to chapters/cpp/skills/tdd-workflow/SKILL.md', () => {
    const result = getChapterOverridePath('cpp', 'skills', 'tdd-workflow');
    const expected = path.join(CHAPTERS_DIR, 'cpp', 'skills', 'tdd-workflow', 'SKILL.md');
    assert.strictEqual(result, expected);
  })) passed++; else failed++;

  // ── getChapterOverridePath — null paths ───────────────────────────────────

  console.log('\ngetChapterOverridePath — null/not-found cases:');

  if (test('python/skills/nonexistent → returns null', () => {
    const result = getChapterOverridePath('python', 'skills', 'nonexistent-skill-xyz');
    assert.strictEqual(result, null);
  })) passed++; else failed++;

  if (test('unknown chapter → returns null', () => {
    const result = getChapterOverridePath('completely-unknown', 'skills', 'tdd-workflow');
    assert.strictEqual(result, null);
  })) passed++; else failed++;

  if (test('empty chapter string → returns null', () => {
    const result = getChapterOverridePath('', 'skills', 'tdd-workflow');
    assert.strictEqual(result, null);
  })) passed++; else failed++;

  if (test('empty name string → returns null', () => {
    const result = getChapterOverridePath('python', 'skills', '');
    assert.strictEqual(result, null);
  })) passed++; else failed++;

  if (test('devops/skills/tdd-workflow → returns null (no devops override)', () => {
    const result = getChapterOverridePath('devops', 'skills', 'tdd-workflow');
    assert.strictEqual(result, null);
  })) passed++; else failed++;

  // ── Override takes precedence over global ─────────────────────────────────

  console.log('\nOverride precedence:');

  if (test('python tdd-workflow override path is NOT the global skills/tdd-workflow path', () => {
    const overridePath = getChapterOverridePath('python', 'skills', 'tdd-workflow');
    const repoRoot = path.join(CHAPTERS_DIR, '..');
    const globalPath = path.join(repoRoot, 'skills', 'tdd-workflow', 'SKILL.md');
    assert.notStrictEqual(overridePath, globalPath, 'Override path should differ from global path');
  })) passed++; else failed++;

  if (test('cpp tdd-workflow override path is NOT the global skills/tdd-workflow path', () => {
    const overridePath = getChapterOverridePath('cpp', 'skills', 'tdd-workflow');
    const repoRoot = path.join(CHAPTERS_DIR, '..');
    const globalPath = path.join(repoRoot, 'skills', 'tdd-workflow', 'SKILL.md');
    assert.notStrictEqual(overridePath, globalPath);
  })) passed++; else failed++;

  // ── Content verification ──────────────────────────────────────────────────

  console.log('\nContent verification (AC2/AC3):');

  if (test('python tdd-workflow SKILL.md contains pytest', () => {
    const filePath = getChapterOverridePath('python', 'skills', 'tdd-workflow');
    assert.ok(filePath, 'Override path should exist');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('pytest'), 'Python override should mention pytest');
  })) passed++; else failed++;

  if (test('python tdd-workflow SKILL.md does NOT contain GTest', () => {
    const filePath = getChapterOverridePath('python', 'skills', 'tdd-workflow');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(!content.includes('GTest') && !content.includes('gtest'),
      'Python override should NOT contain GTest/gtest');
  })) passed++; else failed++;

  if (test('cpp tdd-workflow SKILL.md contains gtest.h', () => {
    const filePath = getChapterOverridePath('cpp', 'skills', 'tdd-workflow');
    assert.ok(filePath, 'Override path should exist');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('gtest'), 'C++ override should mention gtest');
  })) passed++; else failed++;

  if (test('cpp tdd-workflow SKILL.md does NOT contain pytest', () => {
    const filePath = getChapterOverridePath('cpp', 'skills', 'tdd-workflow');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(!content.includes('pytest'), 'C++ override should NOT contain pytest');
  })) passed++; else failed++;

  if (test('frontend tdd-workflow → returns a path (not null)', () => {
    const result = getChapterOverridePath('frontend', 'skills', 'tdd-workflow');
    assert.notStrictEqual(result, null, 'Should return a path for frontend/skills/tdd-workflow');
  })) passed++; else failed++;

  if (test('frontend tdd-workflow → returned path exists on disk', () => {
    const result = getChapterOverridePath('frontend', 'skills', 'tdd-workflow');
    assert.ok(result !== null && fs.existsSync(result), `Override file should exist at: ${result}`);
  })) passed++; else failed++;

  if (test('frontend tdd-workflow SKILL.md contains Vitest', () => {
    const filePath = getChapterOverridePath('frontend', 'skills', 'tdd-workflow');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('Vitest') || content.includes('vitest'), 'Frontend override should mention Vitest');
  })) passed++; else failed++;

  if (test('frontend tdd-workflow SKILL.md contains Cypress', () => {
    const filePath = getChapterOverridePath('frontend', 'skills', 'tdd-workflow');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('Cypress') || content.includes('cypress'), 'Frontend override should mention Cypress');
  })) passed++; else failed++;

  if (test('frontend tdd-workflow SKILL.md does NOT contain pytest or GTest', () => {
    const filePath = getChapterOverridePath('frontend', 'skills', 'tdd-workflow');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(!content.includes('pytest'), 'Frontend override should NOT contain pytest');
    assert.ok(!content.includes('GTest') && !content.includes('gtest.h'), 'Frontend override should NOT contain GTest');
  })) passed++; else failed++;

  // ── getChapterOnlyItems ───────────────────────────────────────────────────

  console.log('\ngetChapterOnlyItems:');

  if (test('returns an array', () => {
    const result = getChapterOnlyItems('python', 'skills');
    assert.ok(Array.isArray(result));
  })) passed++; else failed++;

  if (test('devops/skills → returns empty (only gitkeep)', () => {
    const result = getChapterOnlyItems('devops', 'skills');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0, 'devops has no chapter-only skills');
  })) passed++; else failed++;

  if (test('does NOT return tdd-workflow as additive (it exists globally)', () => {
    // tdd-workflow is in the global skills/ dir, so it should NOT appear as additive
    const result = getChapterOnlyItems('python', 'skills');
    const names = result.map(i => i.name);
    assert.ok(!names.includes('tdd-workflow'),
      'tdd-workflow exists globally so it is an override, not an additive item');
  })) passed++; else failed++;

  if (test('unknown chapter → returns empty array', () => {
    const result = getChapterOnlyItems('completely-unknown', 'skills');
    assert.deepStrictEqual(result, []);
  })) passed++; else failed++;

  if (test('empty chapter → returns empty array', () => {
    const result = getChapterOnlyItems('', 'skills');
    assert.deepStrictEqual(result, []);
  })) passed++; else failed++;

  if (test('empty type → returns empty array', () => {
    const result = getChapterOnlyItems('python', '');
    assert.deepStrictEqual(result, []);
  })) passed++; else failed++;

  if (test('each result item has name and path properties', () => {
    // Use cpp agents dir — has a gitkeep but no .md files, so result may be empty.
    // Use a safe call that simply checks the shape of any returned items.
    const result = getChapterOnlyItems('python', 'agents');
    for (const item of result) {
      assert.ok(typeof item.name === 'string', 'item.name should be string');
      assert.ok(typeof item.path === 'string', 'item.path should be string');
    }
    // Pass whether empty or not — shape contract is satisfied
  })) passed++; else failed++;

  // ── Results ──────────────────────────────────────────────────────────────

  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

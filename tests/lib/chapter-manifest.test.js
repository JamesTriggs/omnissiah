/**
 * Tests for scripts/lib/chapter-manifest.js
 *
 * Run with: node tests/lib/chapter-manifest.test.js
 */

'use strict';

const assert = require('assert');

const {
  getChapterSkills,
  getChapterAgents,
  CHAPTERS,
  GLOBAL_SKILLS,
  GLOBAL_AGENTS,
} = require('../../scripts/lib/chapter-manifest');

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
  console.log('\n=== Testing chapter-manifest.js ===\n');

  let passed = 0;
  let failed = 0;

  // CHAPTERS constant
  console.log('CHAPTERS constant:');

  if (test('CHAPTERS contains python, cpp, devops, frontend', () => {
    assert.ok(CHAPTERS.includes('python'), 'should include python');
    assert.ok(CHAPTERS.includes('cpp'), 'should include cpp');
    assert.ok(CHAPTERS.includes('devops'), 'should include devops');
    assert.ok(CHAPTERS.includes('frontend'), 'should include frontend');
  })) passed++; else failed++;

  if (test('CHAPTERS contains exactly 4 entries', () => {
    assert.strictEqual(CHAPTERS.length, 4);
  })) passed++; else failed++;

  // GLOBAL_SKILLS
  console.log('\nGLOBAL_SKILLS:');

  if (test('GLOBAL_SKILLS is a non-empty array', () => {
    assert.ok(Array.isArray(GLOBAL_SKILLS));
    assert.ok(GLOBAL_SKILLS.length > 0);
  })) passed++; else failed++;

  if (test('GLOBAL_SKILLS includes coding-standards', () => {
    assert.ok(GLOBAL_SKILLS.includes('coding-standards'));
  })) passed++; else failed++;

  if (test('GLOBAL_SKILLS includes security-review', () => {
    assert.ok(GLOBAL_SKILLS.includes('security-review'));
  })) passed++; else failed++;

  if (test('GLOBAL_SKILLS includes agent-teams', () => {
    assert.ok(GLOBAL_SKILLS.includes('agent-teams'));
  })) passed++; else failed++;

  if (test('GLOBAL_SKILLS includes eval-harness', () => {
    assert.ok(GLOBAL_SKILLS.includes('eval-harness'));
  })) passed++; else failed++;

  if (test('GLOBAL_SKILLS includes cto-level-review', () => {
    assert.ok(GLOBAL_SKILLS.includes('cto-level-review'));
  })) passed++; else failed++;

  if (test('GLOBAL_SKILLS includes senior-engineering', () => {
    assert.ok(GLOBAL_SKILLS.includes('senior-engineering'));
  })) passed++; else failed++;

  if (test('GLOBAL_SKILLS includes senior-secops', () => {
    assert.ok(GLOBAL_SKILLS.includes('senior-secops'));
  })) passed++; else failed++;

  if (test('GLOBAL_SKILLS includes test-engineer', () => {
    assert.ok(GLOBAL_SKILLS.includes('test-engineer'));
  })) passed++; else failed++;

  // GLOBAL_AGENTS
  console.log('\nGLOBAL_AGENTS:');

  if (test('GLOBAL_AGENTS includes security-reviewer', () => {
    assert.ok(GLOBAL_AGENTS.includes('security-reviewer'));
  })) passed++; else failed++;

  if (test('GLOBAL_AGENTS includes harness-orchestrator', () => {
    assert.ok(GLOBAL_AGENTS.includes('harness-orchestrator'));
  })) passed++; else failed++;

  if (test('GLOBAL_AGENTS includes harness-lead', () => {
    assert.ok(GLOBAL_AGENTS.includes('harness-lead'));
  })) passed++; else failed++;

  if (test('GLOBAL_AGENTS includes explorer', () => {
    assert.ok(GLOBAL_AGENTS.includes('explorer'));
  })) passed++; else failed++;

  // getChapterSkills — python
  console.log('\ngetChapterSkills(python):');

  if (test('returns an array', () => {
    const skills = getChapterSkills('python');
    assert.ok(Array.isArray(skills));
  })) passed++; else failed++;

  if (test('includes all global skills', () => {
    const skills = getChapterSkills('python');
    for (const g of GLOBAL_SKILLS) {
      assert.ok(skills.includes(g), `should include global skill: ${g}`);
    }
  })) passed++; else failed++;

  if (test('includes python-patterns', () => {
    assert.ok(getChapterSkills('python').includes('python-patterns'));
  })) passed++; else failed++;

  if (test('includes python-testing', () => {
    assert.ok(getChapterSkills('python').includes('python-testing'));
  })) passed++; else failed++;

  if (test('includes backend-patterns', () => {
    assert.ok(getChapterSkills('python').includes('backend-patterns'));
  })) passed++; else failed++;

  if (test('does NOT include frontend-patterns', () => {
    assert.ok(!getChapterSkills('python').includes('frontend-patterns'));
  })) passed++; else failed++;

  if (test('has no duplicates', () => {
    const skills = getChapterSkills('python');
    const unique = [...new Set(skills)];
    assert.deepStrictEqual(skills, unique, 'should have no duplicates');
  })) passed++; else failed++;

  // getChapterSkills — cpp
  console.log('\ngetChapterSkills(cpp):');

  if (test('includes observability-patterns', () => {
    assert.ok(getChapterSkills('cpp').includes('observability-patterns'));
  })) passed++; else failed++;

  if (test('includes verification-loop', () => {
    assert.ok(getChapterSkills('cpp').includes('verification-loop'));
  })) passed++; else failed++;

  if (test('does NOT include python-patterns', () => {
    assert.ok(!getChapterSkills('cpp').includes('python-patterns'));
  })) passed++; else failed++;

  if (test('does NOT include frontend-patterns', () => {
    assert.ok(!getChapterSkills('cpp').includes('frontend-patterns'));
  })) passed++; else failed++;

  if (test('includes all global skills', () => {
    for (const g of GLOBAL_SKILLS) {
      assert.ok(getChapterSkills('cpp').includes(g), `should include global: ${g}`);
    }
  })) passed++; else failed++;

  // getChapterSkills — devops
  console.log('\ngetChapterSkills(devops):');

  if (test('includes operational-excellence', () => {
    assert.ok(getChapterSkills('devops').includes('operational-excellence'));
  })) passed++; else failed++;

  if (test('includes feature-flags', () => {
    assert.ok(getChapterSkills('devops').includes('feature-flags'));
  })) passed++; else failed++;

  if (test('does NOT include python-patterns', () => {
    assert.ok(!getChapterSkills('devops').includes('python-patterns'));
  })) passed++; else failed++;

  if (test('does NOT include python-testing', () => {
    assert.ok(!getChapterSkills('devops').includes('python-testing'));
  })) passed++; else failed++;

  // getChapterAgents — python
  console.log('\ngetChapterAgents(python):');

  if (test('includes all global agents', () => {
    const agents = getChapterAgents('python');
    for (const g of GLOBAL_AGENTS) {
      assert.ok(agents.includes(g), `should include global agent: ${g}`);
    }
  })) passed++; else failed++;

  if (test('includes python-reviewer', () => {
    assert.ok(getChapterAgents('python').includes('python-reviewer'));
  })) passed++; else failed++;

  if (test('includes database-reviewer', () => {
    assert.ok(getChapterAgents('python').includes('database-reviewer'));
  })) passed++; else failed++;

  if (test('includes migrator', () => {
    assert.ok(getChapterAgents('python').includes('migrator'));
  })) passed++; else failed++;

  if (test('does NOT include cpp-reviewer', () => {
    assert.ok(!getChapterAgents('python').includes('cpp-reviewer'));
  })) passed++; else failed++;

  if (test('does NOT include e2e-runner', () => {
    assert.ok(!getChapterAgents('python').includes('e2e-runner'));
  })) passed++; else failed++;

  if (test('has no duplicates', () => {
    const agents = getChapterAgents('python');
    const unique = [...new Set(agents)];
    assert.deepStrictEqual(agents, unique, 'should have no duplicates');
  })) passed++; else failed++;

  // getChapterAgents — cpp
  console.log('\ngetChapterAgents(cpp):');

  if (test('includes cpp-reviewer', () => {
    assert.ok(getChapterAgents('cpp').includes('cpp-reviewer'));
  })) passed++; else failed++;

  if (test('includes build-error-resolver', () => {
    assert.ok(getChapterAgents('cpp').includes('build-error-resolver'));
  })) passed++; else failed++;

  if (test('does NOT include python-reviewer', () => {
    assert.ok(!getChapterAgents('cpp').includes('python-reviewer'));
  })) passed++; else failed++;

  if (test('does NOT include e2e-runner', () => {
    assert.ok(!getChapterAgents('cpp').includes('e2e-runner'));
  })) passed++; else failed++;

  // Error handling
  console.log('\nError handling:');

  if (test('getChapterSkills throws for unknown chapter', () => {
    assert.throws(
      () => getChapterSkills('completely-unknown'),
      /Unknown chapter/,
      'should throw with "Unknown chapter" message'
    );
  })) passed++; else failed++;

  if (test('getChapterAgents throws for unknown chapter', () => {
    assert.throws(
      () => getChapterAgents('completely-unknown'),
      /Unknown chapter/,
      'should throw with "Unknown chapter" message'
    );
  })) passed++; else failed++;

  if (test('getChapterSkills(frontend) returns frontend-patterns', () => {
    assert.ok(getChapterSkills('frontend').includes('frontend-patterns'));
  })) passed++; else failed++;

  if (test('getChapterAgents(frontend) returns e2e-runner', () => {
    assert.ok(getChapterAgents('frontend').includes('e2e-runner'));
  })) passed++; else failed++;

  if (test('getChapterSkills(frontend) does NOT return python-patterns', () => {
    assert.ok(!getChapterSkills('frontend').includes('python-patterns'));
  })) passed++; else failed++;

  if (test('getChapterSkills(frontend) does NOT return python-testing', () => {
    assert.ok(!getChapterSkills('frontend').includes('python-testing'));
  })) passed++; else failed++;

  if (test('getChapterSkills throws for empty string', () => {
    assert.throws(
      () => getChapterSkills(''),
      /Unknown chapter/
    );
  })) passed++; else failed++;

  // AC5 — global skills and agents are present in every chapter
  console.log('\nAC5 — Global items present in all chapters:');

  for (const ch of CHAPTERS) {
    if (test(`${ch}: includes security-review skill`, () => {
      assert.ok(getChapterSkills(ch).includes('security-review'));
    })) passed++; else failed++;

    if (test(`${ch}: includes coding-standards skill`, () => {
      assert.ok(getChapterSkills(ch).includes('coding-standards'));
    })) passed++; else failed++;

    if (test(`${ch}: includes review lens skills`, () => {
      for (const skill of ['cto-level-review', 'senior-engineering', 'senior-secops', 'test-engineer']) {
        assert.ok(getChapterSkills(ch).includes(skill), `should include ${skill}`);
      }
    })) passed++; else failed++;

    if (test(`${ch}: includes security-reviewer agent`, () => {
      assert.ok(getChapterAgents(ch).includes('security-reviewer'));
    })) passed++; else failed++;
  }

  // Results
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

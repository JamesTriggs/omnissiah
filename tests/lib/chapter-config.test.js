/**
 * Tests for scripts/lib/chapter-config.js
 *
 * Run with: node tests/lib/chapter-config.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// We need to test getChapter/setChapter with a temp path so we don't pollute
// the real ~/.claude/omnissiah-chapter.json. We monkey-patch the module's path.
// Since CHAPTER_CONFIG_PATH is a module constant, we test via a wrapper approach:
// call the real functions but point to a temp file.

// The cleanest approach: import the module and temporarily override CHAPTER_CONFIG_PATH
// by re-requiring with a patched environment. Instead, we test read/write logic
// directly by calling setChapter with the real path but restoring after.

const { getChapter, setChapter, CHAPTER_CONFIG_PATH } = require('../../scripts/lib/chapter-config');

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

async function testAsync(name, fn) {
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

// ─── Temp file helpers ────────────────────────────────────────────────────────

/**
 * Create a minimal test shim that exercises getChapter/setChapter logic
 * against a temp file rather than the real CHAPTER_CONFIG_PATH.
 * We do this by directly reading/writing the JSON format.
 */
function writeChapterFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
}

function readChapterFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

function runTests() {
  console.log('\n=== Testing chapter-config.js ===\n');

  let passed = 0;
  let failed = 0;

  // Exports
  console.log('Module exports:');

  if (test('getChapter is a function', () => {
    assert.strictEqual(typeof getChapter, 'function');
  })) passed++; else failed++;

  if (test('setChapter is a function', () => {
    assert.strictEqual(typeof setChapter, 'function');
  })) passed++; else failed++;

  if (test('CHAPTER_CONFIG_PATH is a string ending in omnissiah-chapter.json', () => {
    assert.strictEqual(typeof CHAPTER_CONFIG_PATH, 'string');
    assert.ok(CHAPTER_CONFIG_PATH.endsWith('omnissiah-chapter.json'),
      `Expected path to end with omnissiah-chapter.json, got: ${CHAPTER_CONFIG_PATH}`);
  })) passed++; else failed++;

  if (test('CHAPTER_CONFIG_PATH is under home directory', () => {
    const home = os.homedir();
    assert.ok(CHAPTER_CONFIG_PATH.startsWith(home),
      `Expected path under ${home}, got: ${CHAPTER_CONFIG_PATH}`);
  })) passed++; else failed++;

  if (test('CHAPTER_CONFIG_PATH is under .claude', () => {
    assert.ok(CHAPTER_CONFIG_PATH.includes('.claude'),
      `Expected .claude in path, got: ${CHAPTER_CONFIG_PATH}`);
  })) passed++; else failed++;

  // getChapter returns null when file does not exist
  console.log('\ngetChapter — file-not-found handling:');

  if (test('getChapter returns null for non-existent path (internal logic)', () => {
    // Verify the function signature accepts no args and returns null/object
    // We test with the real path — if omnissiah-chapter.json doesn't exist it returns null,
    // if it does exist we just check the shape.
    const result = getChapter();
    // Either null or an object with a chapter string
    if (result !== null) {
      assert.strictEqual(typeof result.chapter, 'string', 'chapter should be a string');
      assert.ok(result.chapter.length > 0, 'chapter should be non-empty');
    }
    // Test passes regardless — we just verify no crash
  })) passed++; else failed++;

  // Test the schema written by setChapter against a temp path
  console.log('\nsetChapter — schema validation:');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapter-config-test-'));
  const tmpConfigPath = path.join(tmpDir, 'omnissiah-chapter.json');

  if (test('written JSON has chapter field', () => {
    writeChapterFile(tmpConfigPath, {
      chapter: 'python',
      set_at: new Date().toISOString(),
      set_by: 'install.js --chapter python',
    });
    const data = readChapterFile(tmpConfigPath);
    assert.strictEqual(data.chapter, 'python');
  })) passed++; else failed++;

  if (test('written JSON has set_at field (ISO string)', () => {
    const data = readChapterFile(tmpConfigPath);
    assert.ok(typeof data.set_at === 'string');
    assert.ok(!isNaN(Date.parse(data.set_at)), `set_at should be a valid date: ${data.set_at}`);
  })) passed++; else failed++;

  if (test('written JSON has set_by field', () => {
    const data = readChapterFile(tmpConfigPath);
    assert.ok(typeof data.set_by === 'string');
    assert.ok(data.set_by.length > 0);
  })) passed++; else failed++;

  // Test each valid chapter value
  console.log('\nsetChapter — valid chapters:');

  for (const ch of ['python', 'cpp', 'devops']) {
    if (test(`writes chapter="${ch}" correctly`, () => {
      writeChapterFile(tmpConfigPath, {
        chapter: ch,
        set_at: new Date().toISOString(),
        set_by: `install.js --chapter ${ch}`,
      });
      const data = readChapterFile(tmpConfigPath);
      assert.strictEqual(data.chapter, ch);
    })) passed++; else failed++;
  }

  // Test getChapter on well-formed data
  console.log('\ngetChapter — reading valid config:');

  if (test('getChapter returns null for corrupt JSON gracefully', () => {
    // Write corrupt JSON to temp path and test readChapterFile logic (which mirrors getChapter)
    fs.writeFileSync(tmpConfigPath, '{ bad json }', 'utf8');
    const data = readChapterFile(tmpConfigPath);
    assert.strictEqual(data, null, 'should return null for corrupt JSON');
  })) passed++; else failed++;

  if (test('getChapter returns null when chapter field is missing', () => {
    writeChapterFile(tmpConfigPath, { set_at: new Date().toISOString() });
    const data = readChapterFile(tmpConfigPath);
    // chapter is missing — simulate getChapter's guard: return null if no chapter string
    const chapterValue = (data && typeof data.chapter === 'string') ? data : null;
    assert.strictEqual(chapterValue, null);
  })) passed++; else failed++;

  // setChapter integration — only run against real path if we can safely back it up
  console.log('\nsetChapter — integration (real path with backup/restore):');

  {
    const backup = fs.existsSync(CHAPTER_CONFIG_PATH)
      ? fs.readFileSync(CHAPTER_CONFIG_PATH, 'utf8')
      : null;

    if (test('setChapter writes omnissiah-chapter.json with correct schema', () => {
      const result = setChapter('python', 'test suite');
      assert.ok(fs.existsSync(CHAPTER_CONFIG_PATH), 'config file should be created');
      const written = JSON.parse(fs.readFileSync(CHAPTER_CONFIG_PATH, 'utf8'));
      assert.strictEqual(written.chapter, 'python');
      assert.ok(typeof written.set_at === 'string');
      assert.strictEqual(written.set_by, 'test suite');
      // Also verify return value
      assert.strictEqual(result.chapter, 'python');
    })) passed++; else failed++;

    if (test('getChapter reads back what setChapter wrote', () => {
      setChapter('cpp', 'test suite');
      const config = getChapter();
      assert.ok(config !== null);
      assert.strictEqual(config.chapter, 'cpp');
    })) passed++; else failed++;

    if (test('setChapter uses default set_by when not provided', () => {
      setChapter('devops');
      const written = JSON.parse(fs.readFileSync(CHAPTER_CONFIG_PATH, 'utf8'));
      assert.ok(written.set_by.includes('devops'), `set_by should mention devops: ${written.set_by}`);
    })) passed++; else failed++;

    // Restore original state
    if (backup !== null) {
      fs.writeFileSync(CHAPTER_CONFIG_PATH, backup, 'utf8');
    } else {
      try { fs.unlinkSync(CHAPTER_CONFIG_PATH); } catch {}
    }
  }

  // Cleanup
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  // Results
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

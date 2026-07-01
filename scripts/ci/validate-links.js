#!/usr/bin/env node
/**
 * Validate internal skill/command cross-references.
 *
 * Scans every skills/<name>/SKILL.md and commands/<name>.md for references to
 * other skills or commands and fails if a referenced skill/command does not
 * exist on disk. This catches, for example, a skill that references a
 * non-existent command such as `/inspiration-fuse`.
 *
 * To avoid false positives on ordinary slashes we only treat a token as a
 * reference when it is:
 *   - a backtick-wrapped `/kebab-name`  (e.g. `/code-review`), or
 *   - an explicit repo path `skills/<name>/<file>` that resolves to a concrete
 *     file (SKILL.md, a script, etc.). A bare `skills/<name>/` with no file
 *     component is treated as prose (e.g. "skills/commands/agents") and ignored.
 *
 * Claude Code built-in slash commands (e.g. /compact, /clear) are exempt, and
 * lines that merely describe a command being *created* as an example
 * (e.g. "Creates: `/new-table` command") are skipped.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const COMMANDS_DIR = path.join(ROOT, 'commands');

// Claude Code built-in slash commands are not plugin content; never flag them.
const BUILTIN_COMMANDS = new Set([
  'compact',
  'clear',
  'help',
  'init',
  'review',
  'config',
  'cost',
  'doctor',
  'login',
  'logout',
  'model',
  'status',
  'memory',
  'resume',
  'agents',
  'mcp',
]);

// Lines describing a command/skill being generated as an example, not a
// cross-reference to existing content. Matched case-insensitively.
const EXAMPLE_LINE_RE = /(creates?|generates?|produces?|would create|new)\b[^`]*`\//i;

function listSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return new Set();
  return new Set(
    fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
  );
}

function listCommands() {
  if (!fs.existsSync(COMMANDS_DIR)) return new Set();
  return new Set(
    fs.readdirSync(COMMANDS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''))
  );
}

function collectSourceFiles() {
  const files = [];

  // Each skill's SKILL.md.
  if (fs.existsSync(SKILLS_DIR)) {
    for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
      if (fs.existsSync(skillMd)) files.push(skillMd);
    }
  }

  // Each command markdown file.
  if (fs.existsSync(COMMANDS_DIR)) {
    for (const f of fs.readdirSync(COMMANDS_DIR)) {
      if (f.endsWith('.md')) files.push(path.join(COMMANDS_DIR, f));
    }
  }

  return files;
}

function validateLinks() {
  const skills = listSkills();
  const commands = listCommands();
  const files = collectSourceFiles();

  if (files.length === 0) {
    console.log('No skill/command files found, skipping link validation');
    process.exit(0);
  }

  const broken = [];

  // Backtick-wrapped /kebab-name, e.g. `/code-review`.
  const slashRefRe = /`\/([a-z][a-z0-9-]*)`/g;
  // Explicit repo path skills/<name>/<file>, requiring a concrete file
  // component ending in a known extension so prose like "skills/commands/agents"
  // (no file) is not mistaken for a reference.
  const skillPathRe =
    /skills\/([a-z][a-z0-9-]*)\/[A-Za-z0-9._/-]*\.(?:md|js|py|sh|json)\b/g;

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, 'utf-8');
    const lines = text.split('\n');

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;

      // `/name` references (command or skill).
      let m;
      slashRefRe.lastIndex = 0;
      while ((m = slashRefRe.exec(line)) !== null) {
        const name = m[1];
        if (BUILTIN_COMMANDS.has(name)) continue;
        if (commands.has(name) || skills.has(name)) continue;
        if (EXAMPLE_LINE_RE.test(line)) continue; // illustrative, not a reference
        broken.push(
          `${rel}:${lineNo}: references \`/${name}\` but no such command or skill exists`
        );
      }

      // skills/<name>/ path references.
      skillPathRe.lastIndex = 0;
      while ((m = skillPathRe.exec(line)) !== null) {
        const name = m[1];
        if (skills.has(name)) continue;
        broken.push(
          `${rel}:${lineNo}: references skills/${name}/ but no such skill exists`
        );
      }
    });
  }

  if (broken.length > 0) {
    console.error(`Found ${broken.length} broken internal reference(s):`);
    for (const b of broken) console.error(`ERROR: ${b}`);
    process.exit(1);
  }

  console.log(`Validated internal references in ${files.length} skill/command files`);
}

validateLinks();

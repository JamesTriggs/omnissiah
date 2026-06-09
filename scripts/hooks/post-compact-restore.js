#!/usr/bin/env node
/**
 * PostCompact Hook — Skill Context Restoration
 *
 * Runs after Claude compacts context. Re-injects summaries of the most
 * relevant skills to prevent capability regression after compaction.
 *
 * Inspired by Claude Code's post-compact hook pattern:
 * - Reads ~/.claude/homunculus/observations.jsonl to determine active skills
 * - Re-injects top 5 skill summaries (capped at 5K chars each, 25K total)
 * - Falls back to coding-standards when no data is available
 * - Outputs to stdout (injected as context by Claude Code's PostCompact system)
 *
 * Safety contract:
 *   - Exits 0 in ALL cases
 *   - Stdout output is the restored context (Claude Code injects it)
 *   - Gracefully handles missing observations, missing skill files, permissions
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_TOTAL_CHARS = 25000;
const MAX_SKILL_CHARS = 5000;
const MAX_SKILLS = 5;
const RECENT_OBS_LINES = 100;

// Maps tool names to skill domains they signal
const TOOL_TO_SKILLS = {
  Bash:   ['backend-patterns', 'coding-standards', 'python-patterns'],
  Write:  ['coding-standards', 'python-patterns', 'frontend-patterns'],
  Edit:   ['coding-standards', 'python-patterns', 'frontend-patterns'],
  Read:   ['coding-standards'],
  Glob:   ['coding-standards'],
  Grep:   ['coding-standards'],
  Agent:  ['coding-standards', 'iterative-retrieval'],
};

function getPluginRoot() {
  // Script lives at <plugin-root>/scripts/hooks/post-compact-restore.js
  return path.join(__dirname, '..', '..');
}

function getObsFile() {
  return path.join(os.homedir(), '.claude', 'homunculus', 'observations.jsonl');
}

/**
 * Read the last N lines of a text file.
 */
function readLastLines(filePath, n) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').filter(l => l.trim()).slice(-n);
  } catch {
    return [];
  }
}

/**
 * Derive the top skill names from recent observations by counting tool usage.
 */
function getSkillsFromObservations(obsFile) {
  const lines = readLastLines(obsFile, RECENT_OBS_LINES);
  const tally = {};

  for (const line of lines) {
    try {
      const obs = JSON.parse(line);
      const skills = TOOL_TO_SKILLS[obs.tool] || [];
      for (const skill of skills) {
        tally[skill] = (tally[skill] || 0) + 1;
      }
    } catch {
      // Skip malformed lines
    }
  }

  return Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill);
}

/**
 * Load the first MAX_SKILL_CHARS of a skill's SKILL.md, truncating at a
 * paragraph boundary when possible.
 */
function loadSkillSummary(skillName, pluginRoot) {
  const filePath = path.join(pluginRoot, 'skills', skillName, 'SKILL.md');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length <= MAX_SKILL_CHARS) return content;

    const truncated = content.slice(0, MAX_SKILL_CHARS);
    const lastParagraph = truncated.lastIndexOf('\n\n');
    const cutAt = lastParagraph > MAX_SKILL_CHARS * 0.6 ? lastParagraph : MAX_SKILL_CHARS;
    return truncated.slice(0, cutAt) + '\n\n_[...truncated — load full skill for complete reference]_';
  } catch {
    return null;
  }
}

function main() {
  const pluginRoot = getPluginRoot();
  const obsFile = getObsFile();

  // Determine which skills to restore
  let skills = fs.existsSync(obsFile) ? getSkillsFromObservations(obsFile) : [];

  // Always ensure coding-standards is present as a baseline fallback
  for (const fallback of ['coding-standards']) {
    if (!skills.includes(fallback)) skills.push(fallback);
  }
  skills = skills.slice(0, MAX_SKILLS);

  // Build restored context output
  const lines = [
    '## Skill Context Restored After Compaction\n',
    'The following skills were active before compaction and have been re-injected.\n',
  ];
  let totalChars = lines.join('').length;

  for (const skillName of skills) {
    if (totalChars >= MAX_TOTAL_CHARS) break;

    const summary = loadSkillSummary(skillName, pluginRoot);
    if (!summary) continue;

    const section = `\n---\n### Skill: ${skillName}\n\n${summary}\n`;
    const remaining = MAX_TOTAL_CHARS - totalChars;

    if (section.length > remaining) {
      if (remaining > 300) {
        lines.push(`\n---\n### Skill: ${skillName}\n\n${summary.slice(0, remaining - 60)}\n_[...truncated]_\n`);
      }
      break;
    }

    lines.push(section);
    totalChars += section.length;
  }

  process.stdout.write(lines.join(''));
  // No explicit process.exit() — let Node drain stdout naturally before exiting.
  // Calling process.exit(0) immediately after a large stdout.write() can truncate
  // the output when stdout is a pipe (up to 25 KB may still be pending).
}

try {
  main();
} catch {
  // Never block session on restore failure
}

'use strict';

/**
 * chapter-overrides.js — Chapter-specific skill/agent/command overrides.
 *
 * Implements the `chapters/` directory resolution logic:
 *
 *   1. Override: `chapters/<chapter>/<type>/<name>/SKILL.md` replaces the global
 *      `skills/<name>/SKILL.md` when installing for that chapter.
 *
 *   2. Additive: files in `chapters/<chapter>/<type>/` that do NOT exist globally
 *      are installed as chapter-only additions.
 *
 * Usage:
 *   const {
 *     getChapterOverridePath,
 *     getChapterOnlyItems,
 *     CHAPTERS_DIR,
 *   } = require('./chapter-overrides');
 *
 *   // getChapterOverridePath(chapter, type, name) → string | null
 *   // getChapterOnlyItems(chapter, type)          → [{name, path}]
 */

const fs   = require('fs');
const path = require('path');

// ─── Exported constants ───────────────────────────────────────────────────────

/**
 * Absolute path to the `chapters/` directory at the repo root.
 * Derived from this file's location: scripts/lib/ → ../../chapters/
 */
const CHAPTERS_DIR = path.join(__dirname, '..', '..', 'chapters');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return the path to the override file for a given chapter/type/name, or null
 * if no override exists.
 *
 * Resolution rules per type:
 *   - 'skills'   → chapters/<chapter>/skills/<name>/SKILL.md
 *   - 'agents'   → chapters/<chapter>/agents/<name>.md
 *   - 'commands' → chapters/<chapter>/commands/<name>.md
 *
 * Returns null for unknown chapters and unknown types.
 *
 * @param {string} chapter — 'python' | 'cpp' | 'devops'
 * @param {'skills'|'agents'|'commands'} type
 * @param {string} name — skill/agent/command name
 * @returns {string|null}
 */
function getChapterOverridePath(chapter, type, name) {
  if (!chapter || typeof chapter !== 'string') return null;
  if (!type    || typeof type    !== 'string') return null;
  if (!name    || typeof name    !== 'string') return null;

  const chapterDir = path.join(CHAPTERS_DIR, chapter, type);
  if (!fs.existsSync(chapterDir)) return null;

  let candidatePath;
  switch (type) {
    case 'skills':
      candidatePath = path.join(chapterDir, name, 'SKILL.md');
      break;
    case 'agents':
      candidatePath = path.join(chapterDir, `${name}.md`);
      break;
    case 'commands':
      candidatePath = path.join(chapterDir, `${name}.md`);
      break;
    default:
      return null;
  }

  return fs.existsSync(candidatePath) ? candidatePath : null;
}

/**
 * Scan `chapters/<chapter>/<type>/` and return all items that do NOT exist in
 * the global baseline (`skills/<name>/`, `agents/<name>.md`, etc.).
 *
 * Items that are in the global baseline are overrides, not additions.
 * This function returns only the additive ones.
 *
 * @param {string} chapter — 'python' | 'cpp' | 'devops'
 * @param {'skills'|'agents'|'commands'} type
 * @returns {{name: string, path: string}[]}
 */
function getChapterOnlyItems(chapter, type) {
  if (!chapter || !type) return [];

  const chapterTypeDir = path.join(CHAPTERS_DIR, chapter, type);
  if (!fs.existsSync(chapterTypeDir)) return [];

  // Determine the global baseline directory
  const repoRoot = path.join(__dirname, '..', '..');
  let globalDir;
  switch (type) {
    case 'skills':   globalDir = path.join(repoRoot, 'skills');   break;
    case 'agents':   globalDir = path.join(repoRoot, 'agents');   break;
    case 'commands': globalDir = path.join(repoRoot, 'commands'); break;
    default: return [];
  }

  const results = [];

  let entries;
  try {
    entries = fs.readdirSync(chapterTypeDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    // Skip hidden files and gitkeep placeholders
    if (entry.name.startsWith('.')) continue;

    if (type === 'skills') {
      // Skills are directories containing SKILL.md
      if (!entry.isDirectory()) continue;
      const skillName = entry.name;

      // Check whether this skill exists in the global baseline
      const globalSkillDir = path.join(globalDir, skillName);
      if (fs.existsSync(globalSkillDir)) continue; // it's an override, not additive

      const overridePath = path.join(chapterTypeDir, skillName, 'SKILL.md');
      if (!fs.existsSync(overridePath)) continue; // no SKILL.md — invalid

      results.push({ name: skillName, path: overridePath });

    } else {
      // Agents and commands are .md files
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md')) continue;

      const itemName = path.basename(entry.name, '.md');
      const globalFilePath = path.join(globalDir, entry.name);
      if (fs.existsSync(globalFilePath)) continue; // override, not additive

      results.push({
        name: itemName,
        path: path.join(chapterTypeDir, entry.name),
      });
    }
  }

  return results;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getChapterOverridePath,
  getChapterOnlyItems,
  CHAPTERS_DIR,
};

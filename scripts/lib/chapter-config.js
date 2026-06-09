'use strict';

/**
 * chapter-config.js — Read/write ~/.claude/omnissiah-chapter.json
 *
 * The chapter config file stores the engineer's active chapter (python, cpp, devops).
 * It is written at install time via --chapter flag and read by session-start.js.
 *
 * Schema:
 *   {
 *     "chapter": "python",
 *     "set_at": "2026-04-16T10:00:00Z",
 *     "set_by": "install.js --chapter python"
 *   }
 *
 * Usage:
 *   const { getChapter, setChapter, CHAPTER_CONFIG_PATH } = require('./chapter-config');
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Config path ──────────────────────────────────────────────────────────────

const CHAPTER_CONFIG_PATH = path.join(os.homedir(), '.claude', 'omnissiah-chapter.json');

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Read the current chapter config.
 *
 * @returns {{ chapter: string, set_at: string, set_by: string } | null}
 *   Returns the config object if omnissiah-chapter.json exists and is valid,
 *   or null if the file does not exist or cannot be parsed.
 */
function getChapter() {
  try {
    if (!fs.existsSync(CHAPTER_CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CHAPTER_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.chapter !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Write the chapter config to ~/.claude/omnissiah-chapter.json.
 * Creates ~/.claude/ if it does not exist.
 *
 * @param {string} chapter — one of 'python', 'cpp', 'devops'
 * @param {string} [setBy] — description of who set this (default: 'install.js --chapter <name>')
 * @throws {Error} if the file cannot be written
 */
function setChapter(chapter, setBy) {
  const configDir = path.dirname(CHAPTER_CONFIG_PATH);
  fs.mkdirSync(configDir, { recursive: true });

  const config = {
    chapter,
    set_at: new Date().toISOString(),
    set_by: setBy || `install.js --chapter ${chapter}`,
  };

  fs.writeFileSync(CHAPTER_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return config;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getChapter,
  setChapter,
  CHAPTER_CONFIG_PATH,
};

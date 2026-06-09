'use strict';

/**
 * chapter-manifest.js — Single source of truth for the chapter taxonomy.
 *
 * Defines which skills and agents are loaded per chapter.
 * Global items are always loaded regardless of chapter.
 *
 * Usage:
 *   const { getChapterSkills, getChapterAgents, CHAPTERS } = require('./chapter-manifest');
 */

// ─── Global items — always loaded, never excluded ─────────────────────────────

const GLOBAL_SKILLS = [
  'coding-standards',
  'security-review',
  'agent-teams',
  'iterative-retrieval',
  'strategic-compact',
  'continuous-learning-v2',
  'eval-harness',
  'project-opinion-elicitor',
  'flaw-scan-x5',
  'product-clarity-review',
  'cto-level-review',
  'senior-engineering',
  'senior-secops',
  'test-engineer',
  'ceo-advisor',
];

const GLOBAL_AGENTS = [
  'security-reviewer',
  'harness-orchestrator',
  'harness-lead',
  'harness-intake',
  'explorer',
  'architect',
  'planner',
  'code-reviewer',
];

// ─── Chapter-specific items ───────────────────────────────────────────────────

const CHAPTER_SKILLS = {
  python: [
    'python-patterns',
    'python-testing',
    'backend-patterns',
    'tdd-workflow',
    'verification-loop',
  ],
  cpp: [
    'tdd-workflow',
    'verification-loop',
    'observability-patterns',
  ],
  devops: [
    'operational-excellence',
    'observability-patterns',
    'feature-flags',
    'security-review',       // also global, but explicit here for clarity
  ],
  frontend: [
    'frontend-patterns',
    'tdd-workflow',
    'verification-loop',
    'feature-flags',
    'observability-patterns',
  ],
};

const CHAPTER_AGENTS = {
  python: [
    'python-reviewer',
    'database-reviewer',
    'tdd-guide',
    'debugger',
    'performance',
    'migrator',
  ],
  cpp: [
    'cpp-reviewer',
    'debugger',
    'performance',
    'build-error-resolver',
  ],
  devops: [
    'architect',             // also global, but explicit here for clarity
    'planner',               // also global, but explicit here for clarity
    'integrator',
    'security-reviewer',     // also global
    'migrator',
  ],
  frontend: [
    'e2e-runner',
    'tdd-guide',
    'debugger',
    'code-reviewer',         // also global
    'performance',
  ],
};

// ─── Valid chapter names ──────────────────────────────────────────────────────

const CHAPTERS = Object.keys(CHAPTER_SKILLS);

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Returns the complete set of skill names for a chapter (global + chapter-specific).
 * Duplicate entries are deduplicated.
 *
 * @param {string} chapter — one of 'python', 'cpp', 'devops'
 * @returns {string[]} ordered array of skill names
 * @throws {Error} if chapter is not recognised
 */
function getChapterSkills(chapter) {
  if (!CHAPTERS.includes(chapter)) {
    throw new Error(`Unknown chapter: "${chapter}". Valid chapters: ${CHAPTERS.join(', ')}`);
  }
  const combined = [...GLOBAL_SKILLS, ...CHAPTER_SKILLS[chapter]];
  // Deduplicate while preserving order
  return [...new Set(combined)];
}

/**
 * Returns the complete set of agent names for a chapter (global + chapter-specific).
 * Duplicate entries are deduplicated.
 *
 * @param {string} chapter — one of 'python', 'cpp', 'devops'
 * @returns {string[]} ordered array of agent names
 * @throws {Error} if chapter is not recognised
 */
function getChapterAgents(chapter) {
  if (!CHAPTERS.includes(chapter)) {
    throw new Error(`Unknown chapter: "${chapter}". Valid chapters: ${CHAPTERS.join(', ')}`);
  }
  const combined = [...GLOBAL_AGENTS, ...CHAPTER_AGENTS[chapter]];
  return [...new Set(combined)];
}

module.exports = {
  getChapterSkills,
  getChapterAgents,
  CHAPTERS,
  GLOBAL_SKILLS,
  GLOBAL_AGENTS,
  CHAPTER_SKILLS,
  CHAPTER_AGENTS,
};

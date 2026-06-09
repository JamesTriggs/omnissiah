#!/usr/bin/env node
/**
 * SessionStart Hook — Welcome banner, health check, project detection
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Outputs:
 *   1. Welcome banner with Penrose triangle ASCII art
 *   2. Health check (hooks, LLM-TLDR, framework integrity)
 *   3. If in a parent directory, lists available projects
 *   4. Session continuity (recent sessions, learned skills, aliases)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  getSessionsDir,
  getLearnedSkillsDir,
  findFiles,
  ensureDir,
  log,
  commandExists,
  isGitRepo,
  runCommand
} = require('../lib/utils');
const { getPackageManager, getSelectionPrompt } = require('../lib/package-manager');
const { listAliases } = require('../lib/session-aliases');
const { getChapter } = require('../lib/chapter-config');
const { getChapterOverridePath, CHAPTERS_DIR } = require('../lib/chapter-overrides');

// ─── ASCII Art ────────────────────────────────────────────────────────────────
// Penrose (impossible) triangle — right-pointing.
//
// Structure mirrors the logo:
//   /|    = top-left outer diagonal + impossible vertical left face (|)
//   /--\  = inner hollow cutout
//    >    = right-pointing apex
//   \|    = bottom-left outer diagonal + impossible left face
//
// The | on the left is the key Penrose feature — it represents the impossible
// vertical face that makes the triangle appear to loop back on itself in 3D.

function banner(pluginVersion) {
  // High-fidelity Penrose triangle: extracted from ascii-art.txt at col 209,
  // then compressed 2× vertically with Unicode half-block chars (▀ ▄ █).
  // Source: 43 rows × 69 cols → 22 rows × 69 cols.
  const logo = [
    "     ▄▄▄▄████▄▄▄",
    "▄▄████▀▀▀   ▀▀▀████▄▄▄",
    "████▀███▄▄▄       ▀▀▀▀████▄▄",
    "████    ▀▀▀███▄▄▄        ▀▀▀████▄▄▄",
    "████          ▀▀▀████▄▄▄       ▀▀▀████▄▄▄",
    "████     ▄▄▄▄        ▀▀▀███▄▄▄        ▀▀▀████▄▄▄",
    "████     ███▀▀███▄▄▄       ▀▀▀███▄▄▄        ▀▀▀████▄▄▄",
    "████     ███     ▀█████▄▄▄       ▀▀▀▀███▄▄▄        ▀▀▀███▄▄▄▄",
    "████     ███      ███ ▀▀▀▀███▄▄▄▄       ▀▀▀███▄▄▄        ▀▀▀████▄▄▄",
    "████     ███      ███        ▀▀▀████▄▄▄      ▄█████▀          ▄██████",
    "████     ███      ███              ▀▀▀███████▀▀▀        ▄▄▄███▀▀▀ ███",
    "████     ███      ███           ▄▄▄████▀▀▀       ▄▄▄▄██▀▀▀        ███",
    "████     ███      ███     ▄▄████▀▀▀▀       ▄▄▄███▀▀▀        ▄▄▄▄███▀▀",
    "████     ███      ███▄████▀▀▀        ▄▄▄██▀▀▀▀        ▄▄▄███▀▀▀▀",
    "████     ███      ███▀▀       ▄▄▄███▀▀▀         ▄▄▄███▀▀▀",
    "████     ███      ███   ▄▄▄███▀▀▀        ▄▄▄███▀▀▀▀",
    "████     ███      █████▀▀▀         ▄▄▄███▀▀▀▀",
    "████     ███      ▀▀        ▄▄▄████▀▀▀",
    "████     ███          ▄▄▄███▀▀▀▀",
    "████▄▄   ███    ▄▄▄███▀▀▀",
    "  ▀▀▀███████████▀▀▀",
    "         ▀▀▀",
    "",
  ];

  // Text sits below the logo, centred to the same width
  const taglines = [
    'O M N I S S I A H  ·  Dev OS',
    `v${pluginVersion}`,
  ];

  const INNER = 2 + Math.max(
    ...logo.map(l => l.length),
    ...taglines.map(t => t.length)
  ) + 2;

  const logoRows = logo.map(l => {
    const line = '  ' + l;
    return '║' + line + ' '.repeat(Math.max(0, INNER - line.length)) + '║';
  });

  const textRows = taglines.map(t => {
    const pad = Math.max(0, Math.floor((INNER - t.length) / 2));
    const line = ' '.repeat(pad) + t;
    return '║' + line + ' '.repeat(Math.max(0, INNER - line.length)) + '║';
  });

  return [
    '╔' + '═'.repeat(INNER) + '╗',
    '║' + ' '.repeat(INNER) + '║',
    ...logoRows,
    '║' + ' '.repeat(INNER) + '║',
    ...textRows,
    '║' + ' '.repeat(INNER) + '║',
    '╚' + '═'.repeat(INNER) + '╝',
  ].join('\n');
}

// ─── Health Check ─────────────────────────────────────────────────────────────

function runHealthCheck(pluginRoot) {
  const results = [];

  // 1. Hook scripts exist
  const hooksDir = path.join(pluginRoot, 'scripts', 'hooks');
  const requiredHooks = [
    'bash-pre-dispatch.js', 'bash-pre-secret-check.js',
    'session-end.js', 'pre-compact.js', 'post-compact-restore.js',
    'write-post-python-lint.js', 'write-post-python-typecheck.js',
  ];
  const missingHooks = requiredHooks.filter(h => !fs.existsSync(path.join(hooksDir, h)));
  if (missingHooks.length === 0) {
    results.push({ ok: true,  label: 'Hook scripts' });
  } else {
    results.push({ ok: false, label: `Hook scripts (missing: ${missingHooks.join(', ')})` });
  }

  // 2. plugin.json readable
  try {
    JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
    results.push({ ok: true, label: 'plugin.json' });
  } catch {
    results.push({ ok: false, label: 'plugin.json (parse error)' });
  }

  // 3. hooks.json readable
  try {
    JSON.parse(fs.readFileSync(path.join(pluginRoot, 'hooks', 'hooks.json'), 'utf8'));
    results.push({ ok: true, label: 'hooks.json' });
  } catch {
    results.push({ ok: false, label: 'hooks.json (parse error)' });
  }

  // 4. LLM-TLDR installed
  if (commandExists('tldr')) {
    results.push({ ok: true, label: 'LLM-TLDR (tldr)' });
  } else {
    results.push({ ok: false, label: 'LLM-TLDR not installed — run: pip install llm-tldr' });
  }

  // 5. LLM-TLDR index for current project
  const cwd = process.cwd();
  const tldrCache = path.join(cwd, '.tldr', 'cache');
  if (fs.existsSync(tldrCache)) {
    results.push({ ok: true,  label: `TLDR index (${path.basename(cwd)})` });
  } else {
    results.push({ ok: false, label: `TLDR index missing — run: tldr warm . (in ${path.basename(cwd)})` });
  }

  return results;
}

// ─── Project Detection ────────────────────────────────────────────────────────

/**
 * When launched from a parent/workspace directory, scan for child git
 * repositories and list them so the user can load one
 * with `/project <name>`.
 */
function detectProjects(cwd) {
  // If we're already in a git repo, no need to scan
  if (isGitRepo()) return [];

  const projects = [];
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      const gitDir = path.join(cwd, entry.name, '.git');
      if (fs.existsSync(gitDir)) {
        const hasClaude = fs.existsSync(path.join(cwd, entry.name, 'CLAUDE.md'));
        const hasTldr   = fs.existsSync(path.join(cwd, entry.name, '.tldr', 'cache'));
        projects.push({ name: entry.name, hasClaude, hasTldr });
      }
    }
  } catch {
    // Non-fatal
  }
  return projects;
}

// ─── Plugin version ───────────────────────────────────────────────────────────

function getPluginVersion(pluginRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // plugin root = scripts/hooks/../../
  const pluginRoot = path.join(__dirname, '..', '..');
  const version = getPluginVersion(pluginRoot);

  // ── Welcome banner ──
  // stdout only — when run via the PowerShell wrapper, stderr triggers
  // PowerShell's NativeCommandError and prints a garbled duplicate.
  process.stdout.write(banner(version) + '\n');

  // ── Health check ──
  const health = runHealthCheck(pluginRoot);
  const allOk = health.every(r => r.ok);
  log(`[Health] ${allOk ? '✓ All systems nominal' : '⚠ Issues detected'}`);
  for (const r of health) {
    log(`[Health]   ${r.ok ? '✓' : '✗'} ${r.label}`);
  }

  // ── Session continuity ──
  const sessionsDir = getSessionsDir();
  const learnedDir  = getLearnedSkillsDir();
  ensureDir(sessionsDir);
  ensureDir(learnedDir);

  const recentSessions = findFiles(sessionsDir, '*-session.tmp', { maxAge: 7 });
  if (recentSessions.length > 0) {
    log(`[SessionStart] ${recentSessions.length} recent session(s) — latest: ${path.basename(recentSessions[0].path)}`);
  }

  const learnedSkills = findFiles(learnedDir, '*.md');
  if (learnedSkills.length > 0) {
    log(`[SessionStart] ${learnedSkills.length} learned skill(s) available`);
  }

  const aliases = listAliases({ limit: 5 });
  if (aliases.length > 0) {
    log(`[SessionStart] Sessions: ${aliases.map(a => a.name).join(', ')} — use /sessions load <alias>`);
  }

  // ── Package manager ──
  // Only log if there's a package.json here — avoids noise when launching
  // from a home or parent directory where no package manager is relevant.
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    const pm = getPackageManager();
    if (pm.source !== 'fallback' && pm.source !== 'default') {
      log(`[SessionStart] Package manager: ${pm.name}`);
    }
  }

  // ── Project detection (parent directory mode) ──
  const cwd = process.cwd();
  const projects = detectProjects(cwd);
  if (projects.length > 0) {
    log(`[SessionStart] Launched from parent directory — ${projects.length} project(s) available:`);
    for (const p of projects) {
      const tags = [
        p.hasClaude ? 'CLAUDE.md ✓' : 'CLAUDE.md ✗',
        p.hasTldr   ? 'TLDR ✓'      : 'TLDR ✗',
      ].join('  ');
      log(`[SessionStart]   • ${p.name.padEnd(35)} ${tags}`);
    }
    log(`[SessionStart] To load a project: /project <name>`);
  }

  // ── Chapter brief ──
  const chapterConfig = getChapter();
  if (chapterConfig && chapterConfig.chapter) {
    log(`[Chapter] Active chapter: ${chapterConfig.chapter.toUpperCase()} — context scoped to chapter-relevant skills and agents.`);
    log(`[Chapter] To change chapter: node install.js --chapter python|cpp|devops`);

    // Count chapter skill overrides and emit if any are active
    try {
      const { getChapterSkills } = require('../lib/chapter-manifest');
      const chapterSkills = getChapterSkills(chapterConfig.chapter);
      let overrideCount = 0;
      for (const skillName of chapterSkills) {
        const overridePath = getChapterOverridePath(chapterConfig.chapter, 'skills', skillName);
        if (overridePath) overrideCount++;
      }
      if (overrideCount > 0) {
        log(`[Chapter] ${overrideCount} skill override(s) active — chapter-specific versions replace global defaults`);
      }
    } catch {
      // Non-fatal — override count is informational only
    }
  } else {
    log('[Chapter] No chapter set — full manifest loaded. Tip: node install.js --chapter python|cpp|devops to reduce context.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[SessionStart] Error:', err.message);
  process.exit(0);
});

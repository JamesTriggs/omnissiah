#!/usr/bin/env node
/**
 * Validate skill directories have SKILL.md with required structure.
 *
 * Each skill's SKILL.md must exist, be non-empty, and carry a description
 * from EITHER its own YAML frontmatter (with `name:` and `description:`) OR a
 * matching entry in .claude-plugin/plugin.json skills[] with a non-empty
 * `description`. It fails only if NEITHER source is present. A description
 * shorter than 20 characters produces a warning, not a failure.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../../skills');
const PLUGIN_JSON = path.join(__dirname, '../../.claude-plugin/plugin.json');

const MIN_DESCRIPTION_LENGTH = 20;

function extractFrontmatter(content) {
  // Strip BOM if present (UTF-8 BOM: ﻿)
  const cleanContent = content.replace(/^﻿/, '');
  // Support both LF and CRLF line endings
  const match = cleanContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }
  return frontmatter;
}

function loadPluginSkills() {
  // Best-effort: map skill name -> description from plugin.json.
  const byName = {};
  if (!fs.existsSync(PLUGIN_JSON)) return byName;
  try {
    const manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf-8'));
    for (const skill of manifest.skills || []) {
      if (skill && skill.name) {
        byName[skill.name] = (skill.description || '').trim();
      }
    }
  } catch (err) {
    console.error(`WARNING: could not parse plugin.json - ${err.message}`);
  }
  return byName;
}

function validateSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log('No skills directory found, skipping validation');
    process.exit(0);
  }

  const pluginSkills = loadPluginSkills();

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  let hasErrors = false;
  let validCount = 0;

  for (const dir of dirs) {
    const skillMd = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      console.error(`ERROR: ${dir}/ - Missing SKILL.md`);
      hasErrors = true;
      continue;
    }

    const content = fs.readFileSync(skillMd, 'utf-8');
    if (content.trim().length === 0) {
      console.error(`ERROR: ${dir}/SKILL.md - Empty file`);
      hasErrors = true;
      continue;
    }

    // Resolve a description from frontmatter or the plugin manifest.
    // The line-based frontmatter parser cannot expand YAML block scalars
    // (`>`, `>-`, `|`, `|-`), so treat those as "present but unparseable" and
    // fall back to the plugin.json description rather than mis-measuring it.
    const frontmatter = extractFrontmatter(content);
    const rawFmDescription =
      frontmatter && frontmatter.name && frontmatter.description
        ? frontmatter.description.trim()
        : '';
    const isBlockScalar = /^[|>][+-]?$/.test(rawFmDescription);
    const fmDescription = isBlockScalar ? '' : rawFmDescription;
    const pluginDescription = (pluginSkills[dir] || '').trim();
    // A frontmatter block-scalar description still counts as "has frontmatter
    // description"; only its length is unmeasurable here.
    const hasFrontmatterDescription = Boolean(
      frontmatter && frontmatter.name && frontmatter.description
    );
    const description = fmDescription || pluginDescription;

    if (!description && !hasFrontmatterDescription) {
      console.error(
        `ERROR: ${dir}/SKILL.md - No description: needs YAML frontmatter with ` +
          `name: and description:, or a plugin.json skills[] entry with a description`
      );
      hasErrors = true;
      continue;
    }

    if (description && description.length < MIN_DESCRIPTION_LENGTH) {
      console.warn(
        `WARNING: ${dir}/SKILL.md - Description is short (${description.length} chars); ` +
          `aim for at least ${MIN_DESCRIPTION_LENGTH}`
      );
    }

    validCount++;
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`Validated ${validCount} skill directories`);
}

validateSkills();

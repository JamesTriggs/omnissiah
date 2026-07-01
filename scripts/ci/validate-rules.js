#!/usr/bin/env node
/**
 * Validate rule markdown files.
 *
 * Each rule file must exist and be non-empty. As a best-effort check we also
 * confirm the file is referenced by the plugin manifest (.claude-plugin/
 * plugin.json rules.*); an unreferenced rule only WARNS, it does not fail, so
 * this stays conservative and introduces no false failures.
 */

const fs = require('fs');
const path = require('path');

const RULES_DIR = path.join(__dirname, '../../rules');
const PLUGIN_JSON = path.join(__dirname, '../../.claude-plugin/plugin.json');

function loadReferencedRules() {
  // Best-effort: gather every rule path listed under plugin.json rules.*.
  const referenced = new Set();
  if (!fs.existsSync(PLUGIN_JSON)) return referenced;
  try {
    const manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf-8'));
    const rules = manifest.rules || {};
    for (const category of Object.keys(rules)) {
      for (const rulePath of rules[category] || []) {
        // Normalise "rules/python/foo.md" -> "python/foo.md".
        referenced.add(rulePath.replace(/^rules\//, ''));
      }
    }
  } catch (err) {
    console.error(`WARNING: could not parse plugin.json - ${err.message}`);
  }
  return referenced;
}

function validateRules() {
  if (!fs.existsSync(RULES_DIR)) {
    console.log('No rules directory found, skipping validation');
    process.exit(0);
  }

  const referenced = loadReferencedRules();

  const files = fs.readdirSync(RULES_DIR, { recursive: true })
    .filter(f => f.endsWith('.md'));
  let hasErrors = false;
  let validatedCount = 0;

  for (const file of files) {
    const filePath = path.join(RULES_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim().length === 0) {
        console.error(`ERROR: ${file} - Empty rule file`);
        hasErrors = true;
        continue;
      }

      // Best-effort reference check. Normalise path separators so this works
      // on any platform. Warn only — never fail.
      const normalised = file.split(path.sep).join('/');
      if (referenced.size > 0 && !referenced.has(normalised)) {
        console.warn(`WARNING: ${file} - Not referenced in plugin.json rules.*`);
      }

      validatedCount++;
    } catch (err) {
      console.error(`ERROR: ${file} - ${err.message}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`Validated ${validatedCount} rule files`);
}

validateRules();

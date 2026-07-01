#!/usr/bin/env node
/**
 * Validate the framework self-evaluation golden set.
 *
 * Checks that evals/cases/routing.jsonl:
 *   - exists and is non-empty
 *   - parses as JSON Lines (one JSON object per non-blank line)
 *   - every case has the required fields with the right types
 *   - has unique case ids
 *   - every `expected_agent_or_skill` names a real agent (agents/<name>.md)
 *     or skill (skills/<name>/) on disk
 *
 * Exits non-zero on any problem.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const CASES_FILE = path.join(ROOT, 'evals/cases/routing.jsonl');
const AGENTS_DIR = path.join(ROOT, 'agents');
const SKILLS_DIR = path.join(ROOT, 'skills');

const REQUIRED_STRING_FIELDS = ['id', 'prompt', 'expected_agent_or_skill', 'notes'];
const REQUIRED_ARRAY_FIELDS = ['must_include', 'must_not_include'];

function loadKnownTargets() {
  const targets = new Set();

  if (fs.existsSync(AGENTS_DIR)) {
    for (const file of fs.readdirSync(AGENTS_DIR)) {
      if (file.endsWith('.md')) {
        targets.add(file.slice(0, -3));
      }
    }
  }

  if (fs.existsSync(SKILLS_DIR)) {
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        targets.add(entry.name);
      }
    }
  }

  return targets;
}

function validateEvals() {
  if (!fs.existsSync(CASES_FILE)) {
    console.error(`ERROR: missing golden set at ${path.relative(ROOT, CASES_FILE)}`);
    process.exit(1);
  }

  const content = fs.readFileSync(CASES_FILE, 'utf-8').replace(/^﻿/, '');
  if (content.trim().length === 0) {
    console.error('ERROR: routing.jsonl is empty');
    process.exit(1);
  }

  const knownTargets = loadKnownTargets();
  const seenIds = new Set();
  let hasErrors = false;
  let caseCount = 0;

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (line.trim().length === 0) return; // allow blank lines

    let obj;
    try {
      obj = JSON.parse(line);
    } catch (err) {
      console.error(`ERROR: line ${lineNo} - invalid JSON: ${err.message}`);
      hasErrors = true;
      return;
    }

    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      console.error(`ERROR: line ${lineNo} - each line must be a JSON object`);
      hasErrors = true;
      return;
    }

    caseCount++;
    const label = typeof obj.id === 'string' && obj.id ? obj.id : `line ${lineNo}`;

    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof obj[field] !== 'string' || obj[field].trim().length === 0) {
        console.error(`ERROR: ${label} - missing or non-string field: ${field}`);
        hasErrors = true;
      }
    }

    for (const field of REQUIRED_ARRAY_FIELDS) {
      if (!Array.isArray(obj[field])) {
        console.error(`ERROR: ${label} - field ${field} must be an array`);
        hasErrors = true;
      } else if (!obj[field].every(v => typeof v === 'string')) {
        console.error(`ERROR: ${label} - field ${field} must contain only strings`);
        hasErrors = true;
      }
    }

    if (typeof obj.id === 'string' && obj.id) {
      if (seenIds.has(obj.id)) {
        console.error(`ERROR: ${label} - duplicate case id`);
        hasErrors = true;
      }
      seenIds.add(obj.id);
    }

    const target = obj.expected_agent_or_skill;
    if (typeof target === 'string' && target && !knownTargets.has(target)) {
      console.error(
        `ERROR: ${label} - expected_agent_or_skill "${target}" is not a real agent ` +
          `(agents/${target}.md) or skill (skills/${target}/)`
      );
      hasErrors = true;
    }
  });

  if (caseCount === 0) {
    console.error('ERROR: routing.jsonl contains no cases');
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`Validated ${caseCount} eval cases`);
}

validateEvals();

# Chapter Configuration

The omnissiah framework uses **chapters** to scope context load at install time.
Each chapter loads only the skills and agents relevant to a specific engineering role.

## Active Chapter

Your chapter is set by the installer and stored in `~/.claude/omnissiah-chapter.json`.
The session-start hook reads this file and announces your chapter at the start of every session.

If no chapter is set, the full manifest is loaded (all skills and agents).

## Available Chapters

### `python`, Python and Backend Engineering
Active skills: `python-patterns`, `python-testing`, `backend-patterns`, `db-io`, `tdd-workflow`, `verification-loop`
Active agents: `python-reviewer`, `database-reviewer`, `tdd-guide`, `debugger`, `performance`, `migrator`
Rules loaded: `rules/python/`

### `cpp`, C++ and Systems Engineering
Active skills: `cpp-streaming-patterns`, `protobuf-validation`, `tdd-workflow`, `verification-loop`, `observability-patterns`
Active agents: `cpp-reviewer`, `debugger`, `performance`, `build-error-resolver`
Rules loaded: `rules/cpp/`

### `devops`, DevOps and Platform Engineering
Active skills: `operational-excellence`, `observability-patterns`, `feature-flags`, `security-review`, `project-guidelines`
Active agents: `architect`, `planner`, `integrator`, `security-reviewer`, `migrator`
Rules loaded: `rules/common/` only

## Always Available (Global)

Regardless of chapter, the following are always loaded:

**Skills:** `coding-standards`, `security-review`, `agent-teams`, `iterative-retrieval`, `strategic-compact`, `continuous-learning-v2`, `onboarding`, `eval-harness`

**Agents:** `security-reviewer`, `harness-orchestrator`, `harness-lead`, `harness-intake`, `explorer`, `architect`, `planner`, `code-reviewer`

**Commands:** All commands are always available.

**Hooks:** All hooks are always active.

**Rules:** `rules/common/` is always loaded.

## Changing Your Chapter

To change your chapter, re-run the installer with the `--chapter` flag:

```bash
node install.js --chapter python
node install.js --chapter cpp
node install.js --chapter devops
node install.js   # removes chapter filter (full manifest)
```

See `/set-chapter` for full documentation.

## Implementation Note

The chapter filter applies to the **installed** `plugin.json` at `~/.claude/plugins/omnissiah/.claude-plugin/plugin.json`. The canonical `plugin.json` in the repo is never modified.

---

## Chapter Override System

Beyond selecting *which* skills load, chapters can replace the *content* of shared skills
with a chapter-focused version. This is the **chapter override system**.

### The Problem It Solves

Some skills (like `tdd-workflow`) contain content for all technology stacks. When you are
in the Python chapter you do not need GTest or cppcheck patterns. The override system lets
the Python chapter provide its own, focused `tdd-workflow`, with only pytest, mypy, and
ruff, replacing the global skill for Python installs without touching the global baseline.

### Directory Structure

```
chapters/
  python/
    skills/
      tdd-workflow/
        SKILL.md        <- replaces global tdd-workflow for Python installs
      django-patterns/
        SKILL.md        <- Python-only (additive, does not exist globally)
    agents/
      .gitkeep          <- placeholder (no Python-only agents in v1)
    commands/
      .gitkeep
  cpp/
    skills/
      tdd-workflow/
        SKILL.md        <- C++-focused tdd-workflow (GTest, sanitizers, CMake)
    agents/
      .gitkeep
    commands/
      .gitkeep
  devops/
    skills/
      .gitkeep          <- devops uses global skills unchanged
    agents/
      .gitkeep
    commands/
      .gitkeep
```

### Resolution Logic

When installing with `--chapter python`:

1. **Override:** For each skill in the Python chapter's list, check whether
   `chapters/python/skills/<name>/SKILL.md` exists. If it does, install that file instead
   of the global `skills/<name>/SKILL.md`.

2. **Additive:** Scan `chapters/python/skills/` for skill directories NOT in the global
   baseline, install these as chapter-only additions.

3. **Agents and commands** follow the same pattern:
   - `chapters/python/agents/<name>.md` overrides `agents/<name>.md`
   - New agents in `chapters/python/agents/` are installed as chapter-only additions
   - Same for `commands/`

4. **Fallthrough:** If no override exists (e.g. devops), the global skill or agent is used
   unchanged. Installing without `--chapter` never scans the `chapters/` directory.

### How Chapter Leads Create an Override

1. Create the directory: `chapters/<chapter>/skills/<skill-name>/`
2. Write `SKILL.md` inside it with the chapter-specific content.
3. The override takes effect on the next `node install.js --chapter <chapter>` run.

**Key rules:**
- The override SKILL.md completely replaces the global one for that chapter install.
- Do NOT mix technology stacks in an override (Python override = no C++ content).
- The global `skills/<name>/SKILL.md` is never modified.

### API Reference (`scripts/lib/chapter-overrides.js`)

```js
const {
  getChapterOverridePath,
  getChapterOnlyItems,
  CHAPTERS_DIR,
} = require('./chapter-overrides');

// Returns the override path if it exists, null otherwise
getChapterOverridePath('python', 'skills', 'tdd-workflow');
// -> '/path/to/chapters/python/skills/tdd-workflow/SKILL.md'

getChapterOverridePath('python', 'skills', 'nonexistent');
// -> null

// Returns skills/agents/commands in the chapter dir that are NOT in the global baseline
getChapterOnlyItems('python', 'skills');
// -> [{name: 'django-patterns', path: '/path/to/chapters/python/skills/django-patterns/SKILL.md'}]
```

### Session-Start Notification

When a chapter is active and skill overrides exist, the session-start hook emits:

```
[Chapter] Active chapter: PYTHON, context scoped to chapter-relevant skills and agents.
[Chapter] 1 skill override(s) active, chapter-specific versions replace global defaults
```

This tells the engineer that chapter-specific content is in effect, not the global defaults.

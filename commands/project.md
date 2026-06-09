---
description: Load a specific project's context when working from a parent directory. Reads the project's CLAUDE.md, checks the LLM-TLDR index status, and primes Claude with repo-specific architecture and conventions.
---

# Project Command

Load a specific project's context when you've launched Claude Code from a parent
directory (e.g. `~/work/`) rather than inside the repo itself.

## Usage

```
/project <repo-name>
/project list
```

## Examples

```
/project my-api
/project my-frontend
/project list
```

---

## What `/project <name>` Does

### Step 1 — Locate the project

Search for the repo in common locations:
- `~/work/<name>/`
- `../<name>/` (sibling of current directory)
- `./<name>/` (subdirectory of current directory)

If not found, list available projects and stop.

### Step 2 — Load CLAUDE.md

Read `<project>/CLAUDE.md` in full and ingest it as active context.

Report what was loaded:
- Service name and language stack
- Key architecture patterns
- Testing commands
- Any active work-in-progress notes

### Step 3 — Check LLM-TLDR index

Check whether `<project>/.tldr/cache` exists.

- **Index found** → confirm ready, remind of key commands:
  ```
  tldr semantic "query" <project-path>
  tldr impact <project-path>/path/to/file.py function_name
  tldr dead <project-path>
  ```
- **Index missing** → provide the warm command:
  ```
  tldr warm <project-path>
  ```
  Estimated time: ~2 minutes for a medium-sized service.

### Step 4 — Report active context

Summarise what is now loaded:

```
Project loaded: my-api
─────────────────────────────────────
Stack:       Python / FastAPI / SQLAlchemy
Test cmd:    pytest -q
Lint cmd:    ruff check .
TLDR index:  ✓ ready
CLAUDE.md:   ✓ loaded (247 lines)

Ready. Ask me anything about my-api.
```

---

## `/project list`

Scan the workspace for available projects and show their status:

```
Available projects in ~/work/
─────────────────────────────────────
  my-api          CLAUDE.md ✓   TLDR ✓
  my-frontend     CLAUDE.md ✓   TLDR ✗  (run: tldr warm .)
  my-service      CLAUDE.md ✗   TLDR ✗
  shared-schemas  CLAUDE.md ✓   TLDR ✓
  ...

Use /project <name> to load any of these.
```

---

## Working Across Multiple Repos

If your task touches more than one repo (e.g. a shared-schema change that affects both
`shared-schemas` and `my-api`):

```
/project shared-schemas   # load first
/project my-api           # load second — both CLAUDEs now in context
```

Claude will have both repos' architecture and conventions active simultaneously.
Use `/tldr impact` with absolute paths to trace changes across repo boundaries.

---

## Notes

- Running `/project` does not change your shell's working directory
- LLM-TLDR commands must still be run with the full repo path when outside the repo:
  `tldr semantic "query" ~/work/my-api`
- Session files are still tracked by the directory Claude was launched from

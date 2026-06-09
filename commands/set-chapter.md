# /set-chapter — Configure Your Chapter Context

The omnissiah framework supports **chapter-level configurability** to reduce context load. Instead of loading every skill and agent on every session, you can install a filtered manifest that loads only the tools relevant to your engineering chapter.

## What is a chapter?

A chapter is a role-scoped view of the framework. There are four chapters:

| Chapter | What it includes |
|---------|-----------------|
| `python` | Python patterns, testing, backend (Flask/FastAPI), databases, TDD, verification |
| `cpp` | C++ streaming patterns, schema validation, observability, TDD, verification |
| `frontend` | Vue/Nuxt patterns, component testing, end-to-end testing, TDD, verification |
| `devops` | Operational excellence, observability, feature flags, security, project guidelines |

All chapters always include: coding standards, security review, agent teams, the harness (orchestrator/lead/intake), explorer, architect, planner, code reviewer.

## How to set your chapter

**Chapter is set at install time.** To switch chapters, re-run the installer with the `--chapter` flag:

```bash
# Set to Python chapter
node install.js --chapter python

# Set to C++ chapter
node install.js --chapter cpp

# Set to Frontend chapter
node install.js --chapter frontend

# Set to DevOps chapter
node install.js --chapter devops

# Remove chapter filter (full manifest)
node install.js
```

Running without `--chapter` installs the full manifest (no context reduction, backward compatible).

## Where the config lives

The installer writes `~/.claude/omnissiah-chapter.json` when a chapter is set:

```json
{
  "chapter": "python",
  "set_at": "2026-04-16T10:00:00Z",
  "set_by": "install.js --chapter python"
}
```

The session-start hook reads this file and emits a chapter brief at the start of every Claude session.

## What the filtering changes

When you install with `--chapter python`:
- The installed `plugin.json` keeps only `python` and `global` skills/agents
- Skills scoped to other chapters (e.g. `cpp-streaming-patterns`, `frontend-patterns`) are excluded from the manifest
- All commands are always loaded (they are lightweight)
- All hooks are always loaded
- `rules/common/` is always loaded

**The repo's plugin.json is never modified.** Only the installed copy in `~/.claude/plugins/` is filtered.

## Checking your current chapter

To see which chapter you are in, read `~/.claude/omnissiah-chapter.json` or look at the chapter brief printed at the start of your Claude session.

## Cross-chapter work

If you need a tool from another chapter (e.g., a Python engineer occasionally reviewing C++ code), simply reinstall without a filter or with the other chapter's flag for that session.

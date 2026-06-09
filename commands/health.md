---
description: Run a full framework health check. Verifies hook scripts, plugin manifests, LLM-TLDR installation and index, CI validators, and MCP server configuration. Reports pass/fail for each component.
---

# Health Command

Run a full health check on the omnissiah framework and the current project.

## Usage

```
/health
/health --fix
```

---

## What Gets Checked

### Framework Integrity

| Check | Pass Condition |
|-------|---------------|
| `plugin.json` | Valid JSON, all referenced files exist |
| `hooks.json` | Valid JSON, all hook scripts exist on disk |
| Hook scripts | All 15 expected scripts present in `scripts/hooks/` |
| CI validators | `npm run validate` exits 0 |

Run the checks:

```bash
# Validate plugin manifest
node scripts/ci/validate-agents.js
node scripts/ci/validate-commands.js
node scripts/ci/validate-hooks.js
node scripts/ci/validate-rules.js
node scripts/ci/validate-skills.js

# Confirm all hook scripts exist
ls scripts/hooks/*.js | wc -l   # expect 17+
```

---

### LLM-TLDR

| Check | Pass Condition |
|-------|---------------|
| `tldr` installed | `which tldr` / `where tldr` returns a path |
| `.tldr/` index | `<project>/.tldr/cache/` exists and non-empty |
| Daemon running | `tldr daemon status` returns running (optional) |

```bash
tldr doctor        # built-in diagnostics
tldr warm .        # rebuild if index missing or stale
tldr daemon start  # start background daemon for 100ms queries
```

---

### MCP Servers

Check `mcp-configs/mcp-servers.json` is valid and expected servers are listed:

| Server | Required |
|--------|---------|
| `github` | ✓ |
| `memory` | ✓ |
| `context7` | Optional |
| `sequential-thinking` | Optional |

---

### Current Project

| Check | Pass Condition |
|-------|---------------|
| In a git repo | `git rev-parse --git-dir` succeeds |
| `CLAUDE.md` present | File exists in project root |
| TLDR index fresh | `.tldr/cache` modified within 7 days |
| No stale session files | No `.tmp` files older than 14 days |

---

## Output Format

```
Framework Health Check
══════════════════════════════════════════

Framework Integrity
  ✓ plugin.json valid
  ✓ hooks.json valid
  ✓ Hook scripts (17 found)
  ✓ CI validators pass

LLM-TLDR
  ✓ tldr installed (v0.x.x)
  ✗ TLDR index missing — run: tldr warm .

MCP Servers
  ✓ github configured
  ✓ memory configured

Current Project (my-api)
  ✓ Git repository
  ✓ CLAUDE.md present
  ✗ TLDR index stale (last warmed 12 days ago)
  ✓ No stale session files

══════════════════════════════════════════
Status: 2 issues found

To fix:
  tldr warm .
```

---

## `/health --fix`

When `--fix` is passed, automatically resolve issues that can be fixed without user input:

- Stale TLDR index → run `tldr warm .`
- Old session files (>30 days) → archive them to `~/.claude/sessions/archive/`
- Missing directories → create them

Issues that require manual action (missing CLAUDE.md, MCP config problems) are flagged
but not auto-fixed.

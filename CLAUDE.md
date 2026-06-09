# CLAUDE.md

Project instructions for developing the omnissiah framework itself.

## What This Is

omnissiah is a Claude Code plugin providing agents, commands, skills, hooks, and coding rules, plus a harness for running multi-agent teams. It is a generic, domain-agnostic AI engineering operating system for software development. The plugin manifest is `.claude-plugin/plugin.json`.

## Commands

```bash
npm test              # Run all tests (unit + integration)
npm run validate      # Run CI validators (agents, commands, hooks, rules, skills)
```

No build step. No external dependencies required for tests (pure Node.js assert).

## Project Structure

- `agents/` - Agent definition markdown files (YAML frontmatter + prompt)
- `commands/` - Slash command markdown files
- `skills/` - Skill directories, each with a `SKILL.md`
- `rules/` - Convention/standard files organised by language (common, python, typescript, cpp)
- `hooks/hooks.json` - Hook configuration (auto-discovered by Claude Code, NOT declared in plugin.json)
- `scripts/hooks/` - Node.js hook implementation scripts
- `scripts/lib/` - Shared utilities (utils.js, package-manager.js, session-aliases.js, chapter helpers)
- `scripts/ci/` - CI validation scripts
- `contexts/` - Mode-switching context files
- `chapters/` - Chapter-scoped overrides and additions (python, cpp, frontend, devops)
- `schemas/` - JSON schemas for plugin.json and hooks.json
- `tests/` - Test suite (lib/, hooks/, integration/)

## Key Conventions

- **Hooks format**: All hook commands MUST be strings (Claude Code requirement). All hooks (lifecycle, PreToolUse, PostToolUse) reference standalone Node.js scripts via `"node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<name>.js"`. The installer resolves `${CLAUDE_PLUGIN_ROOT}` to the absolute repo path at install time.
- **Plugin manifest**: `plugin.json` must list every agent, command, skill, and rule. If you add a new file, register it in plugin.json.
- **hooks.json is auto-loaded**: Claude Code discovers `hooks/hooks.json` by convention. Do NOT add a `"hooks"` field to plugin.json (causes duplicate detection).
- **CLAUDE.md injection markers**: The installer merges a framework section into the user's CLAUDE.md between `<!-- omnissiah:start -->` and `<!-- omnissiah:end -->`. Keep these markers in sync across `install.js`, `install.sh`, `scripts/lib/merge-claude-md.sh`, and `examples/framework-section.md`.
- **Tests**: All test files use Node.js built-in `assert`. No test framework. Run individual tests with `node tests/<path>.js`.
- **Hook scripts**: Must exit 0 on success and handle errors gracefully (never crash the session).

## Adding New Content

- **New agent**: Create `agents/<name>.md` with YAML frontmatter (model, tools, description), add entry to plugin.json `agents` array.
- **New command**: Create `commands/<name>.md`, add entry to plugin.json `commands` array.
- **New skill**: Create `skills/<name>/SKILL.md`, add entry to plugin.json `skills` array.
- **New rule**: Create `rules/<category>/<name>.md`, add path to plugin.json `rules.<category>` array.
- **New hook script**: Create `scripts/hooks/<name>.js`, add hook entry to `hooks/hooks.json`.

## Testing Changes

After any change, run:

```bash
npm test          # Must show 0 failures
npm run validate  # Must pass all 5 validators
```

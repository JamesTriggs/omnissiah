# omnissiah

omnissiah is a generic AI engineering operating system for Claude Code. It packages a curated set of agents, slash commands, skills, hooks, and coding rules into a single Claude Code plugin, plus a harness for running multi-agent teams. It is domain-agnostic and works on any software project, in any language.

## What it provides

- **21 agents**, specialised personas (planning, architecture, review, debugging, refactoring, migrations, performance, TDD, documentation, integration, exploration, and the harness roles).
- **29 commands**, slash commands that drive structured workflows (`/team`, `/plan`, `/code-review`, `/tdd`, `/debug`, `/perf`, `/health`, and more).
- **47 skills**, reusable bundles of domain knowledge that activate automatically by context.
- **21 hook scripts**, automation for safety guards, code quality, secret detection, and session lifecycle.
- **Coding rules** for common practice plus Python, TypeScript, and C++.
- **A three-tier harness** for running parallel agent teams (intake, orchestrator, leads, workers).

Everything is plain Markdown, JSON, and Node.js. There is no build step and no runtime dependency beyond Node.js (and Python 3.10+ for the optional instinct tooling).

## Quick start

```bash
# Full install (interactive). Bash wrapper also available on macOS / Linux.
node install.js
./install.sh --all

# Non-interactive, all language rules
node install.js --all --non-interactive
```

The installer:

- Checks prerequisites (Node.js 18+, Python 3.10+, git).
- Creates the `~/.claude/` directory structure.
- Merges the framework hooks into `~/.claude/settings.json` (your own hooks are preserved).
- Merges any MCP server config from `mcp-configs/mcp-servers.json`.
- Copies the skills into `~/.claude/skills/`.
- Installs the plugin so slash commands are available.
- Merges a framework section into your user `~/.claude/CLAUDE.md` between the `<!-- omnissiah:start -->` and `<!-- omnissiah:end -->` markers.

Then start a Claude Code session and try `/health`, `/code-review`, or `/team`.

### Minimal install

If you already have your own Claude Code setup and only want the generic hygiene hooks (secret detection and session tracking), use the minimal installer. It never touches your CLAUDE.md, skills, agents, commands, or plugin config:

```bash
node install-minimal.js            # install
node install-minimal.js --check    # show status
node install-minimal.js --uninstall
```

### Chapters

Scope the plugin to one discipline so you only load relevant context. The chapters are `python`, `cpp`, `frontend`, and `devops`:

```bash
node install.js --chapter python
```

The active chapter is recorded in `~/.claude/omnissiah-chapter.json`. Global skills and agents are always included; the chapter only filters the discipline-specific extras. Re-run with a different `--chapter` to switch.

### Uninstall

```bash
node install.js --uninstall
```

Framework hooks and copied skills are removed. Session history and learned instincts are preserved.

## Repository layout

- `agents/` - agent definitions.
- `commands/` - slash commands.
- `skills/` - skill directories, each with a `SKILL.md`.
- `rules/` - conventions by language (common, python, typescript, cpp).
- `hooks/hooks.json` - hook configuration (auto-discovered by Claude Code).
- `scripts/hooks/` - hook implementations.
- `scripts/lib/` - shared utilities.
- `scripts/ci/` - validators.
- `contexts/` - mode-switching context files.
- `chapters/` - chapter overrides and additions.
- `schemas/` - JSON schemas for `plugin.json` and `hooks.json`.
- `tests/` - the test suite.
- `.claude-plugin/plugin.json` - the plugin manifest.

## Adding content

- **New agent**: create `agents/<name>.md` and register it in `.claude-plugin/plugin.json`.
- **New command**: create `commands/<name>.md` and register it in `plugin.json`.
- **New skill**: create `skills/<name>/SKILL.md` and register it in `plugin.json`.
- **New rule**: create `rules/<category>/<name>.md` and add the path to `plugin.json`.
- **New hook**: create `scripts/hooks/<name>.js` and add an entry to `hooks/hooks.json`.

After any change, run:

```bash
npm test          # all tests, must show 0 failures
npm run validate  # all validators must pass
```

## Documentation

- `the-omnissiah-guide.md` - the long-form guide to every part of the framework.
- `CONTRIBUTING.md` - the contribution workflow.
- `CLAUDE.md` - conventions Claude follows when working on this repo.

## Licence

MIT.

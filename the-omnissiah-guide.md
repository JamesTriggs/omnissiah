# The omnissiah Guide

omnissiah is a generic AI engineering operating system for Claude Code. It packages a curated set of agents, slash commands, skills, hooks, and coding rules into a single Claude Code plugin, plus a harness for running multi-agent teams. It is domain-agnostic and works on any software project.

This guide is the long-form companion to the README. It explains what each part of the framework does, how the pieces fit together, and how to drive day-to-day workflows.

## Contents

1. [What omnissiah is](#what-omnissiah-is)
2. [Installation](#installation)
3. [Agents](#agents)
4. [Commands](#commands)
5. [Skills](#skills)
6. [Hooks](#hooks)
7. [Rules](#rules)
8. [Chapters](#chapters)
9. [Delivery lanes](#delivery-lanes)
10. [The harness and agent teams](#the-harness-and-agent-teams)
11. [Extending the framework](#extending-the-framework)

## What omnissiah is

omnissiah turns a stock Claude Code install into an opinionated engineering environment. It provides:

- 23 agents, specialised personas with their own model, tool access, and prompt.
- 29 commands, slash commands that drive structured workflows.
- 45 skills, reusable bundles of domain knowledge that activate by context.
- 21 hook scripts, automation that runs on session and tool lifecycle events.
- Coding rules for common practice plus Python, TypeScript, and C++.
- A three-tier harness for running parallel agent teams.

Everything is plain Markdown, JSON, and Node.js. There is no build step and no runtime dependency beyond Node.js (and Python for the optional instinct tooling).

## Installation

The installer is cross-platform and written in Node.js, with a Bash wrapper for macOS and Linux.

```bash
# Full install (interactive)
node install.js

# Full install, all language rules, no prompts
node install.js --all --non-interactive

# Bash wrapper (macOS / Linux)
./install.sh --all
```

The installer:

- Checks prerequisites (Node.js 18+, Python 3.10+, git).
- Creates the `~/.claude/` directory structure.
- Merges the framework hooks into `~/.claude/settings.json` (your own hooks are preserved).
- Merges any MCP server config from `mcp-configs/mcp-servers.json`.
- Copies the skills into `~/.claude/skills/`.
- Installs the plugin (commands, agents, skills, contexts) so slash commands are available.
- Merges a framework section into your user `~/.claude/CLAUDE.md` between the `<!-- omnissiah:start -->` and `<!-- omnissiah:end -->` markers.

### Minimal install

If you already have your own Claude Code setup and only want the generic hygiene hooks, use the minimal installer:

```bash
node install-minimal.js            # install
node install-minimal.js --check    # show status
node install-minimal.js --uninstall
```

This adds only two vendor-neutral hooks, secret detection and session tracking, and never touches your CLAUDE.md, skills, agents, commands, or plugin config. Its entries are tagged `__omnissiah_minimal__` in settings.json so they can be cleanly removed.

### Chapters

Pass `--chapter <name>` to scope the plugin to a single discipline:

```bash
node install.js --chapter python
node install.js --chapter cpp
node install.js --chapter frontend
node install.js --chapter devops
```

Chapter selection is recorded in `~/.claude/omnissiah-chapter.json`. Global skills and agents are always included; the chapter only filters the discipline-specific extras. See [Chapters](#chapters) below.

### Uninstall

```bash
node install.js --uninstall
```

This removes the framework hooks and the copied skill directories. Your session history and learned instincts are preserved.

## Agents

Agents are specialised personas. Each lives in `agents/<name>.md` with YAML frontmatter declaring its model, allowed tools, and a description, followed by the system prompt. Claude Code routes work to an agent when its description matches the task, or you can target one explicitly.

Agents fall into a few groups:

- Planning and architecture, for breaking down work, designing systems, and identifying risk before any code is written.
- Review, for code quality, security, language-specific review, and database or schema review.
- Implementation support, for debugging, refactoring, migrations, performance, and test-driven development.
- Documentation and integration, for keeping docs current and designing cross-service contracts.
- Exploration, for fast, cheap codebase orientation.
- Harness roles, the orchestrator, leads, and intake gate that power agent teams (see below).

Each agent is given the smallest model and tool set that fits its job, so exploration is cheap and deep review is thorough.

## Commands

Commands are slash commands defined in `commands/<name>.md`. They drive structured, repeatable workflows. Common ones include:

- `/team`, launch a harness-engineered agent team (intake, orchestrator, parallel leads, workers).
- `/plan`, restate requirements, assess risk, and produce a step-by-step plan before touching code.
- `/orchestrate`, run a simple sequential agent chain (plan, TDD, review, security).
- `/code-review`, security-first review of uncommitted changes.
- `/tdd` and `/test-coverage`, test-driven development and coverage analysis.
- `/debug`, `/perf`, `/refactor-clean`, `/build-fix`, focused problem-solving workflows.
- `/learn`, `/sessions`, `/checkpoint`, `/instinct-status`, session and learning management.
- `/health`, a full framework health check.

Run any command by typing it in a Claude Code session. The command file is a prompt template that Claude follows.

## Skills

Skills are reusable bundles of domain knowledge. Each lives in `skills/<name>/SKILL.md` and activates automatically based on context such as the working directory, file types, or task type. Skills cover areas like backend and frontend patterns, Python and testing idioms, coding standards, security review, observability, evaluation harnesses, planning and discovery, and the continuous-learning instinct system.

Because activation is contextual, you usually do not invoke skills directly. Multiple skills can coordinate on a single task, for example a backend change might draw on backend patterns, testing strategy, and security review together.

## Hooks

Hooks are Node.js scripts in `scripts/hooks/` wired up through `hooks/hooks.json`. Claude Code discovers `hooks/hooks.json` by convention, and the installer resolves the script paths and merges them into `~/.claude/settings.json`. Hooks run on session lifecycle events (start, end, compaction) and tool lifecycle events (before and after Bash, Write, and so on).

They provide:

- Safety guards, blocking accidental `git push`, dev-server starts, and install commands.
- Code quality, formatting and linting on write for the supported languages.
- Security, blocking commits that contain secrets such as cloud keys, API tokens, and passwords.
- Session lifecycle, persisting context on start, compaction, and end.

Every hook command is a string of the form `node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<name>.js`. Hooks exit 0 on success and fail gracefully so they never crash a session.

## Rules

Rules are convention and standard documents under `rules/`, organised by category: `common`, `python`, `typescript`, and `cpp`. They capture coding standards, idioms, and review expectations for each language. The installer checks for the relevant tooling (for example Ruff and mypy for Python, cppcheck and CMake for C++) and reports what it finds.

## Chapters

A chapter scopes the framework to one discipline so a contributor only loads the context relevant to their work. The four chapters are python, cpp, frontend, and devops.

When you install with `--chapter <name>`, the installer writes a filtered `plugin.json` into the plugin locations, keeping every global skill and agent plus the chapter-specific extras, and applies any chapter overrides found under `chapters/<name>/`. The active chapter is stored in `~/.claude/omnissiah-chapter.json`. Switch chapters at any time by re-running the installer with a different `--chapter`.

## Delivery lanes

A delivery lane is the process spine that carries a piece of work from idea to shipped and learned. Lanes exist so the rigour matches the risk: a one-line fix should not drag a full PRD behind it, and a strategic architecture change should not skip discovery.

The `delivery-lane-router` skill picks the lane before anyone starts coding. It reads the clarity of the request, the risk and blast radius of the change, and the strength of the evidence behind it, then routes into one of three lanes (or an Outcome Discovery detour when the problem itself is unclear). The router also sets the review floor and the model floor for the work.

The three lanes carry increasing rigour:

- `quick-fix`, a lean lane for clear, bounded fixes. It keeps the process tight while still making TDD, `review-hard`, and the model floor explicit.
- `std-feature`, the default lane for normal product work. It runs the fuller spine and is where most features live.
- `frontier-bet`, a high-rigour lane for strategic, novel, or high-blast-radius work. It adds discovery, an ambition step, and full review on top of the standard spine.

Each lane runs a common spine, doing more or less of it depending on the lane. In order, the spine is:

1. `spec-driven-development`, write the spec when requirements are unclear or only a vague idea.
2. `plan`, break the validated spec into small demoable slices with acceptance criteria and tracked tasks.
3. `beads-workflow`, turn the plan into a bead task graph with dependencies.
4. `flaw-scan-x5`, repeatedly scan the spec, plan, and beads for gaps and weak assumptions, updating them each pass.
5. `build-slice`, implement one small slice at a time with fresh context and proof before moving on.
6. `review-hard`, review the diff or ready slice for bugs, regressions, missing proof, and overcomplication.
7. `ship-safe`, close the lane cleanly by verifying, committing, pushing, and merging only when the gates allow.
8. `operate-and-learn`, check the operating result after delivery and capture durable lessons.
9. `next-best-bet`, pick the highest-leverage next autonomous move, or surface the one real blocker.

Lanes and the harness compose rather than compete. A lane sets the rigour and sequences the spine, and the `/team` harness (below) is one way to execute the build step, running the slices with parallel agents. You pick a lane to decide how much process the work warrants, then optionally run the building part of that lane through a team.

For a full map of these skills and the others they sit alongside, see `SKILLS.md`.

## The harness and agent teams

The harness is a three-tier system for tackling larger pieces of work:

1. Intake, a quality gate that classifies the task and asks targeted questions if the prompt is underspecified.
2. Orchestrator, selects an approach, builds a clear contract, and spawns one or more leads. It does not write files itself.
3. Leads and workers, each lead explores a domain and delegates to workers that do the actual building.

Launch a team with `/team`. Use it in research mode to explore before building ("how best to..."), or in build mode to implement a feature. You only ever prompt the orchestrator; you can drill into any lead or worker thread to follow its progress.

## Extending the framework

omnissiah is meant to be extended. The repository layout is:

- `agents/`, agent definitions.
- `commands/`, slash commands.
- `skills/`, skill directories, each with a `SKILL.md`.
- `rules/`, conventions by language.
- `hooks/hooks.json`, hook configuration (auto-discovered).
- `scripts/hooks/`, hook implementations.
- `scripts/lib/`, shared utilities.
- `scripts/ci/`, validators.
- `contexts/`, mode-switching context files.
- `chapters/`, chapter overrides and additions.
- `schemas/`, JSON schemas for `plugin.json` and `hooks.json`.
- `tests/`, the test suite.

To add content:

- New agent: create `agents/<name>.md` and register it in `.claude-plugin/plugin.json`.
- New command: create `commands/<name>.md` and register it in `plugin.json`.
- New skill: create `skills/<name>/SKILL.md` and register it in `plugin.json`.
- New rule: create `rules/<category>/<name>.md` and add the path to `plugin.json`.
- New hook: create `scripts/hooks/<name>.js` and add an entry to `hooks/hooks.json`.

After any change, run the test suite and the validators:

```bash
npm test          # all tests, must show 0 failures
npm run validate  # all validators must pass
```

See `CONTRIBUTING.md` for the full contribution workflow and `CLAUDE.md` for the conventions Claude follows when working on this repo.

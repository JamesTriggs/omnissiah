# Using omnissiah with the OpenAI Codex CLI

Codex 0.142+ ships a plugin system that reuses Claude Code's plugin layout, so
omnissiah installs into Codex as a real plugin: its agents, commands, and skills
become available, and the command-based safety hooks run.

## Requirements

- The `codex` CLI (`brew install codex`).
- Node.js (already required by omnissiah).

## One-time setup

```bash
npm run codex:setup
```

This:

1. registers this repo as a Codex plugin marketplace,
2. installs the `omnissiah@omnissiah` plugin, and
3. enables auto-sync git hooks (sets `git core.hooksPath` to `scripts/git-hooks`).

Equivalent manual commands:

```bash
codex plugin marketplace add ~/omnissiah   # or: codex plugin marketplace add JamesTriggs/omnissiah
codex plugin add omnissiah@omnissiah
```

## Auto-update

Codex caches a local plugin as a snapshot at install time, so repo changes are
not visible until the plugin is re-added. After setup this happens automatically:

- **On repo updates** (`git pull`, `git rebase`, branch checkout) the
  `post-merge` / `post-rewrite` / `post-checkout` hooks run `codex:sync`, which
  re-copies the current source into the Codex cache.
- **On demand** (e.g. after editing files without committing):

  ```bash
  npm run codex:sync
  ```

`codex:sync` is safe: it is a no-op if the codex CLI is absent or if the plugin
is not installed, and it never fails a git operation.

To disable auto-sync: `git config --unset core.hooksPath`.

## What is and is not ported

Manifests live in Codex-native locations so the Claude Code setup in
`.claude-plugin/` is untouched:

- `.codex-plugin/plugin.json` — plugin manifest (agents, commands, skills).
- `.agents/plugins/marketplace.json` — marketplace index.
- `.codex-plugin/hooks.json` — the hooks that work under Codex.

Ported hooks (Codex feeds the same `tool_name`/`tool_input` stdin, honours
exit-2 blocking, and reads the legacy `CLAUDE_PLUGIN_ROOT`):

- **PreToolUse** — git-push protection, secret-on-commit checks.
- **PostToolUse** — continuous-learning observer.
- **SessionStart** — previous-context load.

Not ported (Codex has no equivalent, so they stay Claude-Code-only):

- Lint/format-on-write hooks — Codex edits via `apply_patch`, not `Write`/`Edit`.
- Compaction and session-end hooks — Codex has no `PreCompact`/`PostCompact`/`SessionEnd` events.

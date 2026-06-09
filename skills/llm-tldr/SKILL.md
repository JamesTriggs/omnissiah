---
name: llm-tldr
description: Use LLM-TLDR (tldr CLI) for fast, semantic codebase exploration before grepping. Covers warm/index, semantic search, call graph analysis, dead code detection, and integration with the 10 Agent Directives.
triggers: ["tldr", "llm-tldr", "semantic search", "call graph", "dead code", "explore codebase", "where is", "who calls", "impact analysis"]
---

# LLM-TLDR — Semantic Codebase Navigation

LLM-TLDR builds a structural index of your codebase (AST + call graphs + FAISS vector
embeddings) and lets you find code by *behaviour* rather than text. Use it **before**
grepping — it tells you *which files to look in*, cutting the noise from exhaustive search.

**Install:** `pip install llm-tldr`
**Index location:** `.tldr/` in your project root (gitignore this)
**Docs:** https://github.com/parcadei/llm-tldr

---

## Authentication — API Key Setup

`llm-tldr` calls the Anthropic API to build its semantic index, so it needs an `ANTHROPIC_API_KEY` environment variable at runtime.

> **⚠ Do not use your Claude Pro/Max subscription OAuth tokens.** Anthropic's consumer terms restrict subscription auth to first-party clients (Claude Code, the apps). Third-party tools like `llm-tldr` must use an API key from the [Claude Console](https://console.anthropic.com/). This is API-billed — separate from your subscription.
>
> **⚠ Do not put the key in a shell alias or a file that's echoed by shell introspection.** A key in `~/.zshrc alias tldr=ANTHROPIC_API_KEY=sk-ant-... command tldr` leaks every time anyone runs `which tldr`, `type tldr`, or `alias`. Store it in your OS secret store instead.

### Step 1 — Get an API key

Go to [console.anthropic.com](https://console.anthropic.com/) → API Keys → Create Key. Give it a name like `llm-tldr-<hostname>`. Copy the `sk-ant-...` value.

### Step 2 — Store the key in your OS secret store

Pick your platform. All three options keep the key out of shell history, process listings, and plaintext dotfiles.

#### macOS — Keychain (`security` CLI, built-in)

```bash
# Store (prompts for the key value — paste and press return)
security add-generic-password -s "anthropic-api-key" -a "$USER" -U -w

# Verify it's retrievable
security find-generic-password -s "anthropic-api-key" -a "$USER" -w
```

Add to `~/.zshrc` (or `~/.bashrc`):

```bash
# Guard: if a `tldr` alias is already active in the current shell, zsh expands
# it before parsing the function name below and fails with "parse error near
# '()'". Dropping any stale alias first makes re-sourcing safe.
unalias tldr 2>/dev/null
tldr() {
  local key
  key=$(security find-generic-password -s "anthropic-api-key" -a "$USER" -w 2>/dev/null) || {
    echo "tldr: no API key in Keychain — run: security add-generic-password -s anthropic-api-key -a \$USER -U -w" >&2
    return 1
  }
  ANTHROPIC_API_KEY="$key" command tldr "$@"
}
```

#### Linux — libsecret (`secret-tool`, works with GNOME Keyring, KDE KWallet via libsecret-kwallet, and most distros)

Install once: `sudo apt install libsecret-tools` (Debian/Ubuntu) or `sudo dnf install libsecret` (Fedora/RHEL).

```bash
# Store (prompts for the key value)
secret-tool store --label="Anthropic API key for llm-tldr" service anthropic-api-key username "$USER"

# Verify
secret-tool lookup service anthropic-api-key username "$USER"
```

Add to `~/.bashrc` / `~/.zshrc`:

```bash
# Drop any stale `tldr` alias first (see macOS recipe above for why).
unalias tldr 2>/dev/null
tldr() {
  local key
  key=$(secret-tool lookup service anthropic-api-key username "$USER" 2>/dev/null) || {
    echo "tldr: no API key in secret store — run: secret-tool store --label='Anthropic API key for llm-tldr' service anthropic-api-key username \$USER" >&2
    return 1
  }
  ANTHROPIC_API_KEY="$key" command tldr "$@"
}
```

> **Headless Linux / WSL with no keyring daemon?** Use the [universal fallback](#universal-fallback--encrypted-file) below.

#### Windows — `SecretManagement` + `SecretStore` (PowerShell, Microsoft-maintained)

Use Microsoft's [`Microsoft.PowerShell.SecretManagement`](https://learn.microsoft.com/en-us/powershell/utility-modules/secretmanagement/overview) module with the built-in `SecretStore` vault. Both prompt interactively — **the key never appears on the command line or in process listings**, which is why this is preferred over raw `cmdkey /pass:…` (which does leak the key via `Get-Process`/`wevtutil` and PowerShell history).

```powershell
# One-time install (no secrets involved)
Install-Module Microsoft.PowerShell.SecretManagement -Scope CurrentUser -Force
Install-Module Microsoft.PowerShell.SecretStore      -Scope CurrentUser -Force

# One-time vault registration
Register-SecretVault -Name SecretStore -ModuleName Microsoft.PowerShell.SecretStore -DefaultVault

# Store the key — PowerShell prompts as a SecureString, nothing echoes
Set-Secret -Name "anthropic-api-key"

# Verify
Get-Secret -Name "anthropic-api-key" -AsPlainText
```

Add to your PowerShell profile (find its path with `$PROFILE`):

```powershell
function tldr {
    $key = $null
    try {
        $key = Get-Secret -Name "anthropic-api-key" -AsPlainText -ErrorAction Stop
    } catch {
        Write-Error "tldr: no API key in SecretStore — run: Set-Secret -Name anthropic-api-key"
        return
    }
    $env:ANTHROPIC_API_KEY = $key
    try {
        # Invoke the real `tldr` CLI (the application, not this function).
        # `llm-tldr` is the pip package name; the installed executable is `tldr`.
        & (Get-Command -Name tldr -CommandType Application).Source @args
    } finally {
        Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
    }
}
```

> First call in a session unlocks the SecretStore vault (password prompt). Subsequent calls in the same session are silent. To reduce prompts, configure vault timeout with `Set-SecretStoreConfiguration -Authentication Password -PasswordTimeout 3600`.
>
> If you cannot install modules (locked-down corporate machine), use the [cross-platform Python `keyring`](#cross-platform-alternative--python-keyring) or [universal file fallback](#universal-fallback--encrypted-file) below — **do not** use raw `cmdkey /pass:…`, which exposes the key on the command line.

### Cross-platform alternative — Python `keyring`

Since `llm-tldr` is a Python tool and `keyring` is already a common Python dependency, this works identically on macOS, Linux (libsecret), and Windows (Credential Manager):

```bash
pip install keyring
python -c "import keyring; keyring.set_password('anthropic-api-key', '$USER', input('key: '))"
```

Shell wrapper (works on any platform with `python` on PATH):

```bash
# Drop any stale `tldr` alias first (see macOS recipe above for why).
unalias tldr 2>/dev/null
tldr() {
  local key
  key=$(python -c "import keyring,getpass; print(keyring.get_password('anthropic-api-key', getpass.getuser()) or '')")
  if [ -z "$key" ]; then
    echo "tldr: no API key in keyring" >&2; return 1
  fi
  ANTHROPIC_API_KEY="$key" command tldr "$@"
}
```

### Universal fallback — encrypted file

If no OS secret store is available (minimal containers, headless WSL without a keyring daemon, CI images), a permission-locked file is the baseline:

```bash
mkdir -p ~/.config/anthropic
umask 077 && printf '%s' "sk-ant-..." > ~/.config/anthropic/key
chmod 600 ~/.config/anthropic/key

# Wrapper (zsh/bash) — drop any stale `tldr` alias first:
unalias tldr 2>/dev/null
tldr() {
  local key
  [ -r ~/.config/anthropic/key ] && key=$(cat ~/.config/anthropic/key)
  [ -z "$key" ] && { echo "tldr: no key at ~/.config/anthropic/key" >&2; return 1; }
  ANTHROPIC_API_KEY="$key" command tldr "$@"
}
```

Add `~/.config/anthropic/key` to your personal ignore list (`~/.gitignore_global`) so it never ends up in a repo.

### Step 3 — Verify the key is not visible to shell introspection

```bash
type tldr     # should show a function, NOT the raw key
which tldr    # same
alias | grep -i anthropic   # should return nothing
env | grep -i anthropic     # should return nothing until you invoke tldr
```

If any of those reveal the `sk-ant-` value, your setup leaks. Rotate the key in the Claude Console and redo Step 2.

### If you suspect a key has leaked

1. Go to [console.anthropic.com](https://console.anthropic.com/) → API Keys → **Delete** the compromised key.
2. Create a new one.
3. `security delete-generic-password -s "anthropic-api-key" -a "$USER"` (macOS) / `secret-tool clear service anthropic-api-key username "$USER"` (Linux) / `cmdkey /delete:anthropic-api-key` (Windows).
4. Redo Step 2 with the new key.

---

## When to Use TLDR vs Grep

| Situation | Use |
|-----------|-----|
| "Where is authentication handled?" | `tldr semantic` |
| "What calls `validate_tenant`?" | `tldr impact` |
| "What does `process_event` call?" | `tldr calls` |
| "Find dead/unused code before refactor" | `tldr dead` |
| "Get a function summary for LLM context" | `tldr context` |
| You know the exact symbol name | `grep` / `Grep tool` |
| After tldr returns candidate files | `grep` to pin the exact line |

**Rule:** Use `tldr semantic` to identify *which* files, then `grep` to find the *exact line*.

---

## Core Commands

### Warm (Build / Update Index)

```bash
# First time or after major changes
tldr warm /path/to/project

# In daemon mode (keeps index in RAM — 100ms queries)
tldr daemon start
tldr warm /path/to/project
```

Run `tldr warm` once per project. The index updates incrementally (only re-analyses changed
files). Re-run if >20 files have changed since last warm.

---

### Semantic Search — "Find code by behaviour"

```bash
# Answers: "where does X happen?"
tldr semantic "validate JWT tokens" /path/to/project
tldr semantic "write to the analytics database" /path/to/project
tldr semantic "tenant isolation check" /path/to/project
tldr semantic "celery task dispatch" /path/to/project
```

Returns: ranked list of files + functions with relevance scores.

**Output example:**
```
appapi/auth/middleware.py::validate_token  [score: 0.91]
appapi/auth/decorators.py::require_auth   [score: 0.84]
appapi/users/views.py::login              [score: 0.71]
```

Use these paths as the starting point for your `grep` / file reads.

---

### Context — LLM-Ready Function Summary

```bash
# Get a compressed, token-efficient summary of a specific function
tldr context appapi/auth/middleware.py validate_token

# Get summary of an entire file
tldr context appapi/auth/middleware.py
```

Returns: function signature, docstring, call relationships, complexity, and the first ~10
lines — without dumping the full source. Typically 95% fewer tokens than reading the file.

---

### Call Graph Analysis

```bash
# Forward: what does this function call?
tldr calls appapi/auth/middleware.py validate_token

# Backward (impact): what calls this function?
# Use this BEFORE renaming or changing a function's signature
tldr impact appapi/auth/middleware.py validate_token
```

**Critical for Point 10 (No Semantic Search) — run `tldr impact` before any rename.** It
finds all callers across the entire codebase including test files, unlike grep which misses
dynamic calls and string references.

---

### Dead Code Detection — Step 0

```bash
# Find unused functions, exports, and imports across the project
tldr dead /path/to/project

# Focus on a specific directory
tldr dead /path/to/project/appapi/app/
```

**Wire this into every refactor session as Step 0** (from Agent Directive #1). Run it,
commit the deletions, then start the real work. A clean codebase compacts less aggressively.

---

### Architecture Overview

```bash
# File structure with dependency relationships
tldr tree /path/to/project

# Import graph — who depends on what?
tldr imports appapi/auth/middleware.py
tldr importers appapi/auth/middleware.py

# Full architecture summary
tldr arch /path/to/project
```

---

## Integration with the 10 Agent Directives

### Directive #1 — Step 0 Dead Code

```bash
# Before ANY refactor on files >300 LOC
tldr dead . | head -50          # Find dead code candidates
# Review, delete, commit separately, then start refactor
```

### Directive #5 — Sub-Agent Swarming

Before spawning sub-agents, use `tldr semantic` to identify the correct file clusters:

```bash
tldr semantic "analytics query execution" .
tldr semantic "Celery task retry logic" .
```

Then assign each cluster to a sub-agent with exactly the right files — no context wasted on
irrelevant code.

### Directive #6 — Context Decay Awareness

After 10+ messages, use `tldr context` rather than re-reading large files:

```bash
# 95% fewer tokens than reading the full file
tldr context path/to/large_file.py function_name
```

### Directive #10 — Exhaustive Search Before Rename

Before renaming `validate_token`:

```bash
# 1. Find all callers (tldr is thorough across the whole repo)
tldr impact appapi/auth/middleware.py validate_token

# 2. THEN do the exhaustive grep passes for:
grep -rn "validate_token" .
grep -rn '"validate_token"' .      # string literals
grep -rn "from.*auth.*import" .    # re-exports
```

`tldr impact` acts as a pre-flight check. If it surfaces files you hadn't considered,
add those to your grep scope before touching anything.

---

## Typical Exploration Workflow

```bash
# 1. Warm the index (once per project, or after big changes)
tldr warm .

# 2. Find relevant files by behaviour
tldr semantic "your question here" .

# 3. Get compressed summaries of candidates (no token waste)
tldr context path/to/candidate.py relevant_function

# 4. Use grep to pin exact lines
grep -n "symbol_name" path/to/candidate.py

# 5. Read only the specific file sections you need
# (use offset/limit per Directive #7)
```

---

## Typical Refactor Workflow

```bash
# Step 0: dead code cleanup
tldr dead . > /tmp/dead-code.txt
# Review, delete, commit

# Step 1: understand impact before changing anything
tldr impact path/to/file.py function_to_change
tldr calls path/to/file.py function_to_change

# Step 2: semantic search to find related patterns
tldr semantic "pattern similar to what you're changing" .

# Step 3: proceed with refactor using standard tools
```

---

## Index Freshness

The `.tldr/` index becomes stale when files change significantly. Signs of a stale index:
- `tldr semantic` returns irrelevant results
- Functions that exist don't appear in `tldr calls` output
- `tldr dead` flags things that are clearly in use

**Fix:** `tldr warm .` — it only re-analyses changed files, typically fast.

**Session start:** The session-start hook checks whether the index exists and warns if it
needs warming. Run `tldr warm .` when prompted.

---

## Example Queries

Useful semantic queries for a typical multi-service codebase:

```bash
# Find tenant isolation enforcement
tldr semantic "tenant_id check" .
tldr semantic "multi-tenant isolation" .

# Find analytics query patterns
tldr semantic "analytics client execute" .
tldr semantic "PREWHERE tenant_id" .

# Find Celery task patterns
tldr semantic "celery task apply_async" .

# Find auth/permission patterns
tldr semantic "JWT decode" .
tldr semantic "admin_required decorator" .

# Dead code in large services
tldr dead appapi/
tldr dead frontend/
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `tldr warm .` | Build/update index |
| `tldr semantic "<query>" .` | Find code by behaviour |
| `tldr context <file> <fn>` | Token-efficient function summary |
| `tldr calls <file> <fn>` | What does this call? |
| `tldr impact <file> <fn>` | What calls this? (rename safety) |
| `tldr dead .` | Find unused code (Step 0) |
| `tldr tree .` | File structure with deps |
| `tldr imports <file>` | What does this file import? |
| `tldr importers <file>` | What imports this file? |
| `tldr daemon start` | Background mode (100ms queries) |
| `tldr arch .` | Full architecture overview |

---
description: Semantic codebase search and exploration using LLM-TLDR. Use before grepping to find relevant files by behaviour, analyse call graphs, detect dead code (Step 0), and get token-efficient function summaries.
---

# TLDR Command

Semantic codebase navigation using LLM-TLDR. Answers "where is X?", "what calls Y?",
and "what is dead code?" faster and more accurately than grep alone.

## Usage

```
/tldr <subcommand> [args]
```

## Subcommands

### warm — Build or refresh the index

```
/tldr warm
```

Run once per project, or when the index feels stale (semantic search returning irrelevant
results). Only re-analyses changed files — fast on subsequent runs.

**Steps:**
1. Check if `tldr` is installed (`pip install llm-tldr` if not)
2. Run `tldr warm .` from the project root
3. Report index size and time taken
4. Confirm index is ready for queries

---

### search — Find code by behaviour

```
/tldr search <natural language query>
```

**Examples:**
```
/tldr search "validate JWT tokens"
/tldr search "write to the database"
/tldr search "access control check"
/tldr search "background task dispatch"
```

**Steps:**
1. Run `tldr semantic "<query>" .`
2. Present ranked results (file + function + score)
3. For top 3 results, run `tldr context <file> <function>` to show compressed summaries
4. Suggest which files to read in full based on relevance scores

---

### impact — Find everything that calls a function (rename safety)

```
/tldr impact <file> <function>
```

**Example:**
```
/tldr impact src/auth/middleware.py validate_token
```

**Steps:**
1. Run `tldr impact <file> <function>`
2. List all callers with file paths and line numbers
3. Run the exhaustive grep checklist from Directive #10:
   - Direct calls
   - String literals containing the name
   - Re-exports and barrel files
   - Test files and mocks
4. Produce a complete change checklist before any rename proceeds

---

### calls — Show what a function calls (dependency analysis)

```
/tldr calls <file> <function>
```

**Steps:**
1. Run `tldr calls <file> <function>`
2. Display the call tree
3. Flag any cross-service calls (serialized-schema boundaries, REST clients)
4. Highlight calls that cross data-access or trust boundaries

---

### dead — Detect unused code (Step 0 cleanup)

```
/tldr dead [path]
```

**Steps:**
1. Run `tldr dead <path>` (defaults to `.`)
2. Group results by category: unused functions, unused exports, unused imports
3. Flag any that look like false positives (dynamic dispatch, __all__ exports, etc.)
4. Produce a deletion checklist
5. Remind: commit dead code removal separately before starting real work (Directive #1)

---

### context — Token-efficient function summary

```
/tldr context <file> [function]
```

**Example:**
```
/tldr context src/auth/middleware.py validate_token
```

**Steps:**
1. Run `tldr context <file> <function>`
2. Display: signature, docstring, call relationships, complexity score, first ~10 lines
3. Use this instead of reading the full file when you only need to understand a function
   (saves ~95% tokens vs a full file read — Directive #6)

---

## Full Exploration Workflow

When starting work on an unfamiliar area:

```
/tldr search "what you're looking for"    # find candidate files
/tldr context <top result>                # understand without reading full file
/tldr calls <top result>                  # understand dependencies
# Then use grep / Read for exact lines
```

## Full Refactor Workflow

Before changing any function:

```
/tldr dead .                              # Step 0: find and remove dead code first
/tldr impact <file> <function>            # find all callers
/tldr calls <file> <function>             # understand what it depends on
# Then proceed with the refactor
```

## Notes

- Requires `tldr` installed: `pip install llm-tldr`
- Requires an Anthropic API key — see [API Key Setup](../skills/llm-tldr/SKILL.md#authentication--api-key-setup) in the `llm-tldr` skill for platform-specific instructions (macOS Keychain, Linux libsecret, Windows Credential Manager, or cross-platform Python `keyring`). Do **not** put the key in a shell alias.
- Index lives in `.tldr/` — add to `.gitignore`
- Run `/tldr warm` if results feel stale (>20 files changed)
- Use daemon mode for fastest queries: `tldr daemon start`

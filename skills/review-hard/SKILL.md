---
name: review-hard
description: Review a local diff or ready slice for bugs, regressions, missing proof, security risks, and overcomplication before shipping.
---

# Review Hard

Use this before `/ship-safe` or whenever a slice claims to be done.

## Review Lens

Check for:

- wrong assumptions or unclear success criteria
- unnecessary scope, abstractions, or adjacent cleanup
- orthogonal damage to files outside the slice
- deterministic logic delegated to an LLM
- unread callers, importers, tests, or shared utilities
- conflicting patterns blended together
- tests that do not prove intent
- skipped, mocked, partial, or missing verification
- convention drift
- silent failure paths

## Output

Return concrete findings with file paths and fixes. If there are no findings, say what evidence you reviewed and what residual risk remains.

All findings must be fixed before delivery unless they conflict with explicit human instruction.

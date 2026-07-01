---
name: review-hard
description: Review a local diff or ready slice for bugs, regressions, missing proof, security risks, and overcomplication before shipping.
---

# Review Hard

Use this before `/ship-safe` or whenever a slice claims to be done.

## Reviewer independence (mandatory)

Review MUST run in a fresh subagent with its own clean context, separate from the implementer's context. A generator grading its own work is unreliable: self-critique collapses and the model tends to rationalise what it already wrote. External verification from a reviewer that never saw the implementation reasoning is what adds signal. Do not fold review into the same context that produced the code.

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

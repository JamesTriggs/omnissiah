---
name: build-slice
description: Implement one small slice at a time using fresh context, bounded scope, and proof before moving on.
---

# Build Slice

Use this when the current slice is ready to touch code.

## Purpose

Implement one small slice cleanly.

Do not drag half the roadmap through one coding turn.
Do not let stale context turn a simple slice into improv theatre.

## Fresh context rule

- Prefer a fresh subagent or fresh session for each slice when the platform supports it.
- Do not fork the entire research conversation into the implementation worker.
- Give the slice worker only:
  - the slice brief
  - the relevant spec, plan, or bead excerpt
  - the files likely to change
  - the tests that should fail or pass
  - one in-repo pattern example
  - the current failing output or acceptance criteria
- If a fresh subagent is unavailable, manually compact to the same bounded packet before coding.

## Default flow

1. Confirm that only one slice is in scope.
2. Load the slice packet with `context-engineering`.
3. If the packet keeps swelling or the worker is retrying, stop and run `context-engineering-advisor`.
4. Start with a failing test when behavior is changing.
5. Implement the smallest complete change that can pass.
6. Run the relevant tests.
7. Run type checks and linting.
8. Verify manually when needed.
9. Save or commit the slice before starting the next one.

## Guardrails

- One slice means one slice. Do not sneak adjacent cleanup or bonus scope into the same pass.
- If the slice touches existing code across multiple files, use `llm-tldr` first for callers, importers, impact, and relevant context.
- If the slice expands into a different bounded domain, stop and reset the context instead of carrying the whole old thread forward.
- If the slice is no longer small, route back through the lane or the plan instead of pretending it still is.

## Prompt starter

```text
Implement only the current slice. Start with a failing test if behavior is changing. Use a fresh context packet with just the slice brief, relevant artifact excerpt, touched files, tests, one in-repo example, and the current failing output. Build the smallest complete slice that works, verify it, and stop before pulling in adjacent work.
```

## Output

- one working slice
- proof that it works

## Gate

Do not start the next slice until the current one is working cleanly and the proof is real.

---
name: quick-fix
description: Lean delivery lane for clear, bounded fixes. Keeps the process tight while making TDD, review-hard, and the model floor explicit.
---

# Quick Fix

Use this only when the router chose `quick-fix`.

## Purpose

Fix the real problem without pretending a tiny fix needs a parade.

Slow is smooth. Smooth is fast.

This lane is for clear, bounded work. If the issue keeps widening while you inspect it, route back through the router instead of cosplaying certainty.

## Default flow

1. `/tldr`
2. use `llm-tldr` first when root cause, callers, importers, diagnostics, or change impact crosses file boundaries
3. `/context-engineering` to bound the fix context before coding
4. `/debug-root-cause`
5. `/test-driven-development`
6. `/build-slice`
7. `/code-simplify` if the fix introduced unnecessary complexity
8. `/browser-proof` if users will actually see the change
9. `/review-hard`
10. `/ship-safe`

If the bug is really a broken customer journey, insert `/discovery-process` before the fix strategy hardens.

## TDD rule

Make the failure concrete before the fix.

Preferred order:

- write a failing automated regression test
- make it pass with the smallest correct change
- keep or extend the test as the proof artifact

If an automated test is genuinely impractical, capture a concrete manual repro before the fix and use that as the minimum bar. Do not skip the proof step just because the bug looks obvious.

## Context rule

- Use `context-engineering-advisor` if the fix becomes retry-heavy, spans more than one bounded domain, or starts dragging unrelated history behind it.
- For `/build-slice`, prefer a fresh subagent or fresh session with only the current fix packet: the failing output, touched files, relevant tests, one in-repo pattern example, and the narrow acceptance criteria.
- If the fix keeps widening, reset and re-route instead of coding through context rot.

## Review rule

Before `/ship-safe`, run two independent review lenses through fresh subagents:
`senior-engineering` and `test-engineer`.

Add `security-review` if the fix touches auth, permissions, secrets, infra,
network boundaries, external integrations, or other trust surfaces.

Do not request or wait for cross-model review. Fix every reviewer finding,
including nits, then rerun the relevant check or lens until clean.

## Model rule

Preferred model: the strongest available model (latest Opus-tier) at `high`.

Bump to `x-high` when risky surfaces, unfamiliar code, or security boundaries are involved.

## What not to drag in here

- full PRDs
- heavyweight discovery
- full 4-lens review by default; use the two-lens floor unless risk escalates
- speculative architecture cleanup that is not needed for the fix

## Escalate out of this lane when

- the change stops being bounded
- the root cause is unclear
- more than a small cluster of files is involved
- the work touches migrations, infra, auth, or cross-system behavior
- the request is actually a broken customer journey, not a narrow defect

When that happens, re-route instead of forcing the wrong lane to carry the load.

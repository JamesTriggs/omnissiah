---
name: flaw-scan-x5
description: Repeatedly scan a proposal, PRD, spec, plan, or bead set for mistakes, gaps, weak assumptions, hidden tradeoffs, and unresolved questions. Use when hardening a `std-feature` or `frontier-bet`, and update the in-scope spec, plan, and beads after every pass until there are no further improvements to be made.
---

# Flaw Scan X5

Use this when reviewing a plan, proposal, PRD, spec, bead set, design doc, or other draft before commitment.

## Purpose

Break the polite first draft.

Find what the document is pretending is solved.

## Scope Rule

Identify the exact artifacts in scope before scanning.

For `std-feature` and `frontier-bet`, this loop starts only after the relevant artifacts exist.
Explicitly identify the current spec, current plan, and current bead set that belong to the initiative you are working on.
Those exact artifacts are in scope for the scan.
If a PRD exists for the same initiative, keep it aligned too.
Do not wander into unrelated docs just because they exist nearby.

## Workflow

1. Identify the active initiative and name the exact in-scope artifacts before scanning.
2. Re-read the current in-scope artifacts carefully.
3. Run one flaw pass for blunders, omissions, logical gaps, weak assumptions, hidden tradeoffs, fuzzy ownership, fake certainty, and missing proof.
4. After each pass, update every in-scope artifact that already exists.
5. For `std-feature` and `frontier-bet`, once the spec, plan, and beads exist, update those exact artifacts on every iteration.
6. Keep iterating until there are no further improvements to be made.
7. Do not stop after the first obvious fix.
8. Keep unresolved questions explicit instead of smoothing them over.
9. Pull in `security-review` and `coding-standards` when the draft is implementation-heavy and would benefit from harsher critique.

## Output Contract

- revised in-scope artifacts or annotated flaw list
- strongest remaining risks
- explicit unresolved questions
- recommendation: ready, revise again, or stop and clarify

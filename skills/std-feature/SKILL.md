---
name: std-feature
description: Default delivery lane for normal product work. Runs PRD, spec, plan, beads, flaw scan, TDD, build, simplification, review, ship, learning, and the next-bet handoff in a cumulative loop.
---

# Std Feature

Use this only when the router chose `std-feature`.

## Purpose

Slow is smooth. Smooth is fast.

This lane is for real feature work that deserves structure but not theatre.
Each step must refine the next one. Do not treat the flow like a checklist you sprint past.

## Default flow

1. `/tldr`
2. use `llm-tldr` first for repo structure, relevant context, change impact, callers, importers, diagnostics, and dead code when the work touches existing code or broad refactors
3. `/context-engineering` to set the lane context and slice boundaries
4. `/context-engineering-advisor` when the work is multi-slice, multi-agent, cross-system, retry-heavy, or context-noisy
5. `/customer-evidence` when the customer problem, segment, or urgency is not already proven
6. `/prd-development`
7. `/spec-driven-development`
8. `/plan`
9. `/beads-workflow`
10. `/flaw-scan-x5` and feed every improvement back into the PRD, the spec, the plan, and the beads before coding
11. run the slice loop for each slice in bead order:
   - `/test-driven-development`
   - `/build-slice` in a fresh subagent or fresh session with bounded slice context
   - `/code-simplify`
   - `/review-hard`
   - `/browser-proof` when users will see it
12. repeat the slice loop until every slice in the current bead is done
13. continue bead by bead until all beads are done
14. `/ship-safe`
15. `/operate-and-learn`
16. `/next-best-bet`

## Cumulative synthesis rule

Every stage inherits what the previous one learned.

- the PRD sharpens the spec
- the spec sharpens the plan
- the plan sharpens the beads
- the flaw scan sharpens all four
- each completed slice can force a refinement to the remaining slices and beads

Do not keep executing stale beads after the evidence changed.
Update the artifacts, then continue.

## Context rule

- Use the Research -> Plan -> Reset -> Implement cycle instead of carrying the whole planning conversation into implementation.
- Each slice should get a fresh implementation packet: slice goal, relevant artifact excerpt, touched files, tests, one pattern example, and current failing output.
- If the slice packets keep growing or agents keep retrying, stop and tighten the context shape before more coding.

## Review rule

Default review is two independent subagent lenses: `senior-engineering` and
`test-engineer`.

Add `security-review` when auth, permissions, secrets, infra, network boundaries, or other risky surfaces are touched.
Escalate to the full 4-lens stack when blast radius, migration risk, reversibility, or architecture weight becomes real.

Each lens runs in its own fresh subagent or bounded session with the diff,
touched files, risk notes, and test evidence. Do not create or wait on
cross-model review. Fix every finding, including small nits, before continuing.

## Model rule

Preferred model: Opus 4.7 or later at `x-high`.

If that exact model is unavailable, use the strongest later model or equivalent reasoning tier.
Do not cheap out on standard feature delivery.

## Stop conditions

Do not stop when:

- the first slice passes
- one bead is green
- the code "basically works"
- the plan feels boring

Stop only when all slices are done, all beads are done, the ship checks pass, the learning pass is done, and the next-bet handoff is captured.

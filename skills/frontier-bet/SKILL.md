---
name: frontier-bet
description: High-rigor delivery lane for strategic, novel, or high-blast-radius work. Runs discovery, ambition, PRD, spec, beads, flaw scan, repeated slice loops, full review, ship, learning, and the next-bet handoff.
---

# Frontier Bet

Use this only when the router chose `frontier-bet`.

## Purpose

Take the big swing without turning the project into a bag of beautiful guesses.

Slow is smooth. Smooth is fast.

## Default flow

1. `/tldr`
2. use `llm-tldr` first when the bet touches existing systems and you need structure, context, callers, importers, diagnostics, dead-code checks, or change impact before shaping the work
3. `/context-engineering` to define the information architecture for the bet
4. `/context-engineering-advisor` to diagnose boundaries, retrieval, and reset points before coding
5. `/discovery-process`
6. `/discovery-process`
7. `/research-software` when the bet depends on unfamiliar, fast-moving, or under-documented tools, platforms, APIs, or frameworks; fold the findings back into the PRD, spec, plan, and beads
8. `/prd-development`
9. `/spec-driven-development`
10. `/plan`
11. `/beads-workflow`
12. `/flaw-scan-x5` and integrate the improvements back into the PRD, spec, plan, and beads before coding
13. run the slice loop for each slice in bead order:
    - `/test-driven-development`
    - `/build-slice` in a fresh subagent or fresh session with bounded slice context
    - `/code-simplify`
    - independent 4-lens subagent review: `cto-level-review`, `senior-engineering`, `security-review`, `test-engineer`
    - `/browser-proof` when users will see it
14. repeat the slice loop until every slice in the current bead is done
15. continue bead by bead until all beads are done
16. `/ship-safe`
17. `/operate-and-learn`
18. `/next-best-bet`

Push ambition and sharpen the differentiating idea during PRD and spec. Do not treat this as a separate tool.

## TDD rule

Novelty is exactly when you want tighter proof, not looser proof.

Write the test, harness, regression, or concrete verification artifact that would fail for the wrong implementation and pass for the right one.
Then keep going until the full bead graph is complete.

## Context rule

- Frontier bets must use Research -> Plan -> Reset -> Implement; do not drag the whole discovery swamp into implementation.
- Treat each slice as a fresh bounded-domain implementation job, not as a continuation of a giant conversation.
- If the bet depends on multiple agents, define what is persistent, what is retrieved, and what resets between workers before starting `/build-slice`.

## Review rule

Run each of the four lenses in a separate fresh subagent or bounded session.
Give each lens the diff, touched files, risk notes, and test evidence.

Do not request or wait for cross-model review. Fix every finding from every
lens, including small nits, then rerun the relevant lens or verification until
clean.

## Model rule

Preferred model: the strongest available model (latest Opus-tier) at `x-high`.

If that is unavailable, use the strongest available model at an equivalent reasoning tier.

## Guardrails

- do not skip the flaw scan
- do not let the flaw scan sit beside the artifacts like a polite suggestion; fold the improvements back in
- do not guess about novel tooling; when the bet leans on unfamiliar or fast-moving software, run `/research-software` before locking the PRD, spec, plan, and beads
- do not skip `llm-tldr` when wide codebase context would prevent blind grep work
- do not stop after the first working slice
- do not stop until all slices are done and all beads are done

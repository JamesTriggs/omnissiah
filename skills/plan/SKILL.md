---
name: plan
description: Break a validated spec or feature initiative into small demoable implementation slices, acceptance criteria, verification steps, dependencies, and tracked tasks.
---

# Plan

Use this after the PRD/spec is clear and before beads are created.

## Purpose

Turn the shaped work into an execution plan the agent can actually deliver.

The plan is the bridge between intent and tracked work. It should be small enough to review, concrete enough to execute, and explicit enough to turn into beads.

## Source

This local Codex skill mirrors the `/plan` command-pack prompt from:

- `/Users/dave/.codex/prompts/plan.md`
- `agent-vps:/home/ubuntu/.codex/prompts/plan.md`

## Workflow

1. Work in read-only planning mode first.
2. Read the spec and relevant project docs carefully.
3. Identify dependencies.
4. Slice vertically.
5. Make each slice demoable.
6. Give each slice acceptance criteria.
7. Give each slice a verification step.
8. Add checkpoints every few slices.
9. If the project uses tracked tasks or beads, convert each slice into one.

## Output

Return:

- implementation plan
- slice list
- acceptance criteria for each slice
- verification step for each slice
- dependency notes
- checkpoints
- tracked tasks if the project uses them

## Rules

- Do not code during planning.
- Keep risky actions explicit.
- Preserve the shared `/plan` command meaning from the KITT command pack when the repo uses it.
- For `std-feature` and `frontier-bet`, this plan is followed by `beads-workflow` and then `flaw-scan-x5`.

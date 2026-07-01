---
name: next-best-bet
description: Pick the highest-leverage next autonomous move when no explicit task is queued, then start it or surface the one real blocker with a recommendation.
---

# Next Best Bet

Use this when there is no explicit task in hand but standing still would be stupid.

## Purpose

Pick the most accretive next move.
Do not confuse "no ticket handed over" with "do nothing."

This skill is the repo-local autonomy bridge.

- Use `beads-workflow` when a ready bead already exists and the repo is clearly in bead mode.
- Use this skill when the situation is fuzzier: no ready bead, stale plan-space, broken routing, conflicting state, or a need to decide what to do next across several plausible options.

## Finishing line

You are done when you can state, in one shot:

- `Bet`
- `Why now`
- `What proof would change your mind`
- `What you are starting immediately`

If the move is safe and normal for the current lane, start it.
If the move truly needs user input, ask once with your recommended answer and why.
Do not ask for permission to do normal repo work that the current lane already owns.

## Decision order

1. Re-read the repo rules that govern autonomy, proof, and protected surfaces.
2. Check whether the current thread already implies the next move.
3. If the repo uses beads, inspect the bead source yourself instead of asking whether a ready bead exists.
4. If a ready bead exists and is build-ready, hand off to `beads-workflow`.
5. If no bead is ready, scan for the highest-leverage unblocker instead of pretending the backlog is the only source of truth.

## Permission deadlock breaker

If you catch yourself about to ask any of these, stop:

- "Should I commit this?"
- "Should I push this?"
- "Should I open the PR?"
- "Should I merge this ready PR?"
- "What should I do next?"

Replace the question with an action unless a named gate blocks it.

- If checks pass and the lane owns repo delivery, commit, push, and open or update the PR.
- If the repo contract allows agent-owned merge and required checks/reviews pass, merge.
- If merge is protected, deploy-triggering, review-gated, or otherwise outside the current authority, do not ask a naked question. State the blocker, your recommended next action, and the exact proof already collected.
- If no task is queued, choose the safest high-leverage next move and start it.

## Candidate sources

Look in this order:

1. A broken agent workflow, missing adapter, stale resolver entry, or other issue that prevents autonomous operation.
2. A ready blocker that is stopping multiple downstream tasks.
3. A failing verification step or obvious repo-health breakage.
4. A user-visible bug or delivery lane already in flight.
5. A stale plan, bead graph, or missing proof artifact that is making implementation unsafe.
6. A durable learning or documentation gap that is causing repeated confusion.

## How to score candidates

Prefer the move with the best mix of:

- leverage
- unblock power
- reversibility
- proofability
- alignment with the user's stated direction

Do not pick a fake-busy task just because it is easy.
Do not pick a giant epic when a sharp unblocker would unlock three other things.

## Output contract

Before you begin work, say:

- `Bet`: the chosen move
- `Why`: why this beats the nearest alternatives
- `Proof`: the shortest checks that will tell you whether the bet was right
- `Start`: the first concrete action you are taking now

Then actually take that action.

## Anti-patterns

Do not:

- wait for ceremonial permission when the next move is obvious
- ask the user to choose the next normal delivery step when the lane already defines it
- recommend five options and dodge the call
- pick a task because it sounds important but proves nothing
- treat stale docs or resolver drift as harmless when they are breaking agent behavior

## Prioritisation bias

Prefer fixing the systems that steer the work, routing gaps, missing skills, broken memory or context links, and operator workflow blockers, before polishing secondary artifacts.
If the system that is supposed to steer agents is broken, fix that first.

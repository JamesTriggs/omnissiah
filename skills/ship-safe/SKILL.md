---
name: ship-safe
description: Close a delivery lane without permission theater. Verifies, commits, pushes, opens or updates PRs, and merges only when the current repo contract and gates allow it.
---

# Ship Safe

Use this at the end of `quick-fix`, `std-feature`, or `frontier-bet`.

## Purpose

Turn working changes into delivered work.

Do not strand a verified diff because you feel awkward about normal git steps.
Do not sneak through protected gates either.

## Default flow

1. Re-read the repo contract and permissions boundary.
2. Check `git status` and separate your changes from unrelated user or agent changes.
3. Run the lane's required proof: tests, type check, lint, browser proof, security checks, or narrower justified equivalents.
4. Fix failures you own and rerun the failing checks.
5. Commit your verified changes when the lane owns delivery.
6. Push the branch when remote delivery is part of the repo flow.
7. Open or update the PR with the proof summary.
8. Merge only when the repo contract allows agent-owned merge and all required checks/reviews have passed.
9. If merge or deploy is gated, stop at the gate with one blocker, your recommended next action, and the proof already collected.

## Permission Deadlock Breaker

Never ask these as standalone questions:

- "Should I commit?"
- "Should I push?"
- "Should I open a PR?"
- "Should I merge?"

Answer them from the rules:

- If it is normal lane delivery and no protected gate blocks it, do it.
- If the gate blocks it, say which gate blocks it and what you recommend.
- If unrelated dirty files exist, leave them alone and commit only your owned files.
- If checks fail, keep fixing instead of asking whether to continue.

## Merge Rule

Merge is allowed only when all are true:

- the current repo contract or task explicitly makes merge part of normal agent delivery
- required CI and review gates are green or not required
- merge does not implicitly deploy to a protected live environment without the required approval
- the branch contains only intended changes or the PR clearly scopes them

If any condition is false, do not merge and do not ask a vague permission question. Report the exact blocker and recommended next step.

## Output

- what shipped or where it stopped
- proof run and result
- branch, commit, PR, and merge state when relevant
- the next safe action if anything remains gated

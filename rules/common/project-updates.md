# Project Update Format

When producing a project or initiative status update, or when asked for a verbal project status, always cover these 4 areas in this order:

## 1. Key progress

What has been completed or meaningfully advanced since the last update. Be specific: name features, PRs, decisions made. Avoid laundry lists, pick the things that matter most.

## 2. Progress towards total goal / milestone

Where the project stands as a whole. Use a percentage, milestone stages, or "X of Y major pieces complete" framing. This makes it immediately clear to anyone reading how far through the work we are.

## 3. Confidence in milestone date

An explicit statement about whether the target date is still realistic. Do not bury this. Use one of:
- **On track**: the date is achievable
- **At risk, [reason]**: achievable but there is a specific threat
- **Slipped to [new date], [reason]**: the date needs to move

If there is uncertainty, say so. Never omit this section.

## 4. Problems / blockers

Anything actively preventing progress, with a named owner where possible. If nothing is blocking, write "No blockers."

---

## Example

```markdown
## Key progress
- Backend PR: all review issues resolved, lint and tests passing
- Frontend: component stack restructured per review feedback, all PRs clean
- Secret populated by ops

## Progress towards milestone
~80% complete. 3 of 5 major pieces merged or done (API, infrastructure, secrets). Frontend and backend PRs in review, smoke test and go-live steps remaining.

## Confidence in target date
On track. Both PRs ready for final review. If reviewers turn around this week, merge and smoke test can complete before the deadline.

## Blockers
- Backend PR: 2 open discussion questions (integration tests, view tests) need a decision to unblock merge
- Frontend stack awaiting re-review after substantial rework
- Ops: deployment pipeline PR awaiting sign-off
```

---

## Why this order

A project lead or incoming contributor needs to know: what's done, how much is left, does the deadline hold, and what's in the way. That's the order of urgency for decision-making.

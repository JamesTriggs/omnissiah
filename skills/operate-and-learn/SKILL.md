---
name: operate-and-learn
description: Close the loop after delivery by checking the operating result, capturing durable lessons, and handing off to the next autonomous move.
---

# Operate And Learn

Use this after `ship-safe` or after any meaningful operating run.

## Purpose

Make the system better because the work happened.

Shipping without learning is how the same mistake gets reincarnated with a new hat.

## Default flow

1. Compare the intended outcome with the verified result.
2. Check for follow-through created by the work: monitoring, docs, user communication drafts, cleanup, next bead, or rollback watch.
3. Capture durable lessons in `lessons.md` only when they are grounded and reusable.
4. Capture stable preferences or operator behavior changes in the appropriate memory file.
5. If a new ready bead or obvious next move exists, hand off to `beads-workflow` or `next-best-bet`.

## Do Not Ask For Tiny Closure

Do not ask:

- whether to record a clear durable lesson
- whether to continue to the next ready bead
- whether to run `next-best-bet` when nothing explicit is queued

Do the safe thing, then report it.

## Ask Only When

- the lesson would change policy or permissions
- the next action touches a protected surface
- the follow-up would send, deploy, book, delete, or mutate external state beyond the current authority
- there are two materially different directions and neither is clearly safer

## Output

- operating result
- lesson captured, if any
- next autonomous move started or the one real blocker

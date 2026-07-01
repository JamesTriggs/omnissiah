---
name: delivery-lane-router
description: Route implementation work into the right delivery lane before anyone starts coding. Picks quick-fix, std-feature, frontier-bet, or an Outcome Discovery detour based on clarity, risk, and evidence. Also sets the review floor and model floor.
---

# Delivery Lane Router

Use this before any implementation, bug fix, refactor, or "what process should we use?" request.

## Purpose

Pick the smallest safe lane.

Do not drag a papercut through cathedral process.
Do not undercook risky work.

## Lanes vs. the /team harness

These two systems compose. They are not alternatives.

- The **delivery lanes** here (`quick-fix` / `std-feature` / `frontier-bet`) decide **how much rigour** a piece of work gets: reviews, flaw scan, model floor, proof.
- The **`/team` harness** (orchestrator → leads → workers, via the `agent-teams` skill) is one way to **execute** the build or slice step with parallel agents.

Pick a lane first for the rigour, then optionally use `/team` to execute the build. Choosing `/team` never lets you skip the lane's required reviews or proof.

## Mandatory delivery preflight

Before any build lane starts, enforce the shared delivery rail:

- For `std-feature` and `frontier-bet`, convert durable work from PRD/spec/ADR into a plan, then into `br` beads before coding. Quick fixes follow their lean rail and do not require this artifact spine.
- For `std-feature` and `frontier-bet`, treat `br` as the canonical progress tracker. Markdown plans and memory are context, not task state.
- Fetch current main before work: `git fetch origin main`.
- Branch from or rebase onto `origin/main` before coding, before PR/review/merge, and before handoff after stale or idle work.
- For `std-feature` and `frontier-bet`, claim exactly one ready bead before editing: `br update <id> --status in_progress`.
- For `std-feature` and `frontier-bet`, if no bead exists for the work, create or slice the plan into beads first; do not freehand complex work.
- For `std-feature` and `frontier-bet`, every branch, commit, PR body, and handoff must name the bead ID it advances.

## First question

Is this actually ready to build?

Route to `Outcome Discovery` from the configured delivery playbook instead of a build lane when any of these are true:

- the problem is not clear enough to write success criteria or tests
- evidence is thin, contradictory, or just stakeholder opinion in a trench coat
- the ask is really about churn, activation, retention, PMF, or workflow friction rather than a narrow defect
- the team is still arguing about the real problem
- the request smells like strategy or discovery dressed up as implementation

If that is true, say so plainly and stop pretending it is build-ready.

## Classify on six dimensions

Rate each one as low, medium, or high:

- clarity
- blast radius
- security surface
- reversibility
- user visibility
- novelty

Then choose exactly one lane.

## Lane choice

### Quick Fix

Choose this when:

- clarity is high
- blast radius is low
- the change is bounded
- the code sits in a known area
- reversibility is high
- novelty is low

Load the locally installed `quick-fix` skill if available.

Review floor:

- `senior-engineering`
- `test-engineer`
- add `security-review` when auth, permissions, secrets, network, infra, external integrations, or trust boundaries are touched

Model floor:

- use a strong coding model at `high`
- bump to `x-high` if the fix touches risky surfaces or unfamiliar code

### Standard Feature

Choose this when:

- the work is normal feature delivery
- it spans multiple files or user-visible behavior
- it is clear enough to build but not trivial
- it needs real proof, not just a patch

Load the locally installed `std-feature` skill if available.

Review floor:

- `senior-engineering`
- `test-engineer`
- add `security-review` for security-sensitive work
- escalate to the full 4-lens stack when architecture, migration, infra, or blast radius gets real

Model floor:

- preferred: the strongest available model (latest Opus-tier) at `x-high`
- fallback: the strongest available coding model at equivalent high reasoning

### Frontier Bet

Choose this when:

- the work is strategic architecture
- the system design is novel
- the change is hard to reverse
- the blast radius is high
- the goal is genuine differentiation, not just shipping another average thing

Load the locally installed `frontier-bet` skill if available.

Review floor:

- full 4-lens stack: `cto-level-review`, `senior-engineering`, `security-review`, `test-engineer`

Model floor:

- default: the strongest available model (latest Opus-tier) at `x-high`
- always use the strongest available model for this lane
- max for the nastiest work

## Context diagnosis

Every build lane needs a context strategy before coding starts.

- Always load `context-engineering` to define the smallest useful context packet for the chosen lane.
- Add `context-engineering-advisor` when the work is multi-slice, cross-system, multi-agent, retry-heavy, stale-context, or otherwise smells like context stuffing.
- Use that diagnosis to decide what stays persistent, what is retrieved just-in-time, and where fresh-session boundaries belong.
- For implementation, each `/build-slice` should prefer a fresh subagent or fresh session with bounded slice context instead of inheriting the whole research thread.

## Model switching rule

Pick the model up front.

Do not assume a running agent can cleanly switch models mid-task.

If stronger reasoning becomes necessary and the platform supports it, hand off or spawn a bounded subagent with the stronger model instead of pretending to hot-swap brains halfway through.

## Output contract

Before implementation, emit a short routing block:

- `Lane`
- `Why`
- `Required flow`
- `Required reviews`
- `Preferred model`
- `Outcome Discovery`
- `Context strategy`
- `Recommended next move`

## Guardrails

- TDD is explicit in all three build lanes.
- Required reviews mean autonomous lens reviews through independent subagents, not cross-model handoffs.
- Every reviewer finding must be fixed before ship.
- `std-feature` and `frontier-bet` always run `/flaw-scan-x5` before the slice loop starts.
- `std-feature` and `frontier-bet` always close with `/operate-and-learn` and `/next-best-bet`.
- In the build lanes, finishing one slice is not permission to stop. Keep cycling through the remaining slices and then the remaining beads until the whole wave is done.
- Context engineering is not optional for build lanes; set the context packet deliberately before coding.
- If context keeps swelling, retries keep climbing, or agents are over-sharing, stop and run `context-engineering-advisor` instead of stuffing more history into the next prompt.
- For `/build-slice`, prefer a fresh subagent or fresh session with only the current slice packet.
- Unless the local repo contract explicitly says patch-only or draft-only, a chosen build lane owns the normal branch, commit, push, and PR progression too.
- Do not stop at a verified local diff waiting for permission to commit if the repo's standard delivery path is branch -> push -> PR.
- Do not open or mark a PR ready until it is rebased onto current `origin/main` and cites the bead ID.
- Do not return "awaiting task" when a ready bead, obvious next slice, or clearly best next move already exists. Recommend it and proceed.
- If you have to ask the user a project question, include your recommended answer, why you recommend it, and the tradeoff that makes the question worth asking.
- When helpful, teach the point with a short analogy or concrete example instead of dumping raw ambiguity on the user.
- If your recommendation is safe and outside the critical areas defined by the repo contract and permissions protocol, do the work and capture the lesson instead of asking.
- If `llm-tldr` is available, use it before broad grep-only exploration for structure, context, callers, importers, diagnostics, dead code, and change impact.
- Do not escalate because the codebase looks spooky.
- Do escalate when reversibility is low, blast radius is wide, or the security surface is real.
- The fastest safe path is the smallest path that still gives proof.

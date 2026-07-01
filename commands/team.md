---
description: Launch a harness-engineered agent team to build features. Runs prompt intake → orchestrator → parallel leads → workers. The user only ever prompts the orchestrator. If your client supports drilling into subagent threads (for example Ctrl+O in Claude Code), you can inspect any lead or worker thread.
---

# /team — Agent Teams

Launch a three-tier harness-engineered agent team to build, fix, or improve any part of your codebase.

## Usage

```
/team "task description"
/team "task description" --skip    # skip intake quality gate
```

## How It Works

```
You  →  /team "task"
          ↓
     harness-intake        Classifies task, scores prompt quality,
     (Haiku, fast)         asks targeted questions if needed,
          ↓                produces REFINED_SPEC
     harness-orchestrator  Selects team preset, builds till-done
     (Opus, deep)          contract, spawns leads in parallel
          ↓
     harness-lead(s)       Explore their domain, spawn specialist
     (Sonnet, balanced)    workers with synthesised prompts
          ↓
     Workers               Implement, test, review, migrate
     (existing agents)     using full tool access
```

**You only ever talk to the orchestrator.** Leads and workers run as sub-agents. If your client supports drilling into subagent threads (for example `Ctrl+O` in Claude Code), you can inspect any thread and see what it's doing.

## Execution Steps

When the user calls `/team`, follow these steps exactly:

### Step 1: Run intake

Spawn the `harness-intake` agent with the user's task description as the prompt.

Wait for harness-intake to either:
- Ask clarifying questions (relay these to the user and wait for answers)
- Output a `REFINED SPEC` block

If the user includes `--skip`, pass that flag to harness-intake so it skips scoring and produces the REFINED_SPEC immediately with assumptions noted.

### Step 2: Confirm team composition (optional, for complex tasks)

If the task is cross-service or involves multiple repos, show the user which preset will be used and ask for confirmation before spawning the orchestrator. For straightforward single-domain tasks, proceed without confirmation.

### Step 3: Spawn the orchestrator

Pass the full `REFINED SPEC` block to `harness-orchestrator` as its prompt.

The orchestrator will:
1. Emit a TILL DONE list (show this to the user immediately)
2. Emit a TEAM PLAN
3. Spawn leads in parallel via the Agent tool

### Step 4: Surface progress

As the orchestrator emits status updates, relay them to the user. The user can at any time:
- Type a message to send to the orchestrator (e.g., "deprioritise the E2E tests for now")
- If your client supports it (for example `Ctrl+O` in Claude Code), drill into a lead's or worker's sub-thread to inspect it
- Type `/checkpoint` to save progress

### Step 5: Surface the final report

When the orchestrator emits its FINAL REPORT, present it clearly. If status is NEEDS WORK or BLOCKED, explain what action is required from the user.

---

## Team Presets (Reference)

| Task Type | Preset | Leads | Workers |
|-----------|--------|-------|---------|
| **Research / advice** | `research` | 1 research lead (read-only) | scout or explorer, architect, planner |
| Backend feature | `backend-feature` | 1 backend lead | planner, tdd-guide, python-reviewer, security-reviewer |
| Frontend feature | `frontend-feature` | 1 frontend lead | planner, tdd-guide, e2e-runner, code-reviewer |
| Frontend bug | `frontend-bug` | 1 frontend lead | debugger, tdd-guide, code-reviewer |
| Data migration | `data-migration` | 1 data lead | database-reviewer, migrator, tdd-guide, code-reviewer |
| Performance | `performance` | 1 perf lead | debugger, performance, code-reviewer, tdd-guide |
| Security fix | `security-fix` | 1 security lead | security-reviewer, python-reviewer, tdd-guide, code-reviewer |
| Cross-service | `cross-service` | 2–3 parallel leads | architect, integrator, planner + domain workers |
| Bug fix | `bug-fix` | 1 backend lead | debugger, tdd-guide, code-reviewer |

---

## Examples

```
# Research / advice first (no code changes)
/team "how best to share a feature's logic between the API and the UI"
/team "what's the right approach for real-time updates — WebSockets or SSE?"
/team "how does the query engine work — I want to add a new operator"

# Implementation
/team "add JWT refresh token rotation to the API service"
/team "fix the broken filter on the results table in the UI"
/team "add a new score column to the events table"
/team "the /api/v1/records endpoint is returning 500 for large date ranges"
/team "add pagination to the list page in the UI" --skip
```

---

## Drill-Down Experience

If your client supports drilling into subagent threads (for example `Ctrl+O` in Claude Code), the three-tier architecture maps directly onto those threads:

```
Main thread          /team output — orchestrator status, till-done list
  drill in ↓
  Orchestrator       Full orchestrator context — lead spawning, planning
    drill in ↓
    Lead A thread    Lead's domain exploration and worker delegation
      drill in ↓
      Worker thread  Actual implementation, tests, file writes
    Lead B thread    Running in parallel with Lead A
```

You never need to drill down — everything rolls up to the top. But it's there if you want to understand what's happening or intervene.

---

## Interacting During a Team Session

You can message the orchestrator at any time during execution:

- `"deprioritise the E2E tests, just do unit tests for now"` — orchestrator will adjust
- `"the database-reviewer found a schema issue — don't proceed until I review it"` — orchestrator will pause that lead
- `"add a code-reviewer pass before merging the backend changes"` — orchestrator will add it

The orchestrator is always listening. It will adjust its till-done list and re-plan accordingly.

---

## Progress Surface Format

During a `/team` run, the orchestrator and leads emit structured progress lines so you can see what's happening without drilling into sub-threads.

### Status icons

| Icon | Meaning |
|------|---------|
| `⏳` | Running — agent is actively working |
| `✓` | Done — agent completed successfully |
| `✗` | Failed — agent encountered an error or blocker |
| `◐` | Parallel summary — aggregate status of concurrent agents |

### Format

```
[team] ⏳ backend-lead — running (turn 2)
         → exploring the API service, reading app/records/service.py

[team] ✓ tdd-guide — done (3 turns)
         → tests written and passing

[team] ✗ security-reviewer — blocked (1 turn)
         → waiting on a missing auth fixture

[team] ◐ parallel: 1/3 done, 2 running
```

### When progress lines are emitted

- **Orchestrator** emits a progress line:
  - After each lead completes (with lead status and summary)
  - When all leads finish (with aggregate `◐` line)
- **Lead** emits a progress line:
  - When starting each worker (`⏳`)
  - When each worker completes (`✓` or `✗`)
  - When the lead itself completes its domain

---

## Harness Engineering Principles

This command implements the harness engineering methodology:

1. **Tool restriction enforces hierarchy** — orchestrators and leads cannot write files (they lack Write/Edit tools). Only workers execute.
2. **Till-done, not todo** — work continues until all items are checked. Nothing is marked done until it's verifiable.
3. **Synthesised prompts, not lazy delegation** — every agent receives specific file paths, function names, and acceptance criteria. "Fix the issue" is banned.
4. **Parallel by default** — independent leads run simultaneously, maximising throughput.
5. **Trust through verification** — every worker output is verified by the lead before reporting up.

See `/team` with the `agent-teams` skill for the full harness engineering guide.

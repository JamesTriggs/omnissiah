---
name: agent-teams
description: Harness engineering guide for building features with three-tier agent teams. Covers the /team command, team presets, till-done contracts, prompt quality gates, and the philosophy of building systems that build systems.
---

# Agent Teams — Harness Engineering

This skill activates whenever you use `/team`, ask about running agent teams, or want to understand how to get more out of the framework than single-agent interactions allow.

## The Core Idea

Most engineers use Claude Code like a very capable pair programmer: one prompt, one agent, one task. That's good. But it hits a ceiling.

**Harness engineering is what comes next.**

When you own the harness — the configuration that controls which agents run, in what order, with what tools, with what context — you stop solving individual problems and start solving *problem classes*. One team setup that knows how to build API endpoints correctly, every time. Another that knows how to write tests that pass review. Another that handles data migrations without downtime.

The `/team` command is your entry point into that world.

---

## The Three-Tier Architecture

```
Tier 1: Orchestrator (Opus)
  ┌─────────────────────────────────────┐
  │ Thinks. Plans. Delegates.           │
  │ Never writes code.                  │
  │ Owns the till-done contract.        │
  │ Spawns leads in parallel.           │
  └──────────────┬──────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
Tier 2: Leads (Sonnet) — one per domain
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │ Backend    │  │ Frontend   │  │ Data       │
  │ lead       │  │ lead       │  │ lead       │
  │            │  │            │  │            │
  │ Explores   │  │ Explores   │  │ Explores   │
  │ domain,    │  │ domain,    │  │ domain,    │
  │ spawns     │  │ spawns     │  │ spawns     │
  │ workers    │  │ workers    │  │ workers    │
  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘
         │               │               │
    ┌────┴────┐      ┌────┴────┐     ┌────┴────┐
    ▼         ▼      ▼         ▼     ▼         ▼
Tier 3: Workers — existing specialist agents
  tdd-guide  code-reviewer  security-reviewer  migrator  etc.
  Full tools: Read, Write, Edit, Grep, Glob, Bash
```

**The key constraint that makes this work:**
- Orchestrators have **no Write/Edit/Bash** — structurally incapable of writing code
- Leads have **no Write/Edit/Bash** — delegate to workers or step in only if workers fail
- Workers have **full tools** — they do the actual execution

This isn't just convention — it's enforced by the agent tool configuration.

---

## The Prompt Intake Gate

Before the orchestrator runs, `harness-intake` (Haiku) classifies your task and scores your prompt:

```
/team "fix the broken filter on the orders table"
         ↓
harness-intake classifies: frontend-bug
Asks only: component details, trigger condition, expected behaviour
         ↓
REFINED SPEC produced → orchestrator receives it
```

The intake agent only asks questions relevant to your task type. It never asks about schema design for a frontend bug. It never asks about browser environments for a backend task.

**Score threshold:** 3/5 minimum before the orchestrator runs. Add `--skip` to bypass.

---

## The Till-Done Contract

Not a todo list. A **completion contract**.

The orchestrator emits this before spawning any agents:

```
TILL DONE — JWT Refresh Token Rotation
══════════════════════════════════════════════════════
[ ] POST /api/v1/auth/refresh endpoint returns 200 with new token pair
[ ] Expired refresh tokens return 401
[ ] Used refresh tokens (rotation) return 401
[ ] Concurrent requests: only first succeeds
[ ] Tests written BEFORE implementation (red)
[ ] Implementation makes all tests pass (green)
[ ] mypy passes on modified files
[ ] user identity extracted from token, not request params
[ ] Security review cleared
[ ] CI passing (lint + type-check + tests)
══════════════════════════════════════════════════════
```

Work does not stop until every item is checked. If a lead fails to complete an item, the orchestrator spawns another agent to finish it. This is not aspirational — it is the contract.

---

## Team Presets

### `backend-feature`
*New API endpoint, service feature, or backend logic*

**When to use:** Adding endpoints to a backend service, new background tasks, new service logic, new resources.

**Team composition:**
```
Lead: backend domain
  1. planner       → implementation plan, phases, risks
  2. tdd-guide     → tests first (red), then implementation (green)
  3. python-reviewer → PEP 8, type hints, patterns
  4. security-reviewer → auth, access control, injection
```

**Example:**
```
/team "add an endpoint to bulk-archive orders older than 30 days"
```

---

### `frontend-feature`
*New Vue/Nuxt component, page, or UI capability*

**When to use:** New pages, new dashboard widgets, new data tables, new modals or forms.

**Team composition:**
```
Lead: frontend domain
  1. planner   → component design, data flow, composables needed
  2. tdd-guide → Vitest unit tests + Cypress E2E
  3. e2e-runner → Cypress test scenarios, data-cy attributes
  4. code-reviewer → Vue 3 patterns, Pinia usage, ESLint
```

**Example:**
```
/team "add a revenue breakdown chart to the analytics dashboard"
```

---

### `frontend-bug`
*Fix a broken UI component, interaction, or rendering issue*

**When to use:** Something is broken, not rendering, throwing errors, or behaving unexpectedly in the UI.

**Team composition:**
```
Lead: frontend domain
  1. debugger    → root cause analysis, repro isolation
  2. tdd-guide   → regression test to lock the fix
  3. code-reviewer → verify fix doesn't break related components
```

**Example:**
```
/team "fix the broken filter on the orders table — it resets to default on every query"
```

---

### `rules-engine`
*New rule or policy for a configurable engine (YAML config or code)*

**When to use:** New business logic to operationalise, a new condition to cover, improving an existing rule's precision.

**Team composition:**
```
Lead: rules domain
  1. planner    → rule design, data source, field mapping
  2. integrator → rule definition (YAML config or code)
  3. code-reviewer → false-positive analysis, rule logic
  4. tdd-guide  → pytest tests for rule logic
```

**Example:**
```
/team "write a rule that flags orders above a configurable value threshold"
```

---

### `data-migration`
*Relational (Alembic) or analytics-database schema change*

**When to use:** Adding/modifying tables or columns, changing data types, adding indexes, analytics schema evolution.

**Team composition:**
```
Lead: data domain
  1. database-reviewer → schema design review, impact analysis
  2. migrator          → migration script (Alembic or analytics DB)
  3. tdd-guide         → tests for new schema, rollback test
  4. code-reviewer     → migration quality, rollback safety
```

**Example:**
```
/team "add a risk_score column (Float32) to the analytics events table"
```

---

### `performance`
*Profile and fix a slow query, endpoint, or rendering bottleneck*

**When to use:** An endpoint is timing out, a query is full-scanning, a Vue component is re-rendering too often.

**Team composition:**
```
Lead: performance domain
  1. debugger     → reproduce and isolate the bottleneck
  2. performance  → profiling, root cause, fix
  3. code-reviewer → verify fix, check for regressions
  4. tdd-guide    → benchmark test to lock the improvement
```

**Example:**
```
/team "the /api/v1/reports/query endpoint times out on queries spanning > 7 days"
```

---

### `security-fix`
*Fix a vulnerability, auth issue, or data exposure*

**When to use:** A security issue has been identified — auth bypass, injection vector, data leak, exposed secrets.

**Team composition:**
```
Lead: security domain
  1. security-reviewer → full vulnerability analysis, blast radius
  2. python-reviewer   → fix implementation with secure patterns
  3. tdd-guide         → security regression tests
  4. code-reviewer     → verify fix completeness
```

**Example:**
```
/team "the user notes field is vulnerable to stored XSS — sanitise before render"
```

---

### `cross-service`
*Feature spanning multiple repos or involving shared schema/contract changes*

**When to use:** Any change that touches a shared data model or schema, requires coordinated deployment across 2+ repos, or involves API contract changes between services.

**Team composition:**
```
Lead A: integration domain
  1. architect   → cross-service design, deployment order
  2. integrator  → API contracts, schema changes, service boundaries
  3. planner     → phased rollout plan

Lead B: backend domain (parallel after Lead A's plan)
  1. tdd-guide → implementation + tests
  2. python-reviewer → code quality
  3. security-reviewer → security pass

Lead C: data domain (parallel with Lead B, if migration needed)
  1. database-reviewer → migration impact
  2. migrator → schema migration scripts
```

**Example:**
```
/team "add a new OrderShipped event type to the shared schema and ingest it into the analytics database"
```

---

### `bug-fix`
*Fix a non-UI, non-security bug*

**When to use:** A backend service is throwing errors, a background task is failing, a query is returning wrong results.

**Team composition:**
```
Lead: backend domain
  1. debugger    → five-step root cause analysis
  2. tdd-guide   → regression test + fix
  3. code-reviewer → verify fix, check related paths
```

**Example:**
```
/team "the reconciliation task fails with KeyError on records without a customer name"
```

---

### `research`
*Explore the codebase and get a recommendation before making any changes*

**When to use:** You want to understand how something works, evaluate your options, or get expert advice before committing to an implementation. **No code is written.** The output is a structured recommendation report that ends with a ready-to-execute `/team` command.

Use this when you're asking "how best to", "what's the right approach", "is it possible to", "how does X work", or "what are my options for".

**Team composition:**
```
Lead: research domain (read-only — no file writes)
  1. explorer      → maps existing implementation end-to-end (files, patterns, data flow)
  2. architect     → designs 2–3 options with trade-offs (effort, risk, reuse vs. rebuild)
  3. planner       → selects recommendation + produces ready-to-execute /team command
```

**Output:** A RESEARCH REPORT with Findings, Options, Recommendation, and a pre-filled `/team` command you can run immediately to start implementation.

**Examples:**
```
/team "how best to replicate the AI summary feature for the detail view
       in the backend and the UI"

/team "what's the best approach for adding real-time notifications to the dashboard —
       WebSockets, polling, or SSE?"

/team "how does the existing query engine work — I want to add a new operator"

/team "should I add the new endpoint to the orders service or the reporting service, and why?"
```

**The flow:**
```
/team "how best to replicate AI summary for the detail view"
  → intake: research, score 3/5 ✓
  → orchestrator: research preset, spawns research lead
    → explorer: finds AI summary implementation
                maps files, API calls, model integration, response shape
    → architect: designs 3 options (copy pattern, shared service, new module)
                 trade-offs: effort, coupling, maintainability
    → planner: recommends option 2 (shared service) with rationale
               produces: /team "create a shared AI summary service in the backend..."
  → RESEARCH REPORT delivered
  → user reviews, runs the ready-to-build /team command
```

---

## The Ctrl+O Drill-Down

Your primary experience is the orchestrator's thread. Everything rolls up there:

```
Main Claude Code thread
  → Orchestrator status: "spawning 2 leads in parallel..."
  → Till-done updates as items complete
  → Final report

Ctrl+O → Orchestrator thread
  → Full orchestrator context
  → Lead spawn prompts (synthesised specs)
  → Lead reports rolling in

  Ctrl+O → Backend Lead thread
    → Domain exploration (file reads, grep results)
    → Worker spawn prompts
    → Worker reports

    Ctrl+O → tdd-guide Worker thread
      → Actual test file being written
      → Red/green cycle
      → Final test results
```

You never need to drill down. But it's there whenever you want to understand *why* a decision was made or *what* an agent is doing.

---

## Interacting with a Running Team

Once the orchestrator is running, you can message it at any time:

| Message | Effect |
|---------|--------|
| `"skip the E2E tests, unit tests only"` | Orchestrator adjusts worker list |
| `"pause the data migration lead — I need to review the schema first"` | Orchestrator holds that lead |
| `"add a performance pass after the implementation"` | Orchestrator adds performance worker |
| `"the approach won't work — here's why: ..."` | Orchestrator replans from that point |

The orchestrator treats your messages as high-priority steering input. It will acknowledge, re-plan, and continue.

---

## Harness Engineering Principles

These principles are enforced mechanically, not by convention:

### 1. Tool restriction IS the enforcement
Orchestrators and leads have `tools: ["Read", "Grep", "Glob", "Agent"]`. They cannot call Write or Edit because those tools aren't in their context. There is no prompt saying "please don't write files" — they structurally cannot.

### 2. Synthesised prompts, not lazy delegation
Every agent prompt must contain specific file paths, function names, and acceptance criteria. The orchestrator *explores the codebase before prompting leads*. Leads *explore their domain before prompting workers*. "Fix the issue" is not a valid agent prompt.

### 3. Till-done, not todo
A todo list is aspirational. A till-done contract is a commitment. The team runs until every item is checked. If a worker fails, the lead steps in. If a lead fails, the orchestrator steps in.

### 4. Parallel by default
Independent leads run simultaneously via multiple Agent tool calls. Only sequence when there's an explicit dependency (e.g., the integration spec must exist before implementation begins). Sequential execution of independent work is a waste.

### 5. One prompt to the orchestrator, visible everything
The user's cognitive load is one prompt. Everything else — team selection, domain exploration, worker coordination, verification — happens in sub-threads the user can optionally inspect. This is what makes it scalable: the surface area of your input doesn't grow with team size.

### 6. Build systems, not solutions
Once you have a working `backend-feature` team that reliably builds endpoints correctly, you have a system. Run it again next week for a different endpoint. It gets better over time as agents update their understanding of your codebase. This is the difference between solving one problem and solving a problem class.

---

## Reading Team Progress

During a `/team` run, the orchestrator and leads emit structured progress lines. These give you live visibility into what's happening without needing to drill into sub-threads with `Ctrl+O`.

### Status Icons

| Icon | Meaning |
|------|---------|
| `⏳` | Running — agent is actively working |
| `✓` | Done — completed successfully |
| `✗` | Failed — error or blocker encountered |
| `◐` | Parallel summary — aggregate of concurrent agents |

### Example Output

```
[team] ⏳ backend-lead — exploring the orders service (turn 2)
         → reading src/orders/service.py
         → 2 turns ↑18k ↓6k $0.031

[team] ✓ tdd-guide — tests written and passing
         → 3 turns ↑24k ↓12k $0.048

[team] ✗ security-reviewer — blocked on missing auth fixture
         → 1 turn ↑8k ↓2k $0.012

[team] ◐ parallel: 2/3 done, 1 running
```

### What Each Field Means

- **Agent name** — the lead or worker emitting the status
- **Description** — what the agent just did or is doing
- **Turns** — how many conversation turns the agent used
- **↑ / ↓** — input/output tokens consumed
- **$** — estimated cost of this agent's work

### Who Emits What

| Agent | Emits progress when |
|-------|-------------------|
| **Orchestrator** | After each lead completes; aggregate `◐` when all leads finish |
| **Lead** | When starting a worker (`⏳`); when a worker finishes (`✓`/`✗`); when the lead's domain is complete |

---

## Tool Call Summary Format

When leads emit progress lines or summarise worker activity, use this compact notation for tool calls. This keeps progress output scannable without expanding every tool invocation.

| Compact Form | Tool | Example |
|-------------|------|---------|
| `$ <command>` | Bash | `$ git diff --stat` |
| `read <path>:L<start>-L<end>` | Read (with offset/limit) | `read src/orders/service.py:L1-L50` |
| `read <path>` | Read (full file) | `read CLAUDE.md` |
| `edit <path>` | Edit | `edit src/stores/orderStore.ts` |
| `grep /<pattern>/ in <path>` | Grep | `grep /user_id/ in src/` |
| `glob <pattern>` | Glob | `glob **/*.proto` |
| `write <path>` | Write | `write tests/test_new.py` |

### Usage in progress lines

```
[team] ⏳ scout — exploring the orders service auth flow
         → grep /def refresh/ in src/
         → read src/apis/auth/views.py:L45-L90
         → 2 turns ↑18k ↓6k $0.031
```

Leads and the orchestrator SHOULD use this compact format when describing what a worker did. Workers themselves use normal tool calls.

---

## Mental Model Management (Advanced)

Agents in your team can maintain persistent knowledge files across sessions. This is optional but powerful for long-running projects.

Location: `~/.claude/team-context/<team-name>/<agent-name>.md`

Structure:
```markdown
# [Agent Name] — Domain Knowledge

## Current Understanding
[What this agent knows about the codebase right now]

## Past Work
[What has been built or reviewed — specific files and what changed]

## Learned Patterns
[What works well in this domain — patterns to repeat]

## Open Questions
[Unresolved architectural questions to surface next session]
```

To activate: tell the orchestrator `"use mental models for this session"` — it will instruct leads to read and update their domain knowledge files.

---

## When Not to Use /team

`/team` is not the right tool for every task. Use the simpler path when it fits:

| Situation | Better tool |
|-----------|------------|
| Single-file fix, obvious solution | Just ask Claude directly |
| Quick question about the codebase | `/tldr search "..."` |
| Security review of a PR | `/code-review` |
| Database migration only | `/migrate` |
| Bug in a specific function | `/debug "..."` |
| Simple sequential 2-3 agent flow | `/orchestrate feature "..."` |

Use `/team` when the task is significant enough to benefit from a structured, verified, multi-domain effort — and when you want that work to happen reliably, in parallel, with a completion contract.

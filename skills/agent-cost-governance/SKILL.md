---
name: agent-cost-governance
description: Govern token spend and model-tier selection for AI-native engineering. Use when choosing which model tier to run a task on, setting a per-task cost cap or token budget, reasoning about context-window economics, deciding whether multi-agent is worth the spend, or cutting the cost of an agent workflow. Triggers include cost, token budget, model selection, model tier, context economics.
---

# Agent Cost Governance

## Overview

Agent workflows spend money one token at a time, and the bill is dominated by choices that are easy to make carelessly: which model runs a task, how much context you carry, and how many agents you fan out. This skill is about making those choices deliberately. The goal is not to minimise spend; it is to spend where it buys quality and stop spending where it does not.

Two facts frame everything below. First, tiers differ by roughly 5x in price between the cheap and top ends, so tier selection is the biggest single lever. Second, agents are far more token-hungry than chat, so context and fan-out decisions compound fast.

## When to Use

- Choosing which model tier to run a task, subagent, or pipeline stage on
- Setting a per-task cost cap or a token budget for an agentic loop
- Estimating what a workflow will cost before running it at scale
- Deciding whether a task justifies multi-agent fan-out
- Cutting the cost of an existing workflow that is spending too much

## Model-Tier Selection

Think in three tiers. Names and exact prices move; the *shape* is stable and is what you design against.

| Tier | Use for | Rough input/output price/MTok |
|---|---|---|
| Cheap / fast | High-volume reads, search, exploration, classification, extraction, simple codegen, cheap subagents | ~$1 / ~$5 |
| Mid | Day-to-day coding, review, test writing, most implementation | ~$3 / ~$15 |
| Top | Architecture, security review, orchestration, deep debugging, hardest agentic runs | ~$5 / ~$25 (specialised frontier tiers higher) |

(As a concrete 2025-2026 anchor: a cheap/fast tier around $1/$5, a mid tier around $3/$15, a top Opus-class tier around $5/$25, and a specialised frontier tier above that. Confirm current model IDs and prices against the model catalogue before quoting numbers.)

### Match tier to task, not habit

- **Cheap/fast tier** for anything high-volume and low-judgement: sweeping a codebase, grepping, classifying tickets, extracting fields, first-pass exploration. If you run it thousands of times, it belongs here.
- **Mid tier** for the bulk of engineering work: writing a feature, reviewing a diff, generating tests, fixing a normal bug. This is where most sessions should live.
- **Top tier** for work where a wrong answer is expensive and hard to catch: system design, security analysis, cross-service integration, incident root-cause, and the orchestrator that coordinates a multi-agent run. The orchestrator earns the top tier because its mistakes multiply across every worker it directs.

### Baseline with the strongest, then downgrade against evals

The disciplined default is: **start on the strongest model, get the task working and measured, then downgrade tiers one step at a time and keep the cheapest tier that still passes your evals.** This ordering matters. If you start cheap and something is subtly wrong, you cannot tell whether the task is hard or the model is under-powered, and you burn time chasing prompt fixes for a capability gap. Starting strong establishes the quality ceiling first; the downgrade then answers a clean question: "does the cheaper tier still pass?" Do not downgrade on vibes, and do not downgrade the orchestrator or a security-critical stage just because the workers downgraded cleanly.

## Token Budgeting and Cost Caps

- **Set a per-task token budget** for agentic loops so a runaway task self-moderates and finishes gracefully instead of grinding to a hard cutoff. A budget the model is aware of (a running countdown it can pace against) is different from a hard per-response cap the model never sees; use the cap as the enforced ceiling and the budget as the guidance.
- **Estimate before scale.** Count tokens on a representative input, multiply by the tier's per-token rate and by the expected number of turns, and multiply again by volume. A workflow that is fine once can be ruinous at 10,000 runs. Do the arithmetic before rolling out.
- **Cap the blast radius, not just the average.** The failure mode is the tail: the one task that loops, re-reads the same files, or fans out uncontrolled. Per-task caps and turn limits bound the worst case.
- **Attribute spend.** Track tokens per task/stage/agent so you can see where the money goes. You cannot govern what you cannot attribute; the biggest wins usually hide in one over-provisioned stage.

## Context-Window Economics

Context is the hidden cost multiplier. Two rules of thumb worth internalising:

- **An agent turn costs roughly 4x the tokens of a single chat message.** The agent resends accumulated history, tool schemas, tool results, and reasoning on every turn. What reads like "one question" is really the whole transcript, re-sent.
- **A multi-agent run costs on the order of 15x a single chat exchange.** Each subagent carries its own context, and the orchestrator carries the coordination overhead on top. Fan-out multiplies the per-turn cost, not just adds to it.

Implications:

- **The context window is not a free budget to fill.** Every token in the prefix is re-processed (or cache-read) on every turn. A bloated system prompt or an over-stuffed context is a recurring tax, not a one-time cost.
- **Prompt caching changes the arithmetic.** Cache reads cost a fraction of full input price, so a large stable prefix that is re-read many times is far cheaper than its raw token count suggests — *if* the prefix stays byte-stable. A silent invalidator (a timestamp in the system prompt, a per-request ID, non-deterministic serialisation) turns every turn back into a full-price write. Keep volatile content out of the cached prefix.

## When Multi-Agent Is Worth the Spend

Multi-agent is a force multiplier and a cost multiplier at the same time. It pays off when the work genuinely parallelises and the outcome justifies the ~15x.

Worth it when:

- The task **fans out across independent items** (many files to read, many candidates to evaluate, many sources to research) that can run concurrently.
- The subtasks are **context-isolated**, so a cheap subagent can own a slice without needing the whole transcript.
- The **outcome is high-value** enough to justify the token spend and coordination overhead.

Not worth it when:

- The work is **sequential** — each step needs the previous step's result. A single agent is cheaper and simpler.
- A **direct read or a single tool call** would answer the question. Spawning a subagent to do one `grep` is pure overhead.
- The task is **small or cheap to redo**; the coordination cost exceeds the benefit.

Default to the simplest tier that works: single call, then single agent with tools, then multi-agent only when the fan-out is real.

## Practical Cost Levers

- **Compaction.** For long-running conversations, summarise earlier context at logical boundaries so you stop re-sending a growing transcript at full price every turn.
- **Context editing.** Prune stale tool results and completed reasoning from the transcript so the per-turn payload stays lean without a full summarisation.
- **Just-in-time retrieval.** Load a file, doc, or result when the task needs it, not pre-emptively. Pulling everything "so the agent has it" is the most common source of context bloat.
- **Condensed subagent returns.** Have a subagent return the *conclusion*, not its full transcript. The parent pays for whatever the subagent hands back; a five-line answer beats a five-page dump, and the parent almost never needs the intermediate steps.
- **Scope tools.** Fewer, well-chosen tools mean smaller schemas in context and fewer wasted exploratory calls. Read-only, parallel-safe tools also let cheap subagents fan out efficiently.
- **Right-size `max_tokens` and effort.** Set output limits and reasoning effort to the task. Maximum effort on a routine task is wasted spend; too-low a limit truncates and forces an expensive retry.
- **Downgrade validated stages.** Once a pipeline is stable and eval-backed, push each non-critical stage to the cheapest tier that still passes.

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Top tier for everything | 5x overspend on work a mid/cheap tier handles | Match tier to task; downgrade against evals |
| Starting cheap to "save money" | Can't separate hard-task from weak-model; time lost | Baseline strong, then downgrade validated |
| Filling the context window because it's large | Recurring per-turn tax | JIT retrieval; keep the prefix lean |
| Multi-agent for sequential work | ~15x cost, no parallelism gain | Single agent with tools |
| Subagents returning full transcripts | Parent pays for the dump | Return condensed conclusions |
| Volatile data in the cached prefix | Cache never hits; full-price every turn | Move timestamps/IDs after the last breakpoint |
| No per-task cap | One runaway task dominates the bill | Budget + turn limit; cap the tail |
| No per-stage attribution | Can't find the overspend | Track tokens per stage/agent |

## Verification

- [ ] Each task/stage/agent runs on the cheapest tier that passes its evals
- [ ] The orchestrator and security-critical stages are not downgraded on vibes
- [ ] Downgrades were validated against evals, not assumed
- [ ] Agentic loops have a token budget and a hard per-task cap
- [ ] Cost was estimated on a representative input before scaling
- [ ] The cached prefix is byte-stable; volatile content sits after the last breakpoint
- [ ] Multi-agent is used only where fan-out is real and the outcome justifies ~15x
- [ ] Subagents return condensed conclusions, not full transcripts
- [ ] Token spend is attributed per stage so overspend is visible

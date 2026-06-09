---
name: customer-evidence
description: Pull the strongest current customer, PMF, health, and GTM evidence before solutioning. Use when work touches customer outcomes, retention, churn, adoption, PMF, roadmap bets, or strategic feature requests.
---

# Customer Evidence

## Purpose

Start from signal, not vibes.

Use your customer-evidence platform (CRM, customer-success tooling, meeting-intelligence, and health/PMF signals) as the evidence layer before you let anyone solution too early.
This skill turns scattered customer context into one short brief the rest of the workflow can trust.

## Use this when

- the work affects a customer-facing metric
- the request came from anecdotes, one loud account, or stakeholder opinion
- you are dealing with churn, renewal, adoption, activation, PMF, expansion, or workflow friction
- you need to know whether the ask is a real problem, a segment problem, or a made-up internal story

## Evidence order

Pull these six evidence classes from your evidence platform first:

1. PMF signal:
   product-market-fit narratives, PMF radar, PMF averages, sector trends, novelty, counter-intuitive insights, drift alerts, quarterly predictions
2. PMF experiment signal:
   experiment definitions and runs, event history, KPI observations, budget observations, promotion gates, stop-loss history
3. Customer-success execution signal:
   CS call summaries, execution-plan and adoption patterns, outcome and advocacy signals, renewal-risk flags, expansion notes, missed next actions
4. Health signal:
   CHI, unified health, health tier, churn probability, churn drivers, expansion probability, expansion signals, recommended actions
5. Opportunity and use-case signal:
   product opportunities, competitive gaps, delighters, JTBD, future pains, case-study or advocacy opportunities
6. Customer-intelligence and commercial context:
   Gmail relationship strength, LinkedIn overlaps, warm intro paths, decision-maker scoring, ABX or ICP context, semantic retrieval

## Transcript pass map

Use the transcript passes deliberately:

- for "what should we build or fix?": `opportunities`, `ai_security_state`, `pmf_enhanced`, `narrative`
- for churn or renewal risk: `cs_execution`, `chi`, `renewal_timing`, `meeting_excellence`, then `opportunities`
- for expansion or advocacy: `cs_execution`, `opportunities`, `chi`, plus account-level health and commercial context
- for deal movement and pricing context: `core_deal`, `discovery_qual`, `value_pricing_signals`, `forecast_assessment`, `se_eval`, `leader_eval`

## Working method

1. Separate hard evidence from inference.
2. Prefer repeated patterns over one-off anecdotes.
3. For churn, renewal, and adoption work, trust repeated CS-call patterns before top-line vanity summaries.
4. State what is known, what is likely, and what still needs discovery.
5. End with one evidence brief, not a landfill of observations.

## Output contract

Produce a concise evidence brief with:

- affected segment
- broken moment or workflow
- business consequence
- strongest proof
- conflicting signals
- open questions still requiring discovery
- build now, discover more, or kill recommendation

## Hand-off rule

This skill should make the next step obvious:

- if the problem is still weakly evidenced, go to `/discovery-process`
- if the problem is clear, hand into `/prd-development`
- if the request is actually small and obvious after the evidence pass, the router may still send it to `quick-fix`

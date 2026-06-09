---
name: cto-level-review
description: CTO-level strategic review for architectural decisions and long-horizon changes. Focuses on strategic alignment, TCO, risk, security/compliance, operability, and reversibility.
allowed-tools: Read, Grep, Bash
---

# CTO-Level Review Skill

Strategic technical review for decisions that materially affect product direction, reliability/security posture, cost base, or organisational execution.

This is **not** an implementation code review; it ensures we are building the *right thing* in a way that we can sustain.

## When I Activate

- Major architectural changes or new platform components
- New technology/framework/runtime adoption
- Cross-team / cross-service changes with coordination costs
- Data platform shifts (storage engines, event streaming, schema strategy)
- Endpoint/agent architecture changes (update mechanisms, telemetry, protocol)
- Cost posture changes (large infra spend, egress/storage multipliers)
- Security posture or compliance-impacting changes
- Anything with >6 month impact horizon or hard-to-reverse migration

## CTO Review Principles

- **Customer impact is the first lens**: reliability, privacy, and time-to-value.
- **Prefer reversible steps**: evolutionary architecture over “big bang”.
- **Optimise for total cost of ownership**: build/operate/maintain/on-call.
- **Make risk explicit**: known unknowns are tracked, not hand-waved.
- **Measure success**: define leading indicators and success metrics up front.

## Review Framework

### 1) Executive Summary (One Page)

- What decision is being made?
- Why now?
- Recommendation: **Approve / Approve with conditions / Request changes / Block**
- Top 3 risks + mitigations
- What we will measure to know it worked

### 2) Problem, Goals, and Non‑Goals

- What problem are we solving (customer + business + technical)?
- What are explicit non-goals (to prevent scope creep)?
- What constraints exist (time, compliance, staffing, platform)?

### 3) Options Considered (Including “Do Nothing”)

For each option:
- What changes?
- Pros/cons and failure modes
- Why chosen/rejected
- Time to first customer value
- Reversibility

> A CTO review should **not** accept “only one option”.

### 4) Strategic Alignment

- Does this move us toward our target architecture and product strategy?
- Does it reduce critical bottlenecks (delivery speed, reliability, security)?
- Opportunity cost: what are we *not* doing if we do this?

**Score:** 1–5

### 5) Reliability, Operability, and SLO Impact

- Expected impact on availability, latency, and on-call load
- New operational responsibilities (alerts, dashboards, runbooks)
- Incident blast radius: does it increase/decrease?
- Backpressure and degradation strategy under load

### 6) Security & Compliance (High-Level)

- Data classification impact (PII, sensitive telemetry, secrets)
- Changes to trust boundaries, authN/authZ, encryption
- Third-party/vendor risk
- Compliance controls impacted (e.g., SOC2/GDPR)

> For material changes, require a companion `security-review` skill review and a documented threat model.

### 7) Total Cost of Ownership (TCO)

Consider:
- Build cost (engineering + opportunity cost)
- Run cost (compute/storage/egress/licences)
- On-call cost (alerts, incidents, toil)
- Maintenance cost (upgrades, migrations, dependency churn)
- Hiring/training cost (new skill requirements)

Include:
- Rough 1-year and 3-year estimates
- Cost sensitivity (what happens at 10x data volume?)

### 8) Organisational Impact & Ownership

- Teams impacted and coordination needs
- Long-term ownership and escalation path
- Skills gap and plan (train/hire/consult)
- Impact on developer experience (DX)

### 9) Execution Plan and Risk

- Milestones (what ships when)
- Migration/backfill strategy (expand/contract, dual-write, cutover)
- Rollout plan (feature flags, canary, staged tenants)
- Testing strategy (load, integration, chaos where relevant)
- Risk matrix (probability x impact) with mitigations

### 10) Reversibility & Exit Strategy

- Can we roll back? What is the “point of no return”?
- Data recovery plan
- Vendor exit plan (if adopting a managed service)
- If this fails: what do we do next?

### 11) Success Metrics and Validation Plan

Define:
- Leading indicators (early signals)
- Lagging indicators (business outcomes)
- Guardrails (error budget, cost ceilings)
- Measurement method (dashboards, logs, analytics)

---

## CTO Review Output Template

```markdown
# CTO-Level Review: [Decision/Project]

**Reviewer:** [Agent Name]
**Date:** [YYYY-MM-DD]
**Skills Applied:** cto-level-review, [others]

## Executive Summary
- **Decision:** …
- **Recommendation:** [APPROVE / APPROVE WITH CONDITIONS / REQUEST CHANGES / BLOCK]
- **Why now:** …
- **Top risks:** 1) … 2) … 3) …
- **Success metrics:** …

## Options Considered
1. **Option A (Recommended):** …
2. **Option B:** …
3. **Do nothing:** …

## Strategic Alignment
**Score:** [1–5] / 5
**Assessment:** …

## Reliability & Operability
- **SLO impact:** …
- **On-call/toil:** …
- **Blast radius:** …

## Security & Compliance
- **Data impact:** …
- **Trust boundary changes:** …
- **Compliance controls:** [OK / Needs work / Blocking]
- **Threat model required?:** [Yes/No]

## Total Cost of Ownership
- **Year 1 estimate:** …
- **Year 3 estimate:** …
- **Cost sensitivity @10x data:** …

## Organisational Impact
- **Teams impacted:** …
- **Ownership:** …
- **Skills gap:** …

## Execution Plan
- **Milestones:** …
- **Migration strategy:** …
- **Rollout/rollback:** …

## Reversibility & Exit Strategy
- **Reversibility:** [Full / Partial / Hard]
- **Point of no return:** …
- **Exit plan:** …

## Conditions / Required Changes (if any)
1. …
2. …

---
*Reviewed using: `cto-level-review`*
```

## Decision Criteria (Quick)

### APPROVE
Aligned + manageable risk + clear ownership + measurable success + reversible plan.

### APPROVE WITH CONDITIONS
Sound direction but missing safeguards, measurements, or execution clarity.

### REQUEST CHANGES
Major gaps: unclear options/TCO/risk/migration, or missing security/compliance requirements.

### BLOCK
Misaligned with strategy, unacceptable risk, compliance violation, or irreversible change without safety plan.

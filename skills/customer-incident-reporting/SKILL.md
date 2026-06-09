---
name: customer-incident-reporting
description: Drafts, reviews, and redrafts customer-facing incident reports from call notes, SOC findings, tickets, and breach summaries. Use when preparing flash reports, draft updates pending further investigation, executive summaries, action trackers, or self-contained Gamma briefs after a live incident.
---

# Customer Incident Reporting

Use this skill to turn messy incident material into a clear, credible customer-facing report.

## Quick Start

1. Gather the available source material.
2. Choose the report mode: flash, draft pending further investigation, or final.
3. Build the evidence ledger before writing prose.
4. Reconcile one timeline with source labels.
5. Draft the report using the template and structure below.
6. Review the rendered output before treating it as done.

## Tiny Worked Example

**Input**

- Vendor case opened at 11:52.
- Customer says the first clear sign of compromise was around 10:22.
- Another tool raised related activity at 10:31.

**Output**

- Status line: `Draft pending further investigation`
- `Confirmed by the vendor`: case opened at 11:52
- `Customer-reported`: activity around 10:22 and 10:31
- Action table with named owners for timeline reconciliation and control changes

## When to Activate

Use this skill for:

- reviewing an existing incident report and improving it
- drafting a fresh customer-facing incident report from raw source material
- producing a same-day flash report
- producing a draft pending further investigation
- separating confirmed facts from customer-reported facts and open questions
- building the owner, timing, and action tracker behind the report
- preparing a self-contained brief for Gamma or another AI document tool

## Expected Outputs

This skill should normally produce one or more of:

- a customer-facing incident report
- an executive summary for a senior stakeholder
- a clear action tracker with owners and timings
- a self-contained document-builder brief
- a short internal note on process or organizational improvements

## Inputs

Gather as many of these as are available:

- current incident report or deck
- customer call transcript or notes
- customer-written incident summary
- vendor timeline, alert extracts, or case notes
- escalation history
- actions already agreed verbally

## Evidence Ledger

Before drafting, sort material into these buckets:

- `Confirmed by the vendor`
- `Customer-reported`
- `Working understanding`
- `Still being confirmed`

Do not merge these buckets in the final report unless the evidence genuinely supports it.

## Core Workflow

1. Ingest the source material.
2. Build the evidence ledger.
3. Reconcile one clean timeline with source labels.
4. Decide the audience: executive, technical, or mixed.
5. Choose the right mode: flash, draft, or final.
6. Draft the report using the required structure.
7. Build a separate actions table with owners and target timing.
8. Review tone, ownership, and readability before delivery.
9. If the issue is cross-functional, load `references/organizational-overlay.md`.

## Output Modes

### Flash Report

Use when the customer needs a same-day executive note.

- keep it short
- keep it calm
- state clearly that investigation continues

### Draft Pending Further Investigation

Use when speed matters but the facts are still being reconciled.

- separate confirmed facts from working understanding
- label open items clearly
- use source labels in the timeline where helpful

### Final Report

Use only when timeline, scope, and actions are closed enough to support it.

- remove uncertainty only where evidence supports it
- keep owner and action tracking visible
- do not rewrite earlier uncertainty out of the story if it mattered operationally

## Required Report Structure

Use this order unless there is a strong reason not to:

1. Title
2. Status line
3. Executive Summary
4. Current Position
5. What We Know So Far
6. Timeline
7. Assessment
8. Actions Already Taken
9. Immediate Next Steps
10. Residual Risk
11. Closing Note

## Drafting Rules

- Write for the most senior plausible reader first.
- Keep the first page readable by someone non-technical.
- Be explicit about what came from the vendor and what came from the customer.
- Do not overstate certainty.
- Do not hide vendor-owned gaps.
- Do not make customer-side issues the whole story if the vendor had real routing, coverage, or escalation weaknesses too.
- Keep commercial follow-up separate from the incident narrative.
- Replace vague recommendations with action rows: action, owner, timing, purpose.
- Show leadership ownership, not only task ownership, when the issue is cross-functional.

## AI Document Builder Rules

When briefing Gamma or another document tool:

- make the prompt self-contained
- do not rely on linked files or local paths
- include the key facts, timeline, open questions, and action table in the prompt
- state the audience and the exact role the document plays
- tell the tool what the document is not: sales deck, marketing asset, or forensic appendix

Use these hard constraints:

- cover page may be dark, but body pages should default to light backgrounds
- maximum 120 words of narrative text on any one card
- maximum 5 bullets in any one column
- avoid dense 3-column layouts for long text
- keep the action plan in one table with an explicit owner column
- expand acronyms on first reference for mixed or executive readers

Use the reusable prompt template at `templates/ai-document-builder-brief-template.md`.

## Rendered Output Review

If the report is produced as a PDF, deck, or Gamma export, review the rendered output before treating it as done.

Score it against:

- executive readability
- evidence separation
- ownership and action clarity
- tone and accountability
- branding and currentness
- visual density and scanability

Iterate again if any of these are true:

- executive readability is below `8/10`
- branding or currentness is below `8/10`
- any page requires slow reading or zooming
- the document looks like a generic cyber deck rather than an executive incident memo
- the action plan is missing a visible owner column

## Support Files

- `templates/flash-report-template.md`
- `templates/ai-document-builder-brief-template.md`
- `references/review-checklist.md`
- `references/organizational-overlay.md`

Load `references/organizational-overlay.md` when the deeper issue is role clarity, trust repair, stakeholder handling, or leadership behavior under pressure.

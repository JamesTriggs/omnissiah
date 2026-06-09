---
name: product-clarity-review
description: Review product, pricing, customer, transcript, documentation, and engineering evidence to answer ambiguity questions before design or implementation. Use when asked whether a requirement was explicit, whether engineering matches the commercial promise, what edge cases exist, how billing/lifecycle/state rules should work, or how to prevent product-to-engineering translation misses.
---

# Product Clarity Review

## Purpose

Use this skill to turn a fuzzy product/commercial question into an explicit decision brief that engineers, product, sales, and leadership can agree on. The core job is to prevent the trap where something is obvious to customers but only implicit to engineering.

Pay special attention to "registration gaps": cases where a founder, salesperson, customer, or product leader describes a need clearly enough in conversation, but the engineering system never converts it into a formal requirement, owner, acceptance test, or architecture decision.

## First Move

Restate the question as:

> What customer/commercial promise is being tested, and what exact system rule would make it true?

Then name the likely missing object. Examples:

- Data-source lifecycle policy
- Case-lifecycle billing unit
- Reopen/refund rule
- Source-level retention clock
- Human-escalation boundary
- Customer-visible entitlement
- Audit/reversal event

If the missing object cannot be named, keep investigating before recommending implementation.

## Evidence Ladder

Gather evidence in this order, stopping only when the answer is well-supported:

1. **Customer promise**: sales deck, pricing calculator, order wizard, proposal, website, customer conversation, demo script.
2. **Formal requirements**: PRD, ADR, architecture docs, spreadsheets, decision logs, acceptance criteria.
3. **Meeting evidence**: weekly planning, retro, customer calls, Slack/email summaries, transcript analysis from a meeting-intelligence tool.
4. **Implementation evidence**: current repo, code paths, schema, migrations, tests, feature flags, telemetry, billing code.
5. **Operational evidence**: deployed config, dashboards, logs, runbooks, and API behaviour.

Classify each item as one of:

- **Explicit**: directly states the rule.
- **Implied**: a reasonable person may infer it, but implementation latitude remains.
- **Verbally explicit but unregistered**: clearly described in conversation or customer framing, but not captured as an accepted requirement, ticket, ADR, acceptance criterion, or design constraint.
- **Contradicted**: current docs/code point another way.
- **Missing**: no reliable evidence found.

Never collapse "obvious to customer" into "explicit enough for engineering." Treat those as different conclusions.

## Registration Gap Assessment

For each important requirement, assess four separate layers:

1. **Customer need**: what customer pain, value, or workflow was described?
2. **Commercial promise**: what Sales/pricing/deck/calculator implied or stated?
3. **Verbal communication**: was the need said in meetings, and how directly?
4. **Engineering registration**: did it become a requirement engineers were accountable to build?

Use this scale:

- **Registered**: formal artifact exists with owner, rule, and acceptance criteria.
- **Verbally explicit but unregistered**: spoken clearly, but no buildable artifact or acceptance test exists.
- **Commercially obvious but unstated**: customer/pricing logic implies it, but nobody says the system rule.
- **Ambiguous**: multiple reasonable interpretations remain.
- **Lost/contradicted**: later implementation or decisions moved away from the communicated need.

When reviewing transcripts, look for the moment where the conversation should have turned into a formal requirement. Name who had the context, who had implementation responsibility, and what handoff object was missing.

## Search Method

For each question, search direct terms and adjacent terms. Do not rely on one keyword.

Examples:

- Pricing: `price`, `credit`, `billable`, `billing`, `refund`, `charge`, `usage`, `commit`, `entitlement`
- Case lifecycle: `case`, `close`, `auto-close`, `auto_closed`, `resolve`, `reopen`, `escalate`, `human`, `override`
- Data lifecycle: `pipeline`, `routing`, `retention`, `ttl`, `lifecycle`, `warm`, `cold`, `compliance`, `observability`
- Customer evidence: `customer`, `promise`, `pricing`, `calculator`, `deck`, `commercial`, `quote`, `proposal`
- Engineering evidence: `schema`, `migration`, `table`, `topic`, `policy`, `config`, `test`, `event`, `ledger`
- Registration evidence: `requirement`, `acceptance`, `decision`, `ADR`, `ticket`, `owner`, `signed off`, `agreed`, `blocked`, `follow up`, `we will`, `we need`, `customer needs`

Use `scripts/collect_evidence.py` for broad local searches when available. Read [source-map.md](references/source-map.md) before looking for project-specific artifacts. Read [knowledge-api-access.md](references/knowledge-api-access.md) before querying a knowledge or meeting-intelligence API. Read [transcript-analysis.md](references/transcript-analysis.md) when meeting transcripts determine whether a requirement was communicated or registered.

## Edge-Case Pass

Before writing a recommendation, force the rule through these lenses:

- **Lifecycle**: created, updated, closed, reopened, merged, split, deleted, expired.
- **Actor**: customer admin, analyst, AI agent, internal operator, partner, background job.
- **Timing**: before billing close, after billing close, during trial, after renewal, after retention window.
- **Repeat events**: retries, duplicate events, double-close, double-charge, repeated reopen.
- **Exceptions**: admin cleanup, mistake correction, new evidence, unrelated new incident, legal hold, customer dispute.
- **Fairness**: would a customer feel punished for trusting the product?
- **Abuse**: can a customer avoid charges by toggling states dishonestly?
- **Auditability**: can Finance, Support, and Engineering explain the outcome later?
- **Implementation fit**: does the current architecture naturally support the rule, fight it, or require redesign?

Read [edge-case-prompts.md](references/edge-case-prompts.md) for deeper prompts.

## Decision Brief Output

Produce a concise written brief with:

1. **Bottom line**: yes/no/partial and why.
2. **Commercial promise**: what customers reasonably believe.
3. **Requirement registration status**: registered, verbally explicit but unregistered, commercially obvious but unstated, ambiguous, or lost/contradicted.
4. **Evidence**: dated meetings, docs, files, calculator/deck behaviour, code paths.
5. **Ambiguity**: what was implied but not nailed down.
6. **Current implementation fit**: whether the system can honour the promise today.
7. **Recommended rule**: plain-English product rule.
8. **Acceptance tests**: edge cases that must pass before build/freeze.
9. **Human factors**: why the ambiguity was missed and how to prevent recurrence.
10. **Open decisions**: choices leadership or product must make.

Use [decision-brief-template.md](assets/decision-brief-template.md) when the user wants a shareable memo.

## Standard Of Proof

Use strong language only when the evidence supports it:

- Say **"explicitly required"** only when the rule is directly stated.
- Say **"verbally explicit but unregistered"** when the need was clearly said in conversation but did not become an owned engineering requirement.
- Say **"commercially obvious"** when the promise is clear to customers but not formally specified.
- Say **"engineering could reasonably miss this"** when artifacts imply the rule but do not define exact system behaviour.
- Say **"current design conflicts"** when code/schema/deployed behaviour makes the promise impossible or materially hard.

## Source Handling

Prefer exact dates, file paths, meeting names, URLs, and short excerpts. For local files, cite paths and line numbers when possible. For web standards or external docs, verify current sources and include links.

When querying a knowledge API or any live product API, treat live systems as read-only unless the user explicitly asks for a change. Do not expose secrets, tokens, customer personal data, or raw sensitive transcripts in the final answer. Summarise sensitive evidence instead.

## Done Criteria

The review is done only when:

- The commercial promise is stated in plain English.
- The formal requirement status is classified as registered, verbally explicit but unregistered, commercially obvious but unstated, ambiguous, contradicted, or missing.
- The current implementation fit is assessed.
- At least five meaningful edge cases are tested mentally or against code.
- The recommendation includes concrete acceptance tests.
- Remaining open decisions are named rather than hidden.

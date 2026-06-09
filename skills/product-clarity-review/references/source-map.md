# Source Map

Use this reference to find likely evidence for product clarity reviews without relying on private infrastructure details. Prefer paths, URLs, and credentials supplied by the runtime, user, repository config, or approved agent interface.

## Environment Variables And Inputs

Look for these optional inputs before falling back to manual discovery:

- `PRODUCT_REPO`: local checkout of the primary product repository.
- `KNOWLEDGE_API_REPO`: local checkout of the knowledge or meeting-intelligence repository.
- `PRODUCT_EVIDENCE_DIR`: folder containing sales decks, diagrams, calculators, order wizards, spreadsheets, and customer artifacts.
- `COMMERCIAL_CALCULATOR_PATH`: pricing calculator or sales order wizard file.
- `SALES_DECK_ASSET_PATH`: deck image, slide, PDF, or other customer-facing asset.
- `ARCHITECTURE_FREEZE_PATH`: architecture freeze spreadsheet or exported CSV/XLSX.
- `KNOWLEDGE_API_BASE_URL`: approved knowledge / meeting-intelligence API base URL.
- `KNOWLEDGE_API_AUTH_HEADER` or `KNOWLEDGE_API_TOKEN`: short-lived auth material supplied by the environment or approved interface.

Never hardcode private hostnames, SSH commands, local home-directory paths, service-account paths, client IDs, tokens, or customer secrets in this skill.

## Commercial Sources

Search for:

- Pricing calculators and sales order wizards.
- Sales-deck diagrams and customer-facing collateral.
- Proposal text, order forms, and quote exports.
- Website/product pages that describe customer-visible promises.
- Finance or commercial model spreadsheets.

Use terms such as:

```text
pricing, credits, billable, completion, retention, pipeline, bypass,
observability, compliance, detection, refund, escalation, human,
GB/month, per case, per source, lifecycle
```

## Product And Architecture Sources

Search for:

- PRDs, ADRs, architecture plans, design docs, decision logs.
- Architecture freeze spreadsheets or approval matrices.
- Onboarding, billing, retention, routing, automation, and case lifecycle docs.
- Tests that encode expected customer-facing behaviour.

Classify evidence as explicit, implied, contradicted, or missing.

## Knowledge / Meeting-Intelligence Sources

Use the knowledge or meeting-intelligence repository or API when available. Relevant source areas commonly include:

- API authentication and dependencies: `app/app/api/dependencies.py`
- Semantic search API: `app/app/api/search.py`
- Semantic chat API: `app/app/api/chat.py`
- Meeting intelligence API: `app/app/api/meeting_intelligence.py`
- Business context API: `app/app/api/context.py`
- Transcript and call-recording processing workflow: `app/app/workflows/pipeline.py`
- Transcript registry tests/runbooks: search for `transcript_registry`

For live access, read [knowledge-api-access.md](knowledge-api-access.md). Prefer read-only endpoints and summarized evidence. Avoid raw transcript dumps unless the user explicitly asks and the environment permits it.

## Primary Product Repository Sources

Use the primary product repository supplied by the environment or user. Relevant areas commonly include:

- Product and architecture docs: `docs/`, `reviews/`, `PLAN.md`, `ADR*.md`
- Ingest/routing services: search for `pipeline`, `routing`, `retention`, `TTL`, `source`, `policy`
- Billing or credit code: search for `credit`, `ledger`, `meter`, `usage`, `bill`
- Schema/migrations: search for `CREATE TABLE`, `retention`, `ttl`, `lifecycle`
- Tests: search for customer examples and edge-case terms.

## Meeting And Transcript Search

Look for:

- Weekly planning transcripts.
- Retros.
- Architecture freeze discussions.
- Calendar-linked meeting notes.
- Transcript search results and analysed call rows.
- Slack/email summaries only when explicitly available through an approved interface.

For meeting evidence, capture the meeting date and speaker when available. Distinguish "discussed verbally" from "accepted as a requirement."

## Evidence Matrix

Use this table while working:

| Evidence | Date | Source type | What it says | Status | Confidence |
|---|---:|---|---|---|---:|
| Sales calculator | YYYY-MM-DD | Commercial |  | Explicit/Implied/Contradicted/Missing | High/Med/Low |
| ADR / PRD | YYYY-MM-DD | Requirement |  |  |  |
| Meeting transcript | YYYY-MM-DD | Meeting |  |  |  |
| Repo code | commit/date | Implementation |  |  |  |
| API behaviour | YYYY-MM-DD | Operational |  |  |  |

# Knowledge / Meeting-Intelligence API Access

Use this reference when a product clarity review needs customer conversations, transcript-derived evidence, meeting intelligence, or business context from a knowledge or meeting-intelligence API.

## Security Model

The API may be protected by an identity-aware proxy. The application code expects the proxy to authenticate the request and forward identity headers to the app. Agents should not embed credentials, client IDs, service-account paths, hostnames, or private network details in prompts or skills.

Use one of these approved access patterns:

1. **Inside the application interface**: use the existing UI/API client provided by the application.
2. **Agent runtime with supplied auth**: use `KNOWLEDGE_API_BASE_URL` plus either `KNOWLEDGE_API_AUTH_HEADER` or a short-lived `KNOWLEDGE_API_TOKEN` supplied by the runtime.
3. **Local development/test**: use the repository's test/dev auth mechanism only when running in a non-production environment.

Do not attempt SSH access, bypass the proxy, scrape private infrastructure, or invent credentials.

## Auth Header Pattern

When the environment provides `KNOWLEDGE_API_AUTH_HEADER`, pass it exactly as supplied.

When the environment provides `KNOWLEDGE_API_TOKEN`, call the API through the proxy with:

```text
Authorization: Bearer $KNOWLEDGE_API_TOKEN
```

The app itself validates proxy-forwarded identity headers and allowed domains. In production, direct requests without valid authentication should fail.

## Useful Read-Only Endpoints

These endpoint shapes are illustrative. The actual base URL should come from `KNOWLEDGE_API_BASE_URL` or an approved interface.

### Search Narratives

```text
GET /api/search/narratives?q=<query>&limit=10
```

Use for transcript-derived themes, call analysis, deal narratives, and citations. Results may include call IDs, account names, meeting dates, themes, excerpts, and citations.

### Semantic Chat

```text
POST /api/chat/query
Content-Type: application/json

{"question":"...", "limit":5, "context_filter":"all"}
```

Use when the interface supports authenticated POST requests and required CSRF protections. The response is JSONL streaming. Prefer search endpoints for simple evidence retrieval.

### Meeting Intelligence

```text
GET /api/meetings/calendar
GET /api/meetings/{event_id}/notes
GET /api/meetings/{event_id}/intelligence
```

Use for calendar-linked meeting evidence and call-recording notes when event IDs are known.

## Handling Sensitive Results

- Do not paste raw transcripts into final answers.
- Quote only the minimum needed to prove the point.
- Prefer summaries with dates, speakers, meeting names, call IDs, or citation IDs.
- Redact personal data and secrets.
- Treat write endpoints as out of scope for product clarity reviews unless the user explicitly asks for a change.

## Query Strategy

For requirement evidence, query both direct and adjacent language:

```text
"resolve credit reopen human escalation refund"
"per source retention lifecycle compliance observability"
"bypass detection compliance observability pricing"
"customer asked retention source pipeline"
"human reopened AI closed case"
```

Record whether the API evidence is explicit, implied, contradicted, or missing.

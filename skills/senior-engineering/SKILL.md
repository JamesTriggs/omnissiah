---
name: senior-engineering
description: Senior engineering review for production-ready services and agents (Python/Go/C++). Focuses on correctness, reliability, scalability, observability, security baseline, testing, and operability.
allowed-tools: Read, Grep, Bash
---

# Senior Engineering Review Skill

Production readiness review aimed at **reducing review findings** by enforcing a concrete, repeatable *definition of done* for production code.

This skill is deliberately opinionated for cloud + data-intensive workloads and multi-language repos (Python/Go/C++).

## When I Activate

Use this review skill for any change that is likely to affect production behaviour, cost, reliability, or security, including:

- New/changed API endpoints or message handlers
- Data pipeline / ingestion / enrichment code
- Database schema changes, migrations, backfills
- Performance-critical paths (hot loops, high-QPS, high-volume batch jobs)
- External dependency integrations (SaaS APIs, queues, object stores)
- Kubernetes/Terraform/Helm and runtime configuration changes
- Endpoint/in-memory agent changes that can impact customer machines

## Review Principles (Non‑Negotiables)

- **Correctness first**: no undefined behaviour, no “it probably works” edge cases.
- **Every external call has**: timeout + cancellation propagation + error classification.
- **No silent failure**: errors are surfaced, logged with context, and metered.
- **Multi-tenant safety**: never mix tenant context; validate tenancy at boundaries.
- **Observability is a feature**: logs/metrics/traces are part of the change, not optional.
- **Operational safety**: risky changes ship behind a safe rollout mechanism (flags/canary) and have a rollback plan.
- **Tests ship with the code**: if behaviour changed, tests changed.

## Severity Levels (How I Prioritise Findings)

- 🔴 **Blocker**: must fix before merge (security bug, data loss, deadlocks, missing auth, unbounded cost, breaks compatibility, missing cancellation/timeouts on external calls, etc.)
- 🟠 **High**: should fix before merge unless explicitly risk-accepted (poor error handling, missing critical tests, no migration plan, can cause incidents)
- 🟡 **Medium**: should fix soon / in follow-up (tech debt, refactors that improve safety, non-critical observability gaps)
- 🟢 **Low**: polish / nice-to-have

## Review Workflow (Fast + Repeatable)

1. **Intent & blast radius**
   - What changed? Who/what is impacted (customer, pipeline, endpoint agent)?
   - Failure modes: what breaks, how bad, how detectable?
2. **Verify automated checks**
   - Confirm lint/format/tests run, or instruct the author-agent to run them.
3. **Review by dimensions**
   - Use the checklists below. Focus on production failure modes first.
4. **Output actionable findings**
   - Findings must be concrete: *file/path, symbol/function, what’s wrong, why it matters, how to fix*.
   - Prefer suggested patches/snippets over abstract advice.
5. **Verdict**
   - Approve / Request changes / Block, based on severity.

---

## Dimension Checklists

### A) Correctness & Data Integrity

- [ ] Inputs validated at boundaries (API, queue, file, network).
- [ ] Invariants are explicit (types, assertions, validation helpers).
- [ ] Idempotency is defined for handlers/jobs (safe retries).
- [ ] Consistency model is clear (transactional vs eventual).
- [ ] Concurrency correctness: no races, deadlocks, goroutine/thread leaks.
- [ ] Time is handled safely (UTC, monotonic clocks where needed).
- [ ] No partial updates without compensation/transaction boundaries.

**Common “AI code” red flags**
- Broad `except Exception` without rethrow/context
- “Happy path” only; missing null/empty/timeout cases
- Off-by-one pagination/streaming termination bugs
- Unbounded loops / reads / retries

### B) Reliability & Resilience

- [ ] Every network call sets a **timeout** and respects **cancellation**.
- [ ] Retries are bounded and **do not amplify load** (exponential backoff + jitter).
- [ ] Errors are categorised (retriable vs permanent) and handled appropriately.
- [ ] Circuit breakers / bulkheads used for fragile dependencies where appropriate.
- [ ] Batch operations handle partial failure and report per-item results.
- [ ] Graceful shutdown: drains work, closes resources, flushes buffers.
- [ ] Backpressure exists (queues, bounded concurrency, rate limits).

**Go minimums**
- Use `context.Context` everywhere; no background contexts in request paths.
- HTTP: never use `http.Get`/default client without timeouts.
- Always close response bodies.

**Python minimums**
- Set timeouts on `requests`/clients; propagate cancellation for async.
- Avoid unbounded concurrency (bounded pools/semaphores).

### C) Scalability, Performance & Cost

- [ ] No N+1 patterns (DB, APIs); batch where possible.
- [ ] Pagination/streaming for list endpoints and large datasets.
- [ ] Bounded memory use; avoid loading whole datasets where not required.
- [ ] Connection pools sized; risk of pool exhaustion understood.
- [ ] Caches have TTL/size limits and safe invalidation.
- [ ] Hot paths avoid excessive allocations and high-cardinality labels/metrics.
- [ ] Cloud cost impact considered (IO, storage, egress, CPU).

### D) Observability & Operability

**Logs**
- [ ] Structured logs (key/value), with stable event names.
- [ ] Correlation IDs (request ID, trace ID) propagate across boundaries.
- [ ] Logs do not include secrets/PII; sensitive fields are redacted/hashed.

**Metrics**
- [ ] RED metrics for services (rate/errors/duration) where applicable.
- [ ] Counters/timers for pipelines (ingest rate, lag, drop rate).
- [ ] Label cardinality is bounded (no user IDs, no raw URLs).

**Tracing**
- [ ] Key spans around external calls and major steps.
- [ ] Trace context propagated (HTTP headers / message metadata).

**Operational hooks**
- [ ] Health endpoints/probes (liveness/readiness) reflect real dependencies.
- [ ] Runbook updated for new alerts/failure modes.
- [ ] Feature flags / kill switches for risky logic.

### E) Security Baseline (Not a Full Threat Model)

- [ ] AuthN/AuthZ is enforced at every trust boundary.
- [ ] Tenant isolation: tenant_id is required, validated, and consistently applied.
- [ ] Input validation prevents injection (SQL, command, template, log injection).
- [ ] SSRF protections for any URL fetching (allowlists, egress controls).
- [ ] Crypto is done via approved libraries; no custom crypto.
- [ ] Secrets are sourced from secret managers; never logged.
- [ ] Audit logging where required (who did what, when).

> If the change alters data flows, auth, encryption, or endpoint behaviour, escalate to a dedicated `security-review` skill review.

### F) Testing & Verification

- [ ] Unit tests for new logic and edge cases.
- [ ] Integration tests for DB/external service interactions (or contract tests).
- [ ] Behaviour-changing bug fixes include regression tests.
- [ ] Tests are deterministic (no time/network flakiness).
- [ ] For concurrency: race tests / stress tests where appropriate.
- [ ] For parsers/decoders: property-based tests or fuzz tests considered.
- [ ] CI runs the right subset (fast path vs nightly).

### G) Maintainability & API Design

- [ ] Clear naming, docstrings/comments where the “why” matters.
- [ ] Functions are small enough to reason about; no deep nesting.
- [ ] Public APIs are versioned/backwards compatible.
- [ ] Errors are wrapped with context (but not duplicated), and are actionable.
- [ ] Config is externalised; defaults are safe.
- [ ] No dead code, commented code, or “TODO: fix later” in production paths without tracking.

### H) Language‑Specific Footguns (Quick Scan)

**Python**
- [ ] Type hints for public boundaries; avoid `Any` sprawl.
- [ ] Avoid mutable default args.
- [ ] Context managers for resources (files, locks, sessions).
- [ ] `datetime` timezone correctness; prefer UTC.
- [ ] Avoid blocking IO in async handlers.

**Go**
- [ ] Context cancellation everywhere; no leaked goroutines.
- [ ] `defer resp.Body.Close()` after error checks.
- [ ] Errors use wrapping (`fmt.Errorf("...: %w", err)`).
- [ ] Avoid global state in packages; be explicit about dependencies.
- [ ] Use `sync.Once`/locks carefully; avoid lock inversion.

**C++ (agents)**
- [ ] RAII, smart pointers; no raw ownership.
- [ ] Thread safety and lifetime are explicit.
- [ ] Bounds checks on buffers; avoid UB.
- [ ] Sanitizers/tests exist for risky code.
- [ ] No secrets or sensitive telemetry written to disk without protection.

---

## Recommended Automated Checks (Adapt to Repo)

> If available in the repo, *verify these ran* or ask the author-agent to run them and paste results.

**Python**
- `ruff check .` / `ruff format .` (or `black .`)
- `mypy .` (or repo equivalent)
- `pytest -q` (plus integration tests as relevant)

**Go**
- `go test ./...`
- `go vet ./...`
- `golangci-lint run` (if configured)

**C++**
- `clang-format` / repo formatter
- `clang-tidy` / static analysis
- ASAN/UBSAN builds for risky changes
- Unit tests via `ctest`/repo equivalent

---

## Review Output Template

```markdown
## Senior Engineering Review: [PR/Component]

### Summary
- **Intent:** [What the change does]
- **Blast radius:** [services/tenants/endpoints/agents impacted]
- **Risk level:** [Low/Medium/High] (why)

### Findings

#### 🔴 Blockers
1. **[Title]** — [file:line or symbol]
   - **Problem:** …
   - **Impact:** …
   - **Fix:** …
   - **Suggested patch/snippet:** …

#### 🟠 High
…

#### 🟡 Medium
…

#### 🟢 Low
…

### Production Readiness Checklist
- [ ] Timeouts + cancellation on external calls
- [ ] Idempotency defined for handlers/jobs
- [ ] Structured logs + correlation IDs
- [ ] Metrics for key operations (RED / pipeline KPIs)
- [ ] Safe rollout (flag/canary) + rollback plan
- [ ] Tests updated/added (unit + integration/contract as needed)
- [ ] Data migrations/backfills are safe and reversible
- [ ] Secrets/PII handled correctly

### Verdict
**[Approve / Request changes / Block]**

---
Reviewed using: `senior-engineering`
```

## Integrations

Common pairings:
- `test-engineer` (deep test coverage + flakiness review)
- `security-review` (threat model, secure coding, security posture, and vulnerability assessment)
- `cto-level-review` (high blast-radius or strategic changes)

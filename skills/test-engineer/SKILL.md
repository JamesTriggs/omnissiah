---
name: test-engineer
description: Deep review and design of tests to ensure production behaviour is covered (unit, integration, contract, regression, concurrency, property/fuzz) across Python/Go/C++.
allowed-tools: Read, Grep, Bash
---

# Test Engineer Skill

This skill exists because “it compiles” is not a safety signal. The goal is to ensure behaviour is **provably correct under realistic failure modes** and remains correct over time.

## When I Activate

- New features or behaviour changes
- Bug fixes (must include regression tests)
- Concurrency/parallelism changes
- Data pipeline changes (ordering, dedupe, backfills)
- Endpoint/agent logic changes
- Any code interacting with external systems (DB, queues, network, filesystem)

## Test Strategy Checklist

### 1) What is the contract?
- Inputs/outputs and invariants are explicit
- Error cases and boundary cases defined
- Idempotency and retry behaviour specified

### 2) Layered tests (prefer this distribution)
- **Unit tests**: fast, deterministic, heavy on edge cases
- **Integration tests**: real DB/queue/client where feasible
- **Contract tests**: for APIs/protos/events used by other services
- **End-to-end tests**: minimal number, highest value flows only
- **Performance tests**: where changes could cause cost/latency incidents

### 3) Determinism & Flake Resistance
- No sleeps as synchronisation (use polling with timeouts, fakes, or controlled clocks)
- No real internet calls
- Control time (fake clock) and randomness (seed)
- Avoid dependence on test order

### 4) Concurrency & Race Testing
- Go: run tests with `-race` when appropriate
- Python: test async cancellation and bounded concurrency
- C++: stress tests; sanitizers; thread safety checks

### 5) Data correctness tests (data-intensive systems)
- Dedupe/idempotency tests
- Ordering guarantees (or explicit lack of them)
- Backfill correctness and partial progress handling
- “Exactly once” claims are proven or explicitly avoided

## Language-Specific Guidance

### Python
- Prefer `pytest` with fixtures; avoid over-mocking internals
- Use `respx`/`responses`-style stubs (if repo uses them) for HTTP
- Assert on structured logs/metrics if your stack supports it

### Go
- Table-driven tests for input matrices
- Use interfaces for external dependencies; use fakes rather than heavy mocks
- Check context cancellation and timeouts (use contexts with deadlines)

### C++
- Prefer gtest/gmock (if used) and small deterministic unit tests
- Use fuzz/property tests for parsers/decoders
- Run ASAN/UBSAN/TSAN for risky components

## Test Review Output Template

```markdown
## Test Review: [PR/Component]

### Coverage Assessment
- New behaviours covered: …
- Edge cases covered: …
- Failure modes covered: …

### Gaps (ordered by risk)
🔴 Blockers:
1. …

🟠 High:
1. …

### Flakiness / Maintainability Risks
- …

### Suggested Tests (Concrete)
- [Test name] in [file] should verify …
- Suggested fixture/fake approach: …

### Verdict
[OK / Needs tests / Block]
---
Reviewed using: `test-engineer`
```

---
description: Performance analysis and optimisation workflow. Invokes the performance agent to profile database queries, ORM N+1 patterns, native hotspots, and frontend rendering bottlenecks.
---

# Perf Command

Analyse and optimise performance using the **performance** agent — a specialist that measures first, identifies bottlenecks at the right layer, and applies targeted optimisations with before/after benchmarks.

## Usage

```
/perf [description of the performance issue]
/perf "report query takes 30 seconds on a large dataset"
/perf "list API endpoint is slow under load"
/perf "dashboard page takes 8 seconds to load in the UI"
/perf "data ingestion throughput dropped to 10K records/s"
/perf "high memory usage in the worker after 6 hours uptime"
```

## When to Use

Use `/perf` when:
- An API endpoint response time exceeds 2 seconds
- A database query runs for more than 5 seconds
- A page loads slowly (LCP > 3s)
- A native service shows high CPU or memory usage
- A task queue is backing up
- You want to proactively optimise before a performance-sensitive feature ships

## What This Command Does

The performance agent follows this workflow:

1. **Measure baseline** — Captures current performance numbers before any changes
2. **Profile at the right layer** — Identifies which layer is slow (DB, app, network, rendering)
3. **Root cause analysis** — Distinguishes the bottleneck from symptoms
4. **Apply optimisations** — Targeted changes with highest ROI
5. **Verify improvement** — Measures after the fix, confirms improvement, checks for regressions

## Performance Budget Targets

| Layer | Target | Critical |
|-------|--------|---------|
| API p95 response time | < 500ms | > 2s |
| Analytical query | < 2s | > 10s |
| Page LCP | < 2s | > 5s |
| Ingestion throughput | > 100K records/s | < 10K records/s |
| Transactional query | < 100ms | > 1s |

## Common Bottlenecks the Agent Finds

### Database
- Missing partition key filter (full table scan across all historical data)
- Missing leading index columns leading to index misses
- No aggregation pre-computation (same heavy query run repeatedly → materialized view)
- COUNT(*) on large tables → use approximation or sample

### Application (ORM)
- N+1 queries (cascade of lazy-loaded related objects)
- Loading all columns when only a subset is needed
- No caching for frequently-accessed, rarely-changed data
- Synchronous database calls in hot request paths

### Native code
- Per-record inserts (should be batched)
- Unnecessary copies (pass by const reference)
- Unbounded data structures growing indefinitely
- Contended mutex in hot path

### Frontend
- Large component tree re-renders on every state change
- No virtual scrolling for large lists
- Heavy components not lazy-loaded
- Unbounded polling intervals

## Output Format

```
PERFORMANCE ANALYSIS REPORT
════════════════════════════
Component:    [API endpoint / query / module]
Severity:     [CRITICAL / HIGH / MEDIUM / LOW]

BASELINE:     [Measured before: X seconds / Y MB / Z records/s]
ROOT CAUSE:   [Technical explanation]

OPTIMISATIONS APPLIED:
  1. [Change 1] — impact: [expected gain]
  2. [Change 2] — impact: [expected gain]

RESULT:       [Measured after: X seconds / Y MB / Z records/s]
IMPROVEMENT:  [N% faster / M% less memory]

TRADE-OFFS:   [Any trade-offs made]
FOLLOW-UP:    [Related bottlenecks to investigate]
```

## Example Session

```
User: /perf "report endpoint slow for large datasets"

Performance agent:
1. Measures: 28.4s for a dataset with 400M rows
2. Profiles: query plan shows full table scan (missing partition filter)
3. Root cause: Query builder not injecting a date-partition filter
4. Fix: Added partition filter to query_builder.py — eliminates 99% of data scan
5. Result: 28.4s → 0.9s for same query
6. Improvement: 97% faster
```

## Related Commands

- `/debug` — For investigating correctness bugs (not performance)
- `/plan` — Plan performance work before implementing
- `/tdd` — Write performance regression tests after optimisation
- `/code-review` — Review performance-sensitive code changes

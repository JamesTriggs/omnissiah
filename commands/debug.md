---
description: Systematic bug investigation workflow. Invokes the debugger agent to trace root causes across backend, frontend, native, and data layers.
---

# Debug Command

Investigate a bug using the **debugger** agent — a specialist that traces root causes methodically, rather than patching symptoms.

## Usage

```
/debug [description of the bug]
/debug "API endpoint returns stale data after update"
/debug "end-to-end test failing at checkout step"
/debug "service crashes with SIGSEGV on startup"
```

## When to Use

Use `/debug` when:
- A test is failing and you cannot immediately see why
- A feature behaves unexpectedly in production or staging
- You have a stack trace but cannot identify the root cause
- An end-to-end test has started failing
- A native component crashes or produces incorrect output
- A database query returns wrong results
- A background task is silently failing or hanging
- Cross-service communication is broken (API returning 500, message queue backed up)

## What This Command Does

The debugger agent follows a five-step root cause process:

1. **Reproduce** — Verifies the failure is reproducible and defines the minimal trigger
2. **Isolate** — Narrows the failure to the smallest possible scope (service → module → function)
3. **Trace** — Follows execution from trigger to failure point
4. **Identify Root Cause** — Distinguishes symptom from cause
5. **Fix and Verify** — Writes a failing test first, applies the fix, confirms test passes, runs full suite

## Output

The debugger provides a structured report:

```
BUG INVESTIGATION REPORT
═════════════════════════
Component:     [Service/Module/File]
Severity:      [CRITICAL/HIGH/MEDIUM/LOW]

SYMPTOM:       [What was observed]
ROOT CAUSE:    [The actual underlying cause — file:line]
FIX APPLIED:   [What was changed]
VERIFICATION:  [Test that now passes]
REGRESSION RISK: [What to watch]
```

## Severity Triage

| Severity | Response |
|----------|----------|
| **CRITICAL** | Data exposure, auth bypass, data loss — fix immediately, notify owners |
| **HIGH** | Incorrect results, N+1 queries causing degradation — fix in current sprint |
| **MEDIUM** | Validation gaps, slow queries — fix in next sprint |
| **LOW** | Cosmetic issues, verbose logging — backlog |

## Example Session

```
User: /debug "The /results endpoint returns records belonging to other accounts"

Debugger:
1. Reproduces: Confirms with test requests using two account tokens
2. Isolates: api service › results/views.py › Results.get()
3. Traces: Query builder does not inject the account filter when none is provided
4. Root Cause:
   File: app/results/query_builder.py:145
   Missing: account scope filter when base_query is constructed
5. Fix: Add mandatory account parameter to build_query()
6. Test: Added test_results_scoped_to_account() — now passes
7. Full suite: run unit and integration tests — PASS
```

## Related Commands

- `/code-review` — Review code changes after fixing
- `/verify` — Run full verification after fix
- `/python-review` — Python-specific review if fix is in Python code

---
name: debug-root-cause
description: Diagnose the real cause before changing code. Use for bugs, failing tests, flaky behavior, regressions, and surprising production symptoms.
---

# Debug Root Cause

Do not patch symptoms first.

## Flow

1. Capture the exact symptom and expected behavior.
2. Reproduce or narrow the failure with the smallest command, test, log, or user flow.
3. Read the failing path, immediate callers/importers, relevant tests, and one nearby working pattern.
4. Separate facts from guesses.
5. Name the likely root cause and one alternative cause.
6. Make the smallest fix that addresses the root cause.
7. Verify the original symptom is gone and no nearby behavior regressed.

## Guardrails

- Do not average conflicting patterns.
- Do not keep retrying the same fix with slightly different paint.
- If reproduction is impossible, fail loud and state the missing proof.

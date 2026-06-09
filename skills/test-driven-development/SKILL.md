---
name: test-driven-development
description: Prove behavior changes with tests before or alongside implementation. Use for bug fixes, new logic, regressions, and risky refactors.
---

# Test-Driven Development

Use this when behavior can change.

## Flow

1. State the behavior or bug in one sentence.
2. Write or identify the test that should fail for the current broken or missing behavior.
3. Confirm the failure when practical.
4. Make the smallest correct change.
5. Rerun the focused test, then the broader relevant suite.
6. Keep the test if it protects a real promise.

## Test Quality

- Tests must prove intent, not just return values.
- A good test fails when the user promise, business rule, security boundary, or data contract is wrong.
- Avoid tests that only assert mocks were called unless the interaction itself is the contract.
- Do not hide uncertainty behind "tests pass" when tests were skipped, shallow, or mocked where real proof was required.

## If A Test Is Not Practical

Use a concrete manual repro or characterization artifact, then explain why automated proof was not the right tool for this slice.

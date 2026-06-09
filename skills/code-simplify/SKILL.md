---
name: code-simplify
description: Simplify code after a slice works. Use to remove accidental complexity, duplicate logic, speculative abstractions, and convention drift.
---

# Code Simplify

Use only after behavior is working or protected by characterization tests.

## Flow

1. Identify the smallest simplification that preserves behavior.
2. Remove speculative abstractions, duplicate branches, dead helpers, and unnecessary indirection.
3. Keep local conventions, even if another style is tempting.
4. Do not rewrite unrelated code.
5. Rerun the same proof after simplification.

## Bar

The simplified version should be easier to read, easier to test, and no broader in scope.

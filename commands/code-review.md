---
description: Security-aware code review of uncommitted changes. Checks for vulnerabilities, code quality, and best-practice issues before commit.
---

# Code Review

Comprehensive security and quality review of uncommitted changes:

1. Get the current branch and changed files:
   - Run: `git rev-parse --abbrev-ref HEAD`
   - Run: `git diff --name-only HEAD`

2. For each changed file, check for:

**Security Issues (CRITICAL):**
- Hardcoded credentials, API keys, tokens
- SQL injection vulnerabilities
- XSS vulnerabilities
- Missing input validation
- Insecure dependencies
- Path traversal risks
- Missing access-control or authorisation checks on protected resources

**Code Quality (HIGH):**
- Functions > 50 lines
- Files > 800 lines
- Nesting depth > 4 levels
- Missing error handling
- Stray debug/console logging statements
- TODO/FIXME comments
- Missing documentation for public APIs

**Best Practices (MEDIUM):**
- Mutation patterns (use immutable instead)
- Emoji usage in code/comments
- Missing tests for new code
- Accessibility issues (a11y)

3. Generate report with:
   - Severity: CRITICAL, HIGH, MEDIUM, LOW
   - File location and line numbers
   - Issue description
   - Suggested fix

4. Block commit if CRITICAL or HIGH issues found

Never approve code with security vulnerabilities.

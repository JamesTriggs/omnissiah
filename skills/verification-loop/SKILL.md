---
name: verification-loop
description: A comprehensive verification system for Claude Code sessions. Runs language-specific quality gates for Python, C++, Vue/Nuxt, and Protocol Buffers.
---

# Verification Loop Skill

A comprehensive verification system for Claude Code sessions. Provides language-specific quality gates and a unified verification report.

## When to Use

Invoke this skill:
- After completing a feature or significant code change
- Before creating a PR
- When you want to ensure quality gates pass
- After refactoring
- Before any deployment
- When switching between services in a session

## Verification Phases by Technology

### Python Projects (backend services)

#### Phase 1: Lint Check (Ruff)
```bash
# Run ruff linter
cd internal-api
ruff check . 2>&1 | head -30

# Auto-fix safe issues
ruff check --fix . 2>&1 | head -20
```

If lint fails, fix issues before continuing. Ruff replaces flake8, isort, and pycodestyle.

#### Phase 2: Type Check (mypy)
```bash
# Static type checking
mypy appapi/ --ignore-missing-imports 2>&1 | head -30
```

Report all type errors. Fix critical ones (missing return types, incompatible types) before continuing. Warnings about third-party stubs can be noted but are non-blocking.

#### Phase 3: Test Suite (pytest)
```bash
# Run unit tests with coverage
./tests.bash -q --type unit 2>&1 | tail -50

# Run integration tests
./tests.bash -q --type integration 2>&1 | tail -50

# Coverage report
pytest --cov=appapi --cov-report=term-missing tests/unit/ 2>&1 | tail -30
```

Report:
- Total tests: X
- Passed: X
- Failed: X
- Skipped: X
- Coverage: X% (target: 85%)

#### Phase 4: Security Scan (Bandit)
```bash
# Check for security issues
bandit -r appapi/ -f txt -q 2>&1 | head -30
```

Report severity levels. HIGH and CRITICAL issues are blocking.

---

### C++ Projects (native components)

#### Phase 1: CMake Build
```bash
# Build the project (catches compile errors, warnings-as-errors)
./build_linux.bash ubuntu2204 build debug 2>&1 | tail -30
```

If build fails, STOP and fix before continuing. The build uses `-Werror` so warnings are errors.

#### Phase 2: Static Analysis (cppcheck)
```bash
# Run static analysis
./build_linux.bash ubuntu2204 shell <<'EOF'
cppcheck --enable=all --std=c++17 --error-exitcode=1 src/ 2>&1 | head -30
EOF
```

Report all findings. Error-level issues are blocking.

#### Phase 3: Test Suite (Google Test)
```bash
# Run all tests
./build_linux.bash ubuntu2204 test 2>&1 | tail -50
```

Report:
- Total tests: X
- Passed: X
- Failed: X
- Disabled: X

#### Phase 4: Memory Check (Valgrind)
```bash
# Run valgrind on test binary (for critical changes)
./build_linux.bash ubuntu2204 shell <<'EOF'
valgrind --leak-check=full --error-exitcode=1 \
    ./build/bin/unit_tests 2>&1 | tail -30
EOF
```

Report:
- Memory leaks: X bytes
- Invalid reads/writes: X
- Result: PASS/FAIL

Valgrind is optional for minor changes but mandatory for:
- Memory management changes
- New data structures
- Buffer handling modifications
- Protobuf parsing changes

---

### Vue/Nuxt Projects (frontend)

#### Phase 1: Lint Check (ESLint)
```bash
# Run ESLint
cd frontend
npm run lint 2>&1 | head -30
```

Fix all errors. Warnings should be reviewed but may not block.

#### Phase 2: Type Check (TypeScript)
```bash
# TypeScript strict checking
npx tsc --noEmit 2>&1 | head -30
```

Report all type errors. Fix before continuing.

#### Phase 3: Unit Tests (Vitest)
```bash
# Run unit tests with coverage
npm run test:unit -- --coverage 2>&1 | tail -50
```

Report:
- Total tests: X
- Passed: X
- Failed: X
- Coverage: X% (target: 85%)

#### Phase 4: E2E Tests (Cypress)
```bash
# Run E2E tests (for UI-affecting changes)
npm run test:cypress-run-batch batch_00 2>&1 | tail -30
npm run test:cypress-run-batch batch_01 2>&1 | tail -30
```

Report:
- Total specs: X
- Passed: X
- Failed: X

E2E tests are mandatory for:
- Page/route changes
- Component changes affecting user workflows
- Query console editor changes
- Authentication flow changes

---

### Protocol Buffer Changes (shared data model)

#### Phase 1: Compilation (protoc)
```bash
# Compile proto files
cd shared-data-model
./build.bash cpp,python 2>&1 | tail -20
```

If protoc fails, STOP and fix syntax errors.

#### Phase 2: Backward Compatibility Check
```bash
# Check for breaking changes using buf
buf breaking --against '.git#branch=main' 2>&1 | head -20

# Manual checks if buf is unavailable:
# - No removed or renamed fields
# - No changed field numbers
# - No changed field types
# - Reserved numbers maintained
```

Report any breaking changes. These are blocking unless explicitly approved.

#### Phase 3: Cross-Language Verification
```bash
# Verify generated bindings compile in each target language

# C++ bindings
cd data-loader
./build_linux.bash ubuntu2204 build debug 2>&1 | tail -10

# Python bindings
cd internal-api
python -c "from shared_data_model import network_flow_pb2; print('Python OK')"
```

#### Phase 4: Dependent Service Tests
```bash
# Run tests in services that depend on the data model

# data-loader
cd data-loader
./build_linux.bash ubuntu2204 test 2>&1 | tail -20

# internal-api
cd internal-api
./tests.bash -q --type unit 2>&1 | tail -20
```

---

## Security Verification (All Projects)

### Secrets Check
```bash
# Check for hardcoded secrets across all modified files
git diff --cached --name-only | xargs grep -n \
    -e "sk-" -e "api_key" -e "password" -e "secret" \
    -e "AKIA" -e "token" 2>/dev/null | head -20

# Check for console.log / print statements with sensitive data
git diff --cached | grep -n \
    -e "console.log.*password" -e "print.*secret" \
    -e "logger.*password" -e "LOG.*secret" 2>/dev/null | head -10
```

### Tenant Isolation Check
```bash
# Verify all new queries include tenant_id
git diff --cached -- "*.py" "*.cpp" | grep -n \
    -e "SELECT" -e "INSERT" -e "DELETE" | \
    grep -v "tenant_id" 2>/dev/null | head -10
```

If any queries lack tenant_id filtering, flag as HIGH severity.

---

## Diff Review

```bash
# Show what changed
git diff --stat
git diff HEAD~1 --name-only
```

Review each changed file for:
- Unintended changes
- Missing error handling
- Potential edge cases
- Tenant isolation gaps
- SQL injection risks
- Missing input validation

---

## Output Format

After running all relevant phases, produce a verification report:

```
VERIFICATION REPORT
===================
Project: [internal-api / frontend / data-loader / ...]
Date:    [YYYY-MM-DD HH:MM]

QUALITY GATES
=============
Lint:         [PASS/FAIL] (X errors, Y warnings)
Type Check:   [PASS/FAIL] (X errors)
Tests:        [PASS/FAIL] (X/Y passed, Z% coverage)
Security:     [PASS/FAIL] (X issues: H high, M medium, L low)
Memory:       [PASS/FAIL/SKIP] (X leaks, Y invalid accesses)
Compatibility:[PASS/FAIL/SKIP] (Proto backward compat)

DIFF SUMMARY
============
Files changed: X
Lines added:   +X
Lines removed: -X

SECURITY REVIEW
===============
Secrets exposed:       [NONE / X issues]
Tenant isolation:      [VERIFIED / X gaps]
SQL injection risk:    [NONE / X issues]
Input validation:      [COMPLETE / X gaps]

OVERALL: [READY / NOT READY] for PR

ISSUES TO FIX:
1. [severity] description (file:line)
2. [severity] description (file:line)
...

RECOMMENDATIONS:
1. ...
2. ...
```

---

## Quick Verification Commands

For fast iteration during development, use these abbreviated checks:

### Python Quick Check
```bash
ruff check . && mypy appapi/ --ignore-missing-imports && pytest tests/unit/ -q
```

### C++ Quick Check
```bash
./build_linux.bash ubuntu2204 build debug && ./build_linux.bash ubuntu2204 test
```

### Vue/Nuxt Quick Check
```bash
npm run lint && npx tsc --noEmit && npm run test:unit -- --run
```

### Proto Quick Check
```bash
./build.bash cpp,python && buf breaking --against '.git#branch=main'
```

---

## Continuous Mode

For long sessions, run verification at these checkpoints:

```
Checkpoint triggers:
- After completing each function or method
- After finishing a component or module
- Before switching to a different service
- Every 15 minutes of active coding
- Before any commit

Quick check: Run the language-specific quick check
Full check:  Run all phases before PR or major milestone
```

---

## Integration with CI/CD

This skill complements your CI/CD pipeline checks:
- Local verification catches issues before push
- CI/CD provides definitive pass/fail
- This skill provides richer context and recommendations
- CI/CD runs the full test matrix across environments

---

**Remember**: Verification is not optional. Run quality gates early and often. Catching issues locally saves time in CI/CD and prevents defects from reaching production.

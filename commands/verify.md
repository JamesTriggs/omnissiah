# Verification Command

Run comprehensive verification on the current project codebase state.

## Instructions

Detect the project type and execute the appropriate verification pipeline.

### Python Projects

Execute in this exact order:

1. **Type Check (mypy)**
   - Run: `uv run mypy src/ --ignore-missing-imports` (or project-specific path)
   - Report all errors with file:line
   - If critical type errors, report and STOP

2. **Lint Check (Ruff)**
   - Run: `uv run ruff check .`
   - Run: `uv run ruff format --check .`
   - Report warnings and errors

3. **Test Suite (pytest)**
   - Run: `pytest -q`
   - Report pass/fail count
   - Report coverage percentage

4. **Security Scan (Bandit)**
   - Run: `uv run bandit -r src/ -c pyproject.toml` (or project path)
   - Report severity HIGH and CRITICAL findings

5. **Dependency Audit**
   - Run: `uv run pip-audit`
   - Report known vulnerabilities

### C++ Projects

Execute in this exact order:

1. **CMake Build**
   - Run: `cmake --build build`
   - If build fails, report errors and STOP

2. **Static Analysis (cppcheck)**
   - Run: `cppcheck --enable=all --suppress=missingInclude --error-exitcode=1 src/`
   - Report warnings and errors

3. **Test Suite (Google Test / CTest)**
   - Run: `ctest --test-dir build`
   - Report pass/fail count
   - Report any memory errors from sanitizers

4. **Compiler Warnings Audit**
   - Check build output for warnings with `-Wall -Wextra -Werror`
   - Report any suppressed warnings

### Vue/Nuxt/TypeScript Projects

Execute in this exact order:

1. **Type Check (TypeScript)**
   - Run: `npx nuxi typecheck` or `npx tsc --noEmit`
   - Report all type errors with file:line

2. **Lint Check (ESLint)**
   - Run: `npm run lint`
   - Report warnings and errors

3. **Unit Tests (Vitest)**
   - Run: `npm run test:unit`
   - Report pass/fail count
   - Report coverage percentage

4. **E2E Tests - if `full` or `pre-pr` mode**
   - Run the end-to-end suite (Cypress or Playwright)
   - Report pass/fail count

5. **Build Check**
   - Run: `npm run build`
   - If build fails, report errors

### Protocol Buffer Projects

Execute in this exact order:

1. **Proto Compilation Check**
   - Run the proto build with target outputs
   - Verify all .proto files compile without errors

2. **Breaking Change Detection**
   - Compare against previous version for field number reuse
   - Check for type changes on existing fields
   - Verify reserved fields are respected

3. **Cross-Language Binding Verification**
   - Verify Python bindings import successfully
   - Verify C++ headers compile

### Common Checks (All Projects)

6. **Debug Statement Audit**
   - Python: Search for `print(`, `breakpoint()`, `pdb.set_trace()` in source files
   - C++: Search for `std::cout <<` outside of logging functions, `#pragma message`
   - Vue/TS: Search for `console.log`, `debugger` in source files
   - Report locations

7. **Secrets Scan**
   - Search for hardcoded API keys, passwords, tokens
   - Check for `.env` files that should not be committed
   - Report any findings as CRITICAL

8. **Git Status**
   - Show uncommitted changes
   - Show files modified since last commit

## Output

Produce a concise verification report:

```
VERIFICATION: [PASS/FAIL]
Project: [project-name] ([Python/C++/Vue/Proto])

Build:      [OK/FAIL]
Types:      [OK/X errors]
Lint:       [OK/X issues]
Tests:      [X/Y passed, Z% coverage]
Security:   [OK/X findings]
Secrets:    [OK/X found]
Debug Stmts:[OK/X found]

Ready for PR: [YES/NO]
```

If any critical issues, list them with fix suggestions.

## Arguments

$ARGUMENTS can be:
- `quick` - Only build + types
- `full` - All checks including E2E (default)
- `pre-commit` - Build + types + lint + unit tests + debug audit
- `pre-pr` - Full checks plus security scan and E2E tests
- `python` - Force Python verification pipeline
- `cpp` - Force C++ verification pipeline
- `vue` - Force Vue/TypeScript verification pipeline
- `proto` - Force Protocol Buffer verification pipeline

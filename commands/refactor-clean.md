---
description: Safely identify and remove dead code across a polyglot stack. Uses vulture (Python), cppcheck (C++), depcheck (Vue/TS) with test verification at every step.
---

# Refactor Clean

Safely identify and remove dead code across a polyglot stack with test verification at every step.

## Workflow

### 1. Run Dead Code Analysis Tools

**Python Projects**
```bash
# Dead code detection
uv run vulture src/ --min-confidence 80

# Unused imports (already caught by Ruff, but double-check)
uv run ruff check . --select F401

# Unused dependencies
uv run pip-audit
uv pip list --outdated

# Complexity analysis (find overly complex code to simplify)
uv run ruff check . --select C901  # McCabe complexity

# Security-focused dependency audit
uv run pip-audit --fix --dry-run
```

**C++ Projects**
```bash
# Static analysis for unused code
cppcheck --enable=all --suppress=missingInclude --force src/

# Specifically check for unused functions and variables
cppcheck --enable=unusedFunction,style src/

# Include dependency analysis (find orphaned headers)
include-what-you-use src/*.cpp

# Dead code via compiler warnings
# Build with: -Wunused-function -Wunused-variable -Wunused-parameter
cmake .. -DCMAKE_CXX_FLAGS="-Wall -Wextra -Wunused"
```

**Vue/TypeScript Projects**
```bash
# Unused exports and imports via ESLint
npx eslint --no-eslintrc -c eslint.config.js --rule '{"no-unused-vars": "error", "@typescript-eslint/no-unused-vars": "error"}' src/

# Find unused components (no imports referencing them)
# Manual search: check each .vue file is imported somewhere

# Unused dependencies
npx depcheck

# Dead CSS/SCSS classes
npx purgecss --content 'src/**/*.vue' --css 'src/**/*.scss' --output purgecss-report
```

**Protocol Buffer Projects**
```bash
# Find unused message types (check if generated code is imported anywhere)
# Search across all consuming projects for proto import usage

# Find deprecated fields still in use
# Grep for reserved field numbers and deprecated annotations
```

### 2. Generate Comprehensive Report

Save findings to `.reports/dead-code-analysis.md`:

```markdown
# Dead Code Analysis Report
Generated: [timestamp]
Project: [project-name]

## Summary
- Total dead code candidates: X
- Safe to remove: Y
- Needs review: Z
- Do not remove: W

## Findings by Category
...
```

### 3. Categorize Findings by Severity

**SAFE (Low risk to remove):**
- Unused imports
- Unused local variables
- Test helper functions not called by any test
- Commented-out code blocks
- Unused utility functions with no external consumers
- Development-only debug functions

**CAUTION (Review before removing):**
- API endpoints (may be used by external consumers)
- Vue components (may be dynamically loaded)
- Background task functions (may be referenced by task name string)
- Query templates (may be used via string lookup)
- Protocol Buffer message types (may be used by other services)
- API model/schema definitions (used for generated docs)
- Configuration classes and environment variable handlers

**DANGER (Do NOT remove without thorough analysis):**
- Authentication/authorization middleware
- Error handlers and exception classes
- Database migration files (Alembic)
- Protocol Buffer field numbers (even if deprecated, must be `reserved`)
- C++ virtual method overrides (may be called polymorphically)
- Vue router guards and middleware
- Audit logging decorators
- Signal handlers and event listeners
- `__init__.py` exports (may be public API)

### 4. Propose Safe Deletions Only

Present a list of safe deletions with justification:

```
SAFE TO REMOVE:

1. src/utils/old_formatter.py
   Reason: No imports found in any file. Last modified 18 months ago.
   Confidence: 95%

2. src/app/query/legacy_builder.py:build_v1_query()
   Reason: Function defined but never called. Replaced by build_v2_query().
   Confidence: 90%

3. src/ingestion/deprecated_parser.cpp
   Reason: Not included in CMakeLists.txt. No #include references.
   Confidence: 98%

4. src/components/OldDashboard.vue
   Reason: Not imported in any router or component. No dynamic import found.
   Confidence: 85%
```

### 5. Safe Deletion Process

Before each deletion:

```
For each proposed deletion:
  1. Run full test suite -> MUST PASS
  2. Remove the dead code
  3. Re-run full test suite -> MUST PASS
  4. If tests fail -> ROLLBACK immediately
  5. If tests pass -> Record deletion in report
  6. Move to next item
```

**Python deletion verification:**
```bash
# Before deletion
pytest -q
# Delete file/function
# After deletion
pytest -q
uv run ruff check .  # Ensure no new import errors
```

**C++ deletion verification:**
```bash
# Before deletion
ctest --test-dir build
# Delete file/function
# After deletion
cmake --build build   # Must compile
ctest --test-dir build  # Must pass
```

**Vue/TypeScript deletion verification:**
```bash
# Before deletion
npm run test:unit && npm run build
# Delete file/function
# After deletion
npx nuxi typecheck        # Must have no type errors
npm run test:unit          # Must pass
npm run build              # Must build successfully
```

### 6. Show Summary of Cleaned Items

```
REFACTOR CLEAN SUMMARY
Project: my-api

Items Removed:
  Files deleted:     3
  Functions removed:  7
  Imports cleaned:   12
  Dead variables:     5

Lines of Code Removed: 342

Test Status: ALL PASSING (145/145)
Build Status: SUCCESS

Dependencies Cleaned:
  Removed: requests-cache (unused)
  Removed: deprecated-lib (unused)

Remaining Dead Code (needs manual review):
  - src/apis/v1/legacy.py (external API - verify no consumers)
  - src/app/tasks/old_sync.py (may be in the task queue)
```

---

## Language-Specific Considerations

### Python Dead Code Patterns

```python
# COMMON: Feature-flagged code that is never enabled
if settings.ENABLE_LEGACY_PARSER:  # Always False in all environments
    result = legacy_parse(data)     # Dead code candidate

# COMMON: Unreachable exception handlers
try:
    value = int(validated_input)  # Already validated as int by Pydantic
except ValueError:                # Can never be reached
    ...                           # Dead code

# COMMON: Deprecated API versions
@ns.route('/v1/events')  # v1 fully migrated to v2
class LegacyEvents(Resource):
    ...  # Check if any external consumers still hit v1

# CHECK BEFORE REMOVING: task string references
# The function may look unused but is called via:
# celery.send_task('myapp.tasks.process_event', args=[event_id])
```

### C++ Dead Code Patterns

```cpp
// COMMON: Preprocessor-guarded code that is never compiled
#ifdef ENABLE_LEGACY_FORMAT  // Never defined in any build config
void parse_legacy_format(const char* data) { ... }
#endif

// COMMON: Virtual methods overridden but never called through that interface
// Check entire class hierarchy before removing

// COMMON: Unused utility functions in header-only libraries
// May be part of public API even if not used internally

// CHECK: Template instantiations may not show as "used" in static analysis
```

### Vue/TypeScript Dead Code Patterns

```typescript
// COMMON: Components registered but never used in templates
// Check for dynamic component resolution: <component :is="componentName" />

// COMMON: Pinia store actions never called from components
// May be called from other stores or middleware

// COMMON: Computed properties that shadow a reactive ref
// The computed may look unused but is in the template

// CHECK: Nuxt auto-imports may make functions look unused to static analysis
// Verify with: npx nuxi analyze
```

### Protocol Buffer Dead Code

```protobuf
// NEVER remove field numbers - use reserved instead
message NetworkEvent {
  reserved 5, 8;  // Previously used field numbers
  reserved "old_field_name";  // Previously used field names

  string source_ip = 1;
  // Field 5 was removed but number is reserved for backward compatibility
}

// SAFE to remove: Message types not imported by any service
// But verify across ALL consuming projects (Python, C++, etc.)
```

---

## Dependency Cleanup

### Python (uv/pip)
```bash
# List all installed packages
uv pip list

# Find unused dependencies
# Compare requirements.txt/pyproject.toml with actual imports
uv run python -c "
import ast, sys, pathlib
imports = set()
for f in pathlib.Path('src').rglob('*.py'):
    tree = ast.parse(f.read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split('.')[0])
print(sorted(imports))
"

# Audit for known vulnerabilities
uv run pip-audit
```

### C++ (CMake)
```bash
# Check CMakeLists.txt for libraries linked but not actually used
# Review find_package() calls and verify corresponding #include usage

# Check for unused git submodules
git submodule status
# Compare with CMake add_subdirectory() calls
```

### Vue/TypeScript (npm)
```bash
# Find unused npm packages
npx depcheck

# Check for duplicate packages
npm ls --all | sort | uniq -d

# Audit for known vulnerabilities
npm audit
```

---

## Never Delete Without Running Tests First!

The golden rule: **Every deletion must be verified by a passing test suite.**

If there are no tests for a piece of code:
1. Write tests first (use `/tdd`)
2. Verify the code is actually dead (tests should not exercise it)
3. Only then remove it

## Integration with Other Commands

- Use `/test-coverage` to identify which code has no test coverage
- Use `/verify` after cleanup to confirm everything still works
- Use `/tdd` to add tests for code that needs coverage before deletion decisions
- Use `/python-review` to review the refactored code quality
- Use `/build-fix` if removals cause build issues

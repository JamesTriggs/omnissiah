# C++ Hooks

> PostToolUse hooks for C++ development.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

### cppcheck Static Analysis

Run cppcheck after editing `.cpp` or `.h` files to catch common errors:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(cpp|h|hpp|cc)$",
        "command": "cppcheck --enable=warning,style,performance,portability --std=c++17 --error-exitcode=0 --quiet --suppress=missingInclude {{filePath}} 2>&1 | head -30"
      }
    ]
  }
}
```

Key cppcheck checks:
- **warning**: Potential bugs and suspicious code
- **style**: Coding style issues (unused variables, redundant code)
- **performance**: Suggestions for performance improvements (pass-by-reference, reserve)
- **portability**: Platform-dependent code that may not work across compilers

### clang-format Auto-Formatting

Run clang-format after editing C++ files to enforce consistent formatting:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(cpp|h|hpp|cc)$",
        "command": "clang-format -i --style=file {{filePath}}"
      }
    ]
  }
}
```

The `.clang-format` file should be at the repository root:

```yaml
# .clang-format
BasedOnStyle: Google
IndentWidth: 4
ColumnLimit: 120
AllowShortFunctionsOnASingleLine: InlineOnly
AllowShortIfStatementsOnASingleLine: Never
AllowShortLoopsOnASingleLine: false
BreakBeforeBraces: Attach
DerivePointerAlignment: false
PointerAlignment: Left
SortIncludes: CaseInsensitive
IncludeBlocks: Preserve
SpaceAfterCStyleCast: false
SpacesBeforeTrailingComments: 2
Standard: c++17
```

### Raw Pointer Warning

Warn about raw pointer usage (new/delete) in edited files:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(cpp|h|hpp|cc)$",
        "command": "grep -nE '\\b(new |delete |malloc|free|realloc)\\b' {{filePath}} | grep -v '// NOLINT' | grep -v 'make_unique' | grep -v 'make_shared' && echo 'WARNING: Raw memory management detected. Use smart pointers (std::unique_ptr, std::shared_ptr) instead.' || true"
      }
    ]
  }
}
```

This hook flags:
- `new` keyword (should use `std::make_unique` or `std::make_shared`)
- `delete` keyword (should use smart pointer destructors)
- `malloc`/`free`/`realloc` (should use C++ containers or smart pointers)

Lines with `// NOLINT` are suppressed for justified exceptions.

### CMake Rebuild Trigger

Run `cmake --build` after editing `CMakeLists.txt` to verify build configuration:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "CMakeLists\\.txt$",
        "command": "echo 'CMakeLists.txt modified. Run: ./build_linux.bash ubuntu2204 build debug' && cmake --build build --target app_core 2>&1 | tail -10 || echo 'NOTE: Build may need to run inside Docker container.'"
      }
    ]
  }
}
```

### Include Guard Check

Verify that header files use `#pragma once`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(h|hpp)$",
        "command": "head -5 {{filePath}} | grep -q '#pragma once' || echo 'WARNING: Header file {{filePath}} is missing #pragma once'"
      }
    ]
  }
}
```

### Unsafe Function Warning

Check for usage of known unsafe C functions:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(cpp|h|hpp|cc)$",
        "command": "grep -nE '\\b(strcpy|strcat|sprintf|gets|scanf|atoi|atof|atol)\\b' {{filePath}} && echo 'WARNING: Unsafe C function detected. Use safe alternatives (strncpy, snprintf, std::stoi, etc.).' || true"
      }
    ]
  }
}
```

## Stop Hooks

### Pre-Session-End Checks

Run comprehensive static analysis on all modified C++ files before the session ends:

```json
{
  "hooks": {
    "Stop": [
      {
        "command": "git diff --name-only --cached | grep -E '\\.(cpp|h|hpp|cc)$' | xargs -I {} cppcheck --enable=all --std=c++17 --error-exitcode=0 --quiet --suppress=missingInclude {} 2>&1 | head -50"
      }
    ]
  }
}
```

### Memory Safety Audit

Check all staged C++ files for raw memory operations:

```json
{
  "hooks": {
    "Stop": [
      {
        "command": "git diff --name-only --cached | grep -E '\\.(cpp|h|hpp|cc)$' | xargs grep -nE '\\b(new |delete |malloc|free|realloc)\\b' 2>/dev/null | grep -v '// NOLINT' | grep -v 'make_unique' | grep -v 'make_shared' && echo 'AUDIT: Raw memory management in staged files. Review for smart pointer alternatives.' || echo 'Clean: No raw memory management in staged files.'"
      }
    ]
  }
}
```

## Complete Hook Configuration Example

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(cpp|h|hpp|cc)$",
        "command": "clang-format -i --style=file {{filePath}}"
      },
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(cpp|h|hpp|cc)$",
        "command": "cppcheck --enable=warning,style,performance,portability --std=c++17 --error-exitcode=0 --quiet --suppress=missingInclude {{filePath}} 2>&1 | head -20"
      },
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(cpp|h|hpp|cc)$",
        "command": "grep -nE '\\b(new |delete |malloc|free|realloc|strcpy|strcat|sprintf|gets)\\b' {{filePath}} | grep -v '// NOLINT' | grep -v 'make_unique' | grep -v 'make_shared' && echo 'WARNING: Unsafe pattern detected. Review for safe alternatives.' || true"
      },
      {
        "matcher": "Edit|Write",
        "filePattern": "\\.(h|hpp)$",
        "command": "head -5 {{filePath}} | grep -q '#pragma once' || echo 'WARNING: Missing #pragma once in {{filePath}}'"
      },
      {
        "matcher": "Edit|Write",
        "filePattern": "CMakeLists\\.txt$",
        "command": "echo 'CMakeLists.txt modified. Rebuild needed: ./build_linux.bash ubuntu2204 build debug'"
      }
    ],
    "Stop": [
      {
        "command": "git diff --name-only --cached | grep -E '\\.(cpp|h|hpp|cc)$' | xargs -I {} sh -c 'cppcheck --enable=warning --std=c++17 --quiet --suppress=missingInclude {} 2>&1' | head -30"
      },
      {
        "command": "git diff --name-only --cached | grep -E '\\.(cpp|h|hpp|cc)$' | xargs grep -nE '\\b(new |delete |malloc|free)\\b' 2>/dev/null | grep -v '// NOLINT' | grep -v 'make_' && echo 'AUDIT: Review raw memory usage before committing.' || true"
      }
    ]
  }
}
```

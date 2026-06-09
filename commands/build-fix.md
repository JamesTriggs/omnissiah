---
description: Incrementally fix build errors across a polyglot stack (Python, C++, TypeScript/Vue). Diagnoses compilation, import, dependency, and Docker build failures.
---

# Build and Fix

Incrementally fix build errors across a polyglot stack: Python/uv, C++/CMake, Vue.js/Nuxt/Vite, Docker, and serialized schemas (e.g. Protocol Buffers).

## Workflow

1. **Detect project type** from current directory and build files:
   - `pyproject.toml` / `requirements.txt` -> Python project
   - `CMakeLists.txt` -> C++ project
   - `package.json` + `nuxt.config.ts` -> Vue/Nuxt project
   - `Dockerfile` -> Docker build
   - `*.proto` -> Protocol Buffer compilation

2. **Run build command** for the detected project type:
   ```bash
   # Python
   uv sync --group dev --group scripts
   uv run python -m py_compile src/**/*.py
   uv run mypy src/ --ignore-missing-imports

   # C++
   cmake --build build

   # Vue/Nuxt
   npm run build

   # Docker
   docker build -t app-test .

   # Protocol Buffers
   protoc --cpp_out=. --python_out=. *.proto
   ```

3. **Parse error output**:
   - Group by file
   - Sort by severity (errors before warnings)
   - Identify root cause vs cascading errors

4. **For each error**:
   - Show error context (5 lines before/after)
   - Explain the issue
   - Propose fix
   - Apply fix
   - Re-run build
   - Verify error resolved

5. **Stop if**:
   - Fix introduces new errors
   - Same error persists after 3 attempts
   - User requests pause

6. **Show summary**:
   - Errors fixed
   - Errors remaining
   - New errors introduced

Fix one error at a time for safety!

---

## Python / uv Build Error Patterns

### Dependency Conflicts
```
ERROR: No solution found when resolving dependencies:
  Because package-a==1.2.0 depends on requests>=2.28 and package-b==3.0 depends on requests<2.28
```
**Fix strategy**:
- Check `pyproject.toml` for version constraints
- Use `uv pip compile` to resolve
- Pin compatible versions or find alternative packages
- Check if `--resolution lowest` or `--resolution highest` helps

### Import Resolution Errors
```
ModuleNotFoundError: No module named 'myapp.app.module'
```
**Fix strategy**:
- Verify `__init__.py` files exist in all package directories
- Check `pyproject.toml` `[tool.setuptools.packages.find]` configuration
- Ensure the module path matches the directory structure
- Run `uv sync` to reinstall in development mode

### mypy Type Errors
```
myapp/app/query.py:42: error: Argument 1 to "execute" has incompatible type "str"; expected "TextClause"  [arg-type]
```
**Fix strategy**:
- Add proper type annotations
- Use `typing.cast()` for known-safe type narrowing
- Add type stubs for untyped libraries (`types-*` packages)
- Use `# type: ignore[error-code]` only as last resort with comment explaining why

### Ruff Linting Failures
```
myapp/apis/handler.py:15:1: F401 `os` imported but unused
myapp/app/records/service.py:88:5: E722 Do not use bare `except`
```
**Fix strategy**:
- Run `ruff check --fix .` for auto-fixable issues
- Run `ruff format .` for formatting issues
- Manually fix security-related rules (S* rules)
- Check `ruff.toml` or `pyproject.toml [tool.ruff]` for project-specific configuration

### Pydantic Validation Errors (Build-time)
```
pydantic.errors.PydanticUserError: A non-annotated attribute was detected: `status = 'active'`
```
**Fix strategy**:
- Add type annotation: `status: str = 'active'`
- Use `ClassVar` for class-level constants not meant for serialization
- Check Pydantic v1 vs v2 syntax differences
- Verify `model_config` settings

---

## C++ / CMake Build Error Patterns

### Missing Dependencies
```
CMake Error at CMakeLists.txt:42:
  Could not find a package configuration file provided by "Boost"
```
**Fix strategy**:
- Check if dependency is available in the Docker build container
- Add to `apt-get install` in Dockerfile or build script
- Set `CMAKE_PREFIX_PATH` to custom install location
- Use `find_package()` with `REQUIRED` and `COMPONENTS` correctly

### Linker Failures
```
/usr/bin/ld: undefined reference to `mylib::DataModel::serialize()'
collect2: error: ld returned 1 exit status
```
**Fix strategy**:
- Check `target_link_libraries()` in CMakeLists.txt
- Verify library build order (dependencies built before dependents)
- Check for missing source files in `add_library()` or `add_executable()`
- Verify symbol visibility (`__attribute__((visibility("default")))`)
- Check for ABI incompatibility between C++ standard versions

### Compiler Flag Issues
```
error: 'string_view' is not a member of 'std'
```
**Fix strategy**:
- Verify `CMAKE_CXX_STANDARD` is set to 17 or higher
- Check compiler version supports the required standard
- Add `set(CMAKE_CXX_STANDARD_REQUIRED ON)` to enforce standard
- Verify correct include headers (`<string_view>` vs `<experimental/string_view>`)

### Header Include Errors
```
fatal error: schema/data_model.pb.h: No such file or directory
```
**Fix strategy**:
- Verify Protocol Buffer generation ran before C++ compilation
- Check `include_directories()` or `target_include_directories()` in CMake
- Ensure generated files are in the correct output directory
- Regenerate the shared schema bindings before building

### Google Test Build Failures
```
error: 'testing' has not been declared
```
**Fix strategy**:
- Verify GTest is found: `find_package(GTest REQUIRED)`
- Link test targets: `target_link_libraries(test_target GTest::gtest GTest::gtest_main)`
- Check include path for `<gtest/gtest.h>`
- Ensure test targets are only built when `BUILD_TESTING` is ON

---

## Vue.js / Nuxt / Vite Build Error Patterns

### TypeScript Compilation Errors
```
error TS2322: Type 'string' is not assignable to type 'CategoryId'.
  src/components/RecordCard.vue:42:5
```
**Fix strategy**:
- Fix the type annotation or add proper type casting
- Check if interface definitions have changed
- Verify auto-generated types from API schemas are up to date
- Use `as const` for literal types where appropriate

### Nuxt Auto-Import Issues
```
error: Cannot find name 'useAsyncData'. Did you mean 'useAsyncData'?
```
**Fix strategy**:
- Run `npx nuxi prepare` to regenerate auto-imports
- Check `.nuxt/imports.d.ts` for available auto-imports
- Verify `nuxt.config.ts` auto-import configuration
- Restart the TypeScript server in your IDE

### Vite Build Failures
```
[vite]: Rollup failed to resolve import "@/components/Editor/QueryEditor.vue"
```
**Fix strategy**:
- Check path alias configuration in `vite.config.ts` and `tsconfig.json`
- Verify the file exists at the expected path
- Check for case sensitivity issues (Linux CI vs macOS dev)
- Ensure `.vue` extension is included in resolve configuration

### ESLint 9 Flat Config Errors
```
ESLint: Configuration for rule "vue/multi-word-component-names" is invalid
```
**Fix strategy**:
- ESLint 9 uses flat config (`eslint.config.js`) not `.eslintrc`
- Check `eslint.config.js` for correct plugin imports
- Verify plugin versions are compatible with ESLint 9
- Use `npx eslint --debug` to trace configuration loading

### CSS/SCSS Build Errors
```
SassError: Undefined variable: $brand-primary
```
**Fix strategy**:
- Check SCSS variable imports in `nuxt.config.ts` `vite.css.preprocessorOptions`
- Verify design system token file is included globally
- Check for circular imports in SCSS partials

---

## Docker Build Error Patterns

### Multi-Stage Build Failures
```
ERROR: failed to solve: app-builder: not found
```
**Fix strategy**:
- Verify stage names match in `FROM ... AS stage-name` and `COPY --from=stage-name`
- Check Docker BuildKit is enabled for advanced features
- Ensure base image tags exist and are accessible
- Verify ARG variables are available in the correct stage

### Layer Cache Invalidation
```
# Build takes 20 minutes instead of 2 minutes
```
**Fix strategy**:
- Order Dockerfile instructions from least to most frequently changing
- Copy dependency files first (`requirements.txt`, `package.json`) before source code
- Use `.dockerignore` to exclude unnecessary files
- Leverage BuildKit cache mounts for package managers:
  ```dockerfile
  RUN --mount=type=cache,target=/root/.cache/uv uv sync
  ```

### Platform/Architecture Issues
```
exec format error: exec user process caused: no such file or directory
```
**Fix strategy**:
- Specify platform explicitly: `FROM --platform=linux/amd64 python:3.11`
- Use `docker buildx` for multi-platform builds
- Check if base image supports the target architecture
- Verify binary compatibility for compiled C++ components

### Container Registry Rate-Limit Issues
```
toomanyrequests: You have reached your pull rate limit
```
**Fix strategy**:
- Use a registry pull-through cache for upstream images
- Authenticate to your registry before pulling
- Cache base images locally in CI
- Use specific image digests instead of tags for reproducibility

---

## Protocol Buffer Compilation Error Patterns

### protoc Compilation Failures
```
schema/events.proto:15:3: "myapp.NetworkEvent" is not defined.
```
**Fix strategy**:
- Check `import` statements in .proto files
- Verify import paths match the `--proto_path` argument
- Ensure dependent .proto files are compiled first
- Check for circular imports between proto packages

### Proto Syntax Errors
```
schema/record.proto:28:5: Expected "required", "optional", or "repeated".
```
**Fix strategy**:
- Ensure `syntax = "proto3";` is declared at the top
- In proto3, fields are implicitly optional (no `required`/`optional` keywords for scalar types)
- Use `optional` keyword only when you need field presence tracking in proto3
- Verify proto3 syntax rules (no default values, no required fields)

### Cross-Language Binding Failures
```
ImportError: cannot import name 'NetworkEvent_pb2' from 'myapp.proto'
```
**Fix strategy**:
- Regenerate Python bindings: `protoc --python_out=. --pyi_out=. *.proto`
- Verify `__init__.py` files exist in generated package directories
- Check `PYTHONPATH` includes the generated output directory
- For C++ bindings, ensure `protoc --cpp_out` output is in the include path

### Schema Compatibility Issues
```
WARNING: Field number 5 in NetworkEvent has been changed from int32 to string
```
**Fix strategy**:
- NEVER change field types for existing field numbers
- NEVER reuse deleted field numbers (use `reserved`)
- Add new fields with new field numbers only
- Use `buf breaking` or manual review to catch breaking changes
- Document all schema changes in migration notes

---

## Build Fix Priority Order

When multiple errors exist, fix in this order:

1. **Dependency/import resolution** - Everything else cascades from these
2. **Type/schema errors** - Protobuf, Pydantic models, TypeScript types
3. **Compilation errors** - Syntax, missing symbols
4. **Linker errors** - Missing libraries, symbol resolution
5. **Lint/style errors** - Non-blocking but should be fixed
6. **Warning cleanup** - Address compiler/linter warnings last

## Integration with Other Commands

- Use `/verify` after fixing to confirm everything passes
- Use `/tdd` to add missing tests for fixed code
- Use `/refactor-clean` if fixes reveal dead code
- Use `/python-review` to review Python fix quality

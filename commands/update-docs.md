# Update Documentation

Sync documentation from source-of-truth files across a polyglot stack.

## Workflow

### 1. Read Source-of-Truth Files by Project Type

**Python Projects**

Read `pyproject.toml`:
```bash
# Extract project metadata
# - name, version, description
# - python-requires
# - dependencies and optional dependency groups
# - tool.ruff configuration
# - tool.pytest configuration
# - tool.mypy configuration
# - scripts and entry points
```

Read `requirements.txt` / `requirements-dev.txt` (if present):
```bash
# Extract pinned dependency versions
# Cross-reference with pyproject.toml
# Note any version conflicts
```

Read `.env.example` / `env.template`:
```bash
# Extract all environment variables
# Document purpose, format, and default values
# Categorize: required vs optional
# Flag: database URLs, API keys, feature flags
```

Read `alembic.ini` / `alembic/env.py` (if present):
```bash
# Extract database migration configuration
# Document migration workflow
```

**C++ Projects**

Read `CMakeLists.txt`:
```bash
# Extract project name and version
# Extract required dependencies (find_package)
# Extract build targets (add_library, add_executable)
# Extract compiler flags and standards
# Extract test targets (add_test, enable_testing)
# Extract install targets
```

Read `build_linux.bash` / `build.bash`:
```bash
# Extract supported platforms
# Extract build modes (debug, release)
# Extract Docker configuration
# Document build prerequisites
```

Read `Dockerfile` / `docker-compose.yml` (if present):
```bash
# Extract base images
# Extract build stages
# Extract exposed ports
# Document volume mounts
```

**Vue/Nuxt Projects**

Read `package.json`:
```bash
# Extract project metadata
# Extract scripts section -> generate scripts reference table
# Extract dependencies and devDependencies
# Note version ranges and locked versions
```

Read `nuxt.config.ts`:
```bash
# Extract Nuxt modules and plugins
# Extract runtime configuration
# Extract build configuration
# Document environment variables used
```

Read `tsconfig.json`:
```bash
# Extract TypeScript configuration
# Document path aliases
# Document strict mode settings
```

Read `eslint.config.js`:
```bash
# Extract ESLint rules and plugins
# Document custom rule configurations
```

Read `cypress.config.ts` (if present):
```bash
# Extract test configuration
# Document base URLs, timeouts
# Document custom commands
```

**Protocol Buffer Projects**

Read `.proto` files:
```bash
# Extract package declarations
# Extract message definitions
# Extract service definitions (if any)
# Extract enum definitions
# Document field numbers and types
# Note reserved fields and their history
```

Read `build.bash`:
```bash
# Extract supported output targets
# Document generation commands
# Document output directories
```

### 2. Generate Documentation

**docs/CONTRIB.md** - Development workflow guide:
```markdown
# Contributing to [Project Name]

## Prerequisites
- [Language version requirements]
- [Required tools: uv/cmake/node]
- [Docker requirements]

## Quick Start
1. Clone repository
2. Install dependencies: [commands]
3. Run tests: [commands]
4. Start development: [commands]

## Available Commands

### Python Projects
| Command | Description |
|---------|-------------|
| `uv sync --group dev` | Install all development dependencies |
| `pytest -q` | Run unit tests |
| `pytest tests/integration -q` | Run integration tests |
| `uv run ruff check .` | Run Ruff linter |
| `uv run ruff format .` | Format code with Ruff |
| `uv run mypy src/` | Type check |

### C++ Projects
| Command | Description |
|---------|-------------|
| `cmake -B build -DCMAKE_BUILD_TYPE=Debug` | Configure debug build |
| `cmake -B build -DCMAKE_BUILD_TYPE=Release` | Configure release build |
| `cmake --build build` | Build |
| `ctest --test-dir build` | Run tests |

### Vue/Nuxt Projects
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test:unit` | Run unit tests |
| `npx cypress run` | End-to-end tests |
| `npm run lint` | Run ESLint |

### Protocol Buffer Projects
| Command | Description |
|---------|-------------|
| `protoc --cpp_out=. *.proto` | Generate C++ bindings |
| `protoc --python_out=. *.proto` | Generate Python bindings |

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | Relational database connection string | - |
| `ANALYTICS_DB_HOST` | Yes | Analytical database host | localhost |
| `ANALYTICS_DB_PORT` | No | Analytical database port | 8123 |
| `REDIS_URL` | No | Redis connection string | redis://localhost:6379 |
| `USE_QUERY_MIDDLEWARE` | No | Enable the query parser | false |
| `CELERY_BROKER_URL` | No | Task broker URL | redis://localhost:6379/0 |

## Testing Procedures

### Unit Tests
[Commands and patterns for each project type]

### Integration Tests
[Commands and environment setup requirements]

### E2E Tests
[End-to-end suite organization and commands]

## Code Quality

### Pre-commit Checklist
1. Run linter: [command]
2. Run formatter: [command]
3. Run type checker: [command]
4. Run unit tests: [command]
5. Check for debug statements
6. Check for secrets/credentials

### CI Pipeline
[Description of CI pipeline stages]
```

**docs/RUNBOOK.md** - Operations runbook:
```markdown
# Operations Runbook: [Project Name]

## Deployment Procedures

### Standard Deployment
1. Merge PR to main
2. CI pipeline runs: [pipeline description]
3. Docker image built and pushed to the registry
4. Service updated
5. Health check verification

### Rollback Procedure
1. Identify failing version in the registry
2. Update the service to the previous image version
3. Force new deployment
4. Verify health checks pass

## Monitoring and Alerts

### Health Endpoints
| Service | Endpoint | Expected |
|---------|----------|----------|
| api | /health | 200 OK |
| worker | /health | 200 OK |
| ui | / | 200 OK |

### Key Metrics
- API response time (p50, p95, p99)
- Database query duration
- Task queue depth
- Error rate by endpoint

### Common Alerts
| Alert | Severity | Action |
|-------|----------|--------|
| API 5xx rate > 1% | HIGH | Check logs, restart if needed |
| Database query timeout | MEDIUM | Check query load, optimize |
| Task queue > 1000 | MEDIUM | Scale workers, check for stuck tasks |
| Disk usage > 80% | HIGH | Clean old data, expand volume |

## Common Issues and Fixes

### Database Connection Pool Exhaustion
**Symptoms:** 500 errors on data-heavy queries
**Fix:** Restart API service, check for connection leaks

### Task Worker Stuck
**Symptoms:** Background tasks not processing
**Fix:** `celery -A src.tasks inspect active`, restart workers

### Database Migration Failure
**Symptoms:** API startup fails with schema error
**Fix:** Run `alembic upgrade head`, check migration compatibility

## Security Incident Response
1. Identify affected systems
2. Isolate if necessary
3. Collect logs and evidence
4. Escalate per your incident response plan
```

### 3. Identify Obsolete Documentation

```bash
# Find documentation files not modified in 90+ days
find docs/ -name "*.md" -mtime +90 -type f

# Cross-reference with source changes
# If source code changed but docs didn't, flag as stale

# Check for broken internal links
# Verify all referenced files still exist
```

Output:
```
STALE DOCUMENTATION:
  docs/old-api-guide.md     Last modified: 180 days ago
  docs/v1-migration.md      Last modified: 120 days ago
  docs/setup-legacy.md      Last modified: 95 days ago

Recommendation: Review for accuracy or archive
```

### 4. Show Diff Summary

```
DOCUMENTATION UPDATE SUMMARY

Files updated:
  docs/CONTRIB.md     +45 lines, -12 lines (new commands added)
  docs/RUNBOOK.md     +8 lines, -3 lines (alert thresholds updated)

Files created:
  docs/ENV_VARS.md    62 lines (extracted from .env.example)

Stale files flagged:
  3 files older than 90 days

Source-of-truth files analyzed:
  Python:  pyproject.toml, .env.example, alembic.ini
  C++:     CMakeLists.txt, build scripts, Dockerfile
  Vue/TS:  package.json, nuxt.config.ts, tsconfig.json
  Proto:   *.proto files
```

---

## Source-of-Truth Hierarchy

The source of truth for documentation is:

| Information | Source File | Priority |
|-------------|-----------|----------|
| Python dependencies | `pyproject.toml` | Primary |
| Python deps (legacy) | `requirements.txt` | Secondary |
| C++ build config | `CMakeLists.txt` | Primary |
| C++ build scripts | build scripts | Secondary |
| Frontend dependencies | `package.json` | Primary |
| Frontend config | `nuxt.config.ts` | Primary |
| Environment variables | `.env.example` | Primary |
| API schema | OpenAPI/Swagger (auto-generated) | Primary |
| Data schema | `.proto` files | Primary |
| Relational schema | Alembic migrations | Primary |
| Analytical schema | Migration SQL files | Primary |

## Integration with Other Commands

- Use `/update-codemaps` to update architecture diagrams alongside docs
- Use `/verify` to ensure documentation references valid commands
- Use `/plan` to document new features before implementation
- Use `/python-review` to check that code changes have corresponding doc updates

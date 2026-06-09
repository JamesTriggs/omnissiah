# CLAUDE.md - [Service Name]

> Copy this template into the root of your repository and customise the sections below.
> Remove this blockquote and all placeholder text when done.

## Project Overview

**Service**: [e.g., core-api, data-loader, ui]
**Language**: [e.g., Python 3.11, C++17, TypeScript 5.x]
**Framework**: [e.g., Flask + Flask-RESTX, CMake + Boost, Nuxt 3 + Vue 3]
**Purpose**: [One-sentence description of what this service does]

### Architecture
```
[Describe this service's architecture]
[Include folder structure, key modules, and data flow]
```

### Dependencies
- **Upstream**: [Services this depends on, e.g., database, cache, shared schemas]
- **Downstream**: [Services that depend on this]
- **Shared Contracts**: [Protocol Buffer schemas, API contracts consumed/produced]

## Code Conventions

### Python Projects
- **Package Manager**: uv (not pip or poetry)
- **Linting**: Ruff (`ruff check .` and `ruff format .`)
- **Type Checking**: mypy with strict mode
- **Testing**: pytest with fixtures, parametrize, and marks
- **Imports**: stdlib, third-party, local (enforced by Ruff isort)
- **Docstrings**: Google style for all public functions
- **Models**: Pydantic v2 for request/response, SQLAlchemy for ORM

### C++ Projects
- **Standard**: C++17
- **Build**: CMake 3.16+ with containerised builds (`./build_linux.bash`)
- **Testing**: Google Test framework
- **Style**: Modern C++ (RAII, smart pointers, no raw new/delete)
- **Dependencies**: Git submodules for external libraries
- **Compiler Flags**: `-fstack-protector-strong -D_FORTIFY_SOURCE=2 -Werror=format-security`

### TypeScript/Vue Projects
- **Framework**: Nuxt 3 with Composition API (`<script setup lang="ts">`)
- **Linting**: ESLint 9+ with flat config and eslint-plugin-vue
- **Testing**: Cypress (E2E), Vitest (unit)
- **State**: Pinia stores with TypeScript
- **Styling**: SCSS with design system tokens
- **Build**: Vite with code splitting

## Security Requirements

All code must follow these security practices:

- **Access Scoping**: Every data query MUST include an ownership filter. No exceptions.
- **Input Validation**: Validate all external input at the boundary (Pydantic, validation library, schema validation).
- **SQL Safety**: Use ORM or parameterised queries. Never concatenate user input into SQL.
- **Authentication**: Tokens with proper expiration and refresh.
- **Authorization**: Access-control checks on every endpoint.
- **Secrets**: Never hardcode credentials. Use environment variables or a secrets manager.
- **Audit Logging**: Log all security-relevant operations (auth, data access, config changes).
- **Dependency Scanning**: Keep dependencies updated. Check for CVEs regularly.

## Available Slash Commands

From the omnissiah framework:

| Command | Description |
|---------|-------------|
| `/code-review` | Security-first code review of uncommitted changes |
| `/learn` | Extract reusable patterns from current session |
| `/eval define <name>` | Define evaluation criteria for a feature |
| `/eval check <name>` | Run evaluations against defined criteria |
| `/checkpoint create <name>` | Create a named checkpoint in your workflow |
| `/orchestrate feature <desc>` | Run full feature workflow (plan -> TDD -> review -> security) |
| `/orchestrate bugfix <desc>` | Run bug investigation workflow |
| `/sessions list` | List recent sessions with metadata |
| `/skill-create` | Generate SKILL.md from git history patterns |
| `/instinct-status` | Show learned instincts with confidence scores |
| `/evolve` | Cluster instincts into skills/commands/agents |

## Testing Requirements

### Python Services
```bash
# Unit tests (fast, no external deps)
./tests.bash -q --type unit

# Integration tests (requires database connections)
./tests.bash -q --type integration

# Coverage target: 80%+ overall, 100% for security-critical paths
pytest --cov=<package> --cov-report=term-missing
```

### C++ Services
```bash
# Build and test in container
./build_linux.bash ubuntu2204 build debug
./build_linux.bash ubuntu2204 test

# Interactive debugging
./build_linux.bash ubuntu2204 shell
```

### Vue/TypeScript Services
```bash
# Unit tests
npm run test:unit

# E2E tests by batch
npm run test:cypress-run-batch batch_00
npm run test:cypress-run-batch batch_01
npm run test:cypress-run-batch batch_02

# Lint
npm run lint
```

## Environment Setup

```bash
# [Customise for your service]

# Python services
uv sync --group dev --group scripts

# C++ services (containerised)
./build_linux.bash ubuntu2204 shell

# Vue services
npm install
npm run dev
```

### Environment Variables
```bash
# [List required environment variables for this service]
# Example:
# DATABASE_URL=postgres://user:pass@localhost/app
# ANALYTICS_DB_HOST=localhost
# REDIS_URL=redis://localhost:6379
# JWT_SECRET_KEY=<from-secrets-manager>
# APP_USE_SQL_MIDDLEWARE=true
```

## Database Patterns

### Analytical Database (OLAP)
- Read-heavy analytical queries over large data volumes
- Filter on the partition key and time range first
- ORDER BY must align with the table ordering key
- Use materialised views for dashboard aggregations
- Immutable append-only storage with TTL for data retention

### Relational Database (Application State)
- OLTP operations: cases, users, configuration
- SQLAlchemy ORM with Alembic migrations
- Transaction support for multi-step operations
- Proper indexing on frequently queried columns

### Redis (Cache / Sessions)
- Session management and token caching
- Frequently accessed configuration data
- Cache invalidation on configuration changes
- TTL on all cached entries

## Key Files and Directories

```
[Customise for your service]
# Example for a Python API:
# src/
#   app/           - Business logic by domain
#   apis/          - REST endpoint definitions
#   db/            - Database models and queries
#   tests/         - Test suites (unit/, integration/, system/)
# alembic/         - Database migrations
# config/          - Configuration files
# Dockerfile       - Container definition
```

## Common Tasks

### Adding a New API Endpoint
1. Define Pydantic request/response models
2. Write the endpoint function with proper auth decorators
3. Add input validation and access scoping
4. Write unit tests and integration tests
5. Run `/code-review` before committing

### Adding a New Domain Rule
1. Document the rule and its intended behaviour
2. Define the rule logic
3. Write positive and negative test cases
4. Validate against realistic data
5. Document the rule in the catalog

### Modifying Protocol Buffer Schemas
1. Never reuse field numbers
2. Add new fields as optional
3. Regenerate bindings in your schema repository
4. Update all downstream services (consumers, APIs, UI types)
5. Test backward compatibility with existing data

## Troubleshooting

### Build Issues
```bash
# [Add service-specific troubleshooting steps]
```

### Test Failures
```bash
# [Add common test failure resolution steps]
```

### Database Connection Issues
```bash
# [Add database debugging steps]
```

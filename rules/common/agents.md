# Agent Orchestration

The agent roster included with the omnissiah framework.

## Available Agents

Located in `~/.claude/agents/`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **planner** | Implementation planning | Complex features, multi-service changes, sprint planning |
| **architect** | System design | Architectural decisions, service boundaries, data flow |
| **code-reviewer** | Code review | After writing code, before committing |
| **security-reviewer** | Security analysis | Before commits, after any auth or data-access changes |
| **python-reviewer** | Python-specific review | Flask/FastAPI code, Pydantic models, ORM queries |
| **cpp-reviewer** | C++ specific review | Native components, memory safety |
| **database-reviewer** | Database review | Schema design, migrations, query performance |
| **tdd-guide** | Test-driven development | New features, bug fixes, regression prevention |
| **build-error-resolver** | Fix build errors | When C++/Python/TypeScript builds fail |
| **e2e-runner** | E2E testing | Critical user flows, end-to-end test creation |
| **refactor-cleaner** | Dead code cleanup | Code maintenance, deprecation removal |
| **doc-updater** | Documentation | Updating API docs, README files, ADRs |

## When to Use Each Agent

### Planning and Design

**planner**, use when:
- Implementing a feature that spans multiple services or components
- Breaking down a large ticket into implementable steps
- Estimating complexity of a cross-cutting change
- Planning a migration or staged rollout

**architect**, use when:
- Introducing a new service or component
- Changing data flow between services
- Evaluating technology choices (new library, protocol change)
- Designing database schemas for new data types
- Planning schema changes that affect multiple languages

### Code Quality

**code-reviewer**, use when:
- Any code has been written or modified, before committing
- Reviewing code for readability, maintainability, and correctness
- Checking adherence to project coding standards

**security-reviewer**, use when:
- Any authentication or authorisation code is changed
- New API endpoints are created
- Database queries are added or modified (SQL injection risk)
- Handling user data or PII
- Changing access-scoping or isolation logic

**python-reviewer**, use when:
- Writing Flask or FastAPI endpoints
- Creating Pydantic models or ORM models
- Implementing background tasks
- Writing database query functions in Python

**cpp-reviewer**, use when:
- Modifying native pipeline code
- Changing network processing code
- Working with multi-threaded C++ code
- Modifying CMake build configurations

**database-reviewer**, use when:
- Creating or altering tables
- Writing complex analytical queries
- Creating migrations
- Optimising query performance

### Testing

**tdd-guide**, use when:
- Starting a new feature (write tests first)
- Fixing a bug (write a failing test that reproduces, then fix)
- Adding regression tests after an incident
- Improving test coverage for existing code

**e2e-runner**, use when:
- Testing complete user workflows in the UI
- Creating end-to-end tests for key journeys
- Validating that API changes do not break the frontend

### Build and Infrastructure

**build-error-resolver**, use when:
- A C++ build fails (CMake errors, linker errors, missing dependencies)
- Python dependency resolution fails
- A TypeScript or Vue build fails (Vite, tsc, or ESLint errors)
- Container build failures occur
- CI pipeline failures occur

### Maintenance

**refactor-cleaner**, use when:
- Removing deprecated code paths
- Cleaning up dead code identified by coverage reports
- Consolidating duplicated logic across services
- Simplifying overly complex functions

**doc-updater**, use when:
- API signature changes require OpenAPI or Swagger updates
- New features need user-facing documentation
- Architecture Decision Records (ADRs) need to be written
- README files are outdated after structural changes

## Immediate Agent Usage

No user prompt needed, invoke automatically:
1. Complex feature requests, use the **planner** agent first
2. Code just written or modified, use the **code-reviewer** agent
3. Bug fix or new feature, use the **tdd-guide** agent first
4. Architectural decision, use the **architect** agent
5. Security-sensitive change, use the **security-reviewer** agent
6. Build failure, use the **build-error-resolver** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution for a new API endpoint
Launch 4 agents in parallel:
1. security-reviewer: Analyse auth and access scoping
2. python-reviewer: Review endpoint code quality
3. database-reviewer: Review query performance
4. tdd-guide: Verify test coverage

# BAD: Sequential when unnecessary
First security-reviewer, then python-reviewer, then database-reviewer
```

## Multi-Perspective Analysis

For complex problems, use split-role sub-agents:
- **Security expert** (security-reviewer): Injection, auth bypass, data leakage
- **Performance engineer** (database-reviewer): Query plans, index usage, data volume
- **Domain expert** (code-reviewer): Business logic correctness, edge cases
- **C++ specialist** (cpp-reviewer): Memory safety, thread safety, performance
- **Frontend specialist** (e2e-runner): User experience, accessibility, responsiveness

## Common Agent Workflows

### New API Endpoint
```
planner -> python-reviewer -> security-reviewer -> database-reviewer -> tdd-guide
```

### C++ Pipeline Change
```
planner -> cpp-reviewer -> security-reviewer -> build-error-resolver -> tdd-guide
```

### Database Schema Change
```
architect -> database-reviewer -> security-reviewer -> python-reviewer -> cpp-reviewer
```

### Frontend Feature
```
planner -> code-reviewer -> security-reviewer -> e2e-runner -> doc-updater
```

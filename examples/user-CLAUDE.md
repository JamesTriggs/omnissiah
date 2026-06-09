# User-Level CLAUDE.md - omnissiah Template

> Place this file at ~/.claude/CLAUDE.md (or the location configured for user-level instructions).
> Customise the sections marked with [YOUR CHOICE] to match your preferences.

## omnissiah Dev OS

This configuration integrates with the omnissiah framework.
Framework location: ~/.claude/plugins/omnissiah/

### Framework Rules (Auto-loaded)
- Security-first review on all code changes
- Access-scoping enforcement
- Ruff/mypy for Python, ESLint for Vue/TS, cppcheck for C++
- Session persistence and knowledge capture
- Secret detection on commits

## Available Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| **architect** | opus | System architecture, scalability design, cross-service contracts |
| **planner** | opus | Implementation planning, task breakdown, risk identification |
| **code-reviewer** | sonnet | Code quality, security review, best practices |
| **security-reviewer** | opus | Deep security analysis, vulnerability assessment, threat modelling |
| **tdd-guide** | sonnet | Test-driven development, test writing, coverage analysis |
| **explorer** | haiku | Codebase exploration, pattern finding, quick research |
| **debugger** | sonnet | Bug investigation, root cause analysis, fix verification |
| **performance** | sonnet | Query optimisation, profiling, bottleneck identification |
| **docs-writer** | sonnet | Documentation generation, API docs, ADRs |
| **migrator** | sonnet | Database migrations, schema evolution, data transformation |
| **integrator** | sonnet | Cross-service integration, API contract design |

## Available Commands

| Command | Description |
|---------|-------------|
| `/code-review` | Security-first review of uncommitted changes |
| `/learn` | Extract reusable patterns from current session |
| `/eval` | Eval-driven development workflow |
| `/checkpoint` | Create/verify workflow checkpoints |
| `/orchestrate` | Sequential agent workflows for complex tasks |
| `/sessions` | Manage session history (list, load, alias) |
| `/skill-create` | Generate skills from git history |
| `/instinct-status` | Show learned instincts |
| `/instinct-import` | Import instincts from teammates |
| `/instinct-export` | Export instincts for sharing |
| `/evolve` | Cluster instincts into skills/commands/agents |

## Available Skills

All skills are provided by the omnissiah framework and activate automatically based on context:

| Skill | Purpose |
|-------|---------|
| `data-architect` | Protocol Buffers, analytical schemas, data model changes |
| `test-runner` | Multi-language test execution (pytest, gtest, Cypress) |
| `query-expert` | Analytical queries, SQL optimisation |
| `api-dev` | Flask/FastAPI endpoint development, Pydantic models |
| `deployment-expert` | Build/deploy orchestration, Docker, CI/CD |
| `devops-specialist` | Monitoring, infrastructure debugging, incidents |
| `python-testing` | pytest strategies, TDD, fixtures, mocking |
| `python-patterns` | Pythonic idioms, type hints, best practices |
| `backend-patterns` | FastAPI, Flask-RESTX, SQLAlchemy, analytical DB, Celery, Redis |
| `frontend-patterns` | Vue 3, Nuxt 3, Pinia, TypeScript, Cypress, D3.js |
| `db-io` | Analytical schemas, query optimisation |
| `coding-standards` | Universal standards for Python, Vue.js/TypeScript, C++17 |
| `security-review` | Auth, user input, APIs, access-scoped data |
| `tdd-workflow` | Test-driven development with 85%+ coverage |
| `eval-harness` | Eval-driven development with pass@k metrics |
| `continuous-learning-v2` | Instinct-based learning from session observations |
| `strategic-compact` | Context compaction at logical boundaries |

## Personal Preferences

### Privacy
- [YOUR CHOICE] Do not send code snippets to external services
- [YOUR CHOICE] Keep session data local to this machine
- [YOUR CHOICE] Anonymise file paths in exported instincts

### Code Style
- [YOUR CHOICE] Prefer functional patterns / class-based patterns
- [YOUR CHOICE] Maximum line length: 88 (Python) / 100 (C++) / 120 (TypeScript)
- [YOUR CHOICE] Docstring style: Google / NumPy / reStructuredText
- [YOUR CHOICE] Commit message style: conventional commits

### Git Workflow
- [YOUR CHOICE] Default branch: main / master / develop
- [YOUR CHOICE] Branch naming: feature/TICKET-description / feat/description
- [YOUR CHOICE] Squash merges: yes / no
- [YOUR CHOICE] Auto-push after commit: never (provide command only)

### Testing
- [YOUR CHOICE] Always write tests first (TDD) / tests alongside code / tests after code
- [YOUR CHOICE] Minimum coverage target: 80% / 90% / 100% for critical paths
- [YOUR CHOICE] Preferred test style: arrange-act-assert / given-when-then

### Service Execution
- I prefer to run all service start/stop commands myself (uvicorn, npm run dev, etc.)
- I prefer to run all installation commands myself (npm install, uv sync, pip install, etc.)
- Claude should provide the exact commands but NOT execute them via Bash tool

## Model Selection Guidance

Choose the right model for the task:

### Haiku (Fast, Exploration)
Use for:
- Quick file searches and pattern matching
- Codebase exploration and orientation
- Simple code generation tasks
- Rapid prototyping and brainstorming
- Running the explorer agent

### Sonnet (Balanced, Coding)
Use for:
- Day-to-day coding and implementation
- Writing tests and documentation
- Code review and refactoring
- API endpoint development
- Bug fixes and debugging
- Most development tasks

### Opus (Deep, Architecture/Security)
Use for:
- Architecture decisions and system design
- Security review and vulnerability assessment
- Complex cross-service integration
- Performance analysis of complex query patterns
- Large-scale refactoring planning
- Incident investigation and root cause analysis

## Environment Notes

```bash
# Your workspace
export WORKSPACE=~/work

# Key project locations (customise to your repositories)
# $WORKSPACE/core-api/      - Primary Python API
# $WORKSPACE/public-api/    - External API
# $WORKSPACE/data-loader/   - C++ data ingestion
# $WORKSPACE/netlib/        - C++ network library
# $WORKSPACE/data-model/    - Protocol Buffer schemas
# $WORKSPACE/ui/            - Vue.js frontend
# $WORKSPACE/sql-parser/    - SQL dialect parser
```

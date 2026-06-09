<!-- omnissiah:start -->
## omnissiah Dev OS

Framework location: `~/.claude/plugins/omnissiah/`
21 agents, 29 commands, 26 skills, 17 hooks

### Available Commands

| Command | Purpose |
|---------|---------|
| `/team` | Three-tier harness, intake -> orchestrator -> parallel leads -> workers. Use for research ("how best to...") and building. |
| `/code-review` | Security-first review of uncommitted changes |
| `/debug` | Systematic bug investigation, traces root causes |
| `/migrate` | Design zero-downtime database migrations |
| `/orchestrate` | Sequential multi-agent workflows (simple linear chains) |
| `/perf` | Performance analysis and optimisation |
| `/plan` | Implementation planning and task breakdown |
| `/python-review` | Python-focused code review (Ruff, mypy, patterns) |
| `/tdd` | Test-driven development workflow |
| `/test-coverage` | Analyse and improve test coverage |
| `/e2e` | End-to-end test runner (Cypress) |
| `/eval` | Eval-driven development (define and check criteria) |
| `/build-fix` | Diagnose and fix build/compilation errors |
| `/refactor-clean` | Safe refactoring with verification |
| `/verify` | Run verification checks on recent changes |
| `/learn` | Extract reusable patterns from current session |
| `/checkpoint` | Save/restore development checkpoints |
| `/sessions` | Manage session history (list, load, alias) |
| `/skill-create` | Generate skills from git history |
| `/instinct-status` | Show learned instincts |
| `/instinct-import` | Import instincts from teammates |
| `/instinct-export` | Export instincts for sharing |
| `/evolve` | Cluster instincts into skills/commands/agents |
| `/project` | Load a project's context from a parent directory |
| `/tldr` | Semantic codebase search and call graph analysis |
| `/health` | Full framework health check |
| `/update-docs` | Regenerate project documentation |
| `/update-codemaps` | Refresh codebase navigation maps |

### Available Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| architect | opus | System architecture and cross-service design |
| planner | opus | Implementation planning and risk identification |
| harness-orchestrator | opus | /team tier-1, selects preset, builds till-done contract, spawns leads. No Write/Edit tools. |
| build-error-resolver | sonnet | Build failure diagnosis and fixes |
| code-reviewer | sonnet | Code quality and best-practices review |
| debugger | sonnet | Bug investigation and root cause analysis |
| doc-updater | sonnet | Documentation generation and updates |
| e2e-runner | sonnet | End-to-end test execution and debugging |
| harness-lead | sonnet | /team tier-2, domain exploration, worker delegation. No Write/Edit tools. |
| integrator | sonnet | Cross-service integration, API contracts |
| migrator | sonnet | Zero-downtime database migrations |
| performance | sonnet | Profiling, query tuning, bottleneck analysis |
| python-reviewer | sonnet | Python-specific review (Ruff, mypy, patterns) |
| refactor-cleaner | sonnet | Safe refactoring with test preservation |
| tdd-guide | sonnet | Test-driven development coaching |
| cpp-reviewer | opus | C++ review (modern C++17, memory safety, thread safety) |
| database-reviewer | opus | Schema and query review |
| security-reviewer | opus | Vulnerability assessment and threat modelling |
| explorer | haiku | Fast codebase exploration, pattern finding |
| harness-intake | haiku | /team prompt quality gate, classifies task type, scores 0-5, asks targeted questions |

### Hooks (auto-enforced)

- **Safety guards**, block accidental `git push`, dev-server starts, and install commands
- **Code quality**, auto-format Python (Ruff), type-check (mypy), lint Vue (ESLint), analyse C++ (cppcheck)
- **Security**, block commits containing secrets (cloud keys, API tokens, passwords)
- **Cross-service**, warn on Protocol Buffer schema changes
- **Harness**, warn if orchestrator/lead role attempts direct file writes (tool restriction is primary enforcement)
- **Session lifecycle**, persist context on start, compact, and end

### Quick Start

```
/team "how best to..."    # Research mode, explore before building (no code changes)
/team "build X"           # Launch three-tier agent team (intake -> orchestrator -> leads -> workers)
/code-review              # Review uncommitted changes
/orchestrate feature      # Simple sequential workflow (plan -> TDD -> review -> security)
/sessions list            # See recent sessions
```

> Set `CLAUDE_PACKAGE_MANAGER` to override auto-detected package manager (npm/pnpm/yarn/bun).
<!-- omnissiah:end -->

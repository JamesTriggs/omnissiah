# omnissiah Skills Index

A navigation map for the framework's 45 skills. Skills activate automatically by context (working directory, file types, task type), so you rarely invoke one by hand. This index exists so you can see what is available, understand how skills group together, and know which one to reach for when several overlap.

For the delivery-lane system and the agent-team harness that many of these skills plug into, see `the-omnissiah-guide.md`.

## Delivery lanes and process

The spine that routes and paces a piece of work from idea to shipped and learned.

| Skill | Purpose |
|-------|---------|
| `delivery-lane-router` | Picks the right lane (quick-fix, std-feature, frontier-bet, or a discovery detour) from clarity, risk, and evidence. Sets the review and model floor. |
| `quick-fix` | Lean lane for clear, bounded fixes. Keeps TDD, review, and the model floor explicit. |
| `std-feature` | Default lane for normal product work. PRD, spec, plan, beads, flaw scan, TDD, build, simplify, review, ship, learn. |
| `frontier-bet` | High-rigour lane for strategic, novel, or high-blast-radius work. Adds discovery, ambition, and full review to the spine. |
| `spec-driven-development` | Writes a spec before coding when requirements are unclear or only a vague idea. |
| `plan` | Breaks a validated spec into small demoable slices with acceptance criteria and tracked tasks. |
| `beads-workflow` | Turns a markdown plan into a bead task graph with dependencies via the `br` CLI. |
| `build-slice` | Implements one small slice at a time with fresh context, bounded scope, and proof. |
| `code-simplify` | Removes accidental complexity and speculative abstraction after a slice works. |
| `ship-safe` | Closes a lane cleanly: verify, commit, push, PR, and merge only when gates allow. |
| `operate-and-learn` | Checks the operating result after delivery, captures lessons, and hands off. |
| `next-best-bet` | Picks the highest-leverage next autonomous move, or surfaces the one real blocker. |

## Multi-agent harness

Building features with three-tier agent teams.

| Skill | Purpose |
|-------|---------|
| `agent-teams` | Harness engineering guide: the `/team` command, presets, till-done contracts, and prompt gates. |
| `iterative-retrieval` | Progressively refines context retrieval to solve the subagent context problem. |

## Review and quality

Gates and lenses applied before shipping.

| Skill | Purpose |
|-------|---------|
| `review-hard` | Reviews a local diff or ready slice for bugs, regressions, missing proof, security risk, and overcomplication. |
| `senior-engineering` | Senior review for production services and agents: correctness, reliability, scalability, observability, testing, operability. |
| `cto-level-review` | Strategic review for architectural and long-horizon changes: alignment, TCO, risk, compliance, reversibility. |
| `security-review` | Focused review for auth, user input, secrets, API endpoints, and other security-sensitive features. |
| `flaw-scan-x5` | Repeatedly scans a proposal, PRD, spec, plan, or bead set for gaps and weak assumptions, updating the artifacts each pass. |
| `verification-loop` | Runs language-specific quality gates (ruff, mypy, eslint, cppcheck) for Python, C++, and Vue/Nuxt. |

## Testing

| Skill | Purpose |
|-------|---------|
| `test-driven-development` | Lightweight process step: prove behaviour changes with tests before or alongside implementation. |
| `tdd-workflow` | Deeper TDD reference: 85%+ coverage across pytest, Google Test, Vitest, and Cypress. |
| `python-testing` | Python testing reference: pytest, fixtures, mocking, parametrization, coverage. |
| `test-engineer` | Deep test design and review across unit, integration, contract, regression, concurrency, and property/fuzz. |
| `browser-proof` | Verifies user-visible web changes in a real browser or browser-equivalent runtime before claiming they work. |

## Language and stack patterns

| Skill | Purpose |
|-------|---------|
| `coding-standards` | Universal standards for Python, Vue.js/TypeScript, and C++17. |
| `python-patterns` | Pythonic idioms, PEP 8, type hints, and best practices. |
| `backend-patterns` | FastAPI, Flask-RESTX, SQLAlchemy, analytics DB, Celery, Redis, inter-service communication. |
| `frontend-patterns` | Vue 3, Nuxt 3, Pinia, TypeScript, Cypress, Playwright, D3.js, Monaco Editor. |
| `feature-flags` | Gradual rollout, kill switches, A/B testing, and migration gating. |

## AI-native engineering

Context, cost, tooling, and learning for agent-driven work.

| Skill | Purpose |
|-------|---------|
| `context-engineering` | Optimises agent context setup: rules files, context packets, slice context. |
| `context-engineering-advisor` | Diagnoses context stuffing versus context engineering when a workflow feels bloated or brittle. |
| `strategic-compact` | Suggests manual context compaction at logical intervals rather than arbitrary auto-compaction. |
| `agent-cost-governance` | Governs token spend and model-tier selection: per-task caps, context economics, multi-agent worth. |
| `mcp-and-tools` | Designs agent tool interfaces and builds and secures MCP servers, scoping read-only versus write. |
| `llm-tldr` | Fast semantic codebase exploration with the `tldr` CLI: search, call graphs, dead-code detection. |
| `continuous-learning-v2` | Instinct-based learning: observes sessions, scores atomic instincts, evolves them into skills/commands/agents. |
| `eval-harness` | Eval-driven development framework with pass@k metrics and graders. |
| `research-software` | Researches unfamiliar or fast-moving software from source, docs, and GitHub before committing to a plan. |

## Operations and observability

| Skill | Purpose |
|-------|---------|
| `observability-patterns` | Structured logging, metrics, health checks, distributed tracing, and alerting. |
| `operational-excellence` | Incident response, deployment strategies, circuit breakers, and reliability patterns. |
| `debug-root-cause` | Diagnoses the real cause before changing code for bugs, flaky tests, and production symptoms. |

## Product and discovery

| Skill | Purpose |
|-------|---------|
| `discovery-process` | Full discovery cycle from problem hypothesis to validated solution: framing, interviews, synthesis, experiments. |
| `prd-development` | Builds a structured PRD connecting problem, users, solution, and success criteria. |
| `product-clarity-review` | Answers ambiguity questions from product, pricing, customer, and engineering evidence before design. |

## Overlapping skills, which to use

Several skills cover related ground. Use the canonical one as the step in your workflow and treat the others as deeper or specialised references.

**Testing.** Use `test-driven-development` as the lightweight process step inside a delivery lane. Reach for `tdd-workflow` and `python-testing` as the deeper references when you need coverage targets, framework specifics, fixtures, or mocking detail. `test-engineer` is for deep test design and review, not the day-to-day loop.

**Review.** Use `review-hard` as the pre-ship gate on a diff or ready slice. Treat `senior-engineering`, `cto-level-review`, and `security-review` as deeper or specialised lenses layered on top for production-grade, strategic, or security-sensitive changes, and the reviewer agents (`code-reviewer`, `python-reviewer`, `cpp-reviewer`, `frontend-reviewer`, `security-reviewer`, `database-reviewer`) when you want a dedicated agent to run the review.

**Planning.** `plan` is the step that breaks a validated spec into slices. `spec-driven-development` and `prd-development` are the upstream artifacts that feed it: write the spec (and, for a major initiative, the PRD) first, then plan.

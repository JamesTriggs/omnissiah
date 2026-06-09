---
description: Sequential agent workflows for complex tasks. Chains specialist agents (planner, TDD guide, code reviewer, security reviewer) with structured handoffs.
---

# Orchestrate Command

Sequential agent workflow for complex tasks.

## Usage

`/orchestrate [workflow-type] [task-description]`

## Workflow Types

### feature
Full feature implementation workflow:
```
planner -> tdd-guide -> code-reviewer -> security-reviewer
```

### bugfix
Bug investigation and fix workflow:
```
explorer -> tdd-guide -> code-reviewer
```

### refactor
Safe refactoring workflow:
```
architect -> code-reviewer -> tdd-guide
```

### security
Security-focused review:
```
security-reviewer -> code-reviewer -> architect
```

## Execution Pattern

For each agent in the workflow:

1. **Invoke agent** with context from previous agent
2. **Collect output** as structured handoff document
3. **Pass to next agent** in chain
4. **Aggregate results** into final report

## Synthesised Spec Contract

**The single most important rule:** the orchestrating agent MUST synthesise findings into a
precise spec before directing the next agent. Lazy delegation is forbidden.

### Lazy Delegation — NEVER do this

```
❌ "Based on what you found in the auth module, fix the security issue."
❌ "Review the planner's output and implement it."
❌ "The previous agent identified problems — address them."
```

These are banned because they push responsibility to the next agent without giving it
the context it needs, causing wasted turns and incorrect fixes.

### Synthesised Spec — ALWAYS do this

Every handoff MUST contain **specific, unambiguous instructions** synthesised from findings:

```
✅ "Fix `src/auth/middleware.py:L142` — the session token is stored in
   plaintext. Replace with `hmac.new(SECRET_KEY, user_id.encode(), 'sha256').hexdigest()`.
   SECRET_KEY is loaded from the secrets store in `src/config.py:L34`."

✅ "Add a pytest fixture in `tests/conftest.py` that creates an isolated
   test database using the schema from `src/migrations/0023_add_events.sql`.
   The existing fixture pattern to copy is `make_db_session` at line 67."
```

## Handoff Document Format

Between agents, create a handoff document containing ALL of the following:

```markdown
## HANDOFF: [previous-agent] -> [next-agent]

### Synthesised Spec
[Precise, unambiguous instructions for the next agent.
Include: exact file paths, line numbers, function names, variable names.
Never write "fix the issue" — write exactly WHAT to change and HOW.]

### Files Relevant to Next Agent
[Absolute paths, key line numbers, relevant functions/classes]
- `path/to/file.py:L45-L67` — reason it matters

### Findings
[What was discovered — facts, not vague descriptions]

### Files Modified (this turn)
[List of files touched by this agent]

### Open Questions
[Unresolved items — if any exist, the orchestrator must decide before the next agent starts]

### Definition of Done for Next Agent
[Specific, verifiable criteria — tests to pass, lint to clear, outputs to produce]
```

## Example: Feature Workflow

```
/orchestrate feature "Add user authentication"
```

Executes:

1. **Planner Agent**
   - Analyzes requirements
   - Creates implementation plan
   - Identifies dependencies
   - Output: `HANDOFF: planner -> tdd-guide`

2. **TDD Guide Agent**
   - Reads planner handoff
   - Writes tests first
   - Implements to pass tests
   - Output: `HANDOFF: tdd-guide -> code-reviewer`

3. **Code Reviewer Agent**
   - Reviews implementation
   - Checks for issues
   - Suggests improvements
   - Output: `HANDOFF: code-reviewer -> security-reviewer`

4. **Security Reviewer Agent**
   - Security audit
   - Vulnerability check
   - Final approval
   - Output: Final Report

## Final Report Format

```
ORCHESTRATION REPORT
====================
Workflow: feature
Task: Add user authentication
Agents: planner -> tdd-guide -> code-reviewer -> security-reviewer

SUMMARY
-------
[One paragraph summary]

AGENT OUTPUTS
-------------
Planner: [summary]
TDD Guide: [summary]
Code Reviewer: [summary]
Security Reviewer: [summary]

FILES CHANGED
-------------
[List all files modified]

TEST RESULTS
------------
[Test pass/fail summary]

SECURITY STATUS
---------------
[Security findings]

RECOMMENDATION
--------------
[SHIP / NEEDS WORK / BLOCKED]
```

## Parallel Execution

For independent checks, run agents in parallel:

```markdown
### Parallel Phase
Run simultaneously:
- code-reviewer (quality)
- security-reviewer (security)
- architect (design)

### Merge Results
Combine outputs into single report
```

## Arguments

$ARGUMENTS:
- `feature <description>` - Full feature workflow
- `bugfix <description>` - Bug fix workflow
- `refactor <description>` - Refactoring workflow
- `security <description>` - Security review workflow
- `custom <agents> <description>` - Custom agent sequence

## Custom Workflow Example

```
/orchestrate custom "architect,tdd-guide,code-reviewer" "Redesign caching layer"
```

## Tips

1. **Start with planner** for complex features
2. **Always include code-reviewer** before merge
3. **Use security-reviewer** for auth/payment/PII
4. **Keep handoffs concise** - focus on what next agent needs
5. **Run verification** between agents if needed
6. **Step 0 on refactor workflows**: before the first agent starts, run `tldr dead .`
   and commit dead code removal separately (Agent Directive #1). Use `/tldr dead` for this.
7. **Use `/tldr search` before exploration**: semantic search identifies the right files
   to include in agent handoffs — better than guessing from filenames alone.

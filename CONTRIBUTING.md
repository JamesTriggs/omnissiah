# Contributing to omnissiah

Thank you for contributing to omnissiah. This document outlines the process for contributing agents, commands, skills, rules, hooks, and other framework components.

## Table of Contents

- [Security Requirements](#security-requirements)
- [Getting Started](#getting-started)
- [Contribution Types](#contribution-types)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Templates](#templates)
- [Testing Requirements](#testing-requirements)
- [Code of Conduct](#code-of-conduct)

## Security Requirements

All contributions to this framework are subject to review. The framework ships hooks and prompts that run on contributors' machines, so it must hold a high security bar.

### Security Checklist (Required for All PRs)

- [ ] No hardcoded credentials, API keys, tokens, or passwords
- [ ] No secrets in example files or documentation
- [ ] Hook commands do not expose sensitive data in output
- [ ] MCP server configurations do not contain real connection strings
- [ ] Session templates do not contain real or personal data
- [ ] Agent prompts do not instruct Claude to bypass security checks
- [ ] Rule files do not weaken existing security requirements
- [ ] All file paths in examples use placeholders, not real paths
- [ ] No personally identifiable information in any contributed file

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/omnissiah.git
   cd omnissiah
   ```

2. Understand the directory structure:
   ```
   omnissiah/
   ├── agents/          # Agent definitions (.md files with YAML frontmatter)
   ├── commands/        # Slash command definitions (.md files)
   ├── skills/          # Skill definitions (directories with SKILL.md)
   ├── rules/           # Rule files organised by language
   │   ├── common/      # Language-agnostic rules
   │   ├── python/      # Python-specific rules
   │   ├── typescript/  # TypeScript-specific rules
   │   └── cpp/         # C++-specific rules
   ├── hooks/           # Hook configuration (JSON)
   ├── contexts/        # Context mode definitions
   ├── chapters/        # Chapter overrides and additions
   ├── mcp-configs/     # MCP server configuration template
   ├── examples/        # Templates and examples
   ├── scripts/         # Hook implementation scripts and CI validators
   ├── schemas/         # JSON schemas for validation
   └── tests/           # Framework tests
   ```

3. Read the existing components to understand patterns:
   - Read `agents/architect.md` for agent structure
   - Read `commands/code-review.md` for command structure
   - Read `skills/python-testing/SKILL.md` for skill structure

## Contribution Types

### Adding a New Agent

Agents are specialist personas that Claude adopts for specific tasks. Create a new file in `agents/`:

```markdown
---
name: agent-name
description: One-sentence description of what this agent does
tools: ["Read", "Grep", "Glob"]
model: opus|sonnet|haiku
---

You are a [role] specialising in [domain].

## Your Role
- [Responsibility 1]
- [Responsibility 2]

## Process
### 1. [Step Name]
[Details]
```

**Requirements:**
- Agent must have a clear, non-overlapping purpose
- Must include a model recommendation (opus for architecture/security, sonnet for coding, haiku for exploration)
- Must define which tools the agent needs
- Must be registered in `.claude-plugin/plugin.json`

### Adding a New Command

Commands are user-invoked actions. Create a new file in `commands/`:

```markdown
# Command Name

Description of what this command does.

## Usage
`/command-name [arguments]`

## What to Do
1. [Step 1]
2. [Step 2]

## Output Format
[Expected output structure]
```

**Requirements:**
- Command must have clear usage instructions
- Must define expected output format
- Must handle error cases
- Must be registered in `.claude-plugin/plugin.json`

### Adding a New Skill

Skills are auto-triggered behaviours. Create a new directory in `skills/`:

```
skills/
└── skill-name/
    ├── SKILL.md        # Skill definition (required)
    └── [scripts/]      # Supporting scripts (optional)
```

**Requirements:**
- Must include YAML frontmatter with name and description
- Must define "When to Activate" conditions
- Must include practical examples
- Must be registered in `.claude-plugin/plugin.json`

### Adding a New Rule

Rules are conventions and standards. Add to the appropriate directory in `rules/`:

- `rules/common/` - Language-agnostic rules
- `rules/python/` - Python-specific rules
- `rules/typescript/` - TypeScript-specific rules
- `rules/cpp/` - C++-specific rules

**Requirements:**
- Rules must be actionable and specific
- Must include code examples (good and bad)
- Must explain the "why" behind the rule
- Must add the rule path to `.claude-plugin/plugin.json`

### Adding a New Hook

Hooks are automated checks. Add entries to `hooks/hooks.json` and implement the script in `scripts/hooks/`:

**Requirements:**
- Must follow the schema in `schemas/hooks.schema.json`
- Hook commands must be strings referencing `node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<name>.js`
- Must handle errors gracefully and exit 0 (never block on hook failure)
- Must be fast (hooks run on every matching tool call)
- Must include a description field
- Do NOT add a `"hooks"` field to `plugin.json`; `hooks/hooks.json` is auto-discovered

### Adding a New Context

Contexts are mode switches. Create a new file in `contexts/`:

**Requirements:**
- Must define clear behavioural expectations
- Must specify which tools to favour
- Must be concise (loaded into every prompt)

## Development Process

### 1. Plan Your Contribution

Before writing code:
- Check existing components for overlap
- Discuss significant changes first
- For agents and skills, verify the scope does not conflict with existing ones

### 2. Follow Existing Patterns

Consistency is critical when many people share the same framework:
- Match the formatting style of existing files
- Use the same YAML frontmatter structure
- Follow naming conventions (kebab-case for files, descriptive names)

### 3. Test Your Changes

Run the validation scripts and the test suite:

```bash
npm run validate   # validates agents, commands, hooks, rules, skills
npm test           # runs the full test suite
```

### 4. Document Your Changes

- Update README.md if adding new agents, commands, or skills
- Update the-omnissiah-guide.md if adding new workflows
- Update examples/ if changing templates

## Pull Request Process

### PR Title Format

```
<type>: <description>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore` (see `commitlint.config.js`).

Examples:
- `feat: add cpp-security-reviewer agent`
- `fix: correct hook matcher for write events`
- `docs: update guide with chapter selection`

### PR Description Template

```markdown
## Summary
- [What this PR does]

## Motivation
- [Why this change is needed]

## Changes
- [List of changes]

## Security Checklist
- [ ] No hardcoded credentials or secrets
- [ ] No personal data in examples
- [ ] Hook commands handle errors gracefully
- [ ] Agent prompts do not bypass security checks

## Testing
- [ ] Validation scripts pass (npm run validate)
- [ ] Test suite passes (npm test)
- [ ] Manual testing completed
- [ ] Tested with a Claude Code session

## Test Plan
- [How to verify this works]
```

### Review Requirements

All PRs require:
1. At least one approval
2. All CI checks passing (validators plus test suite)
3. No secrets or personal data in any file

PRs that modify security-related components (hooks with secret detection, review context, security rules) should get an explicit security sign-off in the review.

## Testing Requirements

**Framework tests (Node.js)**
```bash
npm test
```

**Hook tests**
```bash
node tests/hooks/hooks.test.js
node tests/integration/hooks.test.js
```

**Validators**
```bash
npm run validate
```

### Manual Testing

For agents, commands, and skills, test in a live Claude Code session:
1. Start Claude Code in any project directory
2. Invoke the new component
3. Verify it produces expected output
4. Test edge cases (empty input, large input, error conditions)

### What to Test

| Component | Test Requirements |
|-----------|------------------|
| Agent | Verify persona activation, tool usage, output quality |
| Command | Verify invocation, argument handling, output format |
| Skill | Verify auto-activation triggers, guidance quality |
| Rule | Verify the rule is applied by agents during review |
| Hook | Verify matcher accuracy, command execution, error handling |
| Context | Verify the mode switch affects agent behaviour |

## Templates

### Agent Template

See `agents/architect.md` for a complete example.

### Command Template

See `commands/code-review.md` for a complete example.

### Skill Template

See `skills/python-testing/SKILL.md` for a complete example.

## Code of Conduct

- Treat all contributions respectfully
- Security concerns take priority over features
- When in doubt, discuss before implementing
- Keep the framework focused: every component should serve the goal of consistent, secure, high-quality development

## Questions?

- Check `the-omnissiah-guide.md` for framework documentation
- Check `README.md` for a component overview

---
name: mcp-and-tools
description: Design tool interfaces for agents and build and secure MCP servers. Use when defining agent tools, function calling, tool use, or MCP servers; scoping tools read-only vs write; gating risky actions behind approval; or deciding what to expose to an agent. Triggers include mcp, tool design, tool use, agent tools, function calling.
---

# MCP and Tools

## Overview

Tools are the surface through which an agent acts on the world. The model emits a tool call; your harness decides what actually happens. That gap is where all the leverage and all the risk live. This skill covers three things: designing tool interfaces an agent can use reliably, building and securing MCP servers, and scoping tools so an agent can do its job without doing damage.

The guiding idea is the **agent-computer interface (ACI)**. A human-computer interface is tuned for human perception and habits. An ACI is tuned for how a model reads, reasons, and makes mistakes. Treat tool design as an interface design problem, not an API-plumbing problem.

## When to Use

- Defining the tools an agent (or subagent) can call
- Writing or reviewing an MCP server
- Deciding whether to expose broad access (bash, shell) or narrow, dedicated tools
- Scoping an agent to read-only vs read-write
- Gating a destructive or irreversible action behind approval or a hook
- Debugging why an agent picks the wrong tool, or misuses one

## Designing Tools for Agents

### Bash breadth vs dedicated-tool control

A single `bash` tool gives an agent enormous reach: almost any action is expressible as a command. But it hands your harness only an opaque string, identical in shape for every action, so the harness cannot gate, render, audit, or parallelise specific actions. A **dedicated tool** gives the harness a typed, named hook it can intercept.

Rule of thumb: **start with bash for breadth; promote an action to a dedicated tool when you need to gate, render, audit, or parallelise it.**

Promote when:

- **Security boundary.** Hard-to-reverse actions (sending messages, deleting data, external POSTs) should be gateable. `send_email` is trivial to gate; `bash -c "curl -X POST ..."` is not.
- **Invariant enforcement.** A dedicated `edit` tool can reject a write if the file changed since the agent last read it. Bash cannot enforce that.
- **Rendering.** Some actions deserve custom UI (an approval modal, a diff view).
- **Scheduling.** A read-only `grep` can be marked parallel-safe; a `git push` cannot. Behind bash the harness cannot tell them apart and must serialise everything.

### Unambiguous, non-overlapping tools

The model chooses tools from their names and descriptions. Ambiguity is the main cause of wrong-tool errors.

- **One clear job per tool.** If two tools could each plausibly handle a request, the model will sometimes pick the wrong one, or thrash between them. Merge them, or sharpen the descriptions until the boundary is obvious.
- **Distinct, descriptive names.** `search_customers` beats `search`; `get_current_weather` beats `weather`. A name the model can match to intent halves the description's work.
- **Prescriptive descriptions.** State *when* to call the tool, not only what it does: "Call this when the user asks about current prices or recent events." On models that reach for tools conservatively, an explicit trigger condition measurably raises the should-call rate. Put the trigger in the tool's own description, not only the system prompt.
- **Keep the set focused.** Too many tools crowds the context and dilutes selection. If you have a large library, use tool search (schemas loaded on demand) rather than dumping every schema into every request.

### Poka-yoke: make mistakes hard to make

Borrow the manufacturing idea of mistake-proofing: shape the interface so the wrong call is difficult or impossible to express.

- **Constrain inputs at the schema.** Use `enum` for fixed value sets, typed fields, `required` for genuinely mandatory params, and sane defaults for the rest. A model cannot pass an invalid enum value.
- **Prefer absolute over relative where ambiguity bites.** If agents keep passing relative paths that break because the working directory shifts, require absolute paths in the schema and the description. Redesigning the parameter beats adding a warning.
- **Remove foot-guns from the shape.** If a tool is frequently misused in one specific way, change the interface so that misuse is unrepresentable, rather than documenting "don't do X".
- **Give examples in the description** for tools with complex schemas, so the model sees the intended shape.

### Good error messages

Errors are part of the interface. The model reads them and adapts, so write them for the model.

- **Return errors as tool results, not exceptions.** Set `is_error: true` on the result and put an informative, actionable message in the content. A failed tool must still return a result the model can read; dropping it breaks the loop.
- **Say what went wrong and what to do next.** "File not found: /tmp/x. Use an absolute path under /workspace." beats "ENOENT".
- **Never leak secrets or internal stack traces** into error text the model (and thus logs and downstream calls) will see. Redact, then explain.
- **Fail closed on ambiguity.** If a destructive tool gets an argument it cannot safely interpret, refuse with a clear message rather than guessing.

## Building and Securing MCP Servers

The Model Context Protocol is a standard way to expose tools, resources, and prompts to any MCP-capable client. A well-built MCP server is reusable across agents and hosts; a careless one is an ambient attack surface.

### Transport: stdio vs HTTP

- **stdio** — the server runs as a local subprocess of the client, communicating over stdin/stdout. Best for local, single-user tools (filesystem, local database, dev tooling). No network listener, so the attack surface is the process and its filesystem access. This is the safer default for anything that touches local resources.
- **Streamable HTTP** — the server is a network endpoint. Necessary for remote/shared/hosted servers, and for connecting a hosted agent to a third-party service. Every HTTP MCP server is a reachable service: it needs authentication, transport security (TLS), and origin/host validation. Do not expose an HTTP MCP server without auth "because it's internal".

### Authentication and credentials

- **Authenticate every HTTP server.** Hosted MCP servers commonly use OAuth bearer tokens. Note that an MCP OAuth token is a different credential from the underlying service's API key: a native `ntn_`/`sk-` API key generally will not work as an MCP bearer token.
- **Keep credentials out of the agent's context and out of the sandbox.** Do not put API keys in the system prompt, user messages, or tool arguments. Anything in the conversation is persisted in history, returned by list/replay endpoints, and swept into compaction summaries. Inject credentials at egress (a proxy that adds the token after the request leaves the sandbox) or via a managed credential store, so sandboxed code, including anything the agent writes, cannot read them.
- **Declare servers without auth in reusable configs.** Keep the reusable agent definition credential-free (server name, URL, type) and attach credentials per session/deployment. This keeps secrets out of version-controlled config.

### Least-privilege scopes

- **Grant the narrowest scope that does the job.** An MCP server that only needs to read issues should not hold a write-scoped token. The agent can do anything the credential allows, so a broader token widens the blast radius of any misbehaviour or prompt injection.
- **Separate privileged from routine.** Keep an admin-scoped credential on a dedicated path used only for admin work, and do day-to-day work on an unprivileged one.
- **Restrict egress hosts.** When a credential is substituted at egress, limit which hosts it can be sent to (an allow-list of domains), so a leaked or misdirected request can never carry the secret to an unauthorised host.

### Input validation

- **Validate every tool input server-side.** MCP tool arguments are model-generated and, transitively, may be influenced by untrusted content the model read. Treat them as untrusted input: validate types, ranges, and formats; reject rather than coerce.
- **Confine filesystem tools to a root.** Resolve any model-supplied path to canonical form and verify it stays within the project root before touching it; reject `..`, symlink escapes, absolute paths outside the root, and encoded traversal. Never call `open`/`unlink`/`writeFile` on a raw path argument.
- **Guard command execution.** If a server exposes shell access, run it isolated (container/VM/restricted user), apply an allow-list of executables, reject shell operators, and set timeouts and resource limits. A blocklist is not sufficient.
- **Cap sizes.** Enforce maximum request and payload sizes before parsing, so a huge or deeply nested input cannot exhaust memory.

### Only load servers you use

Every connected MCP server injects its tool schemas into context and adds a trust relationship. Loading servers "just in case" costs tokens, dilutes tool selection, and enlarges the attack surface.

- **Connect servers per task, not globally.** If a workflow does not need GitHub, do not load the GitHub server for it.
- **Prefer on-demand discovery** (tool search) for large tool libraries over always-loaded schemas.
- **Audit the connected set** the way you audit dependencies: each server is code and credentials you now trust.

## Agent Tool-Scoping

Scoping is deciding, per agent or per session, which tools exist and which run without a human in the loop.

### Read-only vs write

- **Default subagents and exploration to read-only.** A research or exploration agent needs `read`, `glob`, `grep`, `web_search`; it does not need `write`, `edit`, `bash`, or `send_*`. Read-only tools are also parallel-safe, so the harness can fan them out.
- **Grant write and side-effecting tools deliberately**, to the specific agent that needs them, for the specific task.

### Allowlists over blocklists

- **Enumerate what an agent may do, not what it may not.** An allow-list fails safe: a tool nobody thought of is simply absent. A blocklist fails open: the one case you forgot is permitted.
- **Scope at the narrowest useful level.** Prefer per-tool enablement (default off, opt specific tools on) over "all tools minus a few".

### Gate risky and irreversible actions

- **Classify by reversibility.** Reversible, low-blast-radius actions (reads, local edits under version control) can run automatically. Hard-to-reverse actions (external API writes, deletes, sending messages, deploys, financial operations) should require confirmation or a policy check.
- **Use an approval policy or hook as the gate.** Route the risky tool through an "ask" policy that pauses the agent for a human decision, or a pre-execution hook that validates the action against a rule before letting it run. The gate lives in the harness, not the prompt, so a prompt injection cannot talk its way past it.
- **Fail closed.** If the gate cannot evaluate an action (missing policy, ambiguous target), block and surface it rather than allowing by default.
- **Log every side-effecting call** with enough context (tool, arguments summary, actor, outcome) to audit later. Dedicated tools make this straightforward; bash makes it nearly impossible.

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| One `search` tool that could mean three things | Model picks wrong, or thrashes | Split into named, non-overlapping tools |
| Description says what, not when | Under- or over-triggering | Add explicit trigger conditions |
| Bash for a gateable action | Harness cannot intercept or audit | Promote to a dedicated, typed tool |
| Secrets in prompt/args | Persisted in history, readable via replay | Inject at egress or via a managed store |
| Every MCP server loaded globally | Token cost, diluted selection, wide attack surface | Connect per task; use tool search |
| Blocklist of forbidden actions | Fails open on the case you forgot | Allow-list of permitted actions |
| Destructive tool runs automatically | No recovery from a bad call | Gate behind approval/hook; fail closed |
| Raw model-supplied path to `open()` | Path traversal | Canonicalise and confine to root |

## Verification

- [ ] Each tool has a distinct name and a description stating when to call it
- [ ] No two tools overlap enough for the model to confuse them
- [ ] Schemas constrain inputs (enums, types, required, defaults); common misuse is unrepresentable
- [ ] Tool errors return `is_error: true` with actionable, secret-free messages
- [ ] Every HTTP MCP server authenticates and validates inputs server-side
- [ ] Credentials never appear in prompts, messages, or tool arguments
- [ ] MCP scopes are least-privilege; egress hosts are restricted
- [ ] Only the servers a task needs are loaded
- [ ] The agent's tool set is an allow-list, read-only by default where possible
- [ ] Irreversible actions are gated behind approval or a hook, and fail closed

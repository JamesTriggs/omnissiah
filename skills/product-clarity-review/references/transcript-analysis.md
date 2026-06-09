# Transcript Analysis

Use this reference when the question turns on what was said in meetings and whether it was registered as an engineering requirement.

## Goal

Do not merely answer "was it mentioned?" Determine whether the customer/product need moved through the full chain:

```text
customer need -> commercial promise -> verbal discussion -> engineering registration -> acceptance tests -> implementation
```

The common failure mode is not silence. It is a clear conversation that never becomes a buildable requirement.

## Transcript Classification

Classify each relevant moment:

- **Mentioned**: topic appears but no concrete rule is stated.
- **Explained**: customer/product rationale is described.
- **Verbally explicit**: a clear need or rule is stated out loud.
- **Challenged**: someone pushes back, raises feasibility, or proposes a simplification.
- **Agreed**: participants appear to accept the direction.
- **Registered**: someone creates or references a ticket, ADR, decision, acceptance criteria, owner, or follow-up.
- **Deferred**: participants explicitly postpone the decision.
- **Lost**: later implementation proceeds without the verbally stated need.

## What To Extract

For each relevant passage, record:

- Meeting name and date.
- Speaker.
- Short evidence summary.
- The exact product rule implied by the passage.
- Whether engineering acknowledged it.
- Whether a follow-up artifact was created.
- Whether later code/docs match or diverge.

Use short quotes only when necessary. Prefer concise summaries with dates and speaker names.

## Registration Questions

Ask:

- Did anyone repeat the need back in engineering terms?
- Did anyone name the object to build?
- Did anyone state the acceptance test?
- Did anyone capture an owner?
- Did anyone say "we will do X" versus "we could do X"?
- Did anyone push back because of architecture/tooling?
- Was the pushback resolved or simply parked?
- Did the final implementation follow the commercial need or the engineering simplification?

## Output Pattern

Use this language when appropriate:

> The requirement was verbally explicit on [date], but I do not see evidence that it was registered as an engineering requirement. The missing handoff object was [ticket/ADR/policy/acceptance test]. That made it reasonable for Engineering to optimise around [simpler implementation], even though the customer/commercial intent pointed toward [needed behaviour].

## Chronology

Build a compact chronology:

| Date | Meeting/source | What changed | Registration status |
|---:|---|---|---|
| YYYY-MM-DD |  | First mention / explicit statement / pushback / decision / implementation divergence |  |

The strongest answer usually depends on chronology: first mention, clearest verbal statement, strongest pushback, formal decision point, and implementation divergence.

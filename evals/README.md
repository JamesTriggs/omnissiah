# Framework Self-Evaluation

This directory holds the evaluation scaffold the framework uses to measure the
quality of its **own** agents and skills — the routing and behaviour that
omnissiah ships. It answers questions like: "when a user says X, does the right
agent or skill pick it up, and does the response respect that agent's output
contract and least-privilege tools?"

This is deliberately distinct from the user-facing `eval-harness` skill. That
skill helps a user run eval-driven development against **their** application
code. This scaffold evaluates the **framework itself** — a regression guard for
the prompts, descriptions, and routing that make omnissiah work.

## Approach

- **Small golden set.** A representative set of ~15-20 realistic user requests
  (`cases/routing.jsonl`), each paired with the expected routing and the key
  properties the response must (and must not) have. Around 20 cases is enough
  to catch regressions without becoming a maintenance burden — add a case when
  a real routing bug slips through, not speculatively.
- **Grade end-state, not path.** A case passes if the right agent/skill handles
  it and the response has the required properties. There are many valid ways to
  get there; do not assert on the exact sequence of tool calls or reasoning
  steps.
- **LLM-as-judge plus deterministic checks.** Each case is graded two ways:
  1. **Deterministic checks** — cheap, exact assertions the harness can make
     without a model (e.g. the expected agent/skill exists on disk, `must_include`
     substrings are present, `must_not_include` substrings are absent).
  2. **LLM-as-judge** — a model scores the response against `rubric.md` across
     dimensions (correct routing, output-contract adherence, least-privilege
     respected, no fabrication, end-state correctness).
- **Failures feed back into prompt fixes.** A failing case points at a specific
  agent/skill description or system prompt that mis-routed or under-delivered.
  Fix the prompt, re-run, keep the case as a regression guard.

## Files

| File | Purpose |
|------|---------|
| `cases/routing.jsonl` | The golden set — one JSON object per line. |
| `rubric.md` | The LLM-as-judge scoring rubric. |
| `../scripts/ci/validate-evals.js` | Validates the golden set parses, every case has the required fields, and every `expected_agent_or_skill` names a real agent or skill on disk. |

## Case Format (`cases/routing.jsonl`)

One JSON object per line:

```json
{
  "id": "short-stable-id",
  "prompt": "the realistic user request",
  "expected_agent_or_skill": "code-reviewer",
  "must_include": ["substring the response should contain"],
  "must_not_include": ["substring that would indicate a wrong path"],
  "notes": "why this is the expected routing"
}
```

- `expected_agent_or_skill` MUST name a real agent (`agents/<name>.md`) or skill
  (`skills/<name>/`). The validator enforces this.
- `must_include` / `must_not_include` are arrays of case-insensitive substrings
  used by the deterministic checks. Keep them about observable properties of a
  correct response, not incidental wording.

## Running

The deterministic structural check runs in CI:

```bash
node scripts/ci/validate-evals.js
```

The full LLM-as-judge run is invoked by the framework's eval tooling against a
model, scoring each response with `rubric.md`. This scaffold provides the golden
set and rubric; wiring the judge into a runner is left to the eval command.

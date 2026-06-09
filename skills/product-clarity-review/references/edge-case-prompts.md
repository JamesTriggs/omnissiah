# Edge-Case Prompts

Use these prompts to turn commercial language into implementable product rules.

## Billing And Credits

- What is the billing unit: event, case, lifecycle, user, GB, month, source, tenant, or outcome?
- When does a charge become pending?
- When does it become final?
- What reverses it?
- Can the same lifecycle be charged twice?
- What happens after invoice close?
- What happens in trial, overage, renewal, or partner seller-of-record scenarios?
- What is shown to the customer in usage history?
- What does Finance need to reconcile it?
- What does Support need to explain it?

## AI / Human Boundaries

- What counts as human intervention?
- Does read-only review count?
- Does an override count?
- Does admin cleanup count?
- Does human approval before an AI action make the outcome assisted rather than autonomous?
- If the AI gets it wrong and a human fixes it later, is the original outcome still billable?
- If the AI retries after human correction, is that a new charge or the same lifecycle?

## Data Lifecycle

- What object owns the lifecycle rule: tenant, pipeline, source, source group, event type, table, account, integration, or case?
- Can two sources in the same table have different clocks?
- What happens when one source must stay warm and another can move cold?
- Does the data move, copy, fan out, or become queryable through a different surface?
- How are legal hold, customer deletion, and compliance export handled?
- Is pricing based on raw, post-filter, post-edge, compressed, or retained volume?

## State Machines

- List every state and transition.
- Which transitions are customer-visible?
- Which transitions are billable?
- Which transitions are reversible?
- Which transitions require audit?
- Which transitions create a new lifecycle?
- Which transitions are idempotent?
- What happens if events arrive out of order?

## Customer Fairness

- Would the customer feel punished for trusting the automation?
- Would a customer understand the bill without speaking to Engineering?
- Is there a simple sentence Sales can say that remains true after edge cases?
- Does the implementation reward the behaviour the product wants to encourage?

## Abuse And Controls

- Can customers avoid billing by reopening everything?
- Can internal users accidentally reverse real value?
- Are reason codes required?
- Are disputes handled through audit trail or manual spreadsheet?
- Does the rule create incentives to hide failures?

## Acceptance Test Pattern

Write tests as plain scenarios first:

```text
Given [initial state]
When [actor does action]
Then [customer-visible outcome]
And [billing/retention/audit outcome]
```

Do not let implementation start until at least one test covers a reversal, one covers duplicate/retry behaviour, and one covers customer dispute/audit.

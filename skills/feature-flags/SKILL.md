# Feature Flags

Patterns and practices for feature flag management, covering gradual rollout, kill switches, A/B testing for configurable rules, and database migration gating.

## Environment Variable Flags

A simple and reliable mechanism for Python services is environment variable-based feature flags, useful for controlling new feature rollout.

### Naming Convention

A consistent pattern works well: `APP_USE_<FEATURE_NAME>` or `APP_ENABLE_<FEATURE_NAME>`.

| Flag | Service | Purpose |
|------|---------|---------|
| `APP_USE_SQL_MIDDLEWARE` | internal-api | Route queries through the query parser |
| `APP_USE_NEW_RULES_ENGINE` | internal-api | Enable v2 rule processing |
| `APP_ENABLE_STREAMING_EXPORT` | data-loader | Enable real-time event streaming |
| `APP_ENABLE_ENHANCED_LOGGING` | all services | Verbose structured logging |

### Implementation Pattern (Python)

```python
import os

# Feature flag helper with type coercion
def is_feature_enabled(flag_name: str, default: bool = False) -> bool:
    value = os.environ.get(flag_name, str(default)).lower()
    return value in ("true", "1", "yes")

# Usage in application code
if is_feature_enabled("APP_USE_SQL_MIDDLEWARE"):
    result = sql_middleware.execute(query)
else:
    result = legacy_query_executor.execute(query)
```

### Implementation Pattern (C++)

```cpp
// Feature flag from environment variable
bool is_feature_enabled(const std::string& flag_name, bool default_val = false) {
    const char* val = std::getenv(flag_name.c_str());
    if (!val) return default_val;
    std::string s(val);
    std::transform(s.begin(), s.end(), s.begin(), ::tolower);
    return s == "true" || s == "1" || s == "yes";
}

// Usage
if (is_feature_enabled("APP_ENABLE_STREAMING_EXPORT")) {
    streaming_exporter.start();
}
```

### Implementation Pattern (Vue.js / Nuxt)

```typescript
// Runtime config in nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      enableNewDashboard: process.env.APP_ENABLE_NEW_DASHBOARD === 'true',
      enableBetaFeatures: process.env.APP_ENABLE_BETA === 'true',
    },
  },
});

// Usage in components
const config = useRuntimeConfig();
if (config.public.enableNewDashboard) {
  // render new dashboard
}
```

## Configurable Rule Gradual Rollout

Configurable rules can be business-critical. A bad rule causes either false positives (noise and fatigue) or false negatives (missed events). Rollout must be gradual and observable.

### Rollout Stages

```
Stage 1: Shadow Mode (log-only, no alerts)
  -> Stage 2: Canary Tenants (3-5 selected tenants, real alerts)
    -> Stage 3: Percentage Rollout (10% -> 25% -> 50% -> 100%)
      -> Stage 4: General Availability (remove flag)
```

### Shadow Mode Implementation

```python
class Rule:
    def __init__(self, rule_id: str, rollout_stage: str = "shadow"):
        self.rule_id = rule_id
        self.rollout_stage = rollout_stage  # shadow | canary | percentage | ga

    def evaluate(self, event: AppEvent, tenant_id: int) -> RuleResult:
        result = self._run_rule_logic(event)

        if self.rollout_stage == "shadow":
            # Log the result but do not take action
            logger.info("rule.shadow_match",
                        rule_id=self.rule_id, tenant_id=tenant_id,
                        would_have_fired=result.matched)
            return RuleResult(matched=False, shadow=True)

        if self.rollout_stage == "canary":
            if tenant_id not in self._get_canary_tenants():
                return RuleResult(matched=False, shadow=True)

        if self.rollout_stage == "percentage":
            if not self._in_rollout_percentage(tenant_id):
                return RuleResult(matched=False, shadow=True)

        return result
```

### Canary Tenant Configuration

```python
# Canary tenants are configured per-rule in the database
CANARY_TENANT_CONFIG = {
    "rule_high_value_order_v2": {
        "canary_tenants": [1001, 1042, 1107],  # Friendly customers who opted in
        "start_date": "2024-12-01",
        "metrics_dashboard": "https://grafana.internal/d/canary-rules",
    }
}
```

### Percentage Rollout

```python
def _in_rollout_percentage(self, tenant_id: int) -> bool:
    """Deterministic percentage rollout based on tenant_id hash."""
    rollout_pct = self._get_rollout_percentage()  # 0-100 from config
    hash_val = hashlib.md5(f"{self.rule_id}:{tenant_id}".encode()).hexdigest()
    bucket = int(hash_val[:8], 16) % 100
    return bucket < rollout_pct
```

### Kill Switch

Every rule has an instant kill switch. When activated, the rule stops evaluating immediately across all tenants.

```python
# Kill switch check (Redis-backed for instant propagation)
def is_rule_killed(rule_id: str) -> bool:
    return redis_client.exists(f"killswitch:rule:{rule_id}")

def kill_rule(rule_id: str, reason: str, killed_by: str):
    redis_client.set(f"killswitch:rule:{rule_id}", json.dumps({
        "reason": reason,
        "killed_by": killed_by,
        "killed_at": datetime.utcnow().isoformat(),
    }))
    logger.critical("rule.killed", rule_id=rule_id, reason=reason)
    # Alert the team
    notify_slack(f"KILL SWITCH: Rule {rule_id} disabled by {killed_by}: {reason}")
```

## A/B Testing for Rules

When two rule approaches exist, A/B test them to compare false positive rates and coverage.

```python
class RuleABTest:
    def __init__(self, test_id: str, rule_a: Rule, rule_b: Rule,
                 traffic_split: float = 0.5):
        self.test_id = test_id
        self.rule_a = rule_a
        self.rule_b = rule_b
        self.traffic_split = traffic_split

    def evaluate(self, event: AppEvent, tenant_id: int):
        # Both rules always evaluate (for metrics), but only one takes action
        result_a = self.rule_a._run_rule_logic(event)
        result_b = self.rule_b._run_rule_logic(event)

        # Deterministic assignment
        in_group_a = self._assign_group(tenant_id) < self.traffic_split

        # Log both results for comparison
        logger.info("rule.ab_test",
                    test_id=self.test_id, tenant_id=tenant_id,
                    rule_a_matched=result_a.matched, rule_b_matched=result_b.matched,
                    active_rule="a" if in_group_a else "b")

        return result_a if in_group_a else result_b
```

## Database Migration Feature Flags

Gate database migrations behind flags when the migration is risky or requires coordination.

### Pattern: Migration + Flag + Code

```
Step 1: Deploy migration (adds new column, nullable)
Step 2: Deploy code with flag OFF (reads old column)
Step 3: Run backfill job
Step 4: Enable flag (code reads new column)
Step 5: Deploy cleanup (remove old column reads)
Step 6: Deploy migration (drop old column)
```

### Analytics Database Migration Flag Example

```python
# Feature flag controls which analytics table version is queried
if is_feature_enabled("APP_USE_EVENTS_V2_TABLE"):
    table = "events_v2"  # New optimized schema
else:
    table = "events"      # Legacy schema

query = f"SELECT * FROM {table} PREWHERE tenant_id = {{tenant_id}}"
```

## API Versioning Strategy

Use feature flags to control API version rollout alongside URL-based versioning.

```python
# URL-based versioning for external API
@router.get("/v2/events")
async def get_events_v2(tenant_id: int = Depends(get_tenant)):
    # v2 always uses the new event format
    return await event_service.get_events(tenant_id, format="v2")

# Feature-flag-based for internal API during migration
@app.route("/api/events")
def get_events():
    if is_feature_enabled("APP_USE_EVENT_V2_FORMAT"):
        return event_service.get_v2(tenant_id)
    return event_service.get_v1(tenant_id)
```

## Rollback Procedures

### Immediate Rollback (Flag Flip)

For feature-flagged changes, rollback is instant:

```bash
# Kubernetes: update environment variable
kubectl set env deployment/internal-api APP_USE_SQL_MIDDLEWARE=false

# ECS/Fargate: update task definition environment
aws ecs update-service --cluster app --service internal-api --force-new-deployment
```

### Staged Rollback

For percentage rollouts, reduce gradually:

```
100% -> 50% -> 25% -> 10% -> 0% (with monitoring between each step)
```

### Post-Rollback Checklist

- [ ] Feature flag set to off in all environments
- [ ] Verify error rates returned to baseline
- [ ] Verify no tenant data inconsistency from partial rollout
- [ ] Create incident ticket with root cause
- [ ] Update rollout plan with lessons learned
- [ ] Schedule fix and re-rollout

## Flag Lifecycle Management

Feature flags are technical debt. Every flag must have an expiry plan.

| Stage | Action |
|-------|--------|
| Created | Document purpose, owner, and target removal date |
| Active | Monitor metrics, adjust rollout percentage |
| 100% Rolled Out | Bake for 2 weeks with flag on |
| Cleanup | Remove flag checks from code, remove environment variable |
| Archived | Document outcome in ADR |

**Quarterly flag audit**: Review all active flags. Any flag older than 90 days at 100% rollout must be cleaned up or have a documented exception.

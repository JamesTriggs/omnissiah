---
name: operational-excellence
description: Operational procedures, incident response, on-call playbooks, deployment strategies, and reliability patterns for production services. Use when running operations, writing or following runbooks, responding to incidents, defining SLOs, staffing on-call, planning rollbacks, or improving reliability. Triggers include operations, runbooks, incidents, SLO, on-call, reliability.
---

# Operational Excellence

Operational procedures, incident response, deployment strategies, and reliability patterns for a platform running on a container orchestrator (examples use AWS Fargate, but the patterns apply to any orchestrator).

## Incident Response Procedures

### Severity Classification

| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|---------|
| **P1 - Critical** | Platform unavailable or data breach risk | 15 min page, immediate response | Analytics database cluster down, tenant data leak, all processing stopped |
| **P2 - Major** | Significant feature degraded | 30 min page | API error rate >5%, data-loader 10min+ behind, partial processing failure |
| **P3 - Minor** | Non-critical degradation | Next business day | Slow dashboard loads, individual query timeouts, non-critical background task failure |
| **P4 - Low** | Cosmetic or minor inconvenience | Backlog | UI rendering glitch, log formatting issue |

### Incident Response Workflow

```
1. DETECT  -> Alert fires (Datadog/PagerDuty)
2. TRIAGE  -> On-call classifies severity, creates incident channel
3. CONTAIN -> Stop the bleeding (kill switch, rollback, failover)
4. DIAGNOSE -> Identify root cause using logs, metrics, traces
5. RESOLVE -> Apply fix, verify resolution
6. RECOVER -> Restore full service, clear backlogs
7. REVIEW  -> Post-incident review within 48 hours
```

### Incident Commander Checklist

```markdown
## Incident: [INC-YYYY-NNNN]
## Severity: [P1/P2/P3]
## Started: [timestamp]
## Commander: [name]

### Timeline
- [HH:MM] Alert received: [description]
- [HH:MM] Incident declared, severity assigned
- [HH:MM] [action taken]
- [HH:MM] Resolution confirmed
- [HH:MM] Incident closed

### Communication
- [ ] Incident Slack channel created (#inc-YYYY-NNNN)
- [ ] Stakeholders notified (engineering lead, product, customer success)
- [ ] Customer communication sent (if external-facing)
- [ ] Status page updated (if applicable)

### Actions
- [ ] Root cause identified
- [ ] Fix deployed and verified
- [ ] Backlog cleared (if data processing was paused)
- [ ] Post-incident review scheduled
```

## On-Call Playbooks

### Playbook: Analytics Database Cluster Degraded

**Symptoms**: Slow queries, connection timeouts, high memory on analytics database nodes. Commands below use a columnar-store CLI (`analytics-cli`) as the example.

```bash
# 1. Check cluster health
analytics-cli --query "SELECT * FROM system.clusters"
analytics-cli --query "SELECT * FROM system.replicas WHERE is_leader = 0 AND absolute_delay > 300"

# 2. Check running queries
analytics-cli --query "SELECT query_id, elapsed, read_rows, memory_usage, query
  FROM system.processes ORDER BY elapsed DESC LIMIT 20"

# 3. Kill long-running queries if needed
analytics-cli --query "KILL QUERY WHERE elapsed > 300 AND user != 'system'"

# 4. Check disk usage
analytics-cli --query "SELECT name, path, free_space, total_space,
  round(free_space/total_space * 100, 2) as free_pct FROM system.disks"

# 5. Check merge queue (high merge backlog = degraded writes)
analytics-cli --query "SELECT database, table, count() as merges,
  sum(rows_read) as total_rows FROM system.merges GROUP BY database, table"
```

**Resolution priority**: Kill runaway queries > Clear merge backlog > Add capacity.

### Playbook: Data-Loader Lag

**Symptoms**: `app.dataloader.lag` metric exceeds 60 seconds.

```bash
# 1. Check data-loader process health
docker ps | grep data-loader
docker logs --tail 100 data-loader

# 2. Check Kafka consumer lag
kafka-consumer-groups --bootstrap-server $KAFKA_BROKER \
  --describe --group app-dataloader

# 3. Check analytics database insert throughput
analytics-cli --query "SELECT event_time, written_rows, written_bytes
  FROM system.query_log WHERE type = 'QueryFinish' AND query LIKE 'INSERT%'
  AND event_time > now() - INTERVAL 10 MINUTE ORDER BY event_time DESC"

# 4. Check backpressure state
docker exec data-loader cat /var/run/app/dataloader.status
```

**Resolution**: If the analytics database is healthy, restart the data loader. If it is overloaded, reduce batch size temporarily and address the database issues first.

### Playbook: API Error Rate Spike

**Symptoms**: `app.api.error.count` 5xx rate exceeds 5%.

```bash
# 1. Check which endpoints are failing
# Query your metrics backend: app.api.request.count{status:5*} by {endpoint}

# 2. Check recent deployments
aws ecs describe-services --cluster app --services internal-api \
  --query 'services[0].deployments'

# 3. Check application logs
aws logs tail /ecs/app/internal-api --since 10m --filter-pattern "ERROR"

# 4. Check downstream dependencies
curl -s http://internal-api:8002/health | jq .

# 5. If recent deployment caused it, rollback
aws ecs update-service --cluster app --service internal-api \
  --task-definition internal-api:PREVIOUS_VERSION --force-new-deployment
```

## Canary Deployment Patterns (Blue/Green)

### Deployment Strategy

A common approach is blue/green deployment on a container orchestrator with weighted target group routing (example uses AWS Fargate).

```
Step 1: Deploy new version as "green" task set (0% traffic)
Step 2: Route 5% traffic to green (canary)
Step 3: Monitor metrics for 10 minutes
Step 4: If healthy, increase to 25% -> 50% -> 100%
Step 5: Drain and decommission "blue" task set
```

### Automated Canary Checks

```python
# Post-deployment health verification
def canary_health_check(service_name: str, green_target_group: str) -> bool:
    checks = {
        "health_endpoint": check_health_endpoint(green_target_group),
        "error_rate": check_error_rate(service_name, threshold=0.02),
        "latency_p99": check_latency_p99(service_name, threshold_ms=3000),
        "active_connections": check_active_connections(green_target_group),
    }

    for check_name, passed in checks.items():
        if not passed:
            logger.error("canary.check_failed", check=check_name, service=service_name)
            return False

    logger.info("canary.all_checks_passed", service=service_name)
    return True
```

### Rollback Trigger

```python
# Automatic rollback if canary fails
def deploy_with_canary(service: str, new_task_def: str):
    deploy_green(service, new_task_def)
    set_traffic_weight(service, green=5, blue=95)

    for minute in range(10):
        time.sleep(60)
        if not canary_health_check(service, green_target_group):
            logger.critical("canary.rollback_triggered", service=service, minute=minute)
            set_traffic_weight(service, green=0, blue=100)
            tear_down_green(service)
            notify_team(f"Canary rollback for {service} at minute {minute}")
            return False

    # Progressive rollout
    for weight in [25, 50, 100]:
        set_traffic_weight(service, green=weight, blue=100 - weight)
        time.sleep(300)  # 5 minutes between steps
        if not canary_health_check(service, green_target_group):
            rollback(service)
            return False

    tear_down_blue(service)
    return True
```

## Circuit Breaker Patterns

### Python Circuit Breaker (Inter-Service Calls)

```python
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject calls
    HALF_OPEN = "half_open"  # Testing recovery

class CircuitBreaker:
    def __init__(self, service_name: str, failure_threshold: int = 5,
                 recovery_timeout: int = 30):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.state = CircuitState.CLOSED
        self.last_failure_time = 0

    def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
            else:
                raise CircuitBreakerOpenError(
                    f"Circuit breaker open for {self.service_name}")

        try:
            result = func(*args, **kwargs)
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                logger.error("circuit_breaker.opened",
                             service=self.service_name,
                             failures=self.failure_count)
            raise

# Usage
public_api_breaker = CircuitBreaker("public-api", failure_threshold=5)

def get_tenant_data(tenant_id: int):
    return public_api_breaker.call(
        requests.get, f"http://public-api/v1/tenant/{tenant_id}/data",
        timeout=5)
```

## Health Check Monitoring

### Synthetic Health Monitoring

```python
# External health checker runs every 30 seconds from multiple regions
SERVICES = {
    "internal-api": "https://api.example.com/health",
    "public-api": "https://public-api.example.com/health",
    "ui": "https://app.example.com/health",
}

def check_all_services():
    for name, url in SERVICES.items():
        try:
            resp = requests.get(url, timeout=10)
            healthy = resp.status_code == 200
            statsd.gauge(f"app.synthetic.{name}.healthy", 1 if healthy else 0)
            statsd.histogram(f"app.synthetic.{name}.latency", resp.elapsed.total_seconds())
        except Exception:
            statsd.gauge(f"app.synthetic.{name}.healthy", 0)
```

## Analytics Database Cluster Health Monitoring

### Automated Health Dashboard Queries

The queries below use `system.*`-style system tables as the example. Adapt them to your analytics database.

```sql
-- Replication lag across cluster
SELECT database, table, replica_name, absolute_delay,
  queue_size, inserts_in_queue, merges_in_queue
FROM system.replicas
WHERE absolute_delay > 60 OR queue_size > 100;

-- Table sizes and growth rate
SELECT database, table,
  formatReadableSize(sum(bytes_on_disk)) as disk_size,
  sum(rows) as total_rows,
  max(modification_time) as last_modified
FROM system.parts
WHERE active AND database = 'app'
GROUP BY database, table
ORDER BY sum(bytes_on_disk) DESC;

-- Partition health (detect unmerged partitions)
SELECT database, table, partition, count() as parts,
  sum(rows) as total_rows, formatReadableSize(sum(bytes_on_disk)) as size
FROM system.parts WHERE active AND database = 'app'
GROUP BY database, table, partition
HAVING count() > 20
ORDER BY count() DESC;
```

## Database Backup and Recovery

### Analytics Database Backup

```bash
# Automated daily backup to object storage (analytics backup tool)
analytics-backup create --tables="app.*" daily_$(date +%Y%m%d)
analytics-backup upload daily_$(date +%Y%m%d)

# Verify backup integrity
analytics-backup list remote
analytics-backup download daily_$(date +%Y%m%d) --check

# Restore from backup
analytics-backup download daily_$(date +%Y%m%d)
analytics-backup restore daily_$(date +%Y%m%d) --tables="app.events"
```

### MySQL Backup

```bash
# Automated backup with mysqldump
mysqldump --single-transaction --routines --triggers \
  --databases app > /backups/app_$(date +%Y%m%d).sql

# Point-in-time recovery using binlog
mysqlbinlog --start-datetime="2024-12-15 10:00:00" \
  --stop-datetime="2024-12-15 11:00:00" mysql-bin.000042 | mysql app
```

## Deployment Rollback Procedures

### Immediate Rollback (ECS/Fargate)

```bash
# Get the previous task definition revision
PREV_REV=$(aws ecs describe-services --cluster app --services $SERVICE \
  --query 'services[0].deployments[?status==`ACTIVE`].taskDefinition' --output text)

# Rollback to previous version
aws ecs update-service --cluster app --service $SERVICE \
  --task-definition $PREV_REV --force-new-deployment

# Monitor rollback progress
aws ecs wait services-stable --cluster app --services $SERVICE
```

### Database Rollback

```bash
# MySQL: Alembic downgrade
cd internal-api/
alembic downgrade -1  # Revert last migration

# Analytics database: Apply reverse migration
cd db-migrator/
python migrate.py --target PREVIOUS_VERSION
```

## Post-Incident Review Template

```markdown
## Post-Incident Review: [INC-YYYY-NNNN]
## Date: [date]
## Severity: [P1/P2/P3]
## Duration: [start] to [end] ([total minutes])
## Author: [name]

### Summary
[1-2 sentence description of what happened and impact]

### Impact
- **Users affected**: [number/percentage of tenants]
- **Data impact**: [any data loss or corruption]
- **Duration of impact**: [minutes]
- **Financial impact**: [if applicable]

### Timeline
| Time (UTC) | Event |
|-----------|-------|
| HH:MM | [First symptom observed] |
| HH:MM | [Alert fired] |
| HH:MM | [Incident declared] |
| HH:MM | [Root cause identified] |
| HH:MM | [Fix deployed] |
| HH:MM | [Service fully recovered] |

### Root Cause
[Detailed technical explanation of what went wrong and why]

### What Went Well
- [Thing that worked during incident response]
- [Thing that worked during incident response]

### What Could Be Improved
- [Gap in monitoring/alerting]
- [Process improvement]

### Action Items
| Action | Owner | Priority | Deadline |
|--------|-------|----------|----------|
| [Specific action] | [name] | [P1/P2/P3] | [date] |
| [Specific action] | [name] | [P1/P2/P3] | [date] |

### Detectability Improvement
- Could we have detected this sooner? [yes/no, how]
- Are there new alerts we should add?
- Are there runbooks we should create or update?

### Prevention
- What change would prevent this class of incident entirely?
- Is there a systemic improvement that addresses the root cause?
```

All operational procedures must be tested periodically. Schedule quarterly game days to practice incident response, failover, and recovery procedures. Keep runbooks updated as the platform evolves.

# Observability Patterns

Comprehensive observability skill covering structured logging, metrics, health checks, distributed tracing, alerting, and incident response logging across a polyglot platform.

## Structured Logging

### Python Services (structlog)

Python services use `structlog` for structured JSON logging. Every log entry should include `tenant_id` (where applicable), `request_id`, and `service_name`.

**Standard logger setup (Flask / FastAPI):**

```python
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()
```

**Per-request context binding (middleware):**

```python
# Flask middleware
@app.before_request
def bind_log_context():
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request.headers.get("X-Request-Id", str(uuid.uuid4())),
        tenant_id=get_tenant_id_from_jwt(),
        service="internal-api",
        endpoint=request.endpoint,
        method=request.method,
    )
```

**Logging conventions:**
- Use `logger.info()` for business events (ticket created, rule triggered).
- Use `logger.warning()` for degraded states (slow query, cache miss fallback).
- Use `logger.error()` for failures requiring attention (database connection lost, auth failure).
- Always include the entity type and ID: `logger.info("ticket.created", ticket_id=ticket_id, priority=priority)`.
- Never log raw credentials, tokens, or PII. Use `logger.info("user.login", user_id=user_id)` not `logger.info("user.login", email=email)`.

### C++ Services (spdlog)

C++ services use `spdlog` with JSON formatting for consistency with the Python services.

**Standard setup:**

```cpp
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/sinks/rotating_file_sink.h>

void init_logging(const std::string& service_name) {
    auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
    auto file_sink = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
        "/var/log/app/" + service_name + ".log", 100 * 1024 * 1024, 5);

    auto logger = std::make_shared<spdlog::logger>(
        service_name, spdlog::sinks_init_list{console_sink, file_sink});

    // JSON pattern: {"time":"...","level":"...","service":"...","msg":"..."}
    logger->set_pattern(R"({"time":"%Y-%m-%dT%H:%M:%S.%eZ","level":"%l","service":")" +
                        service_name + R"(","msg":"%v"})");
    spdlog::set_default_logger(logger);
    spdlog::set_level(spdlog::level::info);
}
```

**Thread-safe context for request_id and tenant_id:**

```cpp
// Thread-local log context
thread_local std::string tl_request_id;
thread_local uint64_t tl_tenant_id = 0;

#define LOG_CTX(fmt, ...) \
    spdlog::info("{{\"request_id\":\"{}\",\"tenant_id\":{},\"detail\":" fmt "}}", \
                 tl_request_id, tl_tenant_id, ##__VA_ARGS__)
```

### Vue.js Frontend (console wrapper)

The frontend uses a structured console wrapper that sends log events to the backend for aggregation.

```typescript
// composables/useLogger.ts
interface LogContext {
  component: string;
  tenant_id?: string;
  request_id?: string;
}

export function useLogger(component: string) {
  const authStore = useAuthStore();

  const ctx: LogContext = {
    component,
    tenant_id: authStore.tenantId,
  };

  return {
    info: (event: string, data?: Record<string, unknown>) =>
      console.info(JSON.stringify({ ...ctx, event, ...data, level: "info" })),
    warn: (event: string, data?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ ...ctx, event, ...data, level: "warn" })),
    error: (event: string, error?: Error, data?: Record<string, unknown>) =>
      console.error(JSON.stringify({
        ...ctx, event, ...data, level: "error",
        error_message: error?.message, stack: error?.stack,
      })),
  };
}
```

## Metrics (StatsD / Datadog)

### Standard Metric Names

Follow the naming convention: `app.<service>.<category>.<metric>`.

| Metric | Type | Description |
|--------|------|-------------|
| `app.api.request.duration` | histogram | API response time (ms) |
| `app.api.request.count` | counter | Request count by endpoint and status |
| `app.api.error.count` | counter | Error count by type |
| `app.analytics.query.duration` | histogram | Analytics query time |
| `app.analytics.query.rows` | histogram | Rows scanned per query |
| `app.dataloader.batch.size` | histogram | Batch insertion size |
| `app.dataloader.throughput` | gauge | Events processed per second |
| `app.celery.task.duration` | histogram | Background task duration |
| `app.rule.trigger.count` | counter | Rule matches by rule |
| `app.cache.hit_rate` | gauge | Redis cache hit percentage |

### Python Metrics (datadog-statsd)

```python
from datadog import statsd

# Request duration middleware
@app.after_request
def record_metrics(response):
    duration = (time.monotonic() - g.start_time) * 1000
    statsd.histogram("app.api.request.duration", duration,
                     tags=[f"endpoint:{request.endpoint}", f"status:{response.status_code}"])
    statsd.increment("app.api.request.count",
                     tags=[f"endpoint:{request.endpoint}", f"status:{response.status_code}"])
    return response
```

### C++ Metrics

```cpp
// Lightweight StatsD client for C++ services
class MetricsClient {
public:
    void histogram(const std::string& name, double value,
                   const std::vector<std::string>& tags = {});
    void increment(const std::string& name,
                   const std::vector<std::string>& tags = {});
    void gauge(const std::string& name, double value,
               const std::vector<std::string>& tags = {});
};

// Usage in the data loader
metrics.histogram("app.dataloader.batch.size", batch.size(),
                  {"table:" + table_name});
metrics.gauge("app.dataloader.throughput", events_per_second);
```

## Health Checks

### Flask Health Endpoint (internal-api)

```python
@app.route("/health")
def health_check():
    checks = {
        "mysql": check_mysql_connection(),
        "analytics_db": check_analytics_db_connection(),
        "redis": check_redis_connection(),
        "celery": check_celery_workers(),
    }
    status = "healthy" if all(c["ok"] for c in checks.values()) else "degraded"
    code = 200 if status == "healthy" else 503
    return jsonify({"status": status, "checks": checks, "version": APP_VERSION}), code

@app.route("/health/ready")
def readiness_check():
    """Kubernetes readiness - can this instance serve traffic?"""
    if not db_migrations_current():
        return jsonify({"ready": False, "reason": "migrations_pending"}), 503
    return jsonify({"ready": True}), 200

@app.route("/health/live")
def liveness_check():
    """Kubernetes liveness - is this process alive?"""
    return jsonify({"alive": True}), 200
```

### FastAPI Health Endpoint (public-api)

```python
@router.get("/health")
async def health():
    checks = await asyncio.gather(
        check_db(), check_cache(), check_upstream_apis(),
        return_exceptions=True,
    )
    # Return structured health with dependency status
```

### C++ Heartbeat (data-loader)

```cpp
// Background thread that writes heartbeat to a well-known file
void heartbeat_loop(std::atomic<bool>& running) {
    while (running.load()) {
        std::ofstream hb("/var/run/app/dataloader.heartbeat");
        hb << std::chrono::system_clock::now().time_since_epoch().count();
        hb.close();
        std::this_thread::sleep_for(std::chrono::seconds(10));
    }
}
```

### Docker HEALTHCHECK

```dockerfile
# Python services
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8002/health/live || exit 1

# C++ services
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD test $(( $(date +%s) - $(cat /var/run/app/dataloader.heartbeat) )) -lt 60 || exit 1
```

## Distributed Tracing

### Request ID Propagation

Every request entering the platform receives a `request_id` (UUID v4) that propagates across all service calls.

**Propagation chain:**
```
Browser (X-Request-Id header)
  -> Nuxt API proxy (forwards header)
    -> Flask/FastAPI (binds to log context, passes to DB queries)
      -> Celery tasks (request_id in task kwargs)
      -> Analytics queries (request_id in query comments)
      -> Inter-service HTTP calls (X-Request-Id header)
```

**Analytics query tagging:**

```python
# Include request_id as a SQL comment for query log correlation
query = f"/* request_id={request_id} tenant_id={tenant_id} */ SELECT ..."
```

**Celery task propagation:**

```python
@shared_task(bind=True)
def process_event(self, tenant_id: int, event_id: str, request_id: str):
    structlog.contextvars.bind_contextvars(
        request_id=request_id, tenant_id=tenant_id, task_id=self.request.id,
    )
    logger.info("event.processing_started", event_id=event_id)
```

## Alerting Thresholds

### Standard Alert Definitions

| Alert | Condition | Severity | Response |
|-------|-----------|----------|----------|
| API error rate | >5% of requests return 5xx over 5 min | P2 | Page on-call |
| API latency | p99 > 5s over 5 min | P3 | Slack notification |
| Analytics query time | p95 > 10s over 10 min | P2 | Page on-call |
| Data-loader lag | >60s behind real-time | P1 | Page on-call + escalate |
| Disk usage | >80% on any analytics database node | P3 | Slack notification |
| Health check failure | Any dependency unhealthy for >2 min | P2 | Page on-call |
| Processing backlog | >10,000 pending events | P2 | Page on-call |
| Certificate expiry | <14 days until expiry | P3 | Slack notification |

## Analytics Query Performance Monitoring

### Query Log Analysis

The example below queries a `system.query_log`-style system table. Adapt it to your analytics database's query-log facility.

```sql
-- Find slow queries per tenant (run periodically)
SELECT
    tenant_id,
    query_duration_ms,
    read_rows,
    read_bytes,
    result_rows,
    substring(query, 1, 200) AS query_preview
FROM system.query_log
WHERE event_time > now() - INTERVAL 1 HOUR
  AND query_duration_ms > 5000
  AND type = 'QueryFinish'
ORDER BY query_duration_ms DESC
LIMIT 50;
```

### Key Performance Indicators

- **Query duration p95**: Target < 2 seconds for interactive queries.
- **Rows scanned per query**: Flag queries scanning > 10M rows.
- **Memory per query**: Alert if peak_memory_usage > 1GB.
- **Concurrent queries**: Alert if > 50 concurrent queries on a single node.

## Incident Response Logging

During incidents, structured logging enables rapid investigation:

```python
# Incident correlation: bind incident_id to all logs during investigation
logger.warning("incident.declared",
    incident_id="INC-2024-0142",
    severity="P1",
    description="analytics database cluster degraded",
    affected_tenants=count_affected_tenants(),
)

# Timeline reconstruction query
# grep request_id=<id> across all service logs
# or query centralized log aggregator with:
# service:* AND request_id:<id> AND timestamp:[start TO end]
```

**Log retention policy:**
- Hot storage (Elasticsearch/Datadog): 30 days
- Warm storage (S3): 90 days
- Cold archive: 1 year (compliance requirement)

All observability patterns must be applied consistently across services. When adding a new service or endpoint, verify that logging, metrics, health checks, and tracing are configured before the PR is merged.

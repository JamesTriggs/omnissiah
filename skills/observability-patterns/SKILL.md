---
name: observability-patterns
description: Instrument services for observability using OpenTelemetry as the vendor-neutral standard, covering traces, metrics, logs, semantic conventions, and OTLP export, plus health checks and alerting. Use when adding logging, metrics, or tracing to a service, wiring up OpenTelemetry, correlating requests across services, or defining alert thresholds. Triggers include observability, logging, metrics, tracing, opentelemetry, otel.
---

# Observability Patterns

Comprehensive observability skill covering structured logging, metrics, health checks, distributed tracing, alerting, and incident response logging across a polyglot platform.

## OpenTelemetry First

**OpenTelemetry (OTel) is the current industry standard for observability and the default this skill assumes.** It is a vendor-neutral, CNCF specification plus a set of SDKs that produce the three signals — traces, metrics, and logs — in one consistent model, then export them over a single wire protocol (OTLP) to any backend. Instrument once against the OTel API; choose or swap the backend later. The Datadog/StatsD examples further down are shown as *one* possible backend, not the default.

### The three signals

- **Traces** — a trace is a tree of spans following one request across services. Each span has a name, start/end time, status, and attributes; child spans nest under parents. Traces answer "where did the time go and where did it fail" across a distributed call path. This subsumes the ad-hoc request-ID propagation described later — with OTel, trace context propagation is built in.
- **Metrics** — numeric measurements over time: counters (monotonic totals), up/down counters, gauges (point-in-time values), and histograms (distributions, for latency and sizes). This is the OTel-native replacement for hand-rolled StatsD calls.
- **Logs** — structured, timestamped records. OTel correlates logs with the active trace by stamping `trace_id` and `span_id` onto each record, so a log line links directly to the span that emitted it.

### Semantic conventions

OTel defines **semantic conventions**: standard names for common attributes so telemetry is portable and queryable regardless of language or backend. Prefer them over bespoke keys:

- HTTP: `http.request.method`, `http.response.status_code`, `url.path`, `server.address`
- RPC/DB: `rpc.system`, `db.system`, `db.query.text`, `db.operation.name`
- General: `service.name`, `service.version`, `deployment.environment.name`

Set resource attributes (`service.name`, `service.version`, `deployment.environment.name`) once per process; they attach to every span, metric, and log the service emits. Reserve custom attribute names for genuinely domain-specific fields (`tenant_id`, `rule_id`) and namespace them consistently.

### OTLP export and the Collector

Instrumented services export over **OTLP** (OpenTelemetry Protocol, gRPC or HTTP) to either a backend directly or, preferably, to an **OpenTelemetry Collector**. The Collector is a standalone process that receives, batches, processes (redaction, sampling, attribute enrichment), and fans out telemetry to one or more backends. Routing through a Collector means the application never hard-codes a vendor: point the Collector's exporter at Datadog, Prometheus + Tempo + Loki, an OTLP-native SaaS, or several at once, and change destinations without touching service code.

```python
# Python — OTel SDK: tracer + OTLP export (backend-agnostic)
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

resource = Resource.create({
    "service.name": "internal-api",
    "service.version": APP_VERSION,
    "deployment.environment.name": ENV,
})
provider = TracerProvider(resource=resource)
# Exports to a Collector (or any OTLP endpoint); the backend is a Collector concern
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=OTLP_ENDPOINT)))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

@app.route("/events")
def get_events():
    with tracer.start_as_current_span("get_events") as span:
        span.set_attribute("tenant_id", get_tenant_id_from_jwt())
        span.set_attribute("http.request.method", "GET")
        return query_events()
```

```python
# Python — OTel metrics (counter + histogram), OTLP export
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

reader = PeriodicExportingMetricReader(OTLPMetricExporter(endpoint=OTLP_ENDPOINT))
metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[reader]))
meter = metrics.get_meter(__name__)

request_duration = meter.create_histogram(
    "http.server.request.duration", unit="ms", description="API response time")
request_count = meter.create_counter(
    "http.server.request.count", description="Request count")

# In a request handler / middleware:
request_duration.record(duration_ms, {"http.route": route, "http.response.status_code": status})
request_count.add(1, {"http.route": route, "http.response.status_code": status})
```

**Auto-instrumentation** covers common frameworks and clients (Flask, FastAPI, SQLAlchemy, HTTP clients, Celery, gRPC) with little or no code change — enable it first, then add manual spans and custom metrics only where the framework instrumentation is not enough. Language support is broad (Python, JS/TS, Go, Java, C++, and more), so a polyglot platform gets one consistent model across services.

### Choosing a backend

Because export is standardised, the backend is a deployment decision, not an instrumentation one:

- **Self-hosted open source**: Prometheus (metrics), Tempo/Jaeger (traces), Loki (logs), Grafana (visualisation).
- **OTLP-native SaaS**: Grafana Cloud, Honeycomb, and similar accept OTLP directly.
- **Vendor agents**: Datadog, New Relic, and others ingest OTLP or run their own agent. The StatsD/Datadog code below is an example of this last category — valid, but one option among many, not the baseline.

## Structured Logging

Structured logs are one of the three OTel signals. Emit them as JSON (as below) and, where OTel logging is wired up, let the SDK stamp `trace_id`/`span_id` onto each record so a log line links to the span that produced it. The `structlog`/`spdlog` setups below produce the JSON records; OTLP export (via the log SDK or the Collector) ships them to the same backend as traces and metrics.

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

## Metrics (backend example: StatsD / Datadog)

The examples in this section use a StatsD/Datadog client to show a concrete backend. In new code, prefer emitting metrics through the OTel metrics API (see OpenTelemetry First above) and exporting via OTLP; the metric names and tag conventions below carry over directly as OTel instrument names and attributes. Treat this section as "how it looks against one specific backend", not as the recommended default.

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

**Prefer OpenTelemetry trace context propagation (see OpenTelemetry First above).** With OTel, a `trace_id`/`span_id` is created at the edge and propagated automatically across HTTP, gRPC, and messaging via the W3C `traceparent` header — you get a full span tree without hand-threading an ID. The manual `request_id` propagation described below predates OTel adoption; it remains a valid lightweight fallback where OTel is not yet wired up, and the `request_id` can be carried as a span attribute (or derived from the trace ID) so the two coexist during migration.

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

All observability patterns must be applied consistently across services. When adding a new service or endpoint, verify that logging, metrics, health checks, and tracing are configured before the PR is merged. For new services, instrument against the OpenTelemetry API and export via OTLP (to a Collector) rather than wiring directly to a specific vendor SDK, so the backend stays a swappable deployment choice.

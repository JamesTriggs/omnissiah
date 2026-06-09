---
description: Comprehensive Python code review for APIs and services. Covers PEP 8 compliance, type hints, security, database patterns, serialized-schema bindings, and Pythonic idioms.
---

# Python Code Review

This command performs comprehensive Python-specific code review for Python services such as Flask and FastAPI APIs, query parsers, and migration tooling.

## What This Command Does

1. **Identify Python Changes**: Find modified `.py` files via `git diff`
2. **Run Static Analysis**: Execute `ruff`, `mypy`, `bandit`
3. **Security Scan**: Check for SQL injection, command injection, unsafe deserialization
4. **Type Safety Review**: Analyze type hints and mypy errors
5. **Pythonic Code Check**: Verify code follows PEP 8 and Python best practices
6. **Pattern Review**: Check database client usage, background tasks, audit logging, query middleware
7. **Generate Report**: Categorize issues by severity

## When to Use

Use `/python-review` when:
- After writing or modifying Python code in any service
- Before committing Python changes
- Reviewing pull requests with Python code
- Working on database query handlers or query middleware
- Modifying serialized-schema bindings or data model integration
- Adding new API endpoints or background tasks
- Changing authentication or authorization logic

## Review Categories

### CRITICAL (Must Fix)

- SQL injection vulnerabilities (especially raw database queries)
- Command injection via `subprocess` or `os.system`
- Unsafe `eval`/`exec` usage
- Pickle unsafe deserialization
- Hardcoded credentials or API keys
- YAML unsafe load (`yaml.load` without `Loader=SafeLoader`)
- Bare except clauses hiding security errors
- Missing authentication on API endpoints
- Missing input validation on user-facing endpoints
- Unparameterized database queries with user input

### HIGH (Should Fix)

- Missing type hints on public functions
- Mutable default arguments
- Swallowing exceptions silently
- Not using context managers for resources (files, DB connections)
- Missing audit logging for state-changing operations
- Race conditions without locks (especially in background tasks)
- Database connection not properly closed/returned to pool
- Missing Pydantic validation on API request/response models
- SQLAlchemy N+1 query patterns
- Missing error handling in background tasks

### MEDIUM (Consider)

- PEP 8 formatting violations (should be caught by Ruff)
- Missing docstrings on public functions
- Print statements instead of structured logging
- Inefficient string operations
- Magic numbers without named constants
- Not using f-strings for formatting
- Unnecessary list creation (use generators)
- Missing `__all__` exports in modules
- Overly broad exception handling

## Automated Checks Run

```bash
# Type checking
uv run mypy src/ --ignore-missing-imports

# Linting and formatting
uv run ruff check .
uv run ruff format --check .

# Security scanning
uv run bandit -r src/ -c pyproject.toml

# Dependency audit
uv run pip-audit

# Testing (verify existing tests still pass)
pytest -q
```

## Example Usage

```text
User: /python-review

Agent:
# Python Code Review Report

## Files Reviewed
- src/app/query/query_executor.py (modified)
- src/apis/records.py (modified)
- src/db/client.py (modified)

## Static Analysis Results
  ruff: No issues
  mypy: 1 error
  ruff format: All files formatted
  bandit: 1 issue (medium severity)

## Issues Found

[CRITICAL] Unparameterized Database Query
File: src/app/query/query_executor.py:67
Issue: User-provided filter value interpolated directly into the query
```python
# BAD - SQL injection risk
query = f"SELECT * FROM events WHERE source_ip = '{user_filter}'"
result = db_client.query(query)
```
Fix: Use a parameterized query
```python
# GOOD - Parameterized query
query = "SELECT * FROM events WHERE source_ip = {source_ip:String}"
result = db_client.query(query, parameters={"source_ip": user_filter})
```

[HIGH] Missing Audit Log for State Change
File: src/apis/records.py:42
Issue: POST endpoint modifies saved queries without audit logging
```python
# BAD - No audit trail
@ns.route('/saved-queries')
class SavedQueries(Resource):
    def post(self):
        query = SavedQuery(**request.json)
        db.session.add(query)
        db.session.commit()
        return query.to_dict(), 201
```
Fix: Add audit logging
```python
# GOOD - With audit trail
@ns.route('/saved-queries')
class SavedQueries(Resource):
    @audit_log(action="create_saved_query")
    def post(self):
        query = SavedQuery(**request.json)
        db.session.add(query)
        db.session.commit()
        return query.to_dict(), 201
```

[HIGH] Database Connection Not Returned to Pool
File: src/db/client.py:35
Issue: Exception path does not close the client
```python
# BAD - Connection leak on exception
def execute_query(sql):
    client = get_db_client()
    result = client.query(sql)
    client.close()
    return result
```
Fix: Use context manager pattern
```python
# GOOD - Connection always returned
def execute_query(sql):
    with get_db_client() as client:
        return client.query(sql)
```

[MEDIUM] Missing Type Hints on Public Function
File: src/app/query/query_executor.py:15
Issue: Public function without type annotations
```python
# BAD
def build_query(filters, time_range, limit):
    ...
```
Fix: Add comprehensive type hints
```python
# GOOD
def build_query(
    filters: list[QueryFilter],
    time_range: TimeRange,
    limit: int = 100,
) -> str:
    ...
```

## Summary
- CRITICAL: 1
- HIGH: 2
- MEDIUM: 1

Recommendation: Block merge until CRITICAL issue is fixed
```

## Approval Criteria

| Status | Condition |
|--------|-----------|
| Approve | No CRITICAL or HIGH issues |
| Warning | Only MEDIUM issues (merge with caution) |
| Block | CRITICAL or HIGH issues found |

---

## Common Review Patterns

### Database Client Library

**Always check for:**

```python
# PATTERN: Parameterized queries (REQUIRED for user input)
# GOOD
client.query(
    "SELECT * FROM events WHERE severity = {severity:String} AND timestamp > {start:DateTime}",
    parameters={"severity": severity, "start": start_time}
)

# BAD - Never interpolate user input
client.query(f"SELECT * FROM events WHERE severity = '{severity}'")
```

```python
# PATTERN: Connection management
# GOOD - Context manager
with db.get_client(host=DB_HOST) as client:
    result = client.query(sql)

# GOOD - Connection pool
from src.db.pool import get_client
client = get_client()
try:
    result = client.query(sql)
finally:
    client.close()

# BAD - Leaked connection
client = db.get_client(host=DB_HOST)
result = client.query(sql)
# client.close() missing!
```

```python
# PATTERN: Large result set handling
# GOOD - Streaming for large results
with client.query_rows_stream("SELECT * FROM large_table") as stream:
    for row in stream:
        process(row)

# BAD - Loading everything into memory
result = client.query("SELECT * FROM large_table")  # May OOM
```

```python
# PATTERN: Insert operations
# GOOD - Batch insert with column types
client.insert(
    "events",
    data=batch_data,
    column_names=["timestamp", "source_ip", "event_type"],
    column_types=["DateTime", "String", "String"],
)

# BAD - One-by-one inserts in a loop
for event in events:
    client.command(f"INSERT INTO events VALUES (...)")
```

### Protocol Buffer Python Bindings

**Always check for:**

```python
# PATTERN: Proper import of generated bindings
# GOOD
from myapp.proto import network_event_pb2
from myapp.proto.network_event_pb2 import NetworkEvent

# BAD - Importing from wrong path
from proto.network_event_pb2 import NetworkEvent  # Path may not resolve

# PATTERN: Serialization/deserialization with error handling
# GOOD
try:
    event = NetworkEvent()
    event.ParseFromString(raw_bytes)
except google.protobuf.message.DecodeError as e:
    logger.error(f"Failed to parse NetworkEvent: {e}")
    raise InvalidProtobufError(f"Malformed event data") from e

# BAD - No error handling
event = NetworkEvent()
event.ParseFromString(raw_bytes)  # Crashes on malformed input

# PATTERN: Proto field presence checking (proto3)
# GOOD - Use HasField for message fields, check zero values for scalars
if event.HasField("metadata"):
    process_metadata(event.metadata)
if event.source_port != 0:
    check_port(event.source_port)

# BAD - Truthy check on proto fields
if event.metadata:  # Always True for message fields in proto3
    process_metadata(event.metadata)
```

### Query Parsing Middleware

**Always check for:**

```python
# PATTERN: query middleware feature flag
# GOOD - Feature-flagged code path
if settings.USE_QUERY_MIDDLEWARE:
    parsed = parse_query(raw_query)
    validated_query = parsed.to_sql()
else:
    validated_query = legacy_query_builder(raw_query)

# PATTERN: parser error handling
# GOOD
try:
    parsed = parse_query(user_query)
except QuerySyntaxError as e:
    return {"error": f"Query syntax error at position {e.position}: {e.message}"}, 400
except QuerySecurityError as e:
    logger.warning(f"Blocked dangerous query from user {user_id}: {e}")
    return {"error": "Query contains disallowed operations"}, 403

# PATTERN: Query compatibility testing
# GOOD - Both paths produce same results
if settings.USE_QUERY_MIDDLEWARE and settings.QUERY_MIDDLEWARE_COMPARE_MODE:
    legacy_result = legacy_query_builder(raw_query)
    middleware_result = parse_query(raw_query).to_sql()
    if legacy_result != middleware_result:
        logger.warning(f"query middleware divergence: {raw_query}")
```

### Background Task Patterns

**Always check for:**

```python
# PATTERN: Idempotent tasks
# GOOD - Safe to retry
@celery.task(bind=True, max_retries=3, acks_late=True)
def process_event(self, event_id: str) -> None:
    try:
        event = get_event(event_id)
        if event.processed:
            return  # Idempotent - skip if already done
        run_processing(event)
        mark_processed(event_id)
    except TransientError as e:
        self.retry(countdown=60, exc=e)

# BAD - Not idempotent, no retry handling
@celery.task
def process_event(event_id):
    event = get_event(event_id)
    run_processing(event)  # May run twice on retry
    send_notification(event)  # May send duplicate notification
```

```python
# PATTERN: Task timeout and resource limits
# GOOD
@celery.task(
    bind=True,
    soft_time_limit=300,
    time_limit=360,
    max_retries=3,
)
def long_running_analysis(self, job_id: str) -> None:
    try:
        analyze(job_id)
    except SoftTimeLimitExceeded:
        logger.warning(f"Analysis timed out for job {job_id}")
        self.retry(countdown=120)
```

### Audit Logging Patterns

**Always check for:**

```python
# PATTERN: Audit log on state-changing operations
# GOOD
@audit_log(action="update_rule", resource_type="rule")
def update_rule(rule_id: str, updates: RuleUpdate, user: User) -> Rule:
    rule = get_rule(rule_id)
    old_state = rule.to_dict()
    rule.apply_updates(updates)
    db.session.commit()
    return rule

# BAD - No audit trail
def update_rule(rule_id, updates, user):
    rule = get_rule(rule_id)
    rule.apply_updates(updates)
    db.session.commit()
    return rule

# PATTERN: Structured logging with context
# GOOD
logger.info(
    "Rule triggered",
    extra={
        "rule_id": rule.id,
        "category": rule.category,
        "severity": rule.severity,
        "event_count": len(matching_events),
        "user_id": None,  # System-triggered
    }
)

# BAD - Unstructured logging
print(f"Rule {rule.id} triggered with {len(events)} events")
```

---

## Framework-Specific Reviews

### Flask Projects

The reviewer checks for:
- Blueprint organization and URL namespace consistency
- Flask-RESTX namespace and model definitions
- SQLAlchemy session management (commit/rollback in error paths)
- Request context management (app context, request context)
- Configuration management via environment variables
- Missing `@login_required` or `@requires_permission` decorators
- Proper error handlers registered for all API namespaces
- N+1 query issues (use `joinedload` and `subqueryload`)
- Missing database migrations for model changes (Alembic)

### FastAPI Projects

The reviewer checks for:
- CORS configuration for allowed origins
- Pydantic models for all request/response validation
- Response model correctness and field inclusion/exclusion
- Proper `async`/`await` usage (no blocking calls in async endpoints)
- Dependency injection patterns via `Depends()`
- Background task usage for long-running operations
- OpenAPI schema accuracy and documentation
- Rate limiting configuration
- Health check endpoint presence

### Query Parser Projects

The reviewer checks for:
- Grammar consistency with implementation
- Parser error recovery and meaningful error messages
- SQL injection prevention in generated queries
- Feature completeness against supported query types
- Performance of parsing for complex queries
- Edge cases in SQL dialect translation

---

## Common Fixes

### Database Query Parameterization
```python
# Before
query = f"SELECT * FROM events WHERE ip = '{ip}' AND time > '{start}'"

# After
query = "SELECT * FROM events WHERE ip = {ip:String} AND time > {start:DateTime}"
params = {"ip": ip, "start": start}
result = client.query(query, parameters=params)
```

### Add Type Hints with Domain Types
```python
# Before
def get_events(filters, limit):
    return db.query(filters, limit)

# After
from src.app.query.types import QueryFilter, EventResult

def get_events(
    filters: list[QueryFilter],
    limit: int = 100,
) -> list[EventResult]:
    return db.query(filters, limit)
```

### Fix Mutable Defaults
```python
# Before
def search_events(filters=[], time_range={}):
    ...

# After
def search_events(
    filters: list[str] | None = None,
    time_range: dict[str, Any] | None = None,
) -> list[Event]:
    filters = filters or []
    time_range = time_range or {}
    ...
```

### Use Context Managers for DB Connections
```python
# Before
client = get_db_client()
result = client.query(sql)
client.close()

# After
with get_db_client() as client:
    result = client.query(sql)
```

### Fix String Concatenation in Loops
```python
# Before
result = ""
for event in events:
    result += event.to_csv_row()

# After
result = "\n".join(event.to_csv_row() for event in events)
```

### Structured Logging
```python
# Before
print(f"Processing event {event_id} from {source_ip}")

# After
import structlog
logger = structlog.get_logger()
logger.info("processing_event", event_id=event_id, source_ip=source_ip)
```

---

## Python Version Compatibility

Target Python 3.11+. The reviewer notes these patterns:

| Feature | Minimum Python | Usage |
|---------|----------------|---------------|
| Type hints | 3.5+ | Required everywhere |
| f-strings | 3.6+ | Preferred formatting |
| Walrus operator (`:=`) | 3.8+ | Allowed |
| `list[str]` (lowercase generics) | 3.9+ | Preferred over `List[str]` |
| Match statements | 3.10+ | Allowed |
| Type unions (`x \| None`) | 3.10+ | Preferred over `Optional[x]` |
| `ExceptionGroup` | 3.11+ | Allowed |
| `tomllib` | 3.11+ | Preferred over `toml` |

Ensure `pyproject.toml` specifies `requires-python = ">=3.11"`.

## Integration with Other Commands

- Use `/tdd` to write tests before implementation
- Use `/verify` for full verification pipeline
- Use `/build-fix` if static analysis tools fail
- Use `/test-coverage` to check coverage after review
- Use `/refactor-clean` to address dead code findings

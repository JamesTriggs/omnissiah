# Python Security

> This file extends [common/security.md](../common/security.md) with Python-specific content for your services.

## Secret Management with Pydantic Settings

Never use raw `os.environ` for secret access. Use Pydantic Settings for validated, typed configuration:

```python
from pydantic_settings import BaseSettings
from pydantic import Field, SecretStr


class Settings(BaseSettings):
    """Application settings with mandatory secret validation.

    All secrets are validated at startup. Missing values cause an
    immediate ValidationError rather than a runtime KeyError.
    """
    # Database credentials
    db_password: SecretStr
    mysql_url: SecretStr
    redis_url: str = "redis://localhost:6379/0"

    # JWT authentication
    jwt_secret_key: SecretStr
    jwt_algorithm: str = "HS256"

    # AWS (use IAM roles in production -- these are for local dev only)
    aws_region: str = "eu-west-2"

    # Feature flags
    use_sql_middleware: bool = Field(False, alias="APP_USE_SQL_MIDDLEWARE")

    class Config:
        env_prefix = "APP_"
        case_sensitive = False


# Instantiate at module level -- fails fast if secrets are missing
settings = Settings()

# Access secret values only when needed
password = settings.db_password.get_secret_value()
```

```python
# BAD: Raw os.environ with no validation
import os
api_key = os.environ.get("API_KEY", "default_key")  # Silent fallback!

# BAD: Hardcoded fallback secrets
DB_PASSWORD = os.environ.get("DB_PASS", "admin123")

# GOOD: Fail-fast with Pydantic
settings = Settings()  # Raises ValidationError if APP_DB_PASSWORD is missing
```

## Security Scanning

Use Ruff's security rules (replacement for bandit) in CI:

```bash
# Ruff includes bandit-equivalent rules (S prefix)
ruff check --select S appcore/

# Key rules enforced:
# S101: assert used in production code
# S105: hardcoded password assignment
# S106: hardcoded password in function argument
# S107: hardcoded password in function default
# S608: SQL injection via string formatting
```

## the analytics database Security (analytics-db)

### Parameterized Queries

Every the analytics database query MUST use parameterized queries. Never interpolate values.

```python
import analytics_db

# BAD: String interpolation -- SQL injection
def get_events(client, org_id, event_type):
    return client.query(f"SELECT * FROM events WHERE org_id = {org_id} AND type = '{event_type}'")

# BAD: .format() -- equally dangerous
def get_events(client, org_id, event_type):
    return client.query("SELECT * FROM events WHERE org_id = {} AND type = '{}'".format(org_id, event_type))

# BAD: %-formatting -- still SQL injection
def get_events(client, org_id, event_type):
    return client.query("SELECT * FROM events WHERE org_id = %s AND type = '%s'" % (org_id, event_type))

# GOOD: Parameterized query via analytics-db
def get_events(client: analytics_db.driver.Client, org_id: int, event_type: str):
    return client.query(
        """SELECT * FROM events
           PREWHERE organisation_id = %(org_id)s
           WHERE event_type = %(event_type)s
           ORDER BY timestamp DESC
           LIMIT 1000""",
        parameters={"org_id": org_id, "event_type": event_type},
    )
```

### Dynamic Column Selection

When users can select which columns to return (e.g., Explorer), validate against an allowlist:

```python
# Allowlist of columns that users can query
ALLOWED_EVENT_COLUMNS = frozenset({
    "timestamp", "event_type", "source_ip", "dest_ip",
    "source_port", "dest_port", "protocol", "severity",
    "description", "technique_id", "technique_name",
    "process_name", "file_hash", "domain",
})

def build_select(requested_columns: list[str]) -> str:
    """Build a SELECT clause from validated column names."""
    validated = [col for col in requested_columns if col in ALLOWED_EVENT_COLUMNS]
    if not validated:
        raise ValueError("No valid columns in request")
    return ", ".join(validated)

# NEVER allow raw user input as column names without validation
```

### the analytics database Specific Risks

Be aware of these the analytics database-specific attack surfaces:
- `system` database queries can reveal infrastructure details
- `url()` table function can make outbound HTTP requests
- `file()` table function can read server filesystem
- `remote()` table function can connect to other the analytics database instances

Ensure the the analytics database user account used by applications has ONLY:
- SELECT, INSERT privileges on application databases
- No access to `system` database beyond necessary metadata
- No FILE, URL, or REMOTE function privileges

## FastAPI Security Middleware Patterns

### Authentication Dependency

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> AuthenticatedUser:
    """Validate JWT token and return authenticated user.

    This dependency MUST be used on all protected endpoints.
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    user = await user_service.get_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_tenant_id(user: AuthenticatedUser = Depends(get_current_user)) -> int:
    """Extract tenant context from authenticated user. Never trust client-supplied tenant IDs."""
    if not user.organisation_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenant context")
    return user.organisation_id
```

### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,  # NEVER use ["*"] in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
```

### Rate Limiting

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.get("/api/v1/events")
@limiter.limit("100/minute")
async def list_events(request: Request):
    ...
```

## SQLAlchemy Injection Prevention

### ORM Queries (Preferred)

Always prefer ORM-style queries over raw SQL:

```python
# GOOD: ORM query -- SQLAlchemy handles parameterization
cases = (
    session.query(Case)
    .filter(Case.organisation_id == org_id)
    .filter(Case.status == "open")
    .order_by(Case.created_at.desc())
    .limit(100)
    .all()
)

# GOOD: ORM with dynamic filters
def search_cases(session, org_id: int, filters: dict):
    query = session.query(Case).filter(Case.organisation_id == org_id)
    if "status" in filters:
        query = query.filter(Case.status == filters["status"])
    if "severity_min" in filters:
        query = query.filter(Case.severity >= filters["severity_min"])
    return query.all()
```

### Raw SQL (When Necessary)

If raw SQL is needed (complex analytics), ALWAYS use SQLAlchemy's `text()` with bound parameters:

```python
from sqlalchemy import text

# BAD: Raw string
result = session.execute(f"SELECT * FROM cases WHERE org_id = {org_id}")

# GOOD: Parameterized with text()
result = session.execute(
    text("SELECT * FROM cases WHERE organisation_id = :org_id AND status = :status"),
    {"org_id": org_id, "status": "open"},
)
```

## Celery Task Security

### Serializer Restrictions

```python
# settings.py -- restrict Celery serializers to prevent deserialization attacks
CELERY_ACCEPT_CONTENT = ["json"]       # ONLY accept JSON
CELERY_TASK_SERIALIZER = "json"        # Serialize tasks as JSON
CELERY_RESULT_SERIALIZER = "json"      # Serialize results as JSON

# NEVER use pickle serializer -- allows arbitrary code execution
# CELERY_TASK_SERIALIZER = "pickle"  # DANGEROUS
```

### Task Input Validation

```python
from celery import Celery
from pydantic import BaseModel, ValidationError

app = Celery("app")


class DetectionTaskInput(BaseModel):
    """Validate task arguments before processing."""
    organisation_id: int
    event_ids: list[str]
    rule_set_version: str


@app.task(bind=True, max_retries=3)
def run_detection(self, org_id: int, event_ids: list[str], rule_version: str):
    """Process detection rules against events."""
    # Validate inputs even though they come from internal services
    try:
        validated = DetectionTaskInput(
            organisation_id=org_id,
            event_ids=event_ids,
            rule_set_version=rule_version,
        )
    except ValidationError as e:
        logger.error("Invalid task input", error=str(e))
        return  # Do not retry invalid input

    # Process with validated data
    process_detections(validated)
```

### Result Sanitization

```python
@app.task
def generate_report(org_id: int, report_type: str) -> dict:
    """Generate a report -- sanitize output to prevent data leakage."""
    report = build_report(org_id, report_type)

    # Strip internal details from task result
    return {
        "status": "complete",
        "report_id": report.id,
        "row_count": report.row_count,
        # NEVER include raw data, SQL queries, or internal IPs in task results
    }
```

## Flask-RESTX Security (Appliance API)

```python
from flask_restx import Namespace, Resource
from functools import wraps

api = Namespace("events")


def require_auth(f):
    """Authentication decorator for Flask-RESTX endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            api.abort(401, "Missing authentication token")
        try:
            payload = verify_jwt(token)
            g.user_id = payload["sub"]
            g.org_id = payload["org_id"]
        except InvalidTokenError:
            api.abort(401, "Invalid authentication token")
        return f(*args, **kwargs)
    return decorated


def require_role(role: str):
    """Role-based access control decorator."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not has_role(g.user_id, role):
                api.abort(403, "Insufficient permissions")
            return f(*args, **kwargs)
        return decorated
    return decorator


@api.route("/")
class EventList(Resource):
    @require_auth
    @require_role("analyst")
    def get(self):
        """List events -- requires analyst role."""
        return event_service.list_events(g.org_id)
```

## Agent Support

- Use **security-reviewer** agent for comprehensive security audits
- Use **python-reviewer** agent for Python-specific security patterns
- Use **database-reviewer** agent for the analytics database/MySQL query security

# Common Patterns

Reusable implementation patterns for the omnissiah framework. Examples are illustrative, adapt them to your stack.

## Skeleton Projects

When implementing new functionality:
1. Search for battle-tested skeleton projects within your codebase
2. Use parallel agents to evaluate options:
   - Security assessment
   - Extensibility analysis
   - Relevance scoring
   - Implementation planning
3. Clone the best match as a foundation
4. Iterate within the proven structure

## Design Patterns

### Repository Pattern (SQLAlchemy)

Encapsulate data access behind a consistent interface using SQLAlchemy:

```python
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional
from sqlalchemy.orm import Session

T = TypeVar("T")

class BaseRepository(ABC, Generic[T]):
    """Abstract repository providing standard CRUD operations."""

    def __init__(self, session: Session, model_class: type[T]):
        self._session = session
        self._model_class = model_class

    def find_all(self, account_id: int, **filters) -> list[T]:
        """Find all records scoped to an account."""
        query = self._session.query(self._model_class).filter_by(
            account_id=account_id, **filters
        )
        return query.all()

    def find_by_id(self, account_id: int, record_id: int) -> Optional[T]:
        """Find a single record by ID, scoped to the account."""
        return (
            self._session.query(self._model_class)
            .filter_by(account_id=account_id, id=record_id)
            .first()
        )

    def create(self, entity: T) -> T:
        """Create a new record."""
        self._session.add(entity)
        self._session.flush()
        return entity

    def update(self, entity: T) -> T:
        """Update an existing record."""
        self._session.merge(entity)
        self._session.flush()
        return entity

    def delete(self, entity: T) -> None:
        """Delete a record."""
        self._session.delete(entity)
        self._session.flush()


# Concrete implementation
class CaseRepository(BaseRepository["Case"]):
    """Repository for case management."""

    def __init__(self, session: Session):
        super().__init__(session, Case)

    def find_open_cases(self, account_id: int) -> list["Case"]:
        return (
            self._session.query(Case)
            .filter_by(account_id=account_id, status="open")
            .order_by(Case.priority.desc(), Case.created_at.desc())
            .all()
        )
```

### FastAPI Endpoint Patterns with Pydantic Validation

A recommended endpoint structure:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/api/v1/records", tags=["records"])


# --- Request/Response Models ---

class RecordQueryParams(BaseModel):
    """Query parameters with strict validation."""
    start_time: datetime
    end_time: datetime
    kind: Optional[str] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    limit: int = Field(100, ge=1, le=10000)
    offset: int = Field(0, ge=0)

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v, info):
        if info.data.get("start_time") and v <= info.data["start_time"]:
            raise ValueError("end_time must be after start_time")
        return v


class RecordResponse(BaseModel):
    """Single record in the response."""
    id: str
    timestamp: datetime
    kind: str
    source: Optional[str] = None
    destination: Optional[str] = None
    priority: int
    description: str


class PaginatedResponse(BaseModel):
    """Standard paginated response envelope."""
    success: bool = True
    data: list[RecordResponse]
    meta: dict  # total, page, limit


# --- Dependency Injection ---

async def get_account_id(user=Depends(get_current_user)) -> int:
    """Extract and validate the access context from the token."""
    if not user.account_id:
        raise HTTPException(status_code=403, detail="No access context")
    return user.account_id


# --- Endpoint ---

@router.get("/", response_model=PaginatedResponse)
async def list_records(
    params: RecordQueryParams = Depends(),
    account_id: int = Depends(get_account_id),
    db=Depends(get_db_client),
):
    """List records with filtering and pagination."""
    records = await query_records(db, account_id, params)
    total = await count_records(db, account_id, params)

    return PaginatedResponse(
        success=True,
        data=records,
        meta={
            "total": total,
            "offset": params.offset,
            "limit": params.limit,
        },
    )
```

### Analytical Query Patterns

Use parameterised queries and scope every query to an owner:

```python
from datetime import datetime


def query_records(
    client,
    account_id: int,
    start_time: datetime,
    end_time: datetime,
    kind: str | None = None,
    limit: int = 1000,
) -> list[dict]:
    """Query records with mandatory account scoping.

    All parameters are passed via the driver's parameterised query interface.
    """
    conditions = ["kind = %(kind)s"] if kind else []
    where_clause = f"AND {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT
            record_id,
            timestamp,
            kind,
            source,
            destination,
            priority,
            description
        FROM records
        WHERE account_id = %(account_id)s
            AND timestamp BETWEEN %(start)s AND %(end)s
        {where_clause}
        ORDER BY timestamp DESC
        LIMIT %(limit)s
    """

    params = {
        "account_id": account_id,
        "start": start_time,
        "end": end_time,
        "limit": limit,
    }
    if kind:
        params["kind"] = kind

    result = client.query(sql, parameters=params)
    return [dict(zip(result.column_names, row)) for row in result.result_rows]
```

### API Response Envelope Format

Use a consistent response envelope across services:

```python
from pydantic import BaseModel
from typing import TypeVar, Generic, Optional
from datetime import datetime

T = TypeVar("T")


class ApiMeta(BaseModel):
    """Metadata for paginated responses."""
    total: int
    offset: int
    limit: int
    request_id: str
    timestamp: datetime


class ApiError(BaseModel):
    """Structured error information."""
    code: str
    message: str
    details: Optional[dict] = None


class ApiResponse(BaseModel, Generic[T]):
    """Standard API response envelope used across all services."""
    success: bool
    data: Optional[T] = None
    error: Optional[ApiError] = None
    meta: Optional[ApiMeta] = None


# Usage in endpoints:
# return ApiResponse(success=True, data=result, meta=meta)
# return ApiResponse(success=False, error=ApiError(code="NOT_FOUND", message="Case not found"))
```

For Flask-RESTX, use the marshal decorator with an equivalent envelope:

```python
from flask_restx import Namespace, Resource, fields

api = Namespace("records", description="Record operations")

record_model = api.model("Record", {
    "id": fields.String(required=True),
    "timestamp": fields.DateTime(required=True),
    "kind": fields.String(required=True),
    "priority": fields.Integer(required=True),
})

envelope_model = api.model("RecordListResponse", {
    "success": fields.Boolean(default=True),
    "data": fields.List(fields.Nested(record_model)),
    "meta": fields.Raw(description="Pagination metadata"),
})

@api.route("/")
class RecordList(Resource):
    @api.marshal_with(envelope_model)
    def get(self):
        """List records."""
        records = record_service.list_records(g.account_id)
        return {
            "success": True,
            "data": records,
            "meta": {"total": len(records), "offset": 0, "limit": 100},
        }
```

### Service-to-Service Communication Patterns

Services communicate via REST APIs and message queues:

```python
# --- HTTP Service Client Pattern ---

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


class ServiceClient:
    """Base client for service-to-service HTTP communication."""

    def __init__(self, base_url: str, service_name: str, timeout: float = 30.0):
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers={
                "X-Service-Name": service_name,
                "Content-Type": "application/json",
            },
        )
        self._service_name = service_name

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def _request(self, method: str, path: str, **kwargs) -> dict:
        response = await self._client.request(method, path, **kwargs)
        response.raise_for_status()
        return response.json()

    async def close(self):
        await self._client.aclose()


class AccountsApiClient(ServiceClient):
    """Client for the accounts service."""

    def __init__(self):
        super().__init__(
            base_url=settings.ACCOUNTS_API_URL,
            service_name="core-api",
        )

    async def get_account(self, account_id: int) -> dict:
        return await self._request("GET", f"/api/v1/accounts/{account_id}")

    async def validate_license(self, account_id: int) -> bool:
        result = await self._request("GET", f"/api/v1/accounts/{account_id}/license")
        return result.get("data", {}).get("is_valid", False)


# --- Celery Task Communication Pattern ---

from celery import Celery

celery_app = Celery("app", broker=settings.REDIS_URL)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_batch(self, account_id: int, item_ids: list[str]):
    """Process a batch of items.

    This task is dispatched from the API and processed by a worker.
    """
    try:
        items = fetch_items(account_id, item_ids)
        results = engine.evaluate(account_id, items)
        store_results(account_id, results)
    except Exception as exc:
        self.retry(exc=exc)
```

### Configuration Pattern

Use Pydantic Settings for all service configuration:

```python
from pydantic_settings import BaseSettings
from pydantic import Field


class AppSettings(BaseSettings):
    """Base settings shared across all Python services."""

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "app"
    db_user: str = "default"
    db_password: str = ""

    redis_url: str = "redis://localhost:6379/0"

    # Cloud
    region: str = "eu-west-2"

    # Feature flags
    use_new_pipeline: bool = Field(False, alias="APP_USE_NEW_PIPELINE")

    # Security
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60

    class Config:
        env_prefix = "APP_"
        case_sensitive = False
```

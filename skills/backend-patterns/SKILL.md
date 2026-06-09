---
name: backend-patterns
description: Backend development patterns covering FastAPI, Flask-RESTX, SQLAlchemy, an analytics database, Celery, Redis, inter-service communication, and event processing.
---

# Backend Development Patterns

Backend architecture patterns and best practices for Python services.

## Service Architecture Overview

A typical multi-service Python backend might consist of:
- **internal-api** (Flask + Flask-RESTX + SQLAlchemy): Primary internal API
- **public-api** (FastAPI + Pydantic): External-facing API
- **batch-worker** (asyncio + aiohttp): Batch processing engine
- **query-parser** (ANTLR4 + Python): Custom query/expression parser
- **db-migrator**: Database migration utility

These patterns apply to any of them. Substitute your own service names and domain entities.

## FastAPI Endpoint Patterns (public-api)

### Basic CRUD Endpoint
```python
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from typing import Optional

router = APIRouter(prefix="/api/v1/events", tags=["events"])

@router.get("/", response_model=PaginatedResponse[EventResponse])
async def list_events(
    tenant_id: str = Depends(get_current_tenant),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    priority_min: int = Query(0, ge=0, le=10, description="Minimum priority"),
    start_time: Optional[datetime] = Query(None, description="Start of time range"),
    end_time: Optional[datetime] = Query(None, description="End of time range"),
    limit: int = Query(50, ge=1, le=1000, description="Page size"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    analytics_db: AnalyticsClient = Depends(get_analytics_client),
):
    """List events for the current tenant."""
    query_params = EventQueryParams(
        tenant_id=tenant_id,
        event_type=event_type,
        priority_min=priority_min,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )
    events, total = await event_service.list_events(analytics_db, query_params)
    return PaginatedResponse(
        success=True,
        data=events,
        meta=PaginationMeta(total=total, limit=limit, offset=offset, has_more=offset + limit < total),
    )

@router.get("/{event_id}", response_model=ApiResponse[EventResponse])
async def get_event(
    event_id: str = Path(..., description="Event ID"),
    tenant_id: str = Depends(get_current_tenant),
    analytics_db: AnalyticsClient = Depends(get_analytics_client),
):
    """Get a specific event by ID."""
    event = await event_service.get_event(analytics_db, tenant_id, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return ApiResponse(success=True, data=event)
```

### Dependency Injection
```python
from fastapi import Depends, Header, HTTPException
from functools import lru_cache

# Settings dependency
class Settings(BaseSettings):
    analytics_db_host: str
    analytics_db_port: int = 8123
    analytics_db_database: str = "app"
    analytics_db_user: str = "default"
    analytics_db_password: str
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str
    jwt_algorithm: str = "RS256"

    class Config:
        env_prefix = "APP_"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

# Tenant extraction dependency
async def get_current_tenant(
    authorization: str = Header(..., description="JWT Bearer token"),
    x_tenant_id: str = Header(..., description="Tenant identifier"),
    settings: Settings = Depends(get_settings),
) -> str:
    """Extract and validate tenant from request headers."""
    try:
        payload = jwt.decode(
            authorization.replace("Bearer ", ""),
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    token_tenant = payload.get("tenant_id")
    if token_tenant != x_tenant_id:
        raise HTTPException(status_code=403, detail="Tenant ID mismatch")

    return x_tenant_id

# Analytics database client dependency
async def get_analytics_client(
    settings: Settings = Depends(get_settings),
) -> AnalyticsClient:
    client = get_analytics_client_impl(
        host=settings.analytics_db_host,
        port=settings.analytics_db_port,
        database=settings.analytics_db_database,
        username=settings.analytics_db_user,
        password=settings.analytics_db_password,
    )
    try:
        yield client
    finally:
        client.close()

# Redis dependency
async def get_redis(
    settings: Settings = Depends(get_settings),
) -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)

# Current user dependency with role checking
async def get_current_user(
    authorization: str = Header(...),
    settings: Settings = Depends(get_settings),
) -> UserPayload:
    try:
        payload = jwt.decode(
            authorization.replace("Bearer ", ""),
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return UserPayload(**payload)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(required_role: str):
    """Dependency that requires a specific role."""
    async def _check_role(user: UserPayload = Depends(get_current_user)):
        if not user.has_role(required_role):
            raise HTTPException(status_code=403, detail=f"Role '{required_role}' required")
        return user
    return _check_role
```

### Pydantic Models
```python
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from typing import Optional, Generic, TypeVar
from enum import Enum

T = TypeVar("T")

class EventType(str, Enum):
    ORDER = "order"
    PAYMENT = "payment"
    AUTH = "auth"
    SYSTEM = "system"
    AUDIT = "audit"

class PriorityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class EventCreate(BaseModel):
    """Input model for creating events."""
    event_type: EventType
    priority: int = Field(..., ge=0, le=10)
    timestamp: datetime
    source: Optional[dict] = None
    target: Optional[dict] = None
    description: str = Field(..., max_length=5000)
    tags: list[str] = Field(default_factory=list)
    raw_data: Optional[dict] = None

    @field_validator("timestamp")
    @classmethod
    def timestamp_not_future(cls, v: datetime) -> datetime:
        from datetime import timezone
        if v > datetime.now(timezone.utc):
            raise ValueError("Timestamp cannot be in the future")
        return v

class EventResponse(BaseModel):
    """Output model for event responses."""
    id: str
    tenant_id: str
    event_type: EventType
    priority: int
    priority_label: PriorityLevel
    timestamp: datetime
    source: Optional[dict] = None
    target: Optional[dict] = None
    description: str
    tags: list[str] = []
    created_at: datetime

    @computed_field
    @property
    def priority_label(self) -> PriorityLevel:
        if self.priority <= 3:
            return PriorityLevel.LOW
        elif self.priority <= 5:
            return PriorityLevel.MEDIUM
        elif self.priority <= 7:
            return PriorityLevel.HIGH
        return PriorityLevel.CRITICAL

class PaginationMeta(BaseModel):
    total: int
    limit: int
    offset: int
    has_more: bool

class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    error_code: Optional[str] = None

class PaginatedResponse(BaseModel, Generic[T]):
    success: bool
    data: list[T]
    meta: PaginationMeta
    error: Optional[str] = None
```

### Async Request Handlers
```python
import asyncio
from fastapi import BackgroundTasks

@router.post("/", response_model=ApiResponse[EventResponse], status_code=201)
async def create_event(
    event: EventCreate,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_current_tenant),
    user: UserPayload = Depends(require_role("write:events")),
    analytics_db: AnalyticsClient = Depends(get_analytics_client),
    redis: Redis = Depends(get_redis),
):
    """Create a new event."""
    # Persist event in the analytics database
    created = await event_service.create_event(analytics_db, tenant_id, event)

    # Invalidate relevant caches
    background_tasks.add_task(invalidate_event_cache, redis, tenant_id)

    # Trigger downstream processing asynchronously
    background_tasks.add_task(process_event, tenant_id, created)

    # Audit log
    background_tasks.add_task(
        audit_log, "event_created", user.id, tenant_id, "event", created.id
    )

    return ApiResponse(success=True, data=created)

@router.post("/bulk", response_model=ApiResponse[BulkInsertResult], status_code=201)
async def bulk_create_events(
    events: list[EventCreate],
    tenant_id: str = Depends(get_current_tenant),
    user: UserPayload = Depends(require_role("write:events")),
    analytics_db: AnalyticsClient = Depends(get_analytics_client),
):
    """Bulk insert events (max 10000 per request)."""
    if len(events) > 10000:
        raise HTTPException(status_code=400, detail="Maximum 10000 events per batch")

    result = await event_service.bulk_create(analytics_db, tenant_id, events)
    return ApiResponse(success=True, data=result)
```

## Flask-RESTX Patterns (internal-api)

### Namespace and Model Definition
```python
from flask_restx import Namespace, Resource, fields, reqparse, marshal
from flask import g, request

api = Namespace("tickets", description="Ticket management operations")

# Model definitions for marshalling and documentation
ticket_model = api.model("Ticket", {
    "id": fields.String(readonly=True, description="Ticket UUID"),
    "tenant_id": fields.String(required=True, description="Tenant identifier"),
    "title": fields.String(required=True, min_length=1, max_length=200),
    "description": fields.String(max_length=5000),
    "priority": fields.String(required=True, enum=["low", "medium", "high", "critical"]),
    "status": fields.String(required=True, enum=["open", "in_progress", "resolved", "closed"]),
    "assignee_id": fields.String(description="Assigned user ID"),
    "related_event_ids": fields.List(fields.String, description="Related event IDs"),
    "tags": fields.List(fields.String, description="Associated tags"),
    "created_at": fields.DateTime(readonly=True),
    "updated_at": fields.DateTime(readonly=True),
})

ticket_create_model = api.model("TicketCreate", {
    "title": fields.String(required=True, min_length=1, max_length=200),
    "description": fields.String(max_length=5000),
    "priority": fields.String(required=True, enum=["low", "medium", "high", "critical"]),
    "assignee_id": fields.String(),
    "related_event_ids": fields.List(fields.String, default=[]),
})

# Request parsers
list_parser = reqparse.RequestParser()
list_parser.add_argument("status", type=str, choices=("open", "in_progress", "resolved", "closed"))
list_parser.add_argument("priority", type=str, choices=("low", "medium", "high", "critical"))
list_parser.add_argument("limit", type=int, default=50, choices=range(1, 1001))
list_parser.add_argument("offset", type=int, default=0)
list_parser.add_argument("sort_by", type=str, default="created_at", choices=("created_at", "priority", "status"))
list_parser.add_argument("sort_order", type=str, default="desc", choices=("asc", "desc"))
```

### Resource Implementation
```python
@api.route("/")
class TicketListResource(Resource):
    @api.doc("list_tickets")
    @api.expect(list_parser)
    @api.marshal_list_with(ticket_model)
    @require_auth
    def get(self):
        """List all tickets for the current tenant."""
        args = list_parser.parse_args()
        tickets = ticket_service.list_tickets(
            tenant_id=g.tenant_id,
            status=args.get("status"),
            priority=args.get("priority"),
            limit=args["limit"],
            offset=args["offset"],
            sort_by=args["sort_by"],
            sort_order=args["sort_order"],
        )
        return tickets

    @api.doc("create_ticket")
    @api.expect(ticket_create_model, validate=True)
    @api.marshal_with(ticket_model, code=201)
    @require_auth
    @require_role("editor")
    def post(self):
        """Create a new ticket."""
        ticket = ticket_service.create_ticket(
            tenant_id=g.tenant_id,
            user_id=g.current_user["id"],
            data=api.payload,
        )
        audit_log("ticket_created", g.current_user["id"], g.tenant_id, "ticket", ticket["id"])
        return ticket, 201

@api.route("/<string:ticket_id>")
@api.param("ticket_id", "Ticket UUID")
class TicketResource(Resource):
    @api.doc("get_ticket")
    @api.marshal_with(ticket_model)
    @require_auth
    def get(self, ticket_id: str):
        """Get a specific ticket."""
        ticket = ticket_service.get_ticket(g.tenant_id, ticket_id)
        if not ticket:
            api.abort(404, "Ticket not found")
        return ticket

    @api.doc("update_ticket")
    @api.expect(ticket_create_model)
    @api.marshal_with(ticket_model)
    @require_auth
    @require_role("editor")
    def patch(self, ticket_id: str):
        """Update a ticket."""
        ticket = ticket_service.update_ticket(g.tenant_id, ticket_id, api.payload)
        if not ticket:
            api.abort(404, "Ticket not found")
        audit_log("ticket_updated", g.current_user["id"], g.tenant_id, "ticket", ticket_id)
        return ticket

    @api.doc("delete_ticket")
    @require_auth
    @require_role("admin")
    def delete(self, ticket_id: str):
        """Delete a ticket (admin only)."""
        success = ticket_service.delete_ticket(g.tenant_id, ticket_id)
        if not success:
            api.abort(404, "Ticket not found")
        audit_log("ticket_deleted", g.current_user["id"], g.tenant_id, "ticket", ticket_id)
        return "", 204
```

### Error Handling
```python
from flask_restx import abort
from werkzeug.exceptions import HTTPException

@api.errorhandler(Exception)
def handle_generic_error(error):
    """Handle unexpected errors."""
    logger.error("Unhandled error", error=str(error), traceback=traceback.format_exc())
    return {"message": "An internal error occurred"}, 500

@api.errorhandler(HTTPException)
def handle_http_error(error):
    """Handle HTTP errors with consistent format."""
    return {"message": error.description}, error.code

class AppError(Exception):
    """Base exception for the application."""
    def __init__(self, message: str, status_code: int = 500, error_code: str = "INTERNAL_ERROR"):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)

@api.errorhandler(AppError)
def handle_app_error(error):
    return {"message": error.message, "error_code": error.error_code}, error.status_code
```

## SQLAlchemy ORM Patterns

### Model Definition
```python
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Enum, Index
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.dialects.mysql import JSON
from datetime import datetime
import uuid
import enum

class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(64), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    priority = Column(Enum(TicketPriority), nullable=False)
    status = Column(Enum(TicketStatus), nullable=False, default=TicketStatus.OPEN)
    assignee_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    related_event_ids = Column(JSON, default=list)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

    # Relationships
    assignee = relationship("User", back_populates="assigned_tickets", lazy="joined")
    comments = relationship("TicketComment", back_populates="ticket", order_by="TicketComment.created_at")
    timeline_entries = relationship("TicketTimeline", back_populates="ticket", order_by="TicketTimeline.created_at")

    # Indexes
    __table_args__ = (
        Index("ix_tickets_tenant_status", "tenant_id", "status"),
        Index("ix_tickets_tenant_priority", "tenant_id", "priority"),
        Index("ix_tickets_tenant_created", "tenant_id", "created_at"),
    )

    @validates("title")
    def validate_title(self, key, title):
        if not title or len(title.strip()) == 0:
            raise ValueError("Title cannot be empty")
        if len(title) > 200:
            raise ValueError("Title must be under 200 characters")
        return title.strip()

    @hybrid_property
    def is_open(self):
        return self.status in (TicketStatus.OPEN, TicketStatus.IN_PROGRESS)

    @is_open.expression
    def is_open(cls):
        return cls.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS])

    @hybrid_property
    def duration_hours(self):
        end = self.closed_at or datetime.utcnow()
        return (end - self.created_at).total_seconds() / 3600

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "title": self.title,
            "description": self.description,
            "priority": self.priority.value,
            "status": self.status.value,
            "assignee_id": self.assignee_id,
            "related_event_ids": self.related_event_ids or [],
            "tags": self.tags or [],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
```

### Repository Pattern with SQLAlchemy
```python
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import Session

class TicketRepository:
    def __init__(self, session: Session):
        self._session = session

    def get_by_id(self, tenant_id: str, ticket_id: str) -> Ticket | None:
        stmt = select(Ticket).where(
            and_(Ticket.tenant_id == tenant_id, Ticket.id == ticket_id)
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def list_tickets(
        self,
        tenant_id: str,
        status: str | None = None,
        priority: str | None = None,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> tuple[list[Ticket], int]:
        # Build base query
        stmt = select(Ticket).where(Ticket.tenant_id == tenant_id)

        # Apply filters
        if status:
            stmt = stmt.where(Ticket.status == status)
        if priority:
            stmt = stmt.where(Ticket.priority == priority)

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self._session.execute(count_stmt).scalar()

        # Apply sorting
        sort_column = getattr(Ticket, sort_by, Ticket.created_at)
        stmt = stmt.order_by(desc(sort_column) if sort_order == "desc" else sort_column)

        # Apply pagination
        stmt = stmt.limit(limit).offset(offset)

        tickets = list(self._session.execute(stmt).scalars())
        return tickets, total

    def create(self, tenant_id: str, data: dict) -> Ticket:
        ticket = Ticket(tenant_id=tenant_id, **data)
        self._session.add(ticket)
        self._session.flush()
        return ticket

    def update(self, tenant_id: str, ticket_id: str, data: dict) -> Ticket | None:
        ticket = self.get_by_id(tenant_id, ticket_id)
        if not ticket:
            return None
        for key, value in data.items():
            if hasattr(ticket, key) and value is not None:
                setattr(ticket, key, value)
        self._session.flush()
        return ticket

    def delete(self, tenant_id: str, ticket_id: str) -> bool:
        ticket = self.get_by_id(tenant_id, ticket_id)
        if not ticket:
            return False
        self._session.delete(ticket)
        self._session.flush()
        return True
```

## Analytics Database Client Integration

These patterns assume a columnar analytics database accessed over an HTTP client. The shape applies to most columnar analytics stores.

### Async Query Execution
```python
from typing import Any

class AnalyticsService:
    def __init__(self, client: AnalyticsClient):
        self._client = client

    async def query(
        self,
        sql: str,
        parameters: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> list[dict]:
        """Execute a parameterized analytics query."""
        params = parameters or {}

        # Enforce tenant scoping
        if tenant_id:
            params["_tenant_id"] = tenant_id

        result = self._client.query(sql, parameters=params)
        columns = result.column_names
        return [dict(zip(columns, row)) for row in result.result_rows]

    async def insert_batch(
        self,
        table: str,
        data: list[dict],
        column_names: list[str],
    ) -> int:
        """Insert a batch of records."""
        if not data:
            return 0

        rows = [[record.get(col) for col in column_names] for record in data]
        self._client.insert(table, rows, column_names=column_names)
        return len(rows)

    async def get_event_counts_by_type(
        self,
        tenant_id: str,
        hours: int = 24,
    ) -> list[dict]:
        """Get event counts grouped by type for the dashboard."""
        return await self.query(
            """
            SELECT
                event_type,
                count() AS event_count,
                avg(priority) AS avg_priority,
                max(priority) AS max_priority
            FROM events
            WHERE tenant_id = {_tenant_id:String}
              AND event_date >= today() - INTERVAL {hours:Int32} HOUR
            GROUP BY event_type
            ORDER BY event_count DESC
            """,
            parameters={"hours": hours},
            tenant_id=tenant_id,
        )
```

## Celery Worker Patterns

### Task Definition
```python
from celery import Celery, Task
from celery.utils.log import get_task_logger

app = Celery("app")
app.config_from_object("app.celery_config")
logger = get_task_logger(__name__)

class TenantAwareTask(Task):
    """Base task that carries tenant context."""
    abstract = True

    def __call__(self, *args, **kwargs):
        tenant_id = kwargs.get("tenant_id")
        if tenant_id:
            # Set tenant context for the task
            g_context.tenant_id = tenant_id
        return super().__call__(*args, **kwargs)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(
            "Task failed",
            task_id=task_id,
            task_name=self.name,
            error=str(exc),
            tenant_id=kwargs.get("tenant_id"),
        )

@app.task(base=TenantAwareTask, bind=True, max_retries=3, default_retry_delay=60)
def process_event_batch(self, tenant_id: str, event_ids: list[str]) -> dict:
    """Process a batch of events through the rules engine."""
    try:
        engine = get_rules_engine()
        results = engine.evaluate(tenant_id, event_ids)
        return {"processed": len(event_ids), "matches": len(results)}
    except ConnectionError as exc:
        logger.warning(f"Connection error, retrying: {exc}")
        raise self.retry(exc=exc)
    except Exception as exc:
        logger.error(f"Event processing failed: {exc}")
        raise

@app.task(bind=True, max_retries=5, default_retry_delay=30)
def sync_events_to_analytics(self, tenant_id: str, events: list[dict]) -> int:
    """Sync events to the analytics database."""
    try:
        analytics = get_analytics_client()
        inserted = analytics.insert_batch("events", events)
        logger.info(f"Synced {inserted} events for tenant {tenant_id}")
        return inserted
    except Exception as exc:
        logger.warning(f"Analytics sync failed, retrying: {exc}")
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))

@app.task(rate_limit="10/m")
def send_notification(tenant_id: str, item_id: str, channels: list[str]):
    """Send a notification through configured channels."""
    item = get_item(tenant_id, item_id)
    for channel in channels:
        try:
            notify(channel, item)
        except Exception as exc:
            logger.error(f"Notification failed for channel {channel}: {exc}")
```

### Celery Configuration
```python
# celery_config.py
broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
result_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "UTC"

# Task routing
task_routes = {
    "app.tasks.process_event_batch": {"queue": "processing"},
    "app.tasks.sync_events_to_analytics": {"queue": "analytics"},
    "app.tasks.send_notification": {"queue": "notifications"},
}

# Retry configuration
task_acks_late = True
task_reject_on_worker_lost = True

# Concurrency
worker_concurrency = int(os.environ.get("CELERY_CONCURRENCY", 4))
worker_prefetch_multiplier = 1
```

## Redis Caching Patterns

### Cache-Aside Pattern
```python
import json
from redis.asyncio import Redis
from typing import TypeVar, Callable, Awaitable

T = TypeVar("T")

class CacheService:
    def __init__(self, redis: Redis):
        self._redis = redis

    async def get_or_fetch(
        self,
        key: str,
        fetch_fn: Callable[[], Awaitable[T]],
        ttl_seconds: int = 300,
    ) -> T:
        """Get from cache or fetch and cache."""
        cached = await self._redis.get(key)
        if cached:
            return json.loads(cached)

        data = await fetch_fn()
        await self._redis.setex(key, ttl_seconds, json.dumps(data, default=str))
        return data

    async def invalidate(self, pattern: str) -> int:
        """Invalidate cache keys matching pattern."""
        keys = []
        async for key in self._redis.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            return await self._redis.delete(*keys)
        return 0

# Usage
cache = CacheService(redis)

async def get_tenant_stats(tenant_id: str) -> dict:
    return await cache.get_or_fetch(
        key=f"stats:{tenant_id}",
        fetch_fn=lambda: analytics_service.get_tenant_stats(tenant_id),
        ttl_seconds=60,
    )

# Invalidate on data change
async def on_event_created(tenant_id: str):
    await cache.invalidate(f"stats:{tenant_id}*")
    await cache.invalidate(f"events:{tenant_id}:*")
```

### Session Management
```python
class SessionService:
    def __init__(self, redis: Redis):
        self._redis = redis
        self._session_ttl = 3600  # 1 hour

    async def create_session(self, user_id: str, tenant_id: str) -> str:
        session_id = str(uuid.uuid4())
        session_data = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "created_at": datetime.utcnow().isoformat(),
        }
        await self._redis.setex(
            f"session:{session_id}",
            self._session_ttl,
            json.dumps(session_data),
        )
        return session_id

    async def get_session(self, session_id: str) -> dict | None:
        data = await self._redis.get(f"session:{session_id}")
        if not data:
            return None
        # Extend session TTL on access
        await self._redis.expire(f"session:{session_id}", self._session_ttl)
        return json.loads(data)

    async def destroy_session(self, session_id: str) -> None:
        await self._redis.delete(f"session:{session_id}")
```

## Inter-Service Communication

### Internal API Calls
```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

class ServiceClient:
    """Client for internal service-to-service communication."""

    def __init__(self, base_url: str, service_token: str):
        self._base_url = base_url
        self._headers = {
            "Authorization": f"Bearer {service_token}",
            "X-Service-Name": "internal-api",
        }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def get(self, path: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}{path}",
                params=params,
                headers=self._headers,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def post(self, path: str, data: dict) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}{path}",
                json=data,
                headers=self._headers,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

# Usage
public_api = ServiceClient(
    base_url=settings.PUBLIC_API_URL,
    service_token=settings.SERVICE_TOKEN,
)
result = await public_api.get("/api/v1/tenant/config", params={"tenant_id": tenant_id})
```

## API Versioning and Deprecation

```python
# FastAPI versioning via router prefixes
from fastapi import FastAPI

app = FastAPI()

# V1 routes
app.include_router(v1_events_router, prefix="/api/v1")
app.include_router(v1_tickets_router, prefix="/api/v1")

# V2 routes (new version)
app.include_router(v2_events_router, prefix="/api/v2")

# Deprecation header middleware
@app.middleware("http")
async def add_deprecation_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/v1/"):
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "2025-06-01"
        response.headers["Link"] = '</api/v2/>; rel="successor-version"'
    return response
```

## Audit Logging and Access Control

```python
import structlog
from datetime import datetime

logger = structlog.get_logger()

def audit_log(
    action: str,
    user_id: str,
    tenant_id: str,
    resource_type: str,
    resource_id: str,
    details: dict | None = None,
    ip_address: str | None = None,
):
    """Create audit log entry. Immutable, append-only."""
    logger.info(
        "audit",
        action=action,
        user_id=user_id,
        tenant_id=tenant_id,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        timestamp=datetime.utcnow().isoformat(),
    )

# Flask decorator for automatic audit logging
def audit(action: str, resource_type: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            result = f(*args, **kwargs)
            resource_id = kwargs.get("ticket_id") or kwargs.get("event_id") or "unknown"
            audit_log(
                action=action,
                user_id=g.current_user["id"],
                tenant_id=g.tenant_id,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=request.remote_addr,
            )
            return result
        return wrapper
    return decorator

# Usage
@api.route("/<string:ticket_id>")
class TicketResource(Resource):
    @require_auth
    @audit("ticket_viewed", "ticket")
    def get(self, ticket_id: str):
        ...
```

## Pydantic Validation for Structured Events

```python
from pydantic import BaseModel, Field, field_validator, IPvAnyAddress
from typing import Literal

class NetworkFlowCreate(BaseModel):
    """Validated network flow event (illustrative structured-event example)."""
    source_ip: IPvAnyAddress
    destination_ip: IPvAnyAddress
    source_port: int = Field(..., ge=0, le=65535)
    destination_port: int = Field(..., ge=0, le=65535)
    protocol: Literal["TCP", "UDP", "ICMP", "DNS", "HTTP", "TLS"]
    bytes_sent: int = Field(..., ge=0)
    bytes_received: int = Field(..., ge=0)
    direction: Literal["inbound", "outbound", "lateral"]
    action: Literal["allow", "deny", "drop"]
    timestamp: datetime

    @field_validator("source_port", "destination_port")
    @classmethod
    def validate_port_not_reserved(cls, v: int) -> int:
        # Port 0 is technically valid but suspicious in flow data
        return v

    @model_validator(mode="after")
    def validate_flow(self):
        """Cross-field validation."""
        if self.source_ip == self.destination_ip and self.source_port == self.destination_port:
            raise ValueError("Source and destination cannot be identical")
        return self
```

## Error Handling Hierarchy

```python
# Custom exception hierarchy
class AppError(Exception):
    """Base exception."""
    status_code = 500
    error_code = "INTERNAL_ERROR"

    def __init__(self, message: str = "An internal error occurred"):
        self.message = message
        super().__init__(message)

class ValidationError(AppError):
    status_code = 422
    error_code = "VALIDATION_ERROR"

class NotFoundError(AppError):
    status_code = 404
    error_code = "NOT_FOUND"

class AuthenticationError(AppError):
    status_code = 401
    error_code = "AUTHENTICATION_ERROR"

class AuthorizationError(AppError):
    status_code = 403
    error_code = "AUTHORIZATION_ERROR"

class TenantIsolationError(AppError):
    status_code = 403
    error_code = "TENANT_ISOLATION_ERROR"

class QueryTimeoutError(AppError):
    status_code = 504
    error_code = "QUERY_TIMEOUT"

class RateLimitError(AppError):
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"

# FastAPI exception handlers
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.message,
            "error_code": exc.error_code,
        },
    )

@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "An internal error occurred",
            "error_code": "INTERNAL_ERROR",
        },
    )
```

---

**Remember**: In a multi-tenant backend, every endpoint must enforce authentication, authorization, tenant isolation, and input validation. Design for reliability (retries, circuit breakers) and observability (structured logging, audit trails). Performance matters — users depend on fast query responses.

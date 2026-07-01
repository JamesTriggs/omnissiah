---
name: coding-standards
description: Universal coding standards and best practices covering Python (Flask/FastAPI), Vue.js/TypeScript (Nuxt 3), and C++17 development.
---

# Coding Standards and Best Practices

Universal coding standards applicable across projects. This skill covers Python, Vue.js/TypeScript, and C++ conventions.

## Code Quality Principles

### 1. Readability First
- Code is read more than written
- Clear variable and function names
- Self-documenting code preferred over comments
- Consistent formatting enforced by automated tools

### 2. KISS (Keep It Simple, Stupid)
- Simplest solution that works
- Avoid over-engineering
- No premature optimization
- Easy to understand beats clever code

### 3. DRY (Don't Repeat Yourself)
- Extract common logic into shared utilities
- Create reusable components and services
- Share data models via a single source of truth (shared schemas/types)
- Avoid copy-paste programming

### 4. YAGNI (You Aren't Gonna Need It)
- Don't build features before they are needed
- Avoid speculative generality
- Add complexity only when required
- Start simple, refactor when needed

### 5. Security by Default
- All inputs validated before processing
- All queries parameterized
- All data tenant-scoped
- All secrets externalized

## Python Standards

### Variable Naming (PEP 8)
```python
# GOOD: Descriptive snake_case names
tenant_id = "tenant-abc-123"
is_authenticated = True
total_event_count = 1000
max_query_timeout_seconds = 30

# BAD: Unclear or non-PEP-8 names
t = "tenant-abc-123"
flag = True
x = 1000
maxTimeout = 30  # camelCase is not Pythonic
```

### Function Naming
```python
# GOOD: Verb-noun pattern, descriptive
async def fetch_events(tenant_id: str, time_range: TimeRange) -> list[AppEvent]:
    ...

def calculate_risk_score(event: AppEvent) -> float:
    ...

def is_valid_category_code(category_id: str) -> bool:
    ...

def parse_network_flow(raw_data: bytes) -> NetworkFlow:
    ...

# BAD: Unclear, noun-only, or too generic
async def events(tid):
    ...

def score(e):
    ...

def check(t):
    ...
```

### Type Hints (Mandatory)
```python
from typing import Optional
from datetime import datetime

# GOOD: Full type annotations
def get_events(
    tenant_id: str,
    start_time: datetime,
    end_time: datetime,
    event_types: list[str] | None = None,
    limit: int = 100,
) -> list[AppEvent]:
    """Retrieve events within time range."""
    ...

# BAD: No type hints
def get_events(tenant_id, start, end, types=None, limit=100):
    ...
```

### Pydantic Models (FastAPI / public-api)
```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from enum import Enum

class EventType(str, Enum):
    ORDER = "order"
    PAYMENT = "payment"
    AUTH = "auth"
    SYSTEM = "system"

class EventCreate(BaseModel):
    """Schema for creating an event."""
    tenant_id: str = Field(..., min_length=1, max_length=64, pattern=r'^[a-zA-Z0-9\-]+$')
    event_type: EventType
    priority: int = Field(..., ge=0, le=10)
    timestamp: datetime
    source_ip: str | None = None
    destination_ip: str | None = None
    description: str = Field(..., max_length=2000)

    @field_validator('timestamp')
    @classmethod
    def timestamp_not_future(cls, v: datetime) -> datetime:
        if v > datetime.utcnow():
            raise ValueError('Event timestamp cannot be in the future')
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "tenant_id": "tenant-abc",
                    "event_type": "order",
                    "priority": 7,
                    "timestamp": "2024-01-15T10:00:00Z",
                    "source_ip": "10.0.0.1",
                    "description": "High-value order placed from a new device"
                }
            ]
        }
    }
```

### Flask-RESTX Patterns (internal-api)
```python
from flask_restx import Namespace, Resource, fields

api = Namespace('tickets', description='Ticket management operations')

ticket_model = api.model('Ticket', {
    'id': fields.String(readonly=True),
    'tenant_id': fields.String(required=True),
    'title': fields.String(required=True, min_length=1, max_length=200),
    'priority': fields.String(required=True, enum=['low', 'medium', 'high', 'critical']),
    'status': fields.String(required=True, enum=['open', 'in_progress', 'resolved', 'closed']),
    'assignee': fields.String(),
    'created_at': fields.DateTime(readonly=True),
})

@api.route('/')
class TicketList(Resource):
    @api.doc('list_tickets')
    @api.marshal_list_with(ticket_model)
    @require_auth
    def get(self):
        """List all tickets for the current tenant."""
        return TicketService.get_tickets(g.tenant_id)

    @api.doc('create_ticket')
    @api.expect(ticket_model)
    @api.marshal_with(ticket_model, code=201)
    @require_auth
    @require_role('editor')
    def post(self):
        """Create a new ticket."""
        return TicketService.create_ticket(g.tenant_id, api.payload), 201
```

### Error Handling (Python)
```python
# GOOD: Comprehensive error handling with custom exceptions
class AppError(Exception):
    """Base exception for the application."""
    def __init__(self, message: str, error_code: str = "INTERNAL_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)

class TenantNotFoundError(AppError):
    def __init__(self, tenant_id: str):
        super().__init__(
            message=f"Tenant not found: {tenant_id}",
            error_code="TENANT_NOT_FOUND"
        )

class QueryTimeoutError(AppError):
    def __init__(self, query_id: str, timeout_seconds: int):
        super().__init__(
            message=f"Query {query_id} timed out after {timeout_seconds}s",
            error_code="QUERY_TIMEOUT"
        )

# Usage with proper exception handling
async def execute_analytics_query(tenant_id: str, query: str) -> QueryResult:
    try:
        validated_query = parse_and_validate(query, tenant_id)
        result = await analytics_client.query(validated_query, timeout=30)
        return QueryResult(data=result.rows, meta=result.summary)
    except ParseError as e:
        raise AppError(f"Invalid query syntax: {e}", "INVALID_QUERY")
    except TimeoutError:
        raise QueryTimeoutError(query_id=generate_id(), timeout_seconds=30)
    except Exception as e:
        logger.error("Unexpected error in analytics query", error=str(e), tenant_id=tenant_id)
        raise AppError("An internal error occurred", "INTERNAL_ERROR")
```

### Async/Await Best Practices (Python)
```python
import asyncio

# GOOD: Parallel execution when possible
async def get_dashboard_data(tenant_id: str) -> DashboardData:
    events, tickets, alerts, stats = await asyncio.gather(
        fetch_recent_events(tenant_id),
        fetch_open_tickets(tenant_id),
        fetch_active_alerts(tenant_id),
        fetch_tenant_stats(tenant_id),
    )
    return DashboardData(events=events, tickets=tickets,
                         alerts=alerts, stats=stats)

# BAD: Sequential when unnecessary
async def get_dashboard_data_slow(tenant_id: str):
    events = await fetch_recent_events(tenant_id)      # Wait
    tickets = await fetch_open_tickets(tenant_id)       # Wait again
    alerts = await fetch_active_alerts(tenant_id)       # Wait again
    stats = await fetch_tenant_stats(tenant_id)         # Wait again
    return DashboardData(...)
```

## Vue.js / TypeScript Standards

### Component Structure (Composition API)
```vue
<!-- GOOD: Well-structured SFC with TypeScript -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { AppEvent } from '~/types/events'

// Props with type safety
const props = defineProps<{
  tenantId: string
  eventType?: string
  limit?: number
}>()

// Emits with type safety
const emit = defineEmits<{
  (e: 'select', event: AppEvent): void
  (e: 'refresh'): void
}>()

// Reactive state
const events = ref<AppEvent[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Computed properties
const highPriorityEvents = computed(() =>
  events.value.filter(e => e.priority >= 7)
)

const eventsByType = computed(() => {
  const grouped = new Map<string, AppEvent[]>()
  for (const event of events.value) {
    const existing = grouped.get(event.event_type) ?? []
    grouped.set(event.event_type, [...existing, event])
  }
  return grouped
})

// Methods
async function fetchEvents(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const { data } = await useFetch(`/api/v1/events`, {
      params: {
        tenant_id: props.tenantId,
        event_type: props.eventType,
        limit: props.limit ?? 100,
      },
    })
    events.value = data.value ?? []
  } catch (e) {
    error.value = 'Failed to load events'
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(fetchEvents)

// Watchers
watch(() => props.eventType, fetchEvents)
</script>

<template>
  <div class="event-list">
    <div v-if="loading" class="loading-spinner" />
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <div v-else>
      <ItemCard
        v-for="event in events"
        :key="event.id"
        :event="event"
        @click="emit('select', event)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.event-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
```

### TypeScript Type Safety
```typescript
// GOOD: Proper types with discriminated unions
interface NetworkFlowEvent {
  type: 'network_flow'
  src_ip: string
  dst_ip: string
  src_port: number
  dst_port: number
  protocol: 'TCP' | 'UDP' | 'ICMP'
  bytes_sent: number
  bytes_received: number
}

interface AuthEvent {
  type: 'auth'
  user_name: string
  auth_result: 'success' | 'failure' | 'lockout'
  source_ip: string
  target_service: string
}

interface EndpointEvent {
  type: 'endpoint'
  hostname: string
  process_name: string
  process_command_line: string
  event_subtype: 'process_start' | 'file_access' | 'registry_change'
}

type AppEvent = {
  id: string
  tenant_id: string
  timestamp: string
  priority: number
  tags: string[]
} & (NetworkFlowEvent | AuthEvent | EndpointEvent)

// Type guards
function isNetworkFlow(event: AppEvent): event is AppEvent & NetworkFlowEvent {
  return event.type === 'network_flow'
}

// BAD: Using 'any'
// function getEvent(id: any): Promise<any> { ... }
```

### Variable and Function Naming (TypeScript)
```typescript
// GOOD: camelCase for variables and functions
const tenantId = 'tenant-abc'
const isAuthenticated = true
const maxRetryCount = 3

async function fetchEvents(tenantId: string): Promise<AppEvent[]> { ... }
function calculateRiskScore(event: AppEvent): number { ... }
function isValidCategoryCode(categoryId: string): boolean { ... }

// GOOD: PascalCase for types and interfaces
interface AppEvent { ... }
type EventPriority = 'low' | 'medium' | 'high' | 'critical'
enum TicketStatus { Open = 'open', Closed = 'closed' }

// GOOD: UPPER_SNAKE_CASE for constants
const MAX_QUERY_TIMEOUT_MS = 30000
const DEFAULT_PAGE_SIZE = 50
const SUPPORTED_EVENT_TYPES = ['order', 'payment', 'auth'] as const
```

### Immutability Pattern (TypeScript)
```typescript
// GOOD: Spread operator for immutable updates
const updatedEvent = {
  ...event,
  status: 'resolved' as const,
  resolved_at: new Date().toISOString(),
}

const updatedList = [...events, newEvent]
const filteredList = events.filter(e => e.severity >= 7)

// BAD: Direct mutation
// event.status = 'resolved'    // Mutation
// events.push(newEvent)        // Mutation
```

## C++ Standards (C++17)

### Naming Conventions
```cpp
// Namespaces: lowercase with underscores, matching directory structure
namespace app::dm::network { ... }
namespace app::database { ... }

// Classes/Structs: PascalCase
class FlowParser { ... };
struct ConnectionInfo { ... };

// Functions: snake_case
void process_network_flow(const Flow& flow);
bool is_valid_tenant_id(const std::string& id);
std::optional<Flow> parse_flow_data(std::string_view data);

// Variables: snake_case
int connection_count = 0;
std::string tenant_id;
bool is_connected = false;

// Constants: UPPER_SNAKE_CASE or kPascalCase
constexpr int MAX_BATCH_SIZE = 10000;
constexpr std::chrono::seconds kFlushInterval{5};
static const std::string DEFAULT_DATABASE = "app";

// Member variables: trailing underscore
class FlowParser {
private:
    std::unique_ptr<Config> config_;
    size_t batch_size_;
    bool running_;
};

// Template parameters: PascalCase
template<typename MessageType, typename WriterType>
class BatchProcessor { ... };
```

### Modern C++17 Patterns
```cpp
// Use structured bindings
auto [host, port] = parse_connection_string(conn_str);

// Use std::optional for nullable returns
std::optional<Flow> FlowParser::parse(std::string_view data) {
    if (data.empty()) {
        return std::nullopt;
    }
    Flow flow;
    if (!flow.ParseFromString(std::string(data))) {
        return std::nullopt;
    }
    return flow;
}

// Use std::variant for type-safe unions
using ParseResult = std::variant<Flow, ParseError>;
ParseResult parse_message(std::string_view data);

// Use if-init statements
if (auto result = parse_flow(data); result.has_value()) {
    process_flow(*result);
} else {
    log_error("Failed to parse flow");
}

// Use string_view for non-owning references
void process_data(std::string_view data);  // No copy
// Not: void process_data(const std::string& data);  // May copy

// Use constexpr for compile-time computation
constexpr size_t MAX_MESSAGE_SIZE = 64 * 1024 * 1024;
constexpr auto FLUSH_INTERVAL = std::chrono::seconds(5);
```

### Resource Management (RAII)
```cpp
// GOOD: Smart pointers for ownership
auto parser = std::make_unique<FlowParser>(config);
auto shared_config = std::make_shared<Config>(load_config());

// GOOD: RAII wrapper for resources
class DatabaseConnection {
public:
    explicit DatabaseConnection(const ConnectionConfig& config)
        : client_(std::make_unique<db::Client>(
            db::ClientOptions()
                .SetHost(config.host)
                .SetPort(config.port))) {}

    ~DatabaseConnection() = default;

    // Non-copyable
    DatabaseConnection(const DatabaseConnection&) = delete;
    DatabaseConnection& operator=(const DatabaseConnection&) = delete;

    // Movable
    DatabaseConnection(DatabaseConnection&&) noexcept = default;
    DatabaseConnection& operator=(DatabaseConnection&&) noexcept = default;

    void insert(const std::string& table, const db::Block& block) {
        client_->Insert(table, block);
    }

private:
    std::unique_ptr<db::Client> client_;
};

// BAD: Raw pointers and manual memory management
// FlowParser* parser = new FlowParser(config);
// delete parser;
```

### Error Handling (C++)
```cpp
// Use exceptions for exceptional conditions
class AppError : public std::runtime_error {
public:
    explicit AppError(const std::string& message)
        : std::runtime_error(message) {}
};

class ParseError : public AppError {
public:
    explicit ParseError(const std::string& message)
        : AppError("Parse error: " + message) {}
};

// Use std::optional or std::expected for expected failures
std::optional<Flow> parse_flow(std::string_view data) noexcept {
    try {
        Flow flow;
        if (!flow.ParseFromString(std::string(data))) {
            return std::nullopt;
        }
        return flow;
    } catch (...) {
        return std::nullopt;
    }
}

// Use noexcept for functions that should never throw
void swap(FlowParser& other) noexcept;
size_t size() const noexcept;
```

## API Design Standards

### REST API Conventions
```
# API URL patterns
GET    /api/v1/events                    # List events
GET    /api/v1/events/{event_id}         # Get specific event
POST   /api/v1/events                    # Ingest new event
GET    /api/v1/tickets                   # List tickets
POST   /api/v1/tickets                   # Create ticket
PATCH  /api/v1/tickets/{ticket_id}       # Update ticket
GET    /api/v1/alerts                    # List active alerts
POST   /api/v1/analytics/query           # Execute analytics query

# Query parameters for filtering
GET /api/v1/events?event_type=order&priority_min=7&limit=50&offset=0

# Versioning via URL path prefix (v1, v2)
# Tenant scoping via header (X-Tenant-ID) validated against JWT
```

### Consistent Response Format
```python
# Python response structure
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional

T = TypeVar('T')

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
    meta: Optional[PaginationMeta] = None

    @classmethod
    def ok(cls, data: T, meta: PaginationMeta = None) -> "ApiResponse[T]":
        return cls(success=True, data=data, meta=meta)

    @classmethod
    def fail(cls, error: str, error_code: str = "UNKNOWN") -> "ApiResponse":
        return cls(success=False, error=error, error_code=error_code)
```

```typescript
// TypeScript response interface (frontend)
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  error_code?: string
  meta?: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}
```

## File Organization

### Python Project Structure (internal-api)
```
appapi/
├── app/                    # Business logic layer
│   ├── tickets/           # Ticket management domain
│   │   ├── __init__.py
│   │   ├── service.py     # Business logic
│   │   └── models.py      # Domain models
│   ├── analytics/         # Analytics/query domain
│   │   ├── __init__.py
│   │   ├── query_service.py
│   │   └── validators.py
│   └── users/             # User management domain
├── apis/                  # REST endpoint definitions
│   ├── __init__.py
│   ├── tickets.py        # /api/v1/tickets endpoints
│   ├── events.py         # /api/v1/events endpoints
│   └── analytics.py      # /api/v1/analytics endpoints
├── db/                    # Data access layer
│   ├── analytics.py      # Analytics database client
│   ├── mysql.py          # SQLAlchemy session
│   └── redis.py          # Redis client
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
└── config.py             # Application configuration
```

### Vue/Nuxt Project Structure (frontend)
```
frontend/
├── pages/                 # Nuxt auto-routed pages
│   ├── index.vue
│   ├── tickets/
│   │   ├── index.vue
│   │   └── [id].vue
│   ├── query-console.vue
│   └── dashboard.vue
├── components/            # Vue components
│   ├── ui/               # Generic reusable UI
│   │   ├── SeverityBadge.vue
│   │   ├── DataTable.vue
│   │   └── TimeRangeSelector.vue
│   ├── tickets/          # Ticket-specific components
│   ├── events/           # Event-specific components
│   └── query/            # Query console components
├── composables/           # Vue composables (hooks)
│   ├── useEvents.ts
│   ├── useTickets.ts
│   └── useAuth.ts
├── stores/                # Pinia stores
│   ├── tickets.ts
│   ├── events.ts
│   └── auth.ts
├── middleware/            # Nuxt middleware
│   └── auth.ts
├── types/                 # TypeScript definitions
│   ├── events.ts
│   ├── tickets.ts
│   └── api.ts
└── utils/                 # Utility functions
    ├── formatting.ts
    ├── validation.ts
    └── constants.ts
```

### C++ Project Structure
```
data-loader/
├── src/
│   ├── main.cpp
│   ├── database/
│   │   ├── analytics_writer.h
│   │   ├── analytics_writer.cpp
│   │   └── batch_buffer.h
│   ├── parser/
│   │   ├── flow_parser.h
│   │   ├── flow_parser.cpp
│   │   └── message_handler.h
│   └── config/
│       ├── config.h
│       └── config.cpp
├── test/
│   ├── unit/
│   │   ├── test_flow_parser.cpp
│   │   └── test_batch_buffer.cpp
│   └── integration/
│       └── test_analytics_writer.cpp
├── external/
│   └── shared-data-model/
├── CMakeLists.txt
└── build_linux.bash
```

## Comments and Documentation

### When to Comment
```python
# GOOD: Explain WHY, not WHAT

# Use exponential backoff to avoid overwhelming the analytics database during merge operations
delay = min(1000 * (2 ** retry_count), 30000)

# Tenant scoping is enforced at this layer as a security boundary,
# even though the API layer also validates. Defense in depth.
if not query.has_tenant_filter(tenant_id):
    query.add_tenant_filter(tenant_id)

# BAD: Stating the obvious
# Increment the counter
counter += 1

# Get the tenant ID
tenant_id = request.tenant_id
```

### Docstrings (Python)
```python
async def execute_analytics_query(
    tenant_id: str,
    query_text: str,
    timeout_seconds: int = 30,
) -> QueryResult:
    """Execute a query against the analytics database.

    Parses the query, validates syntax and security constraints,
    injects tenant scoping, and executes against the analytics database.

    Args:
        tenant_id: The tenant identifier for data scoping.
        query_text: Raw query from the query console.
        timeout_seconds: Maximum query execution time.

    Returns:
        QueryResult containing rows, column metadata, and execution stats.

    Raises:
        ParseError: If the query has invalid syntax.
        SecurityError: If the query attempts prohibited operations.
        QueryTimeoutError: If execution exceeds timeout_seconds.
    """
    ...
```

### TSDoc (TypeScript)
```typescript
/**
 * Fetches events for a given tenant and time range.
 *
 * @param tenantId - The tenant identifier
 * @param options - Query options including time range and filters
 * @returns Promise resolving to paginated events
 *
 * @example
 * ```typescript
 * const events = await fetchEvents('tenant-abc', {
 *   timeRange: { start: '2024-01-01', end: '2024-01-02' },
 *   eventType: 'order',
 *   limit: 50,
 * })
 * ```
 */
export async function fetchEvents(
  tenantId: string,
  options: EventQueryOptions,
): Promise<PaginatedResponse<AppEvent>> {
  // Implementation
}
```

### Doxygen (C++)
```cpp
/**
 * @brief Parses raw network flow data into a protobuf message.
 *
 * Validates message size, parses the protobuf, and checks
 * required fields. Returns std::nullopt on any failure.
 *
 * @param data Raw bytes from the data source
 * @return Parsed Flow message or std::nullopt on failure
 *
 * @note Thread-safe. Can be called from multiple threads.
 * @warning Input must be valid protobuf. Malformed data is rejected.
 */
std::optional<app::dm::network::Flow> parse_flow(std::string_view data);
```

## Code Smell Detection

### 1. Long Functions
```python
# BAD: Function doing too much
def process_security_event(event):
    # 150 lines of validation, transformation, storage, notification...

# GOOD: Split into focused functions
def process_security_event(event: RawEvent) -> ProcessedEvent:
    validated = validate_event(event)
    enriched = enrich_event(validated)
    stored = store_event(enriched)
    notify_if_critical(stored)
    return stored
```

### 2. Deep Nesting
```python
# BAD: 5+ levels of nesting
if user:
    if user.is_authenticated:
        if tenant_id:
            if has_permission(user, 'read:events'):
                if query.is_valid():
                    # Do something

# GOOD: Early returns (guard clauses)
if not user or not user.is_authenticated:
    raise AuthenticationError("Not authenticated")
if not tenant_id:
    raise ValueError("Missing tenant_id")
if not has_permission(user, 'read:events'):
    raise PermissionError("Insufficient permissions")
if not query.is_valid():
    raise ValidationError("Invalid query")

# Do something
```

### 3. Magic Numbers
```python
# BAD: Unexplained numbers
if retry_count > 3:
    ...
await asyncio.sleep(0.5)
if severity > 7:
    ...

# GOOD: Named constants
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 0.5
HIGH_SEVERITY_THRESHOLD = 7

if retry_count > MAX_RETRIES:
    ...
await asyncio.sleep(RETRY_DELAY_SECONDS)
if severity > HIGH_SEVERITY_THRESHOLD:
    ...
```

### 4. God Objects
```python
# BAD: One class doing everything
class EventManager:
    def fetch_events(self): ...
    def store_events(self): ...
    def validate_events(self): ...
    def send_notifications(self): ...
    def generate_reports(self): ...
    def manage_users(self): ...

# GOOD: Single responsibility per class
class EventRepository:
    def fetch(self, query: EventQuery) -> list[Event]: ...
    def store(self, events: list[Event]) -> None: ...

class EventValidator:
    def validate(self, event: RawEvent) -> ValidatedEvent: ...

class NotificationService:
    def notify(self, event: Event) -> None: ...
```

## Performance Best Practices

### Python
```python
# Use generators for large datasets
def stream_events(tenant_id: str):
    offset = 0
    while True:
        batch = fetch_batch(tenant_id, offset, limit=1000)
        if not batch:
            break
        yield from batch
        offset += 1000

# Use dataclasses for simple data containers (faster than dict)
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class FlowSummary:
    src_ip: str
    dst_ip: str
    total_bytes: int
    connection_count: int
```

### Vue.js
```typescript
// Use computed properties instead of methods for cached results
const filteredEvents = computed(() =>
  events.value.filter(e => e.severity >= severityFilter.value)
)

// Use shallowRef for large arrays that replace entirely
const events = shallowRef<AppEvent[]>([])

// Use v-once for static content
// <div v-once>{{ staticLabel }}</div>

// Use dynamic imports for code splitting
const QueryEditor = defineAsyncComponent(() =>
  import('~/components/query/QueryEditor.vue')
)
```

### C++
```cpp
// Reserve vector capacity when size is known
std::vector<Flow> flows;
flows.reserve(expected_count);

// Move semantics for large objects
std::vector<Flow> parse_batch(std::string data) {
    std::vector<Flow> result;
    // ... parse ...
    return result;  // NRVO / move, not copy
}

// Use emplace_back instead of push_back
flows.emplace_back(std::move(flow));

// Prefer references to avoid copies
void process(const std::vector<Flow>& flows);  // const ref
void modify(std::vector<Flow>& flows);          // mutable ref
```

## Linting and Formatting Tools

### Python
```bash
# Ruff (replaces flake8 + black + isort)
ruff check .          # Lint
ruff format .         # Format
ruff check --fix .    # Auto-fix

# mypy for type checking
mypy appapi/ --strict

# bandit for security linting
bandit -r appapi/
```

### TypeScript / Vue
```bash
# ESLint 9+ with flat config
npm run lint          # Lint
npm run lint:fix      # Auto-fix

# TypeScript strict mode
npx tsc --noEmit
```

### C++
```bash
# clang-format for formatting
clang-format -i src/*.cpp src/*.h

# cppcheck for static analysis
cppcheck --enable=all --std=c++17 src/

# clang-tidy for deeper analysis
clang-tidy src/*.cpp -- -std=c++17
```

---

**Remember**: Code quality is not negotiable. Clear, maintainable code enables rapid development and confident refactoring. Follow the conventions of each language, use automated tools to enforce them, and prioritize readability in all decisions.

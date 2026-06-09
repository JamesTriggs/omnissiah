---
name: security-review
description: Use this skill when adding authentication, handling user input, working with secrets, creating API endpoints, modifying configurable rules, or implementing any security-sensitive features.
---

# Security Review Skill

This skill ensures code follows security best practices and identifies potential vulnerabilities. Hold code to a high security standard, a vulnerability could compromise user data or environments.

## When to Activate

- Implementing authentication or authorization
- Handling user input or file uploads
- Creating new API endpoints (Flask-RESTX or FastAPI)
- Working with secrets or credentials
- Modifying configurable rules or policies
- Accessing or modifying tenant data
- Writing analytics-database or MySQL queries
- Handling Protocol Buffer deserialization
- Modifying C++ components
- Deploying to cloud infrastructure
- Processing PII or customer data
- Working with inter-service communication

## Security Checklist

### 1. Secrets Management

#### NEVER Do This
```python
# Python
api_key = "sk-proj-xxxxx"           # Hardcoded secret
db_password = "password123"          # In source code
DB_HOST = "10.0.1.50"               # Hardcoded infrastructure
```

```cpp
// C++
const std::string api_key = "sk-proj-xxxxx";  // Hardcoded
const char* db_pass = "password123";           // In source code
```

#### ALWAYS Do This
```python
# Python - Flask (internal-api)
import os

api_key = os.environ.get("APP_API_KEY")
if not api_key:
    raise RuntimeError("APP_API_KEY not configured")

# Python - FastAPI (public-api)
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    analytics_db_host: str
    analytics_db_password: str
    jwt_secret: str

    class Config:
        env_prefix = "APP_"
        env_file = ".env"

settings = Settings()
```

```cpp
// C++
#include <cstdlib>

const char* api_key = std::getenv("APP_API_KEY");
if (!api_key) {
    throw std::runtime_error("APP_API_KEY not configured");
}
```

#### Verification Steps
- [ ] No hardcoded API keys, tokens, or passwords in any language
- [ ] All secrets loaded from environment variables
- [ ] `.env` and `.env.local` in `.gitignore`
- [ ] No secrets in git history (check with `git log -p --all -S 'password'`)
- [ ] Production secrets in a secrets manager (e.g. AWS Secrets Manager or Parameter Store)
- [ ] Secrets rotated on regular schedule
- [ ] No secrets in Docker image layers

### 2. Input Validation

#### Python - Pydantic (FastAPI / public-api)
```python
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
import re

class EventQuery(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=64)
    start_time: datetime
    end_time: datetime
    event_type: Optional[str] = Field(None, pattern=r'^[a-zA-Z0-9_]+$')
    limit: int = Field(default=100, ge=1, le=10000)

    @validator('tenant_id')
    def validate_tenant_id(cls, v):
        if not re.match(r'^[a-zA-Z0-9\-]+$', v):
            raise ValueError('Invalid tenant_id format')
        return v

    @validator('end_time')
    def validate_time_range(cls, v, values):
        if 'start_time' in values and v < values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v
```

#### Python - Flask-RESTX (internal-api)
```python
from flask_restx import Namespace, Resource, fields, reqparse

api = Namespace('events', description='Event operations')

event_model = api.model('Event', {
    'tenant_id': fields.String(required=True, max_length=64),
    'event_type': fields.String(required=True, enum=['order', 'payment', 'auth']),
    'priority': fields.Integer(required=True, min=0, max=10),
})

parser = reqparse.RequestParser()
parser.add_argument('limit', type=int, default=100, choices=range(1, 10001))
parser.add_argument('offset', type=int, default=0, help='Pagination offset')
```

#### Vue.js / TypeScript (frontend)
```typescript
import { useField, useForm } from 'vee-validate'
import * as yup from 'yup'

const schema = yup.object({
  queryText: yup.string()
    .required('Query is required')
    .max(10000, 'Query too long')
    .test('no-injection', 'Invalid characters detected',
      (value) => !/[;'"\\]/.test(value || '')),
  timeRange: yup.number()
    .required()
    .oneOf([1, 6, 12, 24, 48, 168], 'Invalid time range'),
})
```

#### C++ Input Validation
```cpp
#include <string>
#include <stdexcept>
#include <regex>

void validate_tenant_id(const std::string& tenant_id) {
    if (tenant_id.empty() || tenant_id.size() > 64) {
        throw std::invalid_argument("Invalid tenant_id length");
    }
    static const std::regex valid_pattern("^[a-zA-Z0-9\\-]+$");
    if (!std::regex_match(tenant_id, valid_pattern)) {
        throw std::invalid_argument("Invalid tenant_id format");
    }
}

// Validate protobuf message size before deserialization
bool validate_message_size(size_t size) {
    constexpr size_t MAX_MESSAGE_SIZE = 64 * 1024 * 1024; // 64MB
    return size > 0 && size <= MAX_MESSAGE_SIZE;
}
```

#### File Upload Validation
```python
from werkzeug.utils import secure_filename
import magic

ALLOWED_EXTENSIONS = {'.csv', '.json', '.xlsx', '.pdf'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

def validate_file_upload(file) -> bool:
    # Size check
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        raise ValueError(f'File too large (max {MAX_FILE_SIZE // 1024 // 1024}MB)')

    # Extension check
    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f'Invalid file type: {ext}')

    # MIME type validation (magic number check)
    mime = magic.from_buffer(file.read(2048), mime=True)
    file.seek(0)
    ALLOWED_MIMES = {'text/csv', 'application/json', 'application/pdf'}
    if mime not in ALLOWED_MIMES:
        raise ValueError(f'Invalid MIME type: {mime}')

    return True
```

#### Verification Steps
- [ ] All user inputs validated with Pydantic models or Flask-RESTX parsers
- [ ] File uploads restricted (size, type, extension, MIME)
- [ ] No direct use of user input in queries
- [ ] Whitelist validation (not blacklist)
- [ ] Error messages do not leak sensitive info
- [ ] Protobuf message sizes validated before deserialization
- [ ] Query strings sanitized before passing to any query parser

### 3. SQL Injection Prevention

#### Analytics Database Injection Prevention

The examples below use a columnar-analytics client, but the same parameterisation rules apply to any analytics database.

##### NEVER Concatenate SQL
```python
# DANGEROUS - injection vulnerability
query = f"SELECT * FROM events WHERE tenant_id = '{tenant_id}'"
client.query(query)

# ALSO DANGEROUS - format string
query = "SELECT * FROM events WHERE tenant_id = '%s'" % tenant_id
```

##### ALWAYS Use Parameterized Queries
```python
# Native parameter binding (preferred)
client = get_analytics_client(host='localhost')
result = client.query(
    "SELECT * FROM events WHERE tenant_id = {tenant_id:String} AND timestamp > {start:DateTime}",
    parameters={
        'tenant_id': tenant_id,
        'start': start_time
    }
)

# Driver-style parameter binding
result = client.execute(
    "SELECT * FROM events WHERE tenant_id = %(tenant_id)s",
    {'tenant_id': tenant_id}
)
```

#### MySQL / SQLAlchemy Injection Prevention
```python
# ALWAYS use SQLAlchemy ORM or parameterized queries
from sqlalchemy import select, and_
from models import Ticket, User

# ORM query (safe)
stmt = select(Ticket).where(
    and_(
        Ticket.tenant_id == tenant_id,
        Ticket.status == 'open'
    )
)
result = session.execute(stmt)

# Raw SQL with parameters (when ORM is insufficient)
result = session.execute(
    text("SELECT * FROM tickets WHERE tenant_id = :tid AND status = :status"),
    {"tid": tenant_id, "status": "open"}
)
```

#### Query Parser Security
```python
# When using a query parser for user-supplied queries, validate input before parsing
from app_query_parser import parse_query

def safe_parse_query(user_query: str, tenant_id: str) -> str:
    """Parse and validate a query with mandatory tenant scoping."""
    # Length limit
    if len(user_query) > 50000:
        raise ValueError("Query too long")

    # Parse through the query parser (validates syntax)
    parsed = parse_query(user_query)

    # CRITICAL: Ensure tenant scoping is applied
    if not parsed.has_tenant_filter():
        parsed.add_tenant_filter(tenant_id)

    # Validate no prohibited operations
    if parsed.has_mutation_operations():
        raise ValueError("Mutation operations not allowed in the query console")

    return parsed.to_sql()
```

#### Verification Steps
- [ ] All analytics-database queries use parameterized queries
- [ ] All MySQL queries use SQLAlchemy ORM or parameterized text()
- [ ] No string concatenation or f-strings in any SQL
- [ ] Query parser output validated before execution
- [ ] User-supplied queries always tenant-scoped
- [ ] No DDL operations allowed from user input

### 4. Tenant Data Isolation (CRITICAL)

In a multi-tenant application, tenant data isolation failures are severity-1 security incidents. Skip this section for single-tenant systems.

#### Mandatory Tenant Scoping
```python
# EVERY query MUST include tenant_id filtering

# FastAPI dependency for tenant extraction
from fastapi import Depends, Header, HTTPException

async def get_current_tenant(
    x_tenant_id: str = Header(...),
    authorization: str = Header(...)
) -> str:
    """Extract and validate tenant_id from request headers."""
    token_payload = verify_jwt(authorization)
    if token_payload['tenant_id'] != x_tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    return x_tenant_id

# Apply to all routes
@router.get("/events")
async def get_events(
    tenant_id: str = Depends(get_current_tenant),
    query: EventQuery = Depends()
):
    # tenant_id is guaranteed to be validated
    return await event_service.get_events(tenant_id, query)
```

#### Analytics Database Tenant Isolation
```python
class TenantScopedAnalyticsClient:
    """Wrapper that enforces tenant_id in all queries."""

    def __init__(self, client, tenant_id: str):
        self._client = client
        self._tenant_id = tenant_id

    def query(self, sql: str, parameters: dict = None) -> Any:
        parameters = parameters or {}

        # ALWAYS inject tenant_id
        parameters['_tenant_id'] = self._tenant_id

        # Verify query references tenant_id
        if '{_tenant_id' not in sql and '_tenant_id' not in sql:
            raise SecurityError(
                "All queries MUST include tenant_id filter. "
                "Use {_tenant_id:String} parameter."
            )

        return self._client.query(sql, parameters=parameters)
```

#### Verification Steps
- [ ] Every API endpoint extracts and validates tenant_id
- [ ] Every database query includes tenant_id filter
- [ ] No cross-tenant data leakage possible
- [ ] Tenant isolation tested with integration tests
- [ ] Aggregation queries respect tenant boundaries
- [ ] Background jobs (Celery) carry tenant context
- [ ] WebSocket connections scoped to tenant

### 5. Authentication and Authorization

#### JWT Token Handling
```python
# FastAPI (public-api)
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["RS256"],  # Use asymmetric signing
            audience="app-api",
            issuer="app-auth"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

#### Flask (internal-api) Authentication
```python
from functools import wraps
from flask import request, g, jsonify

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({"error": "Missing authorization"}), 401

        try:
            payload = verify_jwt_token(token)
            g.current_user = payload
            g.tenant_id = payload['tenant_id']
        except Exception:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)
    return decorated

def require_role(role: str):
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated(*args, **kwargs):
            if g.current_user.get('role') != role:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
```

#### Role-Based Access Control
```python
from enum import Enum
from typing import Set

class Permission(str, Enum):
    READ_EVENTS = "read:events"
    WRITE_EVENTS = "write:events"
    MANAGE_RULES = "manage:rules"
    MANAGE_TICKETS = "manage:tickets"
    ADMIN = "admin"
    QUERY_CONSOLE = "query:console"
    SYSTEM_CONFIG = "system:config"

ROLE_PERMISSIONS: dict[str, Set[Permission]] = {
    "viewer": {Permission.READ_EVENTS},
    "editor": {Permission.READ_EVENTS, Permission.MANAGE_TICKETS, Permission.QUERY_CONSOLE},
    "engineer": {Permission.READ_EVENTS, Permission.WRITE_EVENTS,
                 Permission.MANAGE_RULES, Permission.MANAGE_TICKETS, Permission.QUERY_CONSOLE},
    "admin": set(Permission),
}

def check_permission(user_role: str, required: Permission) -> bool:
    permissions = ROLE_PERMISSIONS.get(user_role, set())
    return required in permissions
```

#### Verification Steps
- [ ] JWT tokens use asymmetric signing (RS256)
- [ ] Tokens have expiration and audience claims
- [ ] Authorization checks on every endpoint
- [ ] Role-based access control enforced
- [ ] Session management uses httpOnly cookies where applicable
- [ ] Token refresh mechanism implemented
- [ ] Failed auth attempts are logged and rate-limited

### 6. XSS Prevention (Vue.js / Nuxt)

#### Template Sanitization
```vue
<template>
  <!-- SAFE: Vue auto-escapes interpolation -->
  <div>{{ userInput }}</div>

  <!-- DANGEROUS: v-html bypasses escaping -->
  <!-- NEVER use v-html with user input -->
  <div v-html="sanitizedContent"></div>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify'

const props = defineProps<{
  rawContent: string
}>()

// ALWAYS sanitize before v-html
const sanitizedContent = computed(() =>
  DOMPurify.sanitize(props.rawContent, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'li'],
    ALLOWED_ATTR: []
  })
)
</script>
```

#### Content Security Policy (Nuxt 3)
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'strict-dynamic'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self'",
          "connect-src 'self' https://api.example.com wss://ws.example.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join('; ')
      }
    }
  }
})
```

#### Verification Steps
- [ ] No v-html with unsanitized user input
- [ ] CSP headers configured in Nuxt config
- [ ] DOMPurify used for any HTML rendering
- [ ] Monaco Editor (query console) sandboxed appropriately
- [ ] No inline event handlers with user data

### 7. Protobuf Deserialization Safety

#### C++ Protobuf Safety
```cpp
#include <google/protobuf/io/coded_stream.h>
#include "app/dm/network/flow.pb.h"

bool safe_parse_message(const std::string& raw_data,
                        app::dm::network::Flow& message) {
    // Limit message size
    constexpr size_t MAX_SIZE = 64 * 1024 * 1024;  // 64MB
    if (raw_data.size() > MAX_SIZE) {
        LOG(ERROR) << "Message exceeds size limit: " << raw_data.size();
        return false;
    }

    // Set recursion limit
    google::protobuf::io::CodedInputStream input(
        reinterpret_cast<const uint8_t*>(raw_data.data()),
        raw_data.size()
    );
    input.SetRecursionLimit(64);

    // Parse with validation
    if (!message.ParseFromCodedStream(&input)) {
        LOG(ERROR) << "Failed to parse protobuf message";
        return false;
    }

    // Validate required fields
    if (message.tenant_id().empty()) {
        LOG(ERROR) << "Missing required field: tenant_id";
        return false;
    }

    return true;
}
```

#### Python Protobuf Safety
```python
from google.protobuf.message import DecodeError

MAX_MESSAGE_SIZE = 64 * 1024 * 1024  # 64MB

def safe_parse_protobuf(raw_data: bytes, message_class):
    """Safely parse protobuf with size and validation checks."""
    if len(raw_data) > MAX_MESSAGE_SIZE:
        raise ValueError(f"Message exceeds size limit: {len(raw_data)}")

    try:
        message = message_class()
        message.ParseFromString(raw_data)
    except DecodeError as e:
        raise ValueError(f"Invalid protobuf data: {e}")

    # Check for unknown fields (potential version mismatch)
    unknown = message.UnknownFields()
    if unknown:
        logger.warning(f"Message contains {len(unknown)} unknown fields")

    return message
```

#### Verification Steps
- [ ] Message size limits enforced before parsing
- [ ] Recursion depth limited in C++ parsing
- [ ] Unknown fields logged but not blindly forwarded
- [ ] Required fields validated post-parse
- [ ] Malformed messages rejected gracefully (no crashes)
- [ ] Arena allocation used for high-throughput paths

### 8. C++ Memory Safety

#### ASAN and Valgrind
```bash
# Build with AddressSanitizer
cmake .. -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer"
make -j$(nproc)

# Build with ThreadSanitizer (for multi-threaded code)
cmake .. -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_CXX_FLAGS="-fsanitize=thread"

# Valgrind memory leak check
valgrind --leak-check=full --show-leak-kinds=all \
    --track-origins=yes --verbose \
    ./build/bin/data_loader --test-mode

# Valgrind cache profiling
valgrind --tool=cachegrind ./build/bin/data_loader --benchmark
```

#### Safe C++ Patterns
```cpp
// ALWAYS use smart pointers
auto flow = std::make_unique<app::dm::network::Flow>();
auto shared_config = std::make_shared<Config>(load_config());

// NEVER use raw new/delete
// auto* raw_ptr = new Flow();  // BAD
// delete raw_ptr;               // BAD

// Use RAII for resource management
class DatabaseConnection {
public:
    DatabaseConnection(const std::string& connection_string)
        : conn_(connect(connection_string)) {}

    ~DatabaseConnection() {
        if (conn_) conn_->close();
    }

    // Prevent copying
    DatabaseConnection(const DatabaseConnection&) = delete;
    DatabaseConnection& operator=(const DatabaseConnection&) = delete;

    // Allow moving
    DatabaseConnection(DatabaseConnection&&) noexcept = default;
    DatabaseConnection& operator=(DatabaseConnection&&) noexcept = default;

private:
    std::unique_ptr<Connection> conn_;
};

// Use std::string_view for non-owning references
void process_data(std::string_view data) {
    // No allocation, no ownership
}

// Bounds checking with .at() or range checks
void access_element(const std::vector<int>& vec, size_t index) {
    if (index >= vec.size()) {
        throw std::out_of_range("Index out of bounds");
    }
    return vec[index];
}
```

#### Compiler Security Flags
```cmake
# CMakeLists.txt security hardening
target_compile_options(${PROJECT_NAME} PRIVATE
    -Wall -Wextra -Werror
    -fstack-protector-strong
    -D_FORTIFY_SOURCE=2
    -fPIC
    -Wformat -Wformat-security
    -Werror=format-security
    -Wconversion
    -Wsign-conversion
)

target_link_options(${PROJECT_NAME} PRIVATE
    -Wl,-z,relro,-z,now
    -Wl,-z,noexecstack
)
```

#### Verification Steps
- [ ] ASAN build passes with zero errors
- [ ] Valgrind reports zero memory leaks
- [ ] No raw new/delete usage
- [ ] Smart pointers used for all heap allocations
- [ ] Buffer overflows prevented with bounds checking
- [ ] Stack protector enabled in CMake
- [ ] FORTIFY_SOURCE enabled
- [ ] No use-after-free possibilities
- [ ] Thread safety verified with TSAN

### 9. AWS Security

#### IAM and Security Groups
```python
# Use IAM roles, never hardcode AWS credentials
import boto3

# GOOD: Uses IAM role (ECS task role or EC2 instance profile)
s3_client = boto3.client('s3')

# NEVER hardcode credentials
# s3_client = boto3.client('s3',
#     aws_access_key_id='AKIA...',  # NEVER
#     aws_secret_access_key='...'    # NEVER
# )
```

#### Encryption at Rest and in Transit
```python
# S3 server-side encryption
s3_client.put_object(
    Bucket='app-tenant-data',
    Key=f'{tenant_id}/events/{event_id}.pb',
    Body=serialized_data,
    ServerSideEncryption='aws:kms',
    SSEKMSKeyId='alias/app-tenant-key'
)

# Analytics database TLS configuration
ANALYTICS_DB_CONFIG = {
    'host': os.environ['ANALYTICS_DB_HOST'],
    'port': 9440,  # TLS port
    'secure': True,
    'verify': True,
    'ca_cert': '/etc/ssl/certs/ca-bundle.crt'
}
```

#### Security Group Patterns
```python
# Terraform / IaC security group patterns
# The database should only be accessible from application subnets
# Never expose the database to 0.0.0.0/0

# Container task networking
# - Application tasks in private subnets
# - Load balancer in public subnets
# - Database in private subnets with no internet access
# - VPC endpoints for cloud services (object storage, secrets manager)
```

#### Verification Steps
- [ ] No hardcoded cloud credentials anywhere
- [ ] IAM roles follow least-privilege principle
- [ ] Object storage buckets use server-side encryption (KMS)
- [ ] Analytics database connections use TLS
- [ ] Security groups restrict access to minimum required
- [ ] VPC endpoints used for cloud service access
- [ ] Audit logging enabled (e.g. CloudTrail)
- [ ] No public-facing database endpoints

### 10. PII and GDPR Compliance

#### PII Handling
```python
import hashlib
from typing import Optional

class PIIHandler:
    """Handle PII fields in events."""

    SENSITIVE_FIELDS = {
        'user_email', 'user_name', 'ip_address',
        'hostname', 'mac_address', 'username'
    }

    @staticmethod
    def anonymize_field(value: str, salt: str) -> str:
        """One-way hash for PII fields when anonymization is required."""
        return hashlib.sha256(f"{salt}:{value}".encode()).hexdigest()[:16]

    @staticmethod
    def mask_email(email: str) -> str:
        """Mask email for display: j***@example.com"""
        local, domain = email.split('@')
        return f"{local[0]}***@{domain}"

    @staticmethod
    def mask_ip(ip: str) -> str:
        """Mask last octet: 192.168.1.xxx"""
        parts = ip.split('.')
        if len(parts) == 4:
            parts[-1] = 'xxx'
        return '.'.join(parts)
```

#### Data Retention and TTL
```sql
-- Analytics database TTL for GDPR compliance (columnar-store syntax shown)
CREATE TABLE events (
    tenant_id String,
    event_time DateTime,
    event_type String,
    -- ... other fields
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(event_time))
ORDER BY (tenant_id, event_time)
TTL event_time + INTERVAL 90 DAY DELETE
SETTINGS merge_with_ttl_timeout = 86400;

-- Tenant-specific retention policies
ALTER TABLE events
    MODIFY TTL event_time + INTERVAL 30 DAY DELETE
    WHERE tenant_id = 'tenant-requiring-30-day-retention';
```

#### Audit Logging
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
    details: Optional[dict] = None
):
    """Create immutable audit log entry."""
    logger.info(
        "audit_event",
        action=action,
        user_id=user_id,
        tenant_id=tenant_id,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        timestamp=datetime.utcnow().isoformat(),
        source="app-api"
    )

# Usage
audit_log(
    action="query_executed",
    user_id=current_user.id,
    tenant_id=tenant_id,
    resource_type="analytics_query",
    resource_id=query_id,
    details={"query_hash": hash(query_text), "rows_returned": len(results)}
)
```

#### Verification Steps
- [ ] PII fields identified and handled appropriately
- [ ] Data retention TTLs set per compliance requirements
- [ ] Right-to-erasure (GDPR Article 17) implementable
- [ ] Audit logs capture all data access
- [ ] No PII in application logs
- [ ] Data export mechanism available (GDPR Article 20)
- [ ] Consent tracking for data processing
- [ ] Cross-border data transfer compliance checked

### 11. Configurable Rule Integrity

If your application lets users or operators supply configurable rules or policies, validate them so they cannot be weaponised.

#### Rule Security
```python
def validate_rule(rule: dict) -> bool:
    """Validate a configurable rule cannot be weaponized."""

    # Check rule does not execute arbitrary code
    if 'eval(' in str(rule) or 'exec(' in str(rule):
        raise SecurityError("Rules must not contain code execution")

    # Validate structure
    required_fields = ['name', 'version', 'conditions', 'category']
    for field in required_fields:
        if field not in rule:
            raise ValueError(f"Missing required field: {field}")

    # Validate the category against an allow-list
    ALLOWED_CATEGORIES = {'orders', 'payments', 'auth', 'system'}
    if rule['category'] not in ALLOWED_CATEGORIES:
        raise ValueError(f"Invalid category: {rule['category']}")

    # Check rule performance impact
    if rule.get('scan_interval_seconds', 60) < 10:
        raise ValueError("Scan interval too aggressive (min 10 seconds)")

    return True
```

#### Verification Steps
- [ ] Rules cannot execute arbitrary code
- [ ] Rule fields validated against allow-lists
- [ ] Rule performance impact assessed
- [ ] Rule versioning enforced
- [ ] Rollback mechanism available
- [ ] Rules tested against false-positive benchmarks

### 12. Rate Limiting

#### FastAPI Rate Limiting
```python
from fastapi import Request, HTTPException
from collections import defaultdict
import time

class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def check_rate_limit(self, request: Request):
        client_ip = request.client.host
        tenant_id = request.headers.get('X-Tenant-ID', 'unknown')
        key = f"{tenant_id}:{client_ip}"

        now = time.time()
        self._requests[key] = [
            t for t in self._requests[key]
            if now - t < self.window_seconds
        ]

        if len(self._requests[key]) >= self.max_requests:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")

        self._requests[key].append(now)

# Stricter limits for expensive operations
query_console_limiter = RateLimiter(max_requests=20, window_seconds=60)
api_limiter = RateLimiter(max_requests=200, window_seconds=60)
```

### 13. Sensitive Data Exposure

#### Logging Safety
```python
import structlog

logger = structlog.get_logger()

# NEVER log sensitive data
# logger.info("Auth attempt", password=password)           # BAD
# logger.info("Query", query=full_query_with_data)         # BAD
# logger.info("Token", jwt=token)                          # BAD

# ALWAYS redact sensitive data in logs
logger.info("Auth attempt", user_email=mask_email(email), success=True)
logger.info("Query executed", query_hash=hash(query), rows=row_count)
logger.info("Token issued", user_id=user_id, expires_at=expiry)
```

#### Error Response Safety
```python
# FastAPI error handler
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Log full details server-side
    logger.error("Unhandled exception",
                 error=str(exc),
                 path=request.url.path,
                 traceback=traceback.format_exc())

    # Return generic message to client
    return JSONResponse(
        status_code=500,
        content={"error": "An internal error occurred", "request_id": request.state.request_id}
    )
```

### 14. Dependency Security

#### Python Dependencies
```bash
# Check for vulnerabilities
pip-audit
safety check

# Use uv for dependency management
uv sync --group dev

# Pin exact versions in production
uv lock
```

#### C++ Dependencies
```bash
# Keep submodules updated
git submodule update --remote

# Scan for known CVEs in dependencies
# Use tools like cve-bin-tool for binary analysis
```

#### npm Dependencies
```bash
# Check for vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# Always commit lock files
git add package-lock.json
```

#### Verification Steps
- [ ] All dependency versions pinned
- [ ] No known CVEs in dependencies
- [ ] Lock files committed to git
- [ ] Automated dependency scanning in CI/CD
- [ ] Regular update cadence established

## Security Testing

### Automated Security Tests
```python
# Python - pytest security tests
import pytest
from httpx import AsyncClient

class TestAuthentication:
    async def test_requires_authentication(self, client: AsyncClient):
        response = await client.get("/api/v1/events")
        assert response.status_code == 401

    async def test_rejects_expired_token(self, client: AsyncClient):
        expired_token = create_expired_token()
        response = await client.get(
            "/api/v1/events",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401

    async def test_requires_correct_tenant(self, client: AsyncClient):
        token = create_token(tenant_id="tenant-A")
        response = await client.get(
            "/api/v1/events",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Tenant-ID": "tenant-B"  # Mismatch
            }
        )
        assert response.status_code == 403

class TestTenantIsolation:
    async def test_cannot_access_other_tenant_data(self, client: AsyncClient):
        """Critical: Verify tenant data isolation."""
        token_a = create_token(tenant_id="tenant-A")
        token_b = create_token(tenant_id="tenant-B")

        # Create data for tenant A
        await client.post("/api/v1/cases",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"title": "Test case"})

        # Tenant B should not see tenant A's data
        response = await client.get("/api/v1/cases",
            headers={"Authorization": f"Bearer {token_b}"})

        cases = response.json()["data"]
        tenant_ids = {c["tenant_id"] for c in cases}
        assert "tenant-A" not in tenant_ids

class TestSQLInjection:
    @pytest.mark.parametrize("payload", [
        "'; DROP TABLE events; --",
        "1 OR 1=1",
        "1; SELECT * FROM system.tables",
        "' UNION SELECT * FROM events WHERE '1'='1",
    ])
    async def test_rejects_sql_injection(self, client: AsyncClient, payload: str):
        response = await client.get(
            f"/api/v1/events?search={payload}",
            headers=auth_headers()
        )
        assert response.status_code in (400, 422)
```

### Bandit Security Scanning (Python)
```bash
# Run bandit on all Python code
bandit -r appapi/ -f json -o bandit-report.json

# Common issues to check:
# B101: assert used in production code
# B105: hardcoded password in string
# B106: hardcoded password in function argument
# B108: probable insecure usage of temp file
# B301: pickle usage (deserialization risk)
# B608: SQL injection via string formatting
```

## Pre-Deployment Security Checklist

Before ANY production deployment:

- [ ] **Secrets**: No hardcoded secrets in any language, all in env vars / AWS Secrets Manager
- [ ] **Input Validation**: All user inputs validated (Pydantic/Flask-RESTX/Vee-validate)
- [ ] **SQL Injection**: All queries parameterized (analytics database and MySQL)
- [ ] **XSS**: User content sanitized, CSP headers configured
- [ ] **CSRF**: Protection enabled on state-changing operations
- [ ] **Authentication**: JWT with asymmetric signing, proper expiration
- [ ] **Authorization**: Role-based access control on all endpoints
- [ ] **Tenant Isolation**: Every query scoped to tenant_id
- [ ] **Rate Limiting**: Enabled on all API endpoints
- [ ] **HTTPS**: Enforced in production (TLS 1.2+)
- [ ] **Security Headers**: CSP, X-Frame-Options, HSTS configured
- [ ] **Error Handling**: No sensitive data in error responses
- [ ] **Logging**: No PII, passwords, or tokens logged
- [ ] **Dependencies**: Audited, no known vulnerabilities
- [ ] **Protobuf**: Size limits enforced, deserialization safe
- [ ] **C++ Memory**: ASAN clean, valgrind clean
- [ ] **AWS**: IAM least-privilege, encryption at rest/transit
- [ ] **GDPR**: Data retention TTLs set, audit logging active
- [ ] **Configurable Rules**: Validated, versioned, performance-tested
- [ ] **CORS**: Properly configured for allowed origins only

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [FastAPI Security Documentation](https://fastapi.tiangolo.com/tutorial/security/)
- [Flask Security Best Practices](https://flask.palletsprojects.com/en/stable/web-security/)
- [Google Protobuf Security](https://protobuf.dev/programming-guides/dos-donts/)
- [AWS Security Best Practices](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/)

---

**Remember**: A security vulnerability is not just a bug, it is a threat to every user you protect. Security is the foundation, not a feature. When in doubt, err on the side of caution and request a security review.

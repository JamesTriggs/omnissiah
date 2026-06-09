# Security Guidelines

Generic security rules applicable to any project. Adapt the specifics to your stack.

## Mandatory Security Checks

Before ANY commit:
- [ ] No hardcoded secrets (API keys, passwords, tokens, cloud credentials)
- [ ] All user inputs validated (schema validation on every boundary)
- [ ] SQL injection prevention (parameterised queries only)
- [ ] XSS prevention (sanitised HTML, framework template escaping)
- [ ] CSRF protection enabled on all state-mutating endpoints
- [ ] Authentication and authorisation verified (token validation, access control checks)
- [ ] Rate limiting on all public endpoints
- [ ] Error messages do not leak sensitive data (stack traces, queries, internal IPs)
- [ ] Access scoping verified (no data leakage across users, accounts, or organisations)
- [ ] Audit logging in place for data access operations

## Secret Management

- NEVER hardcode secrets in source code (API keys, database credentials, cloud keys)
- ALWAYS use environment variables or a dedicated secrets manager
- Validate that required secrets are present at startup
- Rotate any secrets that may have been exposed
- Prefer instance or workload identity roles over embedded long-lived credentials

```python
# BAD: Hardcoded credentials
DB_PASSWORD = "s3cret_p@ss"
CLOUD_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"

# GOOD: Environment variables with typed settings
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_host: str
    db_password: str
    region: str = "eu-west-2"

settings = Settings()  # Raises ValidationError if required vars missing
```

## Access Scoping and Data Isolation

If your application serves multiple users, accounts, or organisations, every data access MUST be scoped to the correct owner.

### Mandatory Scoping Rules

1. **Every data query MUST include an ownership filter** with no exceptions
2. **Never trust ownership IDs from client input** and derive them from the authenticated session or token
3. **API endpoints MUST extract the access context from the authentication token**

```python
# BAD: No scoping, returns ALL accounts' data
def get_records(start_time, end_time):
    return db.query(
        "SELECT * FROM records WHERE created BETWEEN %(start)s AND %(end)s",
        parameters={"start": start_time, "end": end_time},
    )

# GOOD: Scoped query
def get_records(account_id: int, start_time, end_time):
    return db.query(
        """SELECT * FROM records
           WHERE account_id = %(account_id)s
           AND created BETWEEN %(start)s AND %(end)s""",
        parameters={"account_id": account_id, "start": start_time, "end": end_time},
    )

# GOOD: Dependency that extracts the access context from the token
from fastapi import Depends, HTTPException

async def get_account_id(user = Depends(get_current_user)) -> int:
    if not user.account_id:
        raise HTTPException(status_code=403, detail="No access context")
    return user.account_id
```

### Isolation Testing

- Write explicit tests that verify data cannot be accessed across owners
- Include negative test cases: account A must NOT see account B's data
- Test that a missing access context results in a 403 error, not an empty result

## SQL Injection Prevention

1. **ALWAYS use parameterised queries**
2. **NEVER use f-strings or string concatenation to build queries**
3. **NEVER pass user input directly into SQL strings**
4. **Validate column names against an allowlist** when dynamic columns are needed

```python
# BAD: String interpolation, SQL injection vulnerability
def query_records(client, account_id, kind):
    sql = f"SELECT * FROM records WHERE account_id = {account_id} AND kind = '{kind}'"
    return client.query(sql)

# GOOD: Parameterised query
def query_records(client, account_id: int, kind: str):
    return client.query(
        """SELECT * FROM records
           WHERE account_id = %(account_id)s AND kind = %(kind)s
           ORDER BY created DESC LIMIT 1000""",
        parameters={"account_id": account_id, "kind": kind},
    )

# GOOD: Dynamic column selection with allowlist validation
ALLOWED_COLUMNS = {"created", "source", "destination", "kind", "severity"}

def query_with_columns(client, account_id: int, columns: list[str]):
    validated = [c for c in columns if c in ALLOWED_COLUMNS]
    if not validated:
        raise ValueError("No valid columns specified")
    col_str = ", ".join(validated)
    return client.query(
        f"SELECT {col_str} FROM records WHERE account_id = %(account_id)s",
        parameters={"account_id": account_id},
    )
```

## Input and Message Validation

When deserialising external data (request bodies, serialised messages, uploads):

1. **Always validate message size before deserialisation** to prevent memory exhaustion
2. **Set maximum size limits** appropriate for the payload type
3. **Validate enum and required field values** explicitly
4. **Never trust deserialised data without business logic validation**

```python
MAX_MESSAGE_SIZE = 10 * 1024 * 1024  # 10 MB

def deserialize(raw_bytes: bytes):
    if len(raw_bytes) > MAX_MESSAGE_SIZE:
        raise ValueError(f"Message too large: {len(raw_bytes)} bytes")
    payload = parse(raw_bytes)
    if not payload.account_id:
        raise ValueError("Missing account_id")
    return payload
```

## Cloud Credential Handling

1. **NEVER hardcode cloud access keys** in source code, configs, or container images
2. **Use workload identity roles** so services inherit scoped permissions
3. **Use instance profiles** instead of embedding credentials in startup scripts
4. **Use environment variables ONLY for local development**, never in deployed environments
5. **Scope IAM policies to minimum required permissions** (least privilege)

```python
# BAD: Hardcoded cloud credentials
import boto3
client = boto3.client("s3", aws_access_key_id="AKIA...", aws_secret_access_key="wJalr...")

# GOOD: Let the SDK use the workload role automatically
import boto3
client = boto3.client("s3", region_name="eu-west-2")
```

## PII Handling and Privacy Compliance

If you process personal data, privacy compliance (such as GDPR) is mandatory.

1. **Data minimisation**, only collect and store what you need
2. **Never log PII** (usernames, email addresses, end-user IP addresses) in application logs
3. **Pseudonymise where possible**, use hashed identifiers instead of raw PII
4. **Implement data retention policies** with automatic expiry
5. **Support data deletion requests**, ensure all of a user's data can be purged
6. **Encrypt PII at rest**

```sql
-- GOOD: automatic data expiry via table TTL
CREATE TABLE records (
    account_id UInt32,
    created DateTime,
    payload String
) ENGINE = MergeTree()
PARTITION BY (account_id, toYYYYMM(created))
ORDER BY (account_id, created)
TTL created + INTERVAL 90 DAY;
```

## Memory Safety (for native code)

If your project includes C or C++ components that process untrusted input:

1. **Run AddressSanitizer (ASAN) in CI** on every PR
2. **Run ThreadSanitizer (TSAN) in CI** for concurrent code
3. **Use smart pointers** (`std::unique_ptr`, `std::shared_ptr`), avoid raw `new`/`delete`
4. **Bounds-check all array and buffer access**, prefer `.at()` over `[]`
5. **Validate all external input sizes** before allocating memory
6. **Use `-fstack-protector-strong`** and `-D_FORTIFY_SOURCE=2` compiler flags

See `rules/cpp/security.md` for comprehensive C++ security guidelines.

## Audit Logging Requirements

All data access operations SHOULD be logged for compliance and forensics.

1. **Log WHO accessed data** (user ID, account ID, IP address)
2. **Log WHAT was accessed** (table, query type, record count)
3. **Log WHEN** (UTC timestamp)
4. **Log the outcome** (success or failure, error code)
5. **Never log the actual data content**, only metadata about the access
6. **Audit logs SHOULD be immutable**, write to a separate append-only store

```python
import structlog

logger = structlog.get_logger()

def audit_log_query(user_id, account_id, table, query_type, row_count):
    logger.info(
        "data_access",
        user_id=user_id,
        account_id=account_id,
        table=table,
        query_type=query_type,
        row_count=row_count,
        action="query",
    )
```

## Security Response Protocol

If a security issue is found:
1. **STOP immediately**, do not continue with other work
2. Use the **security-reviewer** agent for assessment
3. Fix CRITICAL issues before continuing
4. Rotate any exposed secrets immediately
5. Review the entire codebase for similar issues
6. If user data may be affected, escalate to your security team
7. Document the issue, remediation, and prevention measures

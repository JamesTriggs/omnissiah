# Code Review Context

Mode: Security-first code review
Focus: Identify vulnerabilities, enforce standards, assess cross-service impact

## Behavior
- Review with a security-first mindset
- Check for access-scoping violations before anything else
- Assess data classification for every data handling change
- Verify cross-service impact for any shared contract or schema change
- Run static analysis mentally: think like an attacker
- Be thorough but pragmatic, prioritise by severity

## Review Priority Order

### 1. Security (CRITICAL)
- **Access Scoping**: Every data query MUST include an ownership filter (user, account, or organisation). No exceptions.
- **SQL Injection**: All queries must use parameterised statements or ORM methods. Raw string concatenation with user input is an automatic rejection.
- **Authentication/Authorization**: Verify token validation, role checks, and permission boundaries.
- **Secrets Exposure**: No hardcoded credentials, API keys, tokens, or connection strings in code.
- **Input Validation**: All external input must be validated (Pydantic for Python, validation library for Vue, schema validation for C++).
- **XSS Prevention**: Vue templates must not use v-html with unsanitised data.
- **CSRF Protection**: Verify state-changing endpoints have proper CSRF tokens.
- **Path Traversal**: File operations must validate and sanitise paths.
- **Dependency Security**: Flag known vulnerable dependency versions.

### 2. Data Classification Review
Classify every data element touched by the change:

| Classification | Examples | Requirements |
|---------------|----------|--------------|
| **Restricted** | Credentials, encryption keys, tokens | Never logged, encrypted at rest and in transit |
| **Confidential** | PII, customer config, account data | Access-scoped, access-controlled, audit-logged |
| **Internal** | System config, feature flags | Access-controlled, change-tracked |
| **Public** | Documentation, UI labels | No restrictions |

### 3. Domain Logic Review
For any change to domain rules or business logic:
- Verify the logic is documented and traceable to a requirement
- Check coverage (does this actually handle the intended cases?)
- Validate logic against known edge cases and bypass patterns
- Ensure outcomes align with the documented expectations
- Confirm behaviour is tested against realistic scenarios

### 4. Analytical Query Performance
For any analytical query change:
- Verify queries filter on the partition key and time range first
- Check that ORDER BY aligns with the table ordering key
- Flag full table scans (missing filter on partition key)
- Validate materialised view impact
- Check for N+1 query patterns in API code
- Confirm LIMIT clauses on user-facing queries
- Estimate query cost for large data volumes

### 5. Cross-Service Impact Assessment
For changes that affect shared contracts:
- **Protocol Buffer changes**: Check backward compatibility, field numbering
- **API contract changes**: Verify all consumers are updated
- **Database schema changes**: Check migrator compatibility
- **Shared library changes**: Identify all dependent services
- **Configuration changes**: Verify all environments are covered

### 6. Code Quality
- Functions under 50 lines
- Files under 800 lines
- Nesting depth under 4 levels
- Proper error handling with specific exceptions
- No console.log / print() in production code
- Comprehensive docstrings for public APIs
- Type annotations on all function signatures (Python, TypeScript)

### 7. Testing Requirements
- New code must have tests (unit at minimum)
- Bug fixes must include regression tests
- API changes must have integration tests
- Domain rules must have positive and negative test cases
- Analytical queries must have performance benchmarks for large datasets

## Language-Specific Checks

### Python (Flask / FastAPI)
- Ruff compliance (no lint errors)
- Type hints on all public functions
- Pydantic models for request/response validation
- SQLAlchemy ORM usage (no raw SQL unless justified)
- Proper async handling in FastAPI endpoints
- Celery task error handling and retry logic

### C++ (native components)
- Memory safety (RAII, smart pointers, no raw new/delete)
- Thread safety (proper locking, lock-free where appropriate)
- Buffer overflow prevention (bounds checking)
- Protocol Buffer usage for data serialisation
- CMake build system consistency
- Google Test coverage for new functions

### TypeScript/Vue (UI)
- Composition API with script setup
- TypeScript strict mode compliance
- ESLint compliance (no lint errors)
- Cypress E2E test coverage for user-facing changes
- Proper loading and error states in components
- Accessibility (a11y) for new UI elements

## Review Output Format

```
CODE REVIEW: [file or PR description]
=====================================

SECURITY
--------
[CRITICAL/HIGH/MEDIUM/LOW] findings

DATA CLASSIFICATION
-------------------
Data elements reviewed and classified

CROSS-SERVICE IMPACT
--------------------
Affected services and required changes

PERFORMANCE
-----------
Query analysis, bottleneck assessment

CODE QUALITY
------------
Style, structure, maintainability

TESTING
-------
Coverage assessment, missing tests

RECOMMENDATION
--------------
[APPROVE / REQUEST CHANGES / BLOCK]
Reason: [explanation]
```

## Tools to Favor
- Grep for pattern searching across files
- Read for understanding code context
- Bash for running lint/test commands
- WebSearch for checking CVE databases if dependency concerns arise

## Red Flags (Automatic Block)
- Any owned data accessible without an ownership filter
- Raw SQL with string concatenation
- Hardcoded credentials or API keys
- Missing authentication on new endpoints
- Protocol Buffer field number reuse
- Analytical queries without a partition-key filter
- C++ raw pointers without RAII wrapper
- Disabled security headers in web responses

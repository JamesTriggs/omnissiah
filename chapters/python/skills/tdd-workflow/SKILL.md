---
name: tdd-workflow
description: Use this skill when writing new Python features, fixing bugs, or refactoring code. Enforces test-driven development with 85%+ coverage using pytest, ruff, and mypy.
---

# Test-Driven Development Workflow — Python Chapter

This skill enforces TDD for Python development across the platform. It covers only
Python tooling — pytest, mypy, ruff, and pytest-cov. For C++ TDD patterns, see the cpp chapter.

## When to Activate

- Writing new Python features or functions
- Fixing Python bugs or issues
- Refactoring Python code (core-api, public-api, workers)
- Adding Flask-RESTX or FastAPI endpoints
- Modifying Python detection rules or validators
- Updating the analytics database query helpers in Python
- Changing SQLAlchemy models or migrations

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write tests first, then implement minimal code to make them pass.

### 2. Coverage Requirements
- Minimum 85% coverage via pytest-cov
- All edge cases covered: None, empty, large, malformed, boundary values
- Error scenarios tested
- Security-sensitive paths 100% covered

### 3. Arrange-Act-Assert Structure
Every test must follow the three-phase structure:
```python
def test_behaviour_description():
    # Arrange — set up the scenario
    service = MyService(dependency=Mock())

    # Act — call the unit under test
    result = service.do_thing(input_value)

    # Assert — verify the observable outcome
    assert result == expected_value
```

## TDD Workflow Steps

### Step 1: Define the Behaviour
Write a one-line description: "When X, then Y."

### Step 2: Write the Test (Red)
```python
# tests/unit/test_new_feature.py
import pytest
from mymodule import new_feature

def test_new_feature_returns_expected_result():
    result = new_feature(input_value="hello")
    assert result == "expected"
```

Run — it should FAIL (ImportError or AssertionError).

### Step 3: Implement Minimal Code (Green)
Write the smallest implementation that makes the test pass.

### Step 4: Run Tests
```bash
pytest tests/unit/test_new_feature.py -v
```

### Step 5: Refactor
Improve structure, readability, and type hints while keeping tests green.

### Step 6: Verify Coverage
```bash
pytest --cov=appcore --cov-report=term-missing tests/
pytest --cov=appcore --cov-report=html tests/
```

## pytest Patterns

### Basic Unit Test
```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from appcore.app.explorer.query_service import QueryService

class TestQueryService:
    @pytest.fixture
    def mock_analyticsdb(self):
        client = AsyncMock()
        client.query.return_value = [
            {"src_ip": "10.0.0.1", "dst_ip": "10.0.0.2", "bytes": 1024}
        ]
        return client

    @pytest.fixture
    def query_service(self, mock_analyticsdb):
        return QueryService(db_client=mock_analyticsdb)

    async def test_execute_query_returns_results(self, query_service):
        results = await query_service.execute(
            tenant_id="test-tenant",
            query="SELECT src_ip FROM network_flows LIMIT 10"
        )
        assert len(results) == 1
        assert results[0]["src_ip"] == "10.0.0.1"

    async def test_execute_query_enforces_tenant_scoping(self, query_service, mock_analyticsdb):
        await query_service.execute(
            tenant_id="test-tenant",
            query="SELECT * FROM network_flows"
        )
        call_args = mock_analyticsdb.query.call_args
        assert "test-tenant" in str(call_args)

    async def test_execute_query_rejects_mutation(self, query_service):
        with pytest.raises(ValueError, match="Mutation operations not allowed"):
            await query_service.execute(
                tenant_id="test-tenant",
                query="INSERT INTO network_flows VALUES (...)"
            )
```

### Flask-RESTX Integration Test
```python
import pytest
from appcore.app import create_app

@pytest.fixture
def app():
    app = create_app(testing=True)
    with app.app_context():
        yield app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_headers():
    token = create_test_jwt(tenant_id="test-tenant", role="analyst")
    return {"Authorization": f"Bearer {token}", "X-Tenant-ID": "test-tenant"}

class TestEventsAPI:
    def test_list_events_requires_auth(self, client):
        response = client.get("/api/v1/events")
        assert response.status_code == 401

    def test_list_events_returns_tenant_scoped_data(self, client, auth_headers):
        response = client.get("/api/v1/events", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert all(e["tenant_id"] == "test-tenant" for e in data["data"])

    def test_list_events_validates_query_params(self, client, auth_headers):
        response = client.get("/api/v1/events?limit=invalid", headers=auth_headers)
        assert response.status_code == 400
```

### FastAPI Integration Test
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app_public_api.main import app

@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

class TestDetectionRulesAPI:
    @pytest.mark.asyncio
    async def test_create_detection_rule(self, async_client):
        response = await async_client.post(
            "/api/v1/detections",
            headers=auth_headers(role="engineer"),
            json={
                "name": "Suspicious DNS Query",
                "technique": "RULE-200",
                "conditions": {"dns_query_type": "TXT"},
                "severity": 7,
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["data"]["name"] == "Suspicious DNS Query"
```

### Parametrize Pattern
```python
import pytest

@pytest.mark.parametrize("input_val,expected", [
    ("valid_input", True),
    ("",            False),
    (None,          False),
    ("x" * 1000,    False),   # boundary: too long
])
def test_validate_input(input_val, expected):
    assert validate_input(input_val) == expected
```

### Conftest.py Patterns
```python
# tests/conftest.py
import pytest
from unittest.mock import MagicMock, AsyncMock

@pytest.fixture(scope="session")
def app():
    """Session-scoped Flask app for integration tests."""
    from appcore.app import create_app
    app = create_app(testing=True)
    with app.app_context():
        yield app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def mock_analyticsdb():
    client = AsyncMock()
    client.query.return_value = MagicMock(
        result_rows=[("10.0.0.1", "8.8.8.8", 1024)],
        column_names=["src_ip", "dst_ip", "bytes_sent"],
    )
    return client

@pytest.fixture
def mock_redis():
    store = {}
    class MockRedis:
        async def get(self, key):    return store.get(key)
        async def setex(self, k, t, v): store[k] = v
        async def delete(self, *keys):
            for k in keys: store.pop(k, None)
    return MockRedis()
```

## Mocking Patterns

### unittest.mock
```python
from unittest.mock import MagicMock, AsyncMock, patch, call

# Patch at import point, not at definition
with patch('appcore.app.explorer.views.query_service') as mock_qs:
    mock_qs.execute.return_value = [{"src_ip": "10.0.0.1"}]
    response = client.get("/api/v1/explorer/query", headers=auth_headers)
    assert response.status_code == 200

# Assert calls
mock_qs.execute.assert_called_once()
mock_qs.execute.assert_called_with(tenant_id="test-tenant", query=ANY)
```

### pytest-mock
```python
def test_with_mocker(mocker):
    mock_fn = mocker.patch('mymodule.external_call')
    mock_fn.return_value = {"status": "ok"}

    result = my_function()

    mock_fn.assert_called_once()
    assert result["status"] == "ok"
```

### Celery Task Mocking
```python
@pytest.fixture
def mock_celery(monkeypatch):
    from unittest.mock import patch
    with patch('appcore.tasks.process_detection.delay') as mock_task:
        mock_task.side_effect = lambda *a, **kw: process_detection(*a, **kw)
        yield mock_task
```

## mypy Type Checking Integration

Run mypy in the TDD loop to catch type errors early:

```bash
# Check a single module
mypy appcore/app/explorer/query_service.py --strict

# Check the full project
mypy appcore/ --ignore-missing-imports
```

### Type Hint Requirements
```python
from typing import Any
from collections.abc import Sequence

# Always annotate function signatures
def process_events(
    events: list[dict[str, Any]],
    tenant_id: str,
    limit: int = 100,
) -> list[dict[str, Any]]:
    ...

# Use modern union syntax (Python 3.10+)
def get_user(user_id: int) -> dict[str, Any] | None:
    ...
```

## ruff Integration

Run ruff as part of the TDD loop:

```bash
# Lint
ruff check appcore/

# Auto-fix safe issues
ruff check --fix appcore/

# Format
ruff format appcore/
```

### Pre-commit Hook (Python)
```bash
#!/bin/bash
ruff check . && mypy . && pytest tests/unit/ -q
```

## Coverage Configuration

```ini
# pyproject.toml
[tool.coverage.run]
source = ["appcore"]
omit = ["*/tests/*", "*/migrations/*"]

[tool.coverage.report]
fail_under = 85
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "if __name__ ==",
]
```

## Test File Organisation

```
appcore/
├── tests/
│   ├── unit/
│   │   ├── test_query_service.py
│   │   ├── test_detection_engine.py
│   │   └── test_validators.py
│   ├── integration/
│   │   ├── test_events_api.py
│   │   ├── test_cases_api.py
│   │   └── test_analyticsdb_queries.py
│   ├── system/
│   │   └── test_full_workflow.py
│   ├── conftest.py
│   └── fixtures/
│       ├── analyticsdb_data.py
│       └── test_events.json
```

## Watch Mode During Development

```bash
# pytest-watch
pytest --watch tests/

# Or with entr
find appcore -name "*.py" | entr -c pytest tests/unit/ -q
```

## CI Integration (Azure Pipelines)

```yaml
- job: PythonTests
  steps:
    - script: |
        uv sync --group dev
        ruff check .
        mypy .
        pytest tests/ --cov --cov-report=xml
    - task: PublishCodeCoverageResults@2
      inputs:
        codeCoverageTool: Cobertura
        summaryFileLocation: coverage.xml
```

## Common Mistakes to Avoid

### WRONG: Testing Implementation Details
```python
# Don't test internal state
assert service._internal_cache == {'key': 'value'}
```

### CORRECT: Test Observable Behaviour
```python
result = await service.get_data('key')
assert result == expected_value
```

### WRONG: Tests Sharing State
```python
def test_create_case():
    create_case(...)

def test_update_same_case():
    update_case(created_case_id)  # Depends on previous test
```

### CORRECT: Independent Tests
```python
def test_create_case(db_session):
    case = create_case(db_session, title="Test")
    assert case.id is not None

def test_update_case(db_session):
    case = create_case(db_session, title="Original")
    updated = update_case(db_session, case.id, title="Updated")
    assert updated.title == "Updated"
```

## Success Metrics

- 85%+ code coverage achieved
- All tests passing (green) in CI
- No skipped or disabled tests without documented reason
- Unit tests complete in under 60 seconds per service
- mypy reports zero errors on `--strict` mode
- ruff reports zero lint violations

---

**Remember**: This skill covers Python TDD only (pytest, mypy, ruff, pytest-cov).
For C++ TDD, use the cpp chapter — it provides the C++-specific TDD skill.

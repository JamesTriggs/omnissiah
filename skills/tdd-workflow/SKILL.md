---
name: tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test-driven development with 85%+ coverage using pytest, Google Test, Vitest, and Cypress.
---

# Test-Driven Development Workflow

This skill ensures code development follows TDD principles with comprehensive test coverage across Python, C++, and Vue/Nuxt stacks.

## When to Activate

- Writing new features or functionality
- Fixing bugs or issues
- Refactoring existing code
- Adding API endpoints (Flask-RESTX or FastAPI)
- Creating new Vue components
- Modifying configurable rules
- Updating Protocol Buffer schemas
- Changing analytics-database queries or schemas
- Modifying C++ components

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write tests first, then implement code to make tests pass.

### 2. Coverage Requirements
- Minimum 85% coverage (unit + integration + E2E)
- All edge cases covered
- Error scenarios tested
- Boundary conditions verified
- Security-sensitive paths 100% covered

### 3. Test Types by Technology

#### Python (pytest) -- backend services
- Unit tests: Individual functions, services, validators
- Integration tests: API endpoints, database operations, inter-service calls
- System tests: Full workflow validation

#### C++ (Google Test) -- native components
- Unit tests: Classes, functions, algorithms
- Integration tests: Component interactions, data pipeline stages
- Performance tests: Throughput benchmarks, memory profiling

#### Vue/Nuxt (Vitest + Cypress) -- frontend
- Unit tests: Composables, utilities, Pinia stores
- Component tests: Vue components with Vitest + Vue Test Utils
- E2E tests: Full user workflows with Cypress

#### Protocol Buffers
- Schema validation tests
- Backward compatibility tests
- Cross-language serialization tests

## TDD Workflow Steps

### Step 1: Write User Journeys
```
As a [role], I want to [action], so that [benefit]

Example:
As an analyst, I want to search for network flows by IP address,
so that I can investigate connections in the query console.
```

### Step 2: Generate Test Cases
For each user journey, create comprehensive test cases covering the relevant technology.

### Step 3: Run Tests (They Should Fail)
```bash
# Python
pytest tests/unit/test_new_feature.py -v

# C++
./build_linux.bash ubuntu2204 test

# Vue/Nuxt
npm run test:unit -- --reporter verbose
```

### Step 4: Implement Code
Write minimal code to make tests pass.

### Step 5: Run Tests Again (They Should Pass)

### Step 6: Refactor
Improve code quality while keeping tests green.

### Step 7: Verify Coverage
```bash
# Python
pytest --cov=appapi --cov-report=html tests/

# C++
cmake .. -DCMAKE_BUILD_TYPE=Debug -DCODE_COVERAGE=ON
make && make test && make coverage

# Vue/Nuxt
npm run test:unit -- --coverage
```

## Python Testing Patterns (pytest)

### Unit Test Pattern
```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from appapi.app.analytics.query_service import QueryService

class TestQueryService:
    @pytest.fixture
    def mock_analytics_db(self):
        client = AsyncMock()
        client.query.return_value = [
            {"src_ip": "10.0.0.1", "dst_ip": "10.0.0.2", "bytes": 1024}
        ]
        return client

    @pytest.fixture
    def query_service(self, mock_analytics_db):
        return QueryService(analytics_client=mock_analytics_db)

    async def test_execute_query_returns_results(self, query_service):
        results = await query_service.execute(
            tenant_id="test-tenant",
            query="SELECT src_ip, dst_ip FROM network_flows LIMIT 10"
        )
        assert len(results) == 1
        assert results[0]["src_ip"] == "10.0.0.1"

    async def test_execute_query_enforces_tenant_scoping(self, query_service, mock_analytics_db):
        await query_service.execute(
            tenant_id="test-tenant",
            query="SELECT * FROM network_flows"
        )
        # Verify tenant_id was injected into the query
        call_args = mock_analytics_db.query.call_args
        assert "test-tenant" in str(call_args)

    async def test_execute_query_rejects_mutation(self, query_service):
        with pytest.raises(ValueError, match="Mutation operations not allowed"):
            await query_service.execute(
                tenant_id="test-tenant",
                query="INSERT INTO network_flows VALUES (...)"
            )

    async def test_execute_query_handles_timeout(self, query_service, mock_analytics_db):
        mock_analytics_db.query.side_effect = TimeoutError("Query timed out")
        with pytest.raises(TimeoutError):
            await query_service.execute(
                tenant_id="test-tenant",
                query="SELECT * FROM network_flows"
            )
```

### Flask-RESTX API Integration Test Pattern
```python
import pytest
from appapi.app import create_app

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
    token = create_test_jwt(tenant_id="test-tenant", role="editor")
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

    def test_list_events_paginates_correctly(self, client, auth_headers):
        response = client.get("/api/v1/events?limit=10&offset=0", headers=auth_headers)
        data = response.get_json()
        assert len(data["data"]) <= 10
        assert "total" in data["meta"]
```

### FastAPI Integration Test Pattern
```python
import pytest
from httpx import AsyncClient, ASGITransport
from public_api.main import app

@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

class TestRulesAPI:
    @pytest.mark.asyncio
    async def test_create_rule(self, async_client):
        response = await async_client.post(
            "/api/v1/rules",
            headers=auth_headers(role="engineer"),
            json={
                "name": "High-value order flag",
                "category": "orders",
                "conditions": {"order_value": ">1000", "is_new_customer": True},
                "priority": 7
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["data"]["name"] == "High-value order flag"
        assert data["data"]["category"] == "orders"

    @pytest.mark.asyncio
    async def test_create_rule_validates_category(self, async_client):
        response = await async_client.post(
            "/api/v1/rules",
            headers=auth_headers(role="engineer"),
            json={
                "name": "Bad Rule",
                "category": "INVALID",
                "conditions": {},
                "priority": 5
            }
        )
        assert response.status_code == 422
```

### Analytics Database Fixture Pattern
```python
import pytest

@pytest.fixture(scope="session")
def analytics_client():
    """Create an analytics database client for testing (columnar analytics store)."""
    client = get_analytics_client(
        host='localhost',
        port=8123,
        database='test_app'
    )
    yield client
    # Cleanup
    client.command("DROP DATABASE IF EXISTS test_app")

@pytest.fixture(autouse=True)
def setup_test_data(analytics_client):
    """Insert test data before each test, clean up after."""
    analytics_client.command("""
        CREATE TABLE IF NOT EXISTS test_app.network_flows (
            tenant_id String,
            timestamp DateTime,
            src_ip String,
            dst_ip String,
            src_port UInt16,
            dst_port UInt16,
            protocol String,
            bytes_sent UInt64,
            bytes_received UInt64
        ) ENGINE = MergeTree()
        ORDER BY (tenant_id, timestamp)
    """)

    # Insert test data
    analytics_client.insert('test_app.network_flows', [
        ['tenant-A', '2024-01-15 10:00:00', '10.0.0.1', '8.8.8.8', 54321, 443, 'TCP', 1024, 2048],
        ['tenant-A', '2024-01-15 10:01:00', '10.0.0.2', '1.1.1.1', 54322, 53, 'UDP', 64, 256],
        ['tenant-B', '2024-01-15 10:00:00', '192.168.1.1', '10.0.0.5', 8080, 80, 'TCP', 512, 1024],
    ], column_names=['tenant_id', 'timestamp', 'src_ip', 'dst_ip', 'src_port', 'dst_port', 'protocol', 'bytes_sent', 'bytes_received'])

    yield

    # Cleanup
    analytics_client.command("TRUNCATE TABLE test_app.network_flows")

class TestNetworkFlowQueries:
    def test_tenant_isolation(self, analytics_client):
        result = analytics_client.query(
            "SELECT count() FROM test_app.network_flows WHERE tenant_id = {tid:String}",
            parameters={"tid": "tenant-A"}
        )
        assert result.result_rows[0][0] == 2  # Only tenant-A rows

    def test_aggregation_query(self, analytics_client):
        result = analytics_client.query("""
            SELECT src_ip, sum(bytes_sent) as total_bytes
            FROM test_app.network_flows
            WHERE tenant_id = {tid:String}
            GROUP BY src_ip
            ORDER BY total_bytes DESC
        """, parameters={"tid": "tenant-A"})
        assert len(result.result_rows) == 2
```

### Configurable Rule Testing Pattern
```python
import pytest

class TestRuleValidation:
    @pytest.fixture
    def sample_rule(self):
        return {
            "name": "Rapid repeat orders",
            "version": "1.0.0",
            "category": "orders",
            "priority": 8,
            "confidence": 0.85,
            "conditions": {
                "event_type": "order",
                "order_count": ">10",
                "window_minutes": 1,
                "same_customer": True
            },
            "exclusions": [
                {"customer_segment": "wholesale"}
            ]
        }

    def test_valid_rule_passes_validation(self, sample_rule):
        assert validate_rule(sample_rule) is True

    def test_missing_category_fails(self, sample_rule):
        del sample_rule['category']
        with pytest.raises(ValueError, match="Missing required field"):
            validate_rule(sample_rule)

    def test_invalid_priority_range(self, sample_rule):
        sample_rule['priority'] = 15  # Max is 10
        with pytest.raises(ValueError, match="Priority must be between"):
            validate_rule(sample_rule)

    def test_rule_false_positive_rate(self, sample_rule, historical_events):
        """Test rule against historical data to check false positive rate."""
        matches = apply_rule(sample_rule, historical_events)
        true_positives = sum(1 for m in matches if m.is_true_positive)
        false_positive_rate = 1 - (true_positives / len(matches)) if matches else 0
        assert false_positive_rate < 0.05  # Max 5% false positive rate
```

### API Contract Testing Pattern
```python
import pytest
from pydantic import ValidationError
from public_api.models import EventResponse, PaginatedResponse

class TestAPIContracts:
    def test_event_response_schema(self):
        """Verify API response matches documented contract."""
        data = {
            "id": "evt-123",
            "tenant_id": "tenant-A",
            "event_type": "order",
            "timestamp": "2024-01-15T10:00:00Z",
            "priority": 7,
            "source": {"ip": "10.0.0.1", "port": 443},
            "target": {"ip": "8.8.8.8", "port": 53},
            "tags": ["new-device"]
        }
        event = EventResponse(**data)
        assert event.id == "evt-123"
        assert event.priority == 7

    def test_paginated_response_contract(self):
        response = PaginatedResponse(
            data=[],
            meta={"total": 100, "limit": 10, "offset": 0},
            success=True
        )
        serialized = response.model_dump()
        assert "data" in serialized
        assert "meta" in serialized
        assert serialized["meta"]["total"] == 100

    def test_backward_compatible_fields(self):
        """Ensure deprecated fields still work."""
        data_with_legacy = {
            "id": "evt-123",
            "tenant_id": "tenant-A",
            "type": "order",  # Legacy field name
            "event_type": "order",  # New field name
            "timestamp": "2024-01-15T10:00:00Z",
            "priority": 5,
        }
        event = EventResponse(**data_with_legacy)
        assert event.event_type == "order"
```

## C++ Testing Patterns (Google Test)

### Unit Test Pattern
```cpp
#include <gtest/gtest.h>
#include "app/dm/network/flow.pb.h"
#include "app/parser/flow_parser.h"

class FlowParserTest : public ::testing::Test {
protected:
    void SetUp() override {
        parser_ = std::make_unique<FlowParser>();
    }

    void TearDown() override {
        parser_.reset();
    }

    std::unique_ptr<FlowParser> parser_;
};

TEST_F(FlowParserTest, ParsesValidFlow) {
    std::string raw_data = create_test_flow_data();
    auto result = parser_->parse(raw_data);

    ASSERT_TRUE(result.has_value());
    EXPECT_EQ(result->src_ip(), "10.0.0.1");
    EXPECT_EQ(result->dst_port(), 443);
}

TEST_F(FlowParserTest, RejectsEmptyInput) {
    auto result = parser_->parse("");
    ASSERT_FALSE(result.has_value());
}

TEST_F(FlowParserTest, RejectsMalformedProtobuf) {
    std::string garbage = "not a valid protobuf";
    auto result = parser_->parse(garbage);
    ASSERT_FALSE(result.has_value());
}

TEST_F(FlowParserTest, HandlesMaxSizeMessage) {
    std::string large_data(64 * 1024 * 1024, 'x');  // 64MB
    auto result = parser_->parse(large_data);
    ASSERT_FALSE(result.has_value());  // Should reject oversized
}

// Parameterized test for multiple protocols
class ProtocolParserTest : public ::testing::TestWithParam<std::string> {};

TEST_P(ProtocolParserTest, ParsesKnownProtocol) {
    FlowParser parser;
    auto flow = create_test_flow(GetParam());
    auto result = parser.parse(flow);

    ASSERT_TRUE(result.has_value());
    EXPECT_EQ(result->protocol(), GetParam());
}

INSTANTIATE_TEST_SUITE_P(
    Protocols,
    ProtocolParserTest,
    ::testing::Values("TCP", "UDP", "ICMP", "DNS", "HTTP", "TLS")
);
```

### Integration Test Pattern (C++)
```cpp
#include <gtest/gtest.h>
#include "app/database/analytics_writer.h"
#include "app/dm/network/flow.pb.h"

class AnalyticsWriterIntegrationTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Connect to a test analytics database instance
        writer_ = std::make_unique<AnalyticsWriter>(
            "localhost", 9000, "test_app"
        );
        writer_->create_test_tables();
    }

    void TearDown() override {
        writer_->drop_test_tables();
    }

    std::unique_ptr<AnalyticsWriter> writer_;
};

TEST_F(AnalyticsWriterIntegrationTest, WritesFlowBatch) {
    std::vector<app::dm::network::Flow> flows;
    for (int i = 0; i < 100; i++) {
        flows.push_back(create_test_flow(i));
    }

    auto result = writer_->write_batch(flows);
    EXPECT_TRUE(result.ok());
    EXPECT_EQ(result.rows_written(), 100);
}

TEST_F(AnalyticsWriterIntegrationTest, HandlesBatchFailureGracefully) {
    // Write to non-existent table
    auto result = writer_->write_batch_to_table("nonexistent", {});
    EXPECT_FALSE(result.ok());
    EXPECT_NE(result.error_message().find("UNKNOWN_TABLE"), std::string::npos);
}

// Performance benchmark test
TEST_F(AnalyticsWriterIntegrationTest, MeetsThroughputRequirements) {
    constexpr int BATCH_SIZE = 10000;
    auto flows = generate_test_flows(BATCH_SIZE);

    auto start = std::chrono::high_resolution_clock::now();
    auto result = writer_->write_batch(flows);
    auto end = std::chrono::high_resolution_clock::now();

    auto duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

    EXPECT_TRUE(result.ok());
    // Must write 10k flows in under 500ms
    EXPECT_LT(duration_ms, 500) << "Write throughput too slow: " << duration_ms << "ms";
}
```

## Vue/Nuxt Testing Patterns (Vitest + Cypress)

### Composable Unit Test (Vitest)
```typescript
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useEvents } from '~/composables/useEvents'

// Mock the Nuxt fetch composable
vi.mock('#app', () => ({
  useFetch: vi.fn(() => ({
    data: ref([
      { id: 'evt-1', event_type: 'order', priority: 7 },
      { id: 'evt-2', event_type: 'auth_event', priority: 3 },
    ]),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
  })),
}))

describe('useEvents', () => {
  it('returns events for given tenant', async () => {
    const { events, loading, error } = useEvents('tenant-A')
    expect(loading.value).toBe(false)
    expect(events.value).toHaveLength(2)
    expect(error.value).toBeNull()
  })

  it('filters events by priority', () => {
    const { events, filterByPriority } = useEvents('tenant-A')
    const high = filterByPriority(events.value, 5)
    expect(high).toHaveLength(1)
    expect(high[0].priority).toBe(7)
  })
})
```

### Pinia Store Test (Vitest)
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTicketStore } from '~/stores/tickets'

describe('Ticket Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty tickets', () => {
    const store = useTicketStore()
    expect(store.tickets).toEqual([])
    expect(store.selectedTicket).toBeNull()
  })

  it('adds a ticket correctly', () => {
    const store = useTicketStore()
    store.addTicket({
      id: 'ticket-1',
      title: 'Failed payment',
      priority: 'high',
      status: 'open',
      tenant_id: 'tenant-A',
    })
    expect(store.tickets).toHaveLength(1)
    expect(store.tickets[0].title).toBe('Failed payment')
  })

  it('filters tickets by status', () => {
    const store = useTicketStore()
    store.addTicket({ id: '1', title: 'A', status: 'open', priority: 'high', tenant_id: 't' })
    store.addTicket({ id: '2', title: 'B', status: 'closed', priority: 'low', tenant_id: 't' })

    expect(store.openTickets).toHaveLength(1)
    expect(store.openTickets[0].id).toBe('1')
  })

  it('updates ticket status', () => {
    const store = useTicketStore()
    store.addTicket({ id: '1', title: 'A', status: 'open', priority: 'high', tenant_id: 't' })
    store.updateTicketStatus('1', 'in_progress')
    expect(store.tickets[0].status).toBe('in_progress')
  })
})
```

### Vue Component Test (Vitest + Vue Test Utils)
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SeverityBadge from '~/components/SeverityBadge.vue'

describe('SeverityBadge', () => {
  it('renders correct text for high severity', () => {
    const wrapper = mount(SeverityBadge, {
      props: { severity: 'high', score: 8 }
    })
    expect(wrapper.text()).toContain('High')
    expect(wrapper.classes()).toContain('severity-high')
  })

  it('renders correct text for low severity', () => {
    const wrapper = mount(SeverityBadge, {
      props: { severity: 'low', score: 2 }
    })
    expect(wrapper.text()).toContain('Low')
    expect(wrapper.classes()).toContain('severity-low')
  })

  it('emits click event with severity data', async () => {
    const wrapper = mount(SeverityBadge, {
      props: { severity: 'medium', score: 5 }
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')[0]).toEqual([{ severity: 'medium', score: 5 }])
  })
})
```

### Cypress E2E Test Pattern
```typescript
// cypress/e2e/query-console.cy.ts
describe('Query Console', () => {
  beforeEach(() => {
    cy.login('user@example.com', 'test-password')
    cy.visit('/query-console')
    cy.waitForPageLoad()
  })

  it('executes a query and displays results', () => {
    // Type query in Monaco editor
    cy.get('[data-testid="query-editor"]').should('be.visible')
    cy.get('.monaco-editor textarea')
      .type('SELECT src_ip, dst_ip, bytes_sent FROM network_flows LIMIT 10', { force: true })

    // Execute query
    cy.get('[data-testid="run-query-btn"]').click()

    // Wait for results
    cy.get('[data-testid="query-results"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="result-row"]').should('have.length.lte', 10)

    // Verify column headers
    cy.get('[data-testid="result-header"]').should('contain', 'src_ip')
    cy.get('[data-testid="result-header"]').should('contain', 'dst_ip')
  })

  it('shows error for invalid query syntax', () => {
    cy.get('.monaco-editor textarea')
      .type('SELECTT invalid syntax', { force: true })
    cy.get('[data-testid="run-query-btn"]').click()

    cy.get('[data-testid="query-error"]').should('be.visible')
    cy.get('[data-testid="query-error"]').should('contain', 'Syntax error')
  })

  it('prevents mutation queries', () => {
    cy.get('.monaco-editor textarea')
      .type('DROP TABLE network_flows', { force: true })
    cy.get('[data-testid="run-query-btn"]').click()

    cy.get('[data-testid="query-error"]')
      .should('contain', 'Mutation operations not allowed')
  })

  it('saves and loads query history', () => {
    const query = 'SELECT count() FROM network_flows'
    cy.get('.monaco-editor textarea').type(query, { force: true })
    cy.get('[data-testid="run-query-btn"]').click()

    // Open history
    cy.get('[data-testid="query-history-btn"]').click()
    cy.get('[data-testid="history-item"]').first().should('contain', query)

    // Load from history
    cy.get('[data-testid="history-item"]').first().click()
    cy.get('.monaco-editor').should('contain', query)
  })
})

// cypress/e2e/tickets.cy.ts
describe('Ticket Management', () => {
  beforeEach(() => {
    cy.login('user@example.com', 'test-password')
    cy.visit('/tickets')
  })

  it('creates a new ticket from an event', () => {
    cy.get('[data-testid="create-ticket-btn"]').click()
    cy.get('[data-testid="ticket-title-input"]').type('Investigate failed payments')
    cy.get('[data-testid="ticket-priority-select"]').select('High')
    cy.get('[data-testid="ticket-assignee-select"]').select('Ops Team')
    cy.get('[data-testid="submit-ticket-btn"]').click()

    cy.get('[data-testid="ticket-created-toast"]').should('be.visible')
    cy.url().should('match', /\/tickets\/[\w-]+/)
  })

  it('filters tickets by status', () => {
    cy.get('[data-testid="status-filter"]').click()
    cy.get('[data-testid="filter-option-open"]').click()

    cy.get('[data-testid="ticket-card"]').each(($card) => {
      cy.wrap($card).find('[data-testid="ticket-status"]').should('contain', 'Open')
    })
  })
})
```

## Cross-Service Integration Testing

### Service Boundary Testing
```python
class TestCrossServiceIntegration:
    """Test interactions between internal-api and public-api."""

    @pytest.fixture
    def internal_client(self):
        return create_test_client(internal_app)

    @pytest.fixture
    def public_client(self):
        return create_test_client(public_app)

    def test_public_api_reflects_internal_data(
        self, internal_client, public_client
    ):
        """Data written via internal-api should be queryable via public-api."""
        # Write event via internal-api
        internal_client.post("/api/v1/events", json={
            "tenant_id": "test-tenant",
            "event_type": "order",
            "data": {"src_ip": "10.0.0.1"}
        }, headers=internal_auth_headers())

        # Query via public-api
        response = public_client.get(
            "/api/v1/events?event_type=order",
            headers=public_auth_headers(tenant_id="test-tenant")
        )
        assert response.status_code == 200
        assert len(response.json()["data"]) >= 1

    def test_rule_match_triggers_ticket_creation(
        self, internal_client
    ):
        """A rule match should create a ticket."""
        # Submit an event that matches a rule
        internal_client.post("/api/v1/events", json={
            "tenant_id": "test-tenant",
            "event_type": "order",
            "data": {
                "order_value": 5000,
                "is_new_customer": True,
                "order_count": 50  # Exceeds threshold
            }
        }, headers=internal_auth_headers())

        # Check ticket was created
        import time
        time.sleep(2)  # Wait for async processing

        response = internal_client.get(
            "/api/v1/tickets?status=open",
            headers=editor_auth_headers(tenant_id="test-tenant")
        )
        tickets = response.json()["data"]
        assert any("Rapid repeat orders" in t["title"] for t in tickets)
```

## Mocking External Services

### Analytics Database Mock (Python)
```python
import pytest
from unittest.mock import MagicMock

@pytest.fixture
def mock_analytics_client():
    client = MagicMock()
    client.query.return_value = MagicMock(
        result_rows=[
            ("10.0.0.1", "8.8.8.8", 1024),
            ("10.0.0.2", "1.1.1.1", 512),
        ],
        column_names=["src_ip", "dst_ip", "bytes_sent"],
        summary={"read_rows": "2", "elapsed_ns": "1000000"}
    )
    return client
```

### Redis Mock (Python)
```python
@pytest.fixture
def mock_redis():
    """In-memory Redis mock for testing."""
    store = {}

    class MockRedis:
        async def get(self, key):
            return store.get(key)

        async def setex(self, key, ttl, value):
            store[key] = value

        async def delete(self, *keys):
            for key in keys:
                store.pop(key, None)

    return MockRedis()
```

### Celery Task Mock
```python
@pytest.fixture
def mock_celery(monkeypatch):
    """Mock Celery tasks to run synchronously in tests."""
    from unittest.mock import patch

    with patch('appapi.tasks.process_event.delay') as mock_task:
        mock_task.side_effect = lambda *args, **kwargs: \
            process_event(*args, **kwargs)
        yield mock_task
```

## Test File Organization

```
# Python (internal-api)
appapi/
├── tests/
│   ├── unit/
│   │   ├── test_query_service.py
│   │   ├── test_rules_engine.py
│   │   └── test_validators.py
│   ├── integration/
│   │   ├── test_events_api.py
│   │   ├── test_tickets_api.py
│   │   └── test_analytics_queries.py
│   ├── system/
│   │   └── test_full_workflow.py
│   ├── conftest.py
│   └── fixtures/
│       ├── analytics_data.py
│       └── test_events.json

# C++ (data-loader)
test/
├── unit/
│   ├── test_flow_parser.cpp
│   ├── test_message_handler.cpp
│   └── test_batch_writer.cpp
├── integration/
│   ├── test_analytics_writer.cpp
│   └── test_data_pipeline.cpp
└── CMakeLists.txt

# Vue/Nuxt (frontend)
tests/
├── unit/
│   ├── composables/
│   │   └── useEvents.test.ts
│   ├── stores/
│   │   └── tickets.test.ts
│   └── components/
│       └── SeverityBadge.test.ts
├── cypress/
│   ├── e2e/
│   │   ├── query-console.cy.ts
│   │   ├── tickets.cy.ts
│   │   └── dashboard.cy.ts
│   ├── fixtures/
│   │   └── events.json
│   └── support/
│       └── commands.ts
```

## Coverage Thresholds

### Python (pytest-cov)
```ini
# pyproject.toml or setup.cfg
[tool.coverage.run]
source = ["appapi"]
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

### Vitest
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85,
      },
      exclude: ['node_modules/', 'tests/', '.nuxt/'],
    },
  },
})
```

## Common Testing Mistakes to Avoid

### WRONG: Testing Implementation Details
```python
# Don't test internal state
assert service._internal_cache == {'key': 'value'}
```

### CORRECT: Test Observable Behavior
```python
# Test what users/callers observe
result = await service.get_data('key')
assert result == expected_value
```

### WRONG: No Test Isolation
```python
# Tests share state and depend on execution order
def test_create_ticket():
    create_ticket(...)

def test_update_same_ticket():
    update_ticket(created_ticket_id)  # Depends on previous test
```

### CORRECT: Independent Tests
```python
def test_create_ticket(db_session):
    ticket = create_ticket(db_session, title="Test")
    assert ticket.id is not None

def test_update_ticket(db_session):
    ticket = create_ticket(db_session, title="Original")
    updated = update_ticket(db_session, ticket.id, title="Updated")
    assert updated.title == "Updated"
```

### WRONG: Brittle Selectors (Cypress)
```typescript
cy.get('.css-1a2b3c4')  // Breaks on style changes
cy.get('div > span:nth-child(3)')  // Fragile
```

### CORRECT: Semantic Selectors (Cypress)
```typescript
cy.get('[data-testid="severity-badge"]')
cy.get('button').contains('Run Query')
```

## Continuous Testing

### Watch Mode During Development
```bash
# Python
pytest --watch tests/

# Vitest
npx vitest --watch

# C++ (with entr)
find src test -name "*.cpp" -o -name "*.h" | entr -c make test
```

### Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Python
ruff check . && mypy . && pytest tests/unit/ -q

# C++
cmake --build build --target test

# Vue/Nuxt
npm run lint && npm run test:unit -- --run
```

### CI/CD Integration
```yaml
stages:
  - stage: Test
    jobs:
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

      - job: CppTests
        steps:
          - script: |
              ./build_linux.bash ubuntu2204 build debug
              ./build_linux.bash ubuntu2204 test

      - job: FrontendTests
        steps:
          - script: |
              npm ci
              npm run lint
              npm run test:unit -- --coverage
              npm run test:cypress-run-batch batch_00
```

## Best Practices

1. **Write Tests First** -- Always TDD
2. **One Assert Per Concept** -- Focus tests on single behaviors
3. **Descriptive Test Names** -- Explain what is being tested
4. **Arrange-Act-Assert** -- Clear three-phase test structure
5. **Mock External Dependencies** -- Isolate unit tests from the analytics database, Redis, etc.
6. **Test Edge Cases** -- None, empty, large, malformed, boundary values
7. **Test Error Paths** -- Not just happy paths, include failure modes
8. **Keep Tests Fast** -- Unit tests under 50ms each, integration under 5s
9. **Clean Up After Tests** -- No side effects between tests
10. **Review Coverage Reports** -- Identify untested code paths
11. **Test Security Paths** -- Auth, tenant isolation, injection attempts
12. **Test Configurable Rules** -- False positive rates, performance impact

## Success Metrics

- 85%+ code coverage achieved across all services
- All tests passing (green) in CI pipeline
- No skipped or disabled tests without documented reason
- Unit tests complete in under 60 seconds per service
- E2E tests cover all critical user workflows
- Security-sensitive paths have 100% test coverage
- Configurable rules tested against historical data benchmarks
- Performance tests validate throughput requirements

---

**Remember**: Tests are not optional. They are the safety net that enables confident refactoring, rapid development, and production reliability. Untested code is a liability.

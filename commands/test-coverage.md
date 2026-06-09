# Test Coverage

Analyze test coverage across a polyglot stack and generate missing tests.

## Workflow

### 1. Detect Project Type and Run Coverage

**Python Projects**
```bash
# Run tests with coverage
uv run pytest --cov=src --cov-report=term-missing --cov-report=json:coverage.json

# For specific module coverage
uv run pytest tests/unit/app/query/ --cov=src.app.query --cov-report=term-missing
```

**C++ Projects**
```bash
# Build with coverage instrumentation
cmake -B build -DCMAKE_CXX_FLAGS="--coverage -fprofile-arcs -ftest-coverage"
cmake --build build

# Run tests
ctest --test-dir build

# Generate coverage report
cd build
lcov --capture --directory . --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/test/*' '*/external/*' --output-file coverage_filtered.info
genhtml coverage_filtered.info --output-directory coverage_report

# Or using gcovr for quick summary
gcovr --root .. --exclude '.*test.*' --exclude '.*external.*' --print-summary
```

**Vue/TypeScript Projects**
```bash
# Run unit tests with coverage
npx vitest run --coverage

# Coverage report location
# coverage/coverage-summary.json
# coverage/lcov.info

# For specific component coverage
npx vitest run --coverage src/composables/
npx vitest run --coverage src/components/Editor/
```

### 2. Analyze Coverage Report

Parse the coverage output and identify files below the project-specific threshold.

### 3. Identify Files Below Threshold

For each under-covered file:
- Analyze untested code paths
- Identify which branches/functions lack tests
- Prioritize by risk (security-critical > business logic > utility)

### 4. Generate Missing Tests

For each under-covered file:
- Generate unit tests for uncovered functions
- Generate integration tests for uncovered API endpoints
- Generate edge case tests for uncovered branches
- Follow TDD patterns (test naming, arrange-act-assert)

### 5. Verify New Tests Pass

Run all new tests and confirm they pass before reporting.

### 6. Show Before/After Coverage Metrics

Display coverage delta to show improvement.

---

## Coverage Thresholds by Project

| Project type | Target | Critical Paths | Minimum |
|---------|--------|---------------|---------|
| Python API (Flask) | 85% | 95% | 75% |
| Python API (FastAPI) | 85% | 95% | 75% |
| C++ data service | 80% | 90% | 70% |
| C++ library | 80% | 90% | 70% |
| Vue/Nuxt UI | 80% | 90% | 70% |
| Query parser | 90% | 100% | 85% |
| Shared schemas | N/A | Compilation | N/A |

### Critical Paths Requiring 90%+ Coverage

**Python APIs:**
- Authentication and authorization (`src/app/auth/`)
- SQL query builders and validators (`src/app/query/query_*.py`)
- Database query execution (`src/db/`)
- Core business logic (`src/app/`)
- Audit logging functions (`src/app/audit/`)
- Input validation and sanitization

**C++ Components:**
- Data ingestion pipeline (`src/ingestion/`)
- Serialization/deserialization
- Database insert operations
- Message parsing (`src/parser/`)
- Memory management in hot paths

**Vue/TypeScript:**
- Authentication state management (Pinia auth store)
- Query composition and execution
- Form validation
- Workflow state machines
- Data transformation utilities

---

## Python Coverage Analysis (pytest-cov)

### Reading the Coverage Report

```
Name                                        Stmts   Miss  Cover   Missing
-------------------------------------------------------------------------
src/app/query/query_executor.py               120     45    62%   34-42, 67-89, 105-120
src/app/query/query_validator.py               85      5    94%   72-76
src/app/processing/engine.py                  200     80    60%   45-67, 90-134, 178-200
src/apis/records.py                            95     15    84%   67-72, 88-95
src/db/client.py                               60     20    67%   25-44
-------------------------------------------------------------------------
TOTAL                                         560    165    71%
```

### Generating Missing Tests

For each uncovered file, generate tests following this pattern:

```python
# tests/unit/app/query/test_query_executor.py
import pytest
from unittest.mock import MagicMock, patch
from src.app.query.query_executor import QueryExecutor

class TestQueryExecutor:
    """Tests for QueryExecutor - targeting uncovered lines 34-42, 67-89, 105-120."""

    @pytest.fixture
    def executor(self):
        return QueryExecutor(db_client=MagicMock())

    @pytest.fixture
    def sample_filters(self):
        return [
            {"field": "source_ip", "operator": "eq", "value": "10.0.1.50"},
            {"field": "severity", "operator": "gte", "value": "high"},
        ]

    # Lines 34-42: Error handling for invalid filters
    def test_raises_on_invalid_filter_field(self, executor):
        with pytest.raises(ValueError, match="Unknown filter field"):
            executor.build_query([{"field": "nonexistent", "operator": "eq", "value": "x"}])

    def test_raises_on_invalid_operator(self, executor):
        with pytest.raises(ValueError, match="Invalid operator"):
            executor.build_query([{"field": "source_ip", "operator": "LIKE", "value": "x"}])

    # Lines 67-89: Time range handling
    def test_applies_time_range_filter(self, executor, sample_filters):
        query = executor.build_query(sample_filters, time_range={"start": "2024-01-01", "end": "2024-01-02"})
        assert "timestamp >=" in query
        assert "timestamp <=" in query

    def test_default_time_range_is_24h(self, executor, sample_filters):
        query = executor.build_query(sample_filters)
        assert "timestamp >=" in query  # Default 24h lookback

    # Lines 105-120: Result pagination
    def test_applies_limit_and_offset(self, executor, sample_filters):
        query = executor.build_query(sample_filters, limit=50, offset=100)
        assert "LIMIT 50" in query
        assert "OFFSET 100" in query

    def test_max_limit_capped(self, executor, sample_filters):
        query = executor.build_query(sample_filters, limit=100000)
        assert "LIMIT 10000" in query  # Capped to prevent OOM
```

---

## C++ Coverage Analysis (gcov/lcov)

### Reading the Coverage Report

```
Directory: src/ingestion/
File                          Lines    Exec   Cover
----------------------------------------------------
data_parser.cpp                 250     180    72.0%
batch_inserter.cpp              180     150    83.3%
proto_converter.cpp             120      60    50.0%
----------------------------------------------------
TOTAL                           550     390    70.9%
```

### Generating Missing Tests

```cpp
// test/test_proto_converter.cpp
#include <gtest/gtest.h>
#include "ingestion/proto_converter.h"
#include "myapp/network_event.pb.h"

class ProtoConverterTest : public ::testing::Test {
protected:
    ProtoConverter converter;
};

// Covering uncovered deserialization error path
TEST_F(ProtoConverterTest, HandlesCorruptedProtobufGracefully) {
    std::string corrupted_data = "not_valid_protobuf";
    auto result = converter.parse_network_event(corrupted_data);
    EXPECT_FALSE(result.has_value());
    EXPECT_EQ(result.error(), ParseError::INVALID_PROTOBUF);
}

// Covering uncovered field mapping paths
TEST_F(ProtoConverterTest, MapsAllNetworkEventFields) {
    myapp::NetworkEvent proto_event;
    proto_event.set_source_ip("10.0.1.50");
    proto_event.set_dest_ip("10.0.2.100");
    proto_event.set_source_port(49152);
    proto_event.set_dest_port(443);

    std::string serialized;
    proto_event.SerializeToString(&serialized);

    auto result = converter.parse_network_event(serialized);
    ASSERT_TRUE(result.has_value());
    EXPECT_EQ(result->source_ip, "10.0.1.50");
    EXPECT_EQ(result->dest_ip, "10.0.2.100");
    EXPECT_EQ(result->source_port, 49152);
    EXPECT_EQ(result->dest_port, 443);
}

// Covering uncovered empty message path
TEST_F(ProtoConverterTest, HandlesEmptyProtobufMessage) {
    myapp::NetworkEvent empty_event;
    std::string serialized;
    empty_event.SerializeToString(&serialized);

    auto result = converter.parse_network_event(serialized);
    ASSERT_TRUE(result.has_value());
    EXPECT_TRUE(result->source_ip.empty());
    EXPECT_EQ(result->source_port, 0);
}
```

---

## Vue/TypeScript Coverage Analysis (Vitest)

### Reading the Coverage Report

```
% Coverage report from v8
------------------------------------|---------|----------|---------|---------|
File                                | % Stmts | % Branch | % Funcs | % Lines |
------------------------------------|---------|----------|---------|---------|
composables/useQuery.ts             |   72.5  |   55.0   |   80.0  |   72.5  |
composables/useLabel.ts             |   95.0  |   90.0   |  100.0  |   95.0  |
stores/records.ts                   |   60.0  |   45.0   |   70.0  |   60.0  |
utils/queryFormatter.ts             |   85.0  |   80.0   |   90.0  |   85.0  |
------------------------------------|---------|----------|---------|---------|
All files                           |   78.1  |   67.5   |   85.0  |   78.1  |
```

### Generating Missing Tests

```typescript
// composables/__tests__/useQuery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQuery } from '../useQuery'
import { setActivePinia, createPinia } from 'pinia'

describe('useQuery - uncovered branches', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Covering uncovered branch: query timeout handling
  it('handles query execution timeout', async () => {
    const { executeQuery, error, isLoading } = useQuery()

    vi.useFakeTimers()
    const promise = executeQuery('SELECT * FROM large_table')

    // Advance past timeout
    vi.advanceTimersByTime(60000)
    await promise

    expect(isLoading.value).toBe(false)
    expect(error.value).toContain('timeout')
    vi.useRealTimers()
  })

  // Covering uncovered branch: empty result handling
  it('handles empty query results gracefully', async () => {
    const { executeQuery, results, resultCount } = useQuery()

    // Mock empty response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], columns: ['source_ip'], total: 0 }),
    } as Response)

    await executeQuery('SELECT source_ip FROM events WHERE 1=0')

    expect(results.value).toEqual([])
    expect(resultCount.value).toBe(0)
  })

  // Covering uncovered branch: query validation failure
  it('rejects queries with disallowed keywords', async () => {
    const { executeQuery, error } = useQuery()

    await executeQuery('DROP TABLE events')

    expect(error.value).toContain('disallowed')
  })
})
```

---

## Coverage Improvement Strategy

### Priority Order for Test Generation

1. **Security-critical paths** (auth, input validation, query building)
2. **Error handling paths** (exception handlers, edge cases)
3. **Business logic branches** (rules, score calculations)
4. **Integration points** (API endpoints, database operations)
5. **Utility functions** (formatters, converters, helpers)

### Test Focus Areas

**Happy path scenarios:**
- Expected inputs produce expected outputs
- API endpoints return correct status codes and data

**Error handling:**
- Invalid input returns proper error messages
- Database connection failures are handled gracefully
- Timeout scenarios are covered

**Edge cases:**
- Empty collections, None/null values, zero counts
- Maximum values (large datasets, long strings)
- Boundary conditions (exactly at limit, one over)
- Unicode and special characters in input

**Security scenarios:**
- SQL injection attempts are blocked
- Authentication failures return 401
- Authorization failures return 403
- Invalid tokens are rejected

---

## Before/After Report Format

```
COVERAGE REPORT
Project: my-api

Before:
  Statements: 71% (560/789)
  Branches:   58% (234/403)
  Functions:  75% (120/160)
  Lines:      71% (560/789)

After (20 new tests added):
  Statements: 84% (+13%) (663/789)
  Branches:   72% (+14%) (290/403)
  Functions:  88% (+13%) (141/160)
  Lines:      84% (+13%) (663/789)

Files improved:
  src/app/query/query_executor.py:  62% -> 91% (+29%)
  src/app/processing/engine.py:     60% -> 82% (+22%)
  src/db/client.py:                 67% -> 88% (+21%)

Remaining below threshold:
  src/app/legacy/old_parser.py:     45% (consider deprecation)

Target: 85% -- Status: NOT MET (84%)
  Needs 8 more lines covered to reach target.
```

## Integration with Other Commands

- Use `/tdd` to write tests using test-driven development
- Use `/verify` to run full verification after coverage improvement
- Use `/python-review` to review quality of new tests
- Use `/refactor-clean` to remove dead code that inflates uncovered lines
- Use `/build-fix` if new tests reveal build issues

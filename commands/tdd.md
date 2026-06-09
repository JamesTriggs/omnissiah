---
description: Enforce a test-driven development workflow across a polyglot stack. Scaffold interfaces, generate tests FIRST, then implement minimal code to pass. Ensure 80%+ coverage.
---

# TDD Command

This command enforces test-driven development methodology across project types: Python (pytest), C++ (Google Test), and Vue/TypeScript (Vitest/Cypress).

## What This Command Does

1. **Scaffold Interfaces** - Define types/interfaces/schemas first
2. **Generate Tests First** - Write failing tests (RED)
3. **Implement Minimal Code** - Write just enough to pass (GREEN)
4. **Refactor** - Improve code while keeping tests green (REFACTOR)
5. **Verify Coverage** - Ensure 80%+ test coverage

## When to Use

Use `/tdd` when:
- Implementing new features in any service
- Adding new API endpoints (Flask or FastAPI)
- Writing new C++ data processing logic
- Building Vue components or composables
- Fixing bugs (write test that reproduces bug first)
- Adding new business logic
- Implementing database query handlers
- Building serialized-schema message handlers

## How It Works

The TDD workflow will:

1. **Detect project type** from the working directory and file extensions
2. **Define interfaces** for inputs/outputs (Pydantic models, C++ headers, TypeScript types, schema messages)
3. **Write tests that will FAIL** (because code doesn't exist yet)
4. **Run tests** and verify they fail for the right reason
5. **Write minimal implementation** to make tests pass
6. **Run tests** and verify they pass
7. **Refactor** code while keeping tests green
8. **Check coverage** and add more tests if below 80%

## TDD Cycle

```
RED -> GREEN -> REFACTOR -> REPEAT

RED:      Write a failing test
GREEN:    Write minimal code to pass
REFACTOR: Improve code, keep tests passing
REPEAT:   Next feature/scenario
```

## Project-Specific Test Commands

```bash
# Python
pytest tests/unit/test_module.py -v
pytest tests/unit/test_module.py -v --cov=src --cov-report=term-missing

# C++
ctest --test-dir build --output-on-failure

# Vue/TypeScript
npx vitest run src/components/MyComponent.test.ts
npx vitest run --coverage

# Integration tests
pytest tests/integration -v -k "test_specific"
```

---

## Example: Python API (Flask/FastAPI) TDD

```
User: /tdd I need a function to calculate a priority score from request attributes

Agent:
# TDD Session: Priority Score Calculator

## Step 1: Define Interface (SCAFFOLD)

```python
# src/app/scoring/priority.py
from pydantic import BaseModel
from enum import Enum

class PriorityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class RequestAttributes(BaseModel):
    category: str
    item_count: int
    is_escalated: bool
    resource_importance: int  # 1-10 scale
    time_window_minutes: int

class PriorityResult(BaseModel):
    score: float  # 0.0 - 100.0
    level: PriorityLevel
    contributing_factors: list[str]

def calculate_priority(request: RequestAttributes) -> PriorityResult:
    """Calculate a priority score from request attributes."""
    raise NotImplementedError("TDD: implement after tests pass")
```

## Step 2: Write Failing Tests (RED)

```python
# tests/unit/app/scoring/test_priority.py
import pytest
from src.app.scoring.priority import (
    calculate_priority,
    RequestAttributes,
    PriorityLevel,
)

class TestCalculatePriority:
    """TDD tests for priority calculation."""

    def test_critical_priority_for_escalated_important_resource(self):
        request = RequestAttributes(
            category="billing",
            item_count=50,
            is_escalated=True,
            resource_importance=9,
            time_window_minutes=5,
        )
        result = calculate_priority(request)
        assert result.score > 85.0
        assert result.level == PriorityLevel.CRITICAL
        assert "escalated" in result.contributing_factors

    def test_low_priority_for_single_minor_item(self):
        request = RequestAttributes(
            category="info",
            item_count=1,
            is_escalated=False,
            resource_importance=2,
            time_window_minutes=60,
        )
        result = calculate_priority(request)
        assert result.score < 30.0
        assert result.level in (PriorityLevel.LOW, PriorityLevel.INFO)

    def test_high_priority_for_rapid_burst(self):
        request = RequestAttributes(
            category="orders",
            item_count=200,
            is_escalated=False,
            resource_importance=7,
            time_window_minutes=2,
        )
        result = calculate_priority(request)
        assert result.score > 60.0
        assert result.level in (PriorityLevel.HIGH, PriorityLevel.CRITICAL)
        assert "rapid_burst" in result.contributing_factors

    def test_zero_items_returns_info(self):
        request = RequestAttributes(
            category="info",
            item_count=0,
            is_escalated=False,
            resource_importance=1,
            time_window_minutes=60,
        )
        result = calculate_priority(request)
        assert result.score == 0.0
        assert result.level == PriorityLevel.INFO

    def test_score_clamped_to_100(self):
        request = RequestAttributes(
            category="billing",
            item_count=10000,
            is_escalated=True,
            resource_importance=10,
            time_window_minutes=1,
        )
        result = calculate_priority(request)
        assert result.score <= 100.0
```

## Step 3: Run Tests - Verify FAIL

```bash
pytest tests/unit/app/scoring/test_priority.py -v

FAILED test_critical_priority_for_escalated_important_resource - NotImplementedError
FAILED test_low_priority_for_single_minor_item - NotImplementedError
FAILED test_high_priority_for_rapid_burst - NotImplementedError
FAILED test_zero_items_returns_info - NotImplementedError
FAILED test_score_clamped_to_100 - NotImplementedError

5 failed
```

Tests fail as expected. Ready to implement.

## Step 4: Implement Minimal Code (GREEN)

```python
# src/app/scoring/priority.py
def calculate_priority(request: RequestAttributes) -> PriorityResult:
    if request.item_count == 0:
        return PriorityResult(score=0.0, level=PriorityLevel.INFO, contributing_factors=[])

    factors: list[str] = []

    # Volume score (0-25)
    volume_score = min(request.item_count / 100, 1.0) * 25
    if request.item_count > 100:
        factors.append("high_volume")

    # Rapid burst detection (0-25)
    items_per_minute = request.item_count / max(request.time_window_minutes, 1)
    burst_score = min(items_per_minute / 10, 1.0) * 25
    if items_per_minute > 50:
        factors.append("rapid_burst")

    # Resource importance (0-25)
    resource_score = (request.resource_importance / 10) * 25

    # Escalation (0-25)
    escalation_score = 25.0 if request.is_escalated else 0.0
    if request.is_escalated:
        factors.append("escalated")

    score = min(volume_score + burst_score + resource_score + escalation_score, 100.0)

    if score > 85:
        level = PriorityLevel.CRITICAL
    elif score > 60:
        level = PriorityLevel.HIGH
    elif score > 35:
        level = PriorityLevel.MEDIUM
    elif score > 15:
        level = PriorityLevel.LOW
    else:
        level = PriorityLevel.INFO

    return PriorityResult(score=score, level=level, contributing_factors=factors)
```

## Step 5: Run Tests - Verify PASS

```bash
pytest tests/unit/app/scoring/test_priority.py -v

PASSED test_critical_priority_for_escalated_important_resource
PASSED test_low_priority_for_single_minor_item
PASSED test_high_priority_for_rapid_burst
PASSED test_zero_items_returns_info
PASSED test_score_clamped_to_100

5 passed
```

All tests passing!
```

---

## Example: C++ (Google Test) TDD

```
User: /tdd I need a message classifier for the parser library

Agent:
# TDD Session: Message Classifier

## Step 1: Define Interface (SCAFFOLD)

```cpp
// include/mylib/message_classifier.h
#pragma once
#include <string>
#include <cstdint>
#include <memory>

namespace mylib {

enum class MessageCategory {
    NORMAL,
    SUSPECT,
    REJECTED,
    UNKNOWN
};

struct MessageInfo {
    std::string source;
    std::string destination;
    uint16_t source_port;
    uint16_t dest_port;
    uint8_t protocol;
    size_t payload_size;
    bool is_encrypted;
};

struct ClassificationResult {
    MessageCategory category;
    float confidence;  // 0.0 - 1.0
    std::string reason;
};

class MessageClassifier {
public:
    MessageClassifier();
    ~MessageClassifier();

    ClassificationResult classify(const MessageInfo& message) const;
    void add_blocklist_entry(const std::string& source);
    void clear_blocklist();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace mylib
```

## Step 2: Write Failing Tests (RED)

```cpp
// test/test_message_classifier.cpp
#include <gtest/gtest.h>
#include "mylib/message_classifier.h"

using namespace mylib;

class MessageClassifierTest : public ::testing::Test {
protected:
    MessageClassifier classifier;

    MessageInfo make_normal_message() {
        return MessageInfo{
            .source = "192.168.1.100",
            .destination = "10.0.0.1",
            .source_port = 49152,
            .dest_port = 443,
            .protocol = 6,  // TCP
            .payload_size = 1024,
            .is_encrypted = true
        };
    }
};

TEST_F(MessageClassifierTest, NormalMessageClassifiedAsNormal) {
    auto message = make_normal_message();
    auto result = classifier.classify(message);
    EXPECT_EQ(result.category, MessageCategory::NORMAL);
    EXPECT_GE(result.confidence, 0.5f);
}

TEST_F(MessageClassifierTest, BlocklistedSourceIsRejected) {
    classifier.add_blocklist_entry("10.99.99.99");
    MessageInfo message = make_normal_message();
    message.source = "10.99.99.99";
    auto result = classifier.classify(message);
    EXPECT_EQ(result.category, MessageCategory::REJECTED);
    EXPECT_GE(result.confidence, 0.9f);
}

TEST_F(MessageClassifierTest, LargeUnencryptedPayloadIsSuspect) {
    MessageInfo message = make_normal_message();
    message.payload_size = 65000;
    message.is_encrypted = false;
    auto result = classifier.classify(message);
    EXPECT_EQ(result.category, MessageCategory::SUSPECT);
}

TEST_F(MessageClassifierTest, ClearBlocklistResetsClassification) {
    classifier.add_blocklist_entry("10.99.99.99");
    classifier.clear_blocklist();
    MessageInfo message = make_normal_message();
    message.source = "10.99.99.99";
    auto result = classifier.classify(message);
    EXPECT_NE(result.category, MessageCategory::REJECTED);
}

TEST_F(MessageClassifierTest, ConfidenceAlwaysInRange) {
    auto message = make_normal_message();
    auto result = classifier.classify(message);
    EXPECT_GE(result.confidence, 0.0f);
    EXPECT_LE(result.confidence, 1.0f);
}
```

## Step 3: Run Tests - Verify FAIL

```bash
ctest --test-dir build --output-on-failure

[  FAILED  ] MessageClassifierTest.NormalMessageClassifiedAsNormal
[  FAILED  ] MessageClassifierTest.BlocklistedSourceIsRejected
[  FAILED  ] MessageClassifierTest.LargeUnencryptedPayloadIsSuspect
[  FAILED  ] MessageClassifierTest.ClearBlocklistResetsClassification
[  FAILED  ] MessageClassifierTest.ConfidenceAlwaysInRange

5 tests FAILED
```

Tests fail as expected. Implement now.
```

---

## Example: Vue/TypeScript (Vitest) TDD

```
User: /tdd I need a composable to format and display a label with a status badge

Agent:
# TDD Session: Label Display Composable

## Step 1: Define Interface (SCAFFOLD)

```typescript
// composables/useLabel.ts
export interface Label {
  id: string
  name: string
  group: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
}

export interface LabelDisplay {
  formattedId: string        // e.g., "L-001 - Overdue"
  groupBadgeColor: string    // CSS color for the group badge
  severityIcon: string       // Icon name for severity
  shortDescription: string   // Truncated to 120 chars
  detailUrl: string          // Link to a detail page
}

export function useLabel(label: Label): LabelDisplay {
  throw new Error('Not implemented')
}
```

## Step 2: Write Failing Tests (RED)

```typescript
// composables/__tests__/useLabel.test.ts
import { describe, it, expect } from 'vitest'
import { useLabel, type Label } from '../useLabel'

describe('useLabel', () => {
  const baseLabel: Label = {
    id: 'L-001',
    name: 'Overdue',
    group: 'billing',
    severity: 'high',
    description: 'This record is overdue and needs attention. It has been flagged for follow-up by the billing team within the next working day.',
  }

  it('formats label ID with name', () => {
    const result = useLabel(baseLabel)
    expect(result.formattedId).toBe('L-001 - Overdue')
  })

  it('assigns a valid badge color for the billing group', () => {
    const result = useLabel(baseLabel)
    expect(result.groupBadgeColor).toBeTruthy()
    expect(result.groupBadgeColor).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('returns correct severity icon for high severity', () => {
    const result = useLabel(baseLabel)
    expect(result.severityIcon).toBe('mdi-alert')
  })

  it('truncates long descriptions to 120 characters', () => {
    const result = useLabel(baseLabel)
    expect(result.shortDescription.length).toBeLessThanOrEqual(123) // 120 + '...'
    expect(result.shortDescription).toContain('...')
  })

  it('generates a correct detail URL', () => {
    const result = useLabel(baseLabel)
    expect(result.detailUrl).toBe('/labels/L-001')
  })

  it('returns info icon for low severity', () => {
    const label: Label = { ...baseLabel, severity: 'low' }
    const result = useLabel(label)
    expect(result.severityIcon).toBe('mdi-information')
  })
})
```

## Step 3: Run Tests - Verify FAIL

```bash
npx vitest run composables/__tests__/useLabel.test.ts

FAIL composables/__tests__/useLabel.test.ts
  6 tests failed - Error: Not implemented
```

Tests fail as expected. Implement now.
```

---

## TDD Best Practices

**DO:**
- Write the test FIRST, before any implementation
- Run tests and verify they FAIL before implementing
- Write minimal code to make tests pass
- Refactor only after tests are green
- Add edge cases and error scenarios
- Aim for 80%+ coverage (100% for security-critical code)

**DON'T:**
- Write implementation before tests
- Skip running tests after each change
- Write too much code at once
- Ignore failing tests
- Test implementation details (test behavior instead)
- Mock everything (prefer integration tests for API layers)

## Test Types by Layer

### Unit Tests (Function-level)

**Python (pytest)**:
- Happy path scenarios
- Edge cases (empty, None, max values)
- Error conditions and exception handling
- Pydantic model validation
- Query builder output

**C++ (Google Test)**:
- Core algorithm correctness
- Boundary values and overflow
- Memory management (no leaks)
- Thread safety with concurrent access
- Serialization/deserialization

**Vue/TypeScript (Vitest)**:
- Composable logic
- Pinia store mutations and getters
- Utility functions
- Type guard functions
- Component rendering with test utils

### Integration Tests (Component-level)

**Python**: API endpoint testing with test client, database operations with test fixtures
**C++**: Multi-module interaction, database client integration
**Vue/TypeScript**: Component integration with Pinia stores, API mock integration

### E2E Tests (use `/e2e` command)

- Critical user flows through the UI
- Search and query execution
- Record creation and editing
- Multi-step workflows

## Coverage Requirements

- **80% minimum** for all code
- **90%+ required** for:
  - Core business logic
  - Authentication and authorization
  - Query builders
  - Data ingestion pipeline processing
  - Serialized-schema message handling
- **100% required** for:
  - Security-critical code paths
  - SQL injection prevention layers
  - Audit logging functions

## Project-Specific Test Runners

| Project type | Framework | Command |
|---------|-----------|---------|
| Python API (Flask) | pytest | `pytest tests/ -v` |
| Python API (FastAPI) | pytest | `pytest tests/ -v` |
| C++ library | Google Test | `ctest --test-dir build` |
| Vue/Nuxt UI | Vitest | `npx vitest run` |
| Vue/Nuxt UI | Cypress | `npx cypress run` |
| Query parser | pytest | `pytest tests/ -v` |
| Shared schemas | protoc | proto build (compilation check) |

## Integration with Other Commands

- Use `/plan` first to understand what to build
- Use `/tdd` to implement with tests
- Use `/build-fix` if build errors occur
- Use `/python-review` to review Python implementation
- Use `/test-coverage` to verify coverage
- Use `/verify` for full pre-commit verification

## Important Notes

**MANDATORY**: Tests must be written BEFORE implementation. The TDD cycle is:

1. **RED** - Write failing test
2. **GREEN** - Implement to pass
3. **REFACTOR** - Improve code

Never skip the RED phase. Never write code before tests.

**General Considerations**:
- Business-rule tests must include both positive and negative scenarios
- Query tests should validate SQL output, not execute against a live DB
- Serialized-schema tests must verify forward/backward compatibility
- API tests must include authentication/authorization checks
- C++ tests must run under a memory checker (e.g. valgrind) in CI for leak detection

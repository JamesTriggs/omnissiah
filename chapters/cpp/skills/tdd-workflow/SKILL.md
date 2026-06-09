---
name: tdd-workflow
description: Use this skill when writing new C++ features, fixing bugs, or refactoring code. Enforces test-driven development with Google Test, sanitizers, CMake integration, and cppcheck.
---

# Test-Driven Development Workflow — C++ Chapter

This skill enforces TDD for C++ development across the platform. It covers only
C++ tooling — GTest, GMock, CMake, ASAN/TSAN/UBSAN, and cppcheck. For Python TDD
patterns, see the python chapter.

## When to Activate

- Writing new C++ features or classes (data-loader, netlib, stream-engine)
- Fixing C++ bugs or memory safety issues
- Refactoring C++ code
- Adding new data pipeline stages
- Modifying Protobuf serialization logic
- Updating network packet processing

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write a failing GTest first, then implement the minimal code to make it pass.

### 2. Coverage Requirements
- Unit test every class method and edge case
- Integration tests for component interactions and data pipeline stages
- Performance tests for throughput requirements
- All memory safety paths covered (ASAN/TSAN/UBSAN clean)

### 3. Red-Green-Refactor Loop
1. Write a failing test (Red)
2. Write minimal code to pass it (Green)
3. Refactor while keeping tests green (Refactor)
4. Run sanitizers to catch memory/thread safety issues

## TDD Workflow Steps

### Step 1: Write the Test (Red)
```cpp
// test/unit/test_flow_parser.cpp
#include <gtest/gtest.h>
#include "app/parser/flow_parser.h"

TEST(FlowParserTest, ParsesValidFlow) {
    FlowParser parser;
    std::string raw = create_test_flow_data();

    auto result = parser.parse(raw);

    ASSERT_TRUE(result.has_value());
    EXPECT_EQ(result->src_ip(), "10.0.0.1");
    EXPECT_EQ(result->dst_port(), 443);
}
```

Compile and run — it should FAIL (linker error or assertion failure).

### Step 2: Implement Minimal Code (Green)
Write the smallest implementation that makes the test pass. No more.

### Step 3: Run Tests
```bash
./build_linux.bash ubuntu2204 test
# or
cmake --build build --target test
ctest --output-on-failure
```

### Step 4: Refactor
Improve code quality, extract classes, reduce duplication — keep tests green.

### Step 5: Run Sanitizers
```bash
cmake .. -DCMAKE_BUILD_TYPE=Debug \
         -DSANITIZE_ADDRESS=ON \
         -DSANITIZE_UNDEFINED=ON
make && ./run_tests
```

## Google Test Patterns

### Test Fixture
```cpp
#include <gtest/gtest.h>
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
```

### Parameterized Tests
```cpp
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

### GTest Assertions Reference
```cpp
// Fatal assertions (stop test on failure)
ASSERT_TRUE(condition);
ASSERT_FALSE(condition);
ASSERT_EQ(expected, actual);
ASSERT_NE(a, b);
ASSERT_LT(a, b);    // a < b
ASSERT_LE(a, b);    // a <= b
ASSERT_GT(a, b);    // a > b
ASSERT_GE(a, b);    // a >= b
ASSERT_STREQ(expected_str, actual_str);
ASSERT_THROW(statement, ExceptionType);
ASSERT_NO_THROW(statement);

// Non-fatal assertions (continue test on failure)
EXPECT_TRUE(condition);
EXPECT_EQ(expected, actual);
EXPECT_DOUBLE_EQ(expected, actual);  // floating point
EXPECT_NEAR(expected, actual, abs_error);
```

## GMock Patterns

### Mock Objects
```cpp
#include <gmock/gmock.h>
#include "app/interfaces/db_client.h"

class MockDbClient : public IDbClient {
public:
    MOCK_METHOD(bool, write_batch,
        (const std::vector<app::dm::network::Flow>&), (override));
    MOCK_METHOD(std::vector<Row>, query,
        (const std::string& sql), (override));
};
```

### Using Mocks in Tests
```cpp
TEST_F(WriterTest, WritesBatchSuccessfully) {
    MockDbClient mock_client;

    // Set up expectation
    EXPECT_CALL(mock_client, write_batch(::testing::SizeIs(100)))
        .Times(1)
        .WillOnce(::testing::Return(true));

    BatchWriter writer(&mock_client);
    auto flows = generate_test_flows(100);

    bool result = writer.flush(flows);

    EXPECT_TRUE(result);
}

TEST_F(WriterTest, RetriesOnTransientFailure) {
    MockDbClient mock_client;

    // Fail first call, succeed second
    EXPECT_CALL(mock_client, write_batch(::testing::_))
        .WillOnce(::testing::Return(false))
        .WillOnce(::testing::Return(true));

    BatchWriter writer(&mock_client, /*max_retries=*/3);
    auto flows = generate_test_flows(10);

    bool result = writer.flush(flows);

    EXPECT_TRUE(result);
}
```

### GMock Matchers
```cpp
using ::testing::_;
using ::testing::Eq;
using ::testing::Contains;
using ::testing::StartsWith;
using ::testing::SizeIs;
using ::testing::IsEmpty;
using ::testing::Not;
using ::testing::AnyOf;

EXPECT_CALL(mock, method(SizeIs(10)));      // arg has size 10
EXPECT_CALL(mock, method(Contains("key"))); // arg contains "key"
EXPECT_CALL(mock, method(Not(IsEmpty())));  // arg is not empty
EXPECT_CALL(mock, method(_, Eq(42)));       // second arg == 42
```

## Integration Tests

### the analytics database Writer Integration Test
```cpp
#include <gtest/gtest.h>
#include "app/database/db_writer.h"

class DbWriterIntegrationTest : public ::testing::Test {
protected:
    void SetUp() override {
        writer_ = std::make_unique<DbWriter>(
            "localhost", 9000, "test_app"
        );
        writer_->create_test_tables();
    }

    void TearDown() override {
        writer_->drop_test_tables();
    }

    std::unique_ptr<DbWriter> writer_;
};

TEST_F(DbWriterIntegrationTest, WritesFlowBatch) {
    std::vector<app::dm::network::Flow> flows;
    for (int i = 0; i < 100; i++) {
        flows.push_back(create_test_flow(i));
    }

    auto result = writer_->write_batch(flows);

    EXPECT_TRUE(result.ok());
    EXPECT_EQ(result.rows_written(), 100);
}

TEST_F(DbWriterIntegrationTest, HandlesBatchFailureGracefully) {
    auto result = writer_->write_batch_to_table("nonexistent", {});
    EXPECT_FALSE(result.ok());
    EXPECT_NE(result.error_message().find("UNKNOWN_TABLE"), std::string::npos);
}
```

### Performance Benchmark Test
```cpp
TEST_F(DbWriterIntegrationTest, MeetsThroughputRequirements) {
    constexpr int BATCH_SIZE = 10000;
    auto flows = generate_test_flows(BATCH_SIZE);

    auto start = std::chrono::high_resolution_clock::now();
    auto result = writer_->write_batch(flows);
    auto end   = std::chrono::high_resolution_clock::now();

    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

    EXPECT_TRUE(result.ok());
    // Must write 10k flows in under 500ms
    EXPECT_LT(ms, 500) << "Write throughput too slow: " << ms << "ms";
}
```

## Sanitizers

### AddressSanitizer (ASAN) — Memory Safety
```cmake
# CMakeLists.txt
option(SANITIZE_ADDRESS "Enable AddressSanitizer" OFF)
if(SANITIZE_ADDRESS)
    add_compile_options(-fsanitize=address -fno-omit-frame-pointer)
    add_link_options(-fsanitize=address)
endif()
```

```bash
# Build and run with ASAN
cmake .. -DCMAKE_BUILD_TYPE=Debug -DSANITIZE_ADDRESS=ON
make
./run_unit_tests
# ASAN will report heap-use-after-free, buffer overflows, etc.
```

### ThreadSanitizer (TSAN) — Data Races
```bash
cmake .. -DCMAKE_BUILD_TYPE=Debug -DSANITIZE_THREAD=ON
make
./run_unit_tests
# TSAN will report data races between threads
```

### UndefinedBehaviorSanitizer (UBSAN)
```bash
cmake .. -DCMAKE_BUILD_TYPE=Debug -DSANITIZE_UNDEFINED=ON
make
./run_unit_tests
# UBSAN catches integer overflow, null dereference, etc.
```

### Combined Sanitizer Build (CI)
```bash
cmake .. -DCMAKE_BUILD_TYPE=Debug \
         -DSANITIZE_ADDRESS=ON \
         -DSANITIZE_UNDEFINED=ON
make -j$(nproc)
ctest --output-on-failure
```

## CMake Test Integration

### CMakeLists.txt Pattern
```cmake
cmake_minimum_required(VERSION 3.14)
project(app_tests)

enable_testing()
find_package(GTest REQUIRED)

# Unit tests
add_executable(unit_tests
    test/unit/test_flow_parser.cpp
    test/unit/test_batch_writer.cpp
    test/unit/test_protobuf_handler.cpp
)
target_link_libraries(unit_tests
    PRIVATE
        GTest::gtest_main
        GTest::gmock
        app_lib
)

# Register with CTest
include(GoogleTest)
gtest_discover_tests(unit_tests)

# Integration tests (separate target)
add_executable(integration_tests
    test/integration/test_db_writer.cpp
)
target_link_libraries(integration_tests
    PRIVATE GTest::gtest_main app_lib db_client
)
gtest_discover_tests(integration_tests
    PROPERTIES LABELS "integration"
)
```

### Running Specific Tests
```bash
# Run all tests
ctest

# Run only unit tests
ctest -L unit

# Run specific test by name
./Debug/unit_tests --gtest_filter="FlowParserTest.*"

# Run with verbose output
./Debug/unit_tests --gtest_filter="FlowParserTest.ParsesValidFlow" --gtest_color=yes

# List all test names
./Debug/unit_tests --gtest_list_tests
```

## cppcheck Integration

Run cppcheck in the TDD loop to catch static analysis issues:

```bash
# Analyse source directory
cppcheck --enable=all --suppress=missingIncludeSystem \
         --std=c++17 --error-exitcode=1 src/

# Generate XML report for CI
cppcheck --enable=all --xml src/ 2> cppcheck-report.xml

# Focus on specific checks
cppcheck --enable=warning,performance,portability src/
```

### cppcheck CI Integration
```bash
#!/bin/bash
set -e
cppcheck --enable=all \
         --suppress=missingIncludeSystem \
         --std=c++17 \
         --error-exitcode=1 \
         src/
```

## Test File Organisation

```
# C++ (data-loader, netlib)
test/
├── unit/
│   ├── test_flow_parser.cpp
│   ├── test_protobuf_handler.cpp
│   ├── test_batch_writer.cpp
│   └── test_network_classifier.cpp
├── integration/
│   ├── test_db_writer.cpp
│   └── test_data_pipeline.cpp
├── performance/
│   └── test_throughput.cpp
└── CMakeLists.txt
```

## Watch Mode During Development

```bash
# Use entr to re-run tests on file change
find src test -name "*.cpp" -o -name "*.h" | entr -c make test

# Or with CMake + ctest
find src test -name "*.cpp" | entr -c bash -c "cmake --build build && ctest --output-on-failure"
```

## CI Integration (Azure Pipelines)

```yaml
- job: CppTests
  steps:
    - script: |
        ./build_linux.bash ubuntu2204 build debug
        ./build_linux.bash ubuntu2204 test
        cppcheck --enable=all --error-exitcode=1 src/
```

## Memory Safety Checklist

Before merging any C++ change:

- [ ] ASAN run: zero errors
- [ ] TSAN run: zero data races (for multi-threaded code)
- [ ] UBSAN run: zero undefined behaviour reports
- [ ] cppcheck: zero warnings (or all suppressed with justification)
- [ ] Valgrind clean (for allocation-heavy code):
  ```bash
  valgrind --leak-check=full --error-exitcode=1 ./unit_tests
  ```

## Success Metrics

- All GTest tests passing in CI
- ASAN/TSAN/UBSAN clean builds
- cppcheck reports zero errors
- Performance benchmarks within defined thresholds (e.g. 10k flows < 500ms)
- Zero memory leaks (Valgrind clean)
- Integration tests validate full data pipeline

---

**Remember**: This skill covers C++ TDD only (CMake, sanitizers, cppcheck, and the Google Test framework).
For Python TDD, use the python chapter — it provides the Python-specific TDD skill.

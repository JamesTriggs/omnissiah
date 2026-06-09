# C++ Testing

> Testing rules for C++ components using Google Test and Google Benchmark.

## Testing Stack

| Tool | Purpose | Scope |
|------|---------|-------|
| **Google Test** | Unit and integration testing | All C++ test cases |
| **Google Mock** | Mock objects and dependency injection | Isolating components |
| **Google Benchmark** | Performance benchmarks | Critical path optimization |
| **gcov/lcov** | Code coverage measurement | Coverage reports in CI |
| **Valgrind** | Memory leak detection | CI validation and local debugging |
| **ASAN/TSAN** | Sanitizer-based testing | CI debug builds |

## Build and Run Tests

```bash
# Build and test using the Docker-based build system
./build_linux.bash ubuntu2204 test

# Build debug (includes ASAN) and run tests
./build_linux.bash ubuntu2204 build debug
./build_linux.bash ubuntu2204 test

# Interactive shell for manual testing
./build_linux.bash ubuntu2204 shell
cd build && ctest --output-on-failure -j$(nproc)

# Run specific test suite
./build_linux.bash ubuntu2204 shell
cd build && ./bin/event_processor_test --gtest_filter="EventProcessor.*"

# Run with verbose output
cd build && ./bin/database_loader_test --gtest_output=xml:test_results.xml
```

## Google Test Patterns

### TEST vs TEST_F

```cpp
// TEST: Simple test without shared setup
TEST(EventValidation, RejectsNullOrganisationId) {
    SecurityEvent event;
    event.set_organisation_id(0);
    event.set_timestamp(time(nullptr));

    EXPECT_FALSE(validate_event(event));
}

// TEST_F: Tests sharing common setup via fixtures
class EventProcessorTest : public ::testing::Test {
protected:
    void SetUp() override {
        config_.max_batch_size = 100;
        config_.flush_interval_seconds = 5;
        processor_ = std::make_unique<EventProcessor>(config_);
    }

    void TearDown() override {
        processor_.reset();
    }

    PipelineConfig config_;
    std::unique_ptr<EventProcessor> processor_;

    // Helper to create test events
    SecurityEvent make_event(int org_id, int severity) {
        SecurityEvent event;
        event.set_organisation_id(org_id);
        event.set_severity(severity);
        event.set_timestamp(time(nullptr));
        event.set_event_type("test_event");
        return event;
    }
};

TEST_F(EventProcessorTest, ProcessesSingleEvent) {
    auto event = make_event(42, 5);
    processor_->add_event(event);

    EXPECT_EQ(processor_->pending_count(), 1);
}

TEST_F(EventProcessorTest, FlushesWhenBatchFull) {
    for (int i = 0; i < 100; ++i) {
        processor_->add_event(make_event(42, i % 10));
    }

    // Batch should auto-flush when full
    EXPECT_EQ(processor_->pending_count(), 0);
    EXPECT_EQ(processor_->total_flushed(), 100);
}

TEST_F(EventProcessorTest, RejectsInvalidEvents) {
    auto invalid_event = make_event(0, 5);  // org_id = 0 is invalid

    EXPECT_THROW(processor_->add_event(invalid_event), std::invalid_argument);
    EXPECT_EQ(processor_->pending_count(), 0);
}
```

### EXPECT vs ASSERT

```cpp
TEST_F(EventProcessorTest, BatchContainsCorrectEvents) {
    // ASSERT: Use when subsequent checks depend on this passing
    // If ASSERT fails, the test STOPS immediately
    auto batch = processor_->get_current_batch();
    ASSERT_NE(batch, nullptr) << "Batch must exist";
    ASSERT_GT(batch->size(), 0) << "Batch must not be empty";

    // EXPECT: Use for independent checks
    // If EXPECT fails, the test CONTINUES (reports all failures)
    for (const auto& event : *batch) {
        EXPECT_GT(event.organisation_id(), 0) << "Every event must have an org_id";
        EXPECT_GE(event.severity(), 0);
        EXPECT_LE(event.severity(), 10);
        EXPECT_FALSE(event.event_type().empty());
    }
}

// Rule of thumb:
// - ASSERT for preconditions that must hold for the test to be meaningful
// - EXPECT for the actual assertions being tested
```

### Death Tests

Use death tests to verify that invalid inputs cause expected failures:

```cpp
TEST(SecurityValidation, CrashesOnNullBuffer) {
    // Verify that passing nullptr crashes (in debug builds)
    EXPECT_DEATH(
        process_packet(nullptr, 100),
        ".*null.*"  // Expected message pattern
    );
}

TEST(BufferOverflow, AbortsOnOversizedInput) {
    std::vector<uint8_t> oversized(kMaxPacketSize + 1);
    EXPECT_DEATH(
        parse_raw_packet(oversized.data(), oversized.size()),
        ".*exceeds.*limit.*"
    );
}
```

### Parameterized Tests

```cpp
// Test multiple severity levels with the same logic
class SeverityClassificationTest : public ::testing::TestWithParam<std::tuple<int, std::string>> {};

TEST_P(SeverityClassificationTest, ClassifiesCorrectly) {
    auto [severity, expected_label] = GetParam();
    EXPECT_EQ(classify_severity(severity), expected_label);
}

INSTANTIATE_TEST_SUITE_P(
    SeverityLevels,
    SeverityClassificationTest,
    ::testing::Values(
        std::make_tuple(1, "low"),
        std::make_tuple(2, "low"),
        std::make_tuple(3, "medium"),
        std::make_tuple(5, "medium"),
        std::make_tuple(7, "high"),
        std::make_tuple(8, "critical"),
        std::make_tuple(10, "critical")
    )
);

// Parameterized test for Protocol Buffer message types
class ProtobufRoundtripTest : public ::testing::TestWithParam<SecurityEvent> {};

TEST_P(ProtobufRoundtripTest, SerializesAndDeserializesCorrectly) {
    const auto& original = GetParam();

    std::string serialized;
    ASSERT_TRUE(original.SerializeToString(&serialized));

    SecurityEvent deserialized;
    ASSERT_TRUE(deserialized.ParseFromString(serialized));

    EXPECT_EQ(deserialized.organisation_id(), original.organisation_id());
    EXPECT_EQ(deserialized.severity(), original.severity());
    EXPECT_EQ(deserialized.event_type(), original.event_type());
}
```

## Test Organization

### Directory Structure

```
app-data-loader/
  src/
    event_processor.cpp
    packet_handler.cpp
    db_writer.cpp
  test/
    unit/
      event_processor_test.cpp
      packet_handler_test.cpp
      protobuf_validation_test.cpp
    integration/
      db_writer_test.cpp
      pipeline_integration_test.cpp
      connection_pool_test.cpp
    benchmark/
      event_processing_benchmark.cpp
      serialization_benchmark.cpp
    fixtures/
      sample_events.h
      test_helpers.h
    CMakeLists.txt
```

### CMake Test Configuration

```cmake
# test/CMakeLists.txt
include(GoogleTest)

# --- Unit Tests ---
add_executable(unit_tests
    unit/event_processor_test.cpp
    unit/packet_handler_test.cpp
    unit/protobuf_validation_test.cpp
)

target_link_libraries(unit_tests
    PRIVATE
        app_core
        GTest::gtest
        GTest::gtest_main
        GTest::gmock
)

gtest_discover_tests(unit_tests
    PROPERTIES
        LABELS "unit"
        TIMEOUT 30
)

# --- Integration Tests ---
add_executable(integration_tests
    integration/db_writer_test.cpp
    integration/pipeline_integration_test.cpp
    integration/connection_pool_test.cpp
)

target_link_libraries(integration_tests
    PRIVATE
        app_core
        GTest::gtest
        GTest::gtest_main
        GTest::gmock
)

gtest_discover_tests(integration_tests
    PROPERTIES
        LABELS "integration"
        TIMEOUT 120
)

# --- Benchmarks ---
add_executable(benchmarks
    benchmark/event_processing_benchmark.cpp
    benchmark/serialization_benchmark.cpp
)

target_link_libraries(benchmarks
    PRIVATE
        app_core
        benchmark::benchmark
        benchmark::benchmark_main
)
```

## Google Mock Patterns

### Dependency Injection for Testability

```cpp
// Define an interface for database operations
class IDbWriter {
public:
    virtual ~IDbWriter() = default;
    virtual bool write_batch(const std::vector<SecurityEvent>& events) = 0;
    virtual bool is_connected() const = 0;
    virtual size_t pending_writes() const = 0;
};

// Production implementation
class DbWriter : public IDbWriter {
public:
    explicit DbWriter(const ConnectionConfig& config);
    bool write_batch(const std::vector<SecurityEvent>& events) override;
    bool is_connected() const override;
    size_t pending_writes() const override;
};

// Mock for testing
class MockDbWriter : public IDbWriter {
public:
    MOCK_METHOD(bool, write_batch, (const std::vector<SecurityEvent>&), (override));
    MOCK_METHOD(bool, is_connected, (), (const, override));
    MOCK_METHOD(size_t, pending_writes, (), (const, override));
};
```

### Using Mocks in Tests

```cpp
#include <gmock/gmock.h>
using ::testing::_;
using ::testing::Return;
using ::testing::SizeIs;
using ::testing::Each;
using ::testing::Field;

class PipelineTest : public ::testing::Test {
protected:
    void SetUp() override {
        mock_writer_ = std::make_shared<MockDbWriter>();
        pipeline_ = std::make_unique<DataPipeline>(mock_writer_);
    }

    std::shared_ptr<MockDbWriter> mock_writer_;
    std::unique_ptr<DataPipeline> pipeline_;
};

TEST_F(PipelineTest, FlushesEventsToWriter) {
    // Expect write_batch to be called once with exactly 10 events
    EXPECT_CALL(*mock_writer_, write_batch(SizeIs(10)))
        .WillOnce(Return(true));

    EXPECT_CALL(*mock_writer_, is_connected())
        .WillRepeatedly(Return(true));

    for (int i = 0; i < 10; ++i) {
        pipeline_->ingest(make_test_event(42, i));
    }
    pipeline_->flush();
}

TEST_F(PipelineTest, RetriesOnWriteFailure) {
    // First call fails, second succeeds
    EXPECT_CALL(*mock_writer_, write_batch(_))
        .WillOnce(Return(false))
        .WillOnce(Return(true));

    EXPECT_CALL(*mock_writer_, is_connected())
        .WillRepeatedly(Return(true));

    pipeline_->ingest(make_test_event(42, 5));
    pipeline_->flush();

    EXPECT_EQ(pipeline_->retry_count(), 1);
}

TEST_F(PipelineTest, EnforcesOrganisationIsolation) {
    // Verify that events are batched per organisation
    EXPECT_CALL(*mock_writer_, write_batch(
        Each(Field(&SecurityEvent::organisation_id, 42))
    )).WillOnce(Return(true));

    EXPECT_CALL(*mock_writer_, write_batch(
        Each(Field(&SecurityEvent::organisation_id, 99))
    )).WillOnce(Return(true));

    pipeline_->ingest(make_test_event(42, 5));
    pipeline_->ingest(make_test_event(99, 3));
    pipeline_->flush_all();
}
```

## Code Coverage with gcov/lcov

### Minimum Coverage Threshold: 80%

```cmake
# Enable coverage in debug builds
option(ENABLE_COVERAGE "Enable code coverage" OFF)

if(ENABLE_COVERAGE)
    target_compile_options(app_core PRIVATE --coverage -fprofile-arcs -ftest-coverage)
    target_link_options(app_core PRIVATE --coverage)
endif()
```

```bash
# Generate coverage report
./build_linux.bash ubuntu2204 shell

# Build with coverage
cmake .. -DCMAKE_BUILD_TYPE=Debug -DENABLE_COVERAGE=ON
make -j$(nproc)
ctest --output-on-failure

# Generate lcov report
lcov --capture --directory . --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/test/*' '*/external/*' --output-file coverage_filtered.info
genhtml coverage_filtered.info --output-directory coverage_report

# Check threshold
COVERAGE=$(lcov --summary coverage_filtered.info 2>&1 | grep 'lines' | grep -oP '\d+\.\d+')
if (( $(echo "$COVERAGE < 80.0" | bc -l) )); then
    echo "FAIL: Coverage ${COVERAGE}% is below 80% threshold"
    exit 1
fi
```

### CI Coverage Integration

```yaml
# Azure Pipelines step
- script: |
    cmake --build . --target coverage_report
    lcov_result=$(lcov --summary coverage_filtered.info 2>&1 | grep 'lines')
    echo "Coverage: $lcov_result"
  displayName: 'Generate Coverage Report'
  condition: eq(variables['Build.Reason'], 'PullRequest')
```

## Performance Benchmarks (Google Benchmark)

```cpp
// benchmark/event_processing_benchmark.cpp
#include <benchmark/benchmark.h>
#include "event_processor.h"

static void BM_EventDeserialization(benchmark::State& state) {
    // Setup: create a serialized protobuf event
    SecurityEvent event;
    event.set_organisation_id(42);
    event.set_severity(5);
    event.set_event_type("network_connection");
    event.set_timestamp(time(nullptr));
    event.set_description("Test event for benchmarking");

    std::string serialized;
    event.SerializeToString(&serialized);

    for (auto _ : state) {
        SecurityEvent deserialized;
        deserialized.ParseFromString(serialized);
        benchmark::DoNotOptimize(deserialized);
    }

    state.SetBytesProcessed(state.iterations() * serialized.size());
}
BENCHMARK(BM_EventDeserialization);

static void BM_BatchProcessing(benchmark::State& state) {
    const int batch_size = state.range(0);
    PipelineConfig config;
    config.max_batch_size = batch_size;
    EventProcessor processor(config);

    auto events = generate_test_events(batch_size, 42);

    for (auto _ : state) {
        for (const auto& event : events) {
            processor.add_event(event);
        }
        processor.flush_batch();
    }

    state.SetItemsProcessed(state.iterations() * batch_size);
}
BENCHMARK(BM_BatchProcessing)
    ->Arg(100)
    ->Arg(1000)
    ->Arg(10000)
    ->Arg(100000);

static void BM_PacketParsing(benchmark::State& state) {
    auto raw_packet = generate_test_packet(state.range(0));

    for (auto _ : state) {
        PacketInfo info;
        auto result = parse_packet(raw_packet.data(), raw_packet.size(), info);
        benchmark::DoNotOptimize(result);
    }

    state.SetBytesProcessed(state.iterations() * raw_packet.size());
}
BENCHMARK(BM_PacketParsing)
    ->Arg(64)     // Minimum packet
    ->Arg(576)    // Common small packet
    ->Arg(1500)   // Typical MTU
    ->Arg(9000);  // Jumbo frame

BENCHMARK_MAIN();
```

```bash
# Run benchmarks
./build_linux.bash ubuntu2204 shell
cd build && ./bin/benchmarks --benchmark_out=benchmark_results.json --benchmark_out_format=json
```

## Valgrind for Memory Leak Detection

```bash
# Full memory leak check
./build_linux.bash ubuntu2204 shell
valgrind --leak-check=full \
         --show-leak-kinds=all \
         --track-origins=yes \
         --error-exitcode=1 \
         ./build/bin/unit_tests

# Memory profiling (heap usage over time)
valgrind --tool=massif \
         --pages-as-heap=yes \
         ./build/bin/database_loader --config test_config.yaml

# Cache/branch prediction analysis
valgrind --tool=cachegrind ./build/bin/benchmarks
```

### Suppressions File

```
# valgrind.supp -- suppress known false positives
{
   ProtobufGlobalState
   Memcheck:Leak
   match-leak-kinds: reachable
   ...
   fun:*google*protobuf*
}

{
   BoostStaticInit
   Memcheck:Leak
   match-leak-kinds: reachable
   ...
   fun:*boost*
}
```

## Test Naming Conventions

Follow the pattern: `TestSuite_ConditionOrAction_ExpectedResult`

```cpp
TEST(EventValidation, ValidEvent_ReturnsTrue)
TEST(EventValidation, MissingOrgId_ReturnsFalse)
TEST(EventValidation, FutureTimestamp_ReturnsFalse)
TEST(EventValidation, SeverityOutOfRange_ReturnsFalse)

TEST_F(PipelineTest, FullBatch_TriggersAutoFlush)
TEST_F(PipelineTest, WriterDisconnected_BuffersEvents)
TEST_F(PipelineTest, EmptyBatch_SkipsWrite)
```

## Agent Support

- **tdd-guide** -- Test-driven development workflow for C++ features
- **cpp-reviewer** -- Review test quality and coverage
- **build-error-resolver** -- Fix compilation errors in test code

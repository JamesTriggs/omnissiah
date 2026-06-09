# C++ Coding Style

> C++17 coding standards for native system components.

## Language Standard

All C++ code targets **C++17**. Use modern C++ idioms and avoid legacy patterns.

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Types (classes, structs, enums) | `PascalCase` | `SecurityEvent`, `PacketProcessor` |
| Functions and methods | `snake_case` | `process_events()`, `get_organisation_id()` |
| Variables (local, member) | `snake_case` | `event_count`, `buffer_size` |
| Member variables (private) | `snake_case_` with trailing underscore | `connection_pool_`, `max_retries_` |
| Constants | `kPascalCase` | `kMaxBufferSize`, `kDefaultTimeout` |
| Enum values | `kPascalCase` | `kSuccess`, `kConnectionError` |
| Macros (avoid when possible) | `ALL_CAPS` | `APP_VERSION`, `LOG_LEVEL` |
| Namespaces | `snake_case` | `app::database`, `app::net` |
| Template parameters | `PascalCase` | `typename EventType`, `typename Callback` |
| File names | `snake_case` | `packet_processor.h`, `event_handler.cpp` |

```cpp
namespace app::database {

constexpr size_t kMaxBatchSize = 10000;
constexpr std::chrono::seconds kFlushInterval{5};

class EventBatchProcessor {
public:
    explicit EventBatchProcessor(size_t batch_size = kMaxBatchSize);

    void add_event(SecurityEvent event);
    void flush_batch();
    [[nodiscard]] size_t pending_count() const;

private:
    size_t max_batch_size_;
    std::vector<SecurityEvent> pending_events_;
    std::chrono::steady_clock::time_point last_flush_;
};

}  // namespace app::database
```

## RAII and Smart Pointers

ALWAYS use RAII for resource management. Never use raw `new`/`delete`.

```cpp
// BAD: Raw pointer management
DbConnection* conn = new DbConnection(host, port);
conn->execute(query);
delete conn;  // Easy to leak on exception

// BAD: Raw pointer with manual cleanup
FILE* f = fopen("events.log", "r");
// ... if exception thrown here, file handle leaks
fclose(f);

// GOOD: unique_ptr for exclusive ownership
auto conn = std::make_unique<DbConnection>(host, port);
conn->execute(query);
// Automatically cleaned up when conn goes out of scope

// GOOD: shared_ptr when ownership is shared across threads
auto config = std::make_shared<PipelineConfig>();
thread_pool.submit([config] { process_with_config(config); });
thread_pool.submit([config] { monitor_with_config(config); });

// GOOD: RAII wrapper for non-owning resources
class FileHandle {
public:
    explicit FileHandle(const std::string& path, const char* mode)
        : handle_(fopen(path.c_str(), mode)) {
        if (!handle_) {
            throw std::runtime_error("Failed to open: " + path);
        }
    }

    ~FileHandle() {
        if (handle_) fclose(handle_);
    }

    // Non-copyable, movable
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;
    FileHandle(FileHandle&& other) noexcept : handle_(std::exchange(other.handle_, nullptr)) {}
    FileHandle& operator=(FileHandle&& other) noexcept {
        if (this != &other) {
            if (handle_) fclose(handle_);
            handle_ = std::exchange(other.handle_, nullptr);
        }
        return *this;
    }

    FILE* get() const { return handle_; }

private:
    FILE* handle_;
};
```

### When to Use Each Smart Pointer

| Smart Pointer | Use Case |
|--------------|----------|
| `std::unique_ptr` | Default choice. Single owner, no sharing. Use for pipeline stages, connections. |
| `std::shared_ptr` | Shared ownership across threads. Use for shared config, connection pools. |
| `std::weak_ptr` | Break circular references. Use for observer patterns, caches. |
| Raw pointer (non-owning) | Observing only, no ownership transfer. Function parameters, temporary references. |

## Modern C++ Idioms

### auto and Type Deduction

```cpp
// GOOD: Use auto to avoid redundant type repetition
auto events = load_events(org_id);                    // Return type is clear from function name
auto it = container.find(key);                        // Iterator type is verbose
auto [success, message] = validate_event(event);      // Structured bindings

// BAD: auto obscures the type when it's not obvious
auto x = process(data);    // What type is x? Unclear.

// GOOD: Be explicit when the type matters
std::chrono::seconds timeout{30};  // Duration type is important
int32_t organisation_id = 42;     // Exact integer width matters
```

### Range-Based For Loops

```cpp
// GOOD: Range-based for with const reference
for (const auto& event : events) {
    process_event(event);
}

// GOOD: Range-based for with structured bindings
for (const auto& [technique_id, event_list] : events_by_technique) {
    log_technique_summary(technique_id, event_list.size());
}

// BAD: Index-based loop when range-for suffices
for (size_t i = 0; i < events.size(); ++i) {
    process_event(events[i]);
}

// ACCEPTABLE: Index-based when you need the index
for (size_t i = 0; i < events.size(); ++i) {
    events[i].set_sequence_number(i);
}
```

### Structured Bindings

```cpp
// GOOD: Structured bindings for map iteration
std::unordered_map<std::string, int> technique_counts;
for (const auto& [technique, count] : technique_counts) {
    if (count > threshold) {
        raise_alert(technique, count);
    }
}

// GOOD: Structured bindings for tuple/pair returns
auto [inserted, position] = cache.emplace(key, value);
if (!inserted) {
    LOG(WARNING) << "Cache key already exists: " << key;
}

// GOOD: Structured bindings for custom types
struct ParseResult {
    bool success;
    std::string message;
    size_t bytes_consumed;
};

auto [success, message, consumed] = parse_packet(raw_data);
```

### std::optional

```cpp
// GOOD: Use optional for values that may not exist
std::optional<SecurityEvent> find_event_by_id(
    const std::string& event_id,
    int org_id
) {
    auto result = database.query(event_id, org_id);
    if (result.empty()) {
        return std::nullopt;
    }
    return SecurityEvent::from_row(result.front());
}

// GOOD: Consuming optional values
if (auto event = find_event_by_id(id, org_id)) {
    process_event(*event);
} else {
    LOG(INFO) << "Event not found: " << id;
}

// GOOD: value_or for defaults
auto timeout = config.get_optional<int>("timeout").value_or(30);
```

## Const Correctness

```cpp
class EventProcessor {
public:
    // Const methods for read-only operations
    [[nodiscard]] size_t event_count() const { return events_.size(); }
    [[nodiscard]] bool is_empty() const { return events_.empty(); }

    // Const reference parameters for input
    void add_event(const SecurityEvent& event);

    // Const reference return for internal data access
    [[nodiscard]] const std::vector<SecurityEvent>& events() const { return events_; }

    // Non-const for mutation
    void clear();

private:
    std::vector<SecurityEvent> events_;
};

// GOOD: Use const for variables that should not change
void process_batch(const std::vector<SecurityEvent>& events) {
    const size_t batch_size = events.size();
    const auto start_time = std::chrono::steady_clock::now();

    for (const auto& event : events) {
        // event is const -- cannot accidentally modify
        validate_and_forward(event);
    }
}
```

## Move Semantics

```cpp
class DataBatch {
public:
    // Accept by value and move (efficient for both lvalue and rvalue arguments)
    void set_events(std::vector<SecurityEvent> events) {
        events_ = std::move(events);
    }

    // Return by value (compiler applies NRVO or move)
    [[nodiscard]] std::vector<SecurityEvent> take_events() {
        return std::move(events_);
    }

private:
    std::vector<SecurityEvent> events_;
};

// GOOD: Move large objects instead of copying
std::vector<SecurityEvent> events = load_from_database(org_id);
batch.set_events(std::move(events));  // events is now empty

// GOOD: Emplace instead of push_back for in-place construction
std::vector<SecurityEvent> events;
events.emplace_back(org_id, timestamp, event_type, severity);
```

## Error Handling

### When to Use Exceptions vs Error Codes

| Situation | Approach | Rationale |
|-----------|----------|-----------|
| Initialization failure | Exception | Caller cannot proceed without valid state |
| Configuration error | Exception | Application should not start misconfigured |
| Network/database error | Exception | Rare in normal flow, needs stack unwinding |
| Expected empty result | Return `std::optional` | Normal operation, not an error |
| Parse failure on input | Return `std::expected` or error code | Common in hot path, performance-sensitive |
| Hot-path processing | Error codes / `std::optional` | No exception overhead in tight loops |

```cpp
// GOOD: Exception for initialization failure
class DbClient {
public:
    explicit DbClient(const ConnectionConfig& config) {
        connection_ = connect(config);
        if (!connection_) {
            throw std::runtime_error(
                "Failed to connect to the analytics database at " + config.host + ":" + std::to_string(config.port)
            );
        }
    }
};

// GOOD: Optional for expected "not found" cases
std::optional<SecurityEvent> EventStore::find_by_id(const std::string& id) const {
    auto row = query_by_id(id);
    if (!row) return std::nullopt;
    return SecurityEvent::from_row(*row);
}

// GOOD: Error codes in hot-path processing
enum class ParseResult { kSuccess, kInvalidFormat, kTruncated, kUnsupportedProtocol };

ParseResult parse_packet(const uint8_t* data, size_t length, PacketInfo& out) {
    if (length < kMinPacketSize) return ParseResult::kTruncated;
    // ... parse into out
    return ParseResult::kSuccess;
}
```

## File Organization

### Header Files

```cpp
// packet_processor.h
#pragma once  // Preferred over include guards

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

// Forward declarations to minimize includes
namespace app::proto {
class SecurityEvent;
}

namespace app::net {

class PacketProcessor {
public:
    explicit PacketProcessor(const Config& config);
    ~PacketProcessor();

    // Non-copyable, movable
    PacketProcessor(const PacketProcessor&) = delete;
    PacketProcessor& operator=(const PacketProcessor&) = delete;
    PacketProcessor(PacketProcessor&&) noexcept;
    PacketProcessor& operator=(PacketProcessor&&) noexcept;

    void process(const uint8_t* data, size_t length);
    [[nodiscard]] size_t packets_processed() const;

private:
    struct Impl;  // Pimpl idiom for compilation firewall
    std::unique_ptr<Impl> impl_;
};

}  // namespace app::net
```

### Source Files

```cpp
// packet_processor.cpp
#include "packet_processor.h"

#include <algorithm>
#include <chrono>

#include "security_event.pb.h"     // Project includes
#include "internal_helpers.h"

namespace app::net {

struct PacketProcessor::Impl {
    Config config;
    size_t packets_processed = 0;
    std::vector<app::proto::SecurityEvent> pending_events;
};

PacketProcessor::PacketProcessor(const Config& config)
    : impl_(std::make_unique<Impl>()) {
    impl_->config = config;
}

PacketProcessor::~PacketProcessor() = default;
PacketProcessor::PacketProcessor(PacketProcessor&&) noexcept = default;
PacketProcessor& PacketProcessor::operator=(PacketProcessor&&) noexcept = default;

// ... implementation

}  // namespace app::net
```

### Include Order

Order includes from most specific to most general, with blank lines between groups:

```cpp
// 1. Corresponding header (for .cpp files)
#include "my_class.h"

// 2. C system headers
#include <cstdint>
#include <cstring>

// 3. C++ standard library headers
#include <algorithm>
#include <memory>
#include <string>
#include <vector>

// 4. Third-party library headers
#include <boost/asio.hpp>
#include <google/protobuf/message.h>

// 5. Project headers
#include "app/config.h"
#include "app/event_store.h"
```

## CMake Modern Practices

### Target-Based Properties

```cmake
# GOOD: Modern target-based CMake
add_library(app_core
    src/event_processor.cpp
    src/packet_handler.cpp
    src/connection_pool.cpp
)

target_compile_features(app_core PUBLIC cxx_std_17)

target_include_directories(app_core
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(app_core
    PUBLIC
        Boost::system
        protobuf::libprotobuf
    PRIVATE
        Boost::filesystem
)

target_compile_options(app_core
    PRIVATE
        -Wall -Wextra -Wpedantic -Werror
        -fstack-protector-strong
        -D_FORTIFY_SOURCE=2
)

# BAD: Legacy global-scope CMake
include_directories(${Boost_INCLUDE_DIRS})      # Pollutes all targets
add_definitions(-DSOME_FLAG)                     # Pollutes all targets
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall") # Pollutes all targets
```

### Generator Expressions

```cmake
# Conditional settings based on build type
target_compile_options(app_core PRIVATE
    $<$<CONFIG:Debug>:-O0 -g -fsanitize=address>
    $<$<CONFIG:Release>:-O2 -DNDEBUG>
)

target_link_options(app_core PRIVATE
    $<$<CONFIG:Debug>:-fsanitize=address>
)
```

## [[nodiscard]] Attribute

Use `[[nodiscard]]` on functions where ignoring the return value is likely a bug:

```cpp
[[nodiscard]] bool connect(const std::string& host, int port);
[[nodiscard]] std::optional<SecurityEvent> find_event(const std::string& id);
[[nodiscard]] size_t process_batch(const std::vector<RawData>& batch);
```

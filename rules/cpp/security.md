# C++ Security

> Security rules for C++ components that process untrusted network data.

## Buffer Overflow Prevention

### Bounds Checking

```cpp
// BAD: Unchecked array access
void process_packet(const std::vector<uint8_t>& data, size_t offset) {
    uint8_t type = data[offset];        // No bounds check -- undefined behavior if out of range
    uint16_t len = data[offset + 1];    // Could be past end
}

// GOOD: Bounds-checked access with .at()
void process_packet(const std::vector<uint8_t>& data, size_t offset) {
    if (offset + 2 > data.size()) {
        throw std::out_of_range("Packet too short for header");
    }
    uint8_t type = data.at(offset);
    uint16_t len = data.at(offset + 1);
}

// GOOD: Use std::span (C++20) or equivalent for safe buffer views
void process_buffer(const uint8_t* data, size_t length) {
    if (length < kMinHeaderSize) {
        LOG(WARNING) << "Buffer too small: " << length << " < " << kMinHeaderSize;
        return;
    }
    // Process with validated length
}
```

### Safe String Operations

```cpp
// BAD: C-style string operations
char buffer[256];
strcpy(buffer, user_input);       // Buffer overflow if input > 255 chars
sprintf(buffer, "org=%d", org_id); // No bounds checking

// GOOD: Use std::string
std::string buffer = user_input;  // Automatically manages memory

// GOOD: If C buffers are needed, use safe alternatives
char buffer[256];
snprintf(buffer, sizeof(buffer), "org=%d", org_id);  // Bounds-checked

// GOOD: Use std::string_view for non-owning references
void log_event(std::string_view event_description) {
    // No allocation, no ownership, safe
    logger->info("Event: {}", event_description);
}
```

### Container Safety

```cpp
// GOOD: Reserve capacity to avoid reallocation in hot paths
std::vector<SecurityEvent> events;
events.reserve(expected_count);  // Single allocation

// GOOD: Validate sizes before allocating
constexpr size_t kMaxEventBatch = 100000;

void load_events(size_t count) {
    if (count > kMaxEventBatch) {
        throw std::invalid_argument("Batch size exceeds limit: " + std::to_string(count));
    }
    std::vector<SecurityEvent> events;
    events.reserve(count);
    // ...
}
```

## Memory Safety

### AddressSanitizer (ASAN)

ASAN MUST be enabled in CI debug builds. It detects:
- Use-after-free
- Heap buffer overflow
- Stack buffer overflow
- Memory leaks

```cmake
# CMakeLists.txt -- ASAN for debug builds
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_options(app_core PRIVATE -fsanitize=address -fno-omit-frame-pointer)
    target_link_options(app_core PRIVATE -fsanitize=address)
endif()
```

```bash
# Run with ASAN
./build_linux.bash ubuntu2204 build debug
# Tests automatically run with ASAN in debug mode
./build_linux.bash ubuntu2204 test
```

### MemorySanitizer (MSAN)

MSAN detects reads of uninitialized memory:

```cmake
# Separate MSAN build target
option(ENABLE_MSAN "Enable MemorySanitizer" OFF)
if(ENABLE_MSAN)
    target_compile_options(app_core PRIVATE -fsanitize=memory -fno-omit-frame-pointer)
    target_link_options(app_core PRIVATE -fsanitize=memory)
endif()
```

### Valgrind

Use valgrind for memory leak detection when sanitizers are not available:

```bash
# Run with valgrind in Docker container
./build_linux.bash ubuntu2204 shell
valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes \
    ./build/bin/database_loader_test
```

### Smart Pointer Rules

```cpp
// RULE 1: Never use raw new/delete
// BAD
auto* conn = new DbConnection(host, port);
delete conn;

// GOOD
auto conn = std::make_unique<DbConnection>(host, port);

// RULE 2: Use unique_ptr by default, shared_ptr only when necessary
// GOOD: Unique ownership
class Pipeline {
    std::unique_ptr<Stage> first_stage_;
    std::unique_ptr<Stage> second_stage_;
};

// GOOD: Shared ownership across threads
class ConnectionPool {
    std::vector<std::shared_ptr<Connection>> connections_;
};

// RULE 3: Pass unique_ptr by value to transfer ownership
void Pipeline::add_stage(std::unique_ptr<Stage> stage) {
    stages_.push_back(std::move(stage));
}

// RULE 4: Use raw pointer or reference for non-owning access
void process(const Connection& conn);  // Non-owning reference
void process(Connection* conn);        // Non-owning pointer (nullable)
```

## Integer Overflow Protection

```cpp
// BAD: Unchecked arithmetic on sizes from external input
size_t total_size = header.count * header.element_size;  // Can overflow

// GOOD: Check for overflow before multiplication
bool safe_multiply(size_t a, size_t b, size_t& result) {
    if (a != 0 && b > std::numeric_limits<size_t>::max() / a) {
        return false;  // Would overflow
    }
    result = a * b;
    return true;
}

size_t total_size;
if (!safe_multiply(header.count, header.element_size, total_size)) {
    LOG(ERROR) << "Integer overflow in size calculation";
    return;
}

// GOOD: Use compiler flag for debug builds
// -ftrapv causes signed integer overflow to trap (abort)
// Add to debug build flags in CMake

// GOOD: Validate ranges from external input
void process_event_count(int32_t count_from_protobuf) {
    if (count_from_protobuf < 0 || count_from_protobuf > kMaxEventCount) {
        throw std::out_of_range("Invalid event count: " + std::to_string(count_from_protobuf));
    }
    auto safe_count = static_cast<size_t>(count_from_protobuf);
    // ...
}
```

### Narrowing Conversion Safety

```cpp
// BAD: Silent narrowing
uint32_t large_value = get_value();
uint16_t small_value = large_value;  // Silently truncated

// GOOD: Explicit checked conversion
template<typename To, typename From>
To checked_cast(From value) {
    auto result = static_cast<To>(value);
    if (static_cast<From>(result) != value) {
        throw std::overflow_error("Narrowing conversion overflow");
    }
    return result;
}

uint16_t small_value = checked_cast<uint16_t>(large_value);
```

## Format String Security

```cpp
// BAD: User input in format string
void log_event(const std::string& user_message) {
    printf(user_message.c_str());       // Format string attack
    LOG(INFO) << user_message;          // Safe with stream operators
}

// BAD: User input as format argument position
char buffer[256];
snprintf(buffer, sizeof(buffer), user_format.c_str(), args...);

// GOOD: Always use constant format strings
void log_event(const std::string& user_message) {
    printf("%s\n", user_message.c_str());  // User input as data, not format
    LOG(INFO) << "Event: " << user_message;
}

// GOOD: Use fmt/spdlog with compile-time format checking
#include <fmt/format.h>
auto msg = fmt::format("Event from org {}: {}", org_id, description);
```

## Secure Compilation Flags

### Required Flags for All Builds

```cmake
# Security hardening flags -- REQUIRED for all C++ targets
function(app_security_flags target)
    target_compile_options(${target} PRIVATE
        # Stack protection
        -fstack-protector-strong

        # Fortify source (buffer overflow detection)
        -D_FORTIFY_SOURCE=2

        # Position independent code (required for ASLR)
        -fPIC

        # Format string warnings as errors
        -Wformat
        -Wformat-security
        -Werror=format-security

        # Additional warnings
        -Wall
        -Wextra
        -Wpedantic
        -Wshadow
        -Wconversion
        -Wsign-conversion

        # Treat warnings as errors in CI
        $<$<BOOL:${CI}>:-Werror>
    )

    target_link_options(${target} PRIVATE
        # Full RELRO (Read-Only Relocations)
        -Wl,-z,relro,-z,now

        # Non-executable stack
        -Wl,-z,noexecstack
    )
endfunction()

# Usage:
add_library(app_core ...)
app_security_flags(app_core)
```

### Debug-Specific Sanitizer Flags

```cmake
# Debug builds include sanitizers
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    function(app_debug_flags target)
        target_compile_options(${target} PRIVATE
            -fsanitize=address,undefined
            -fno-omit-frame-pointer
            -ftrapv  # Trap on signed integer overflow
        )
        target_link_options(${target} PRIVATE
            -fsanitize=address,undefined
        )
    endfunction()
endif()
```

## Dependency Management (CVE Scanning)

### Boost Security

```cmake
# Pin Boost version and verify
find_package(Boost 1.81 REQUIRED COMPONENTS system filesystem program_options)

# In CI: Check Boost version against known CVEs
# Automate with dependency scanning tools
```

### Protobuf Security

```cmake
# Pin Protobuf version
find_package(Protobuf 3.21 REQUIRED)

# Set maximum message size for deserialization
# (configured in code, not CMake)
```

```cpp
// GOOD: Limit protobuf message size
#include <google/protobuf/io/coded_stream.h>

constexpr int kMaxProtobufMessageSize = 64 * 1024 * 1024;  // 64 MB

bool parse_event(const std::string& raw_data, SecurityEvent& event) {
    if (raw_data.size() > static_cast<size_t>(kMaxProtobufMessageSize)) {
        LOG(WARNING) << "Protobuf message exceeds size limit: " << raw_data.size();
        return false;
    }

    google::protobuf::io::ArrayInputStream stream(raw_data.data(), raw_data.size());
    google::protobuf::io::CodedInputStream coded_stream(&stream);
    coded_stream.SetTotalBytesLimit(kMaxProtobufMessageSize);

    return event.ParseFromCodedStream(&coded_stream);
}
```

### Regular CVE Scanning

Run dependency CVE scans in CI:

```yaml
# Azure Pipelines step
- script: |
    # Scan C++ dependencies for known CVEs
    # Check Boost version against NVD database
    # Check Protobuf version against NVD database
    # Check other third-party libraries
    python3 scripts/check_dependency_cves.py
  displayName: 'CVE Scan'
```

## Input Validation for Network Data

These components process untrusted network data. Validate ALL external input.

```cpp
// GOOD: Validate Protocol Buffer fields after deserialization
bool validate_security_event(const SecurityEvent& event) {
    // Organisation ID must be set
    if (event.organisation_id() == 0) {
        LOG(WARNING) << "Missing organisation_id";
        return false;
    }

    // Timestamp must be reasonable (not in the future, not too old)
    auto now = std::chrono::system_clock::now();
    auto event_time = std::chrono::system_clock::from_time_t(event.timestamp());
    auto age = now - event_time;

    if (age < std::chrono::hours(-1)) {
        LOG(WARNING) << "Event timestamp in the future";
        return false;
    }
    if (age > std::chrono::hours(24 * 30)) {
        LOG(WARNING) << "Event timestamp too old (>30 days)";
        return false;
    }

    // Severity must be in valid range
    if (event.severity() < 0 || event.severity() > 10) {
        LOG(WARNING) << "Invalid severity: " << event.severity();
        return false;
    }

    // String fields must not exceed reasonable limits
    if (event.description().size() > 10000) {
        LOG(WARNING) << "Description too long: " << event.description().size();
        return false;
    }

    return true;
}
```

```cpp
// GOOD: Validate network packet structure before parsing
enum class ValidationResult { kOk, kTooSmall, kTooLarge, kInvalidHeader, kUnsupported };

ValidationResult validate_packet(const uint8_t* data, size_t length) {
    constexpr size_t kMinPacketSize = 14;     // Ethernet header minimum
    constexpr size_t kMaxPacketSize = 65535;  // Maximum practical packet size

    if (length < kMinPacketSize) return ValidationResult::kTooSmall;
    if (length > kMaxPacketSize) return ValidationResult::kTooLarge;

    // Validate Ethernet type field
    uint16_t ether_type = (static_cast<uint16_t>(data[12]) << 8) | data[13];
    if (ether_type != 0x0800 && ether_type != 0x86DD) {
        return ValidationResult::kUnsupported;  // Not IPv4 or IPv6
    }

    return ValidationResult::kOk;
}
```

## Thread Safety

### ThreadSanitizer (TSAN)

Enable TSAN in CI for concurrent code:

```cmake
option(ENABLE_TSAN "Enable ThreadSanitizer" OFF)
if(ENABLE_TSAN)
    target_compile_options(app_core PRIVATE
        -fsanitize=thread
        -fno-omit-frame-pointer
    )
    target_link_options(app_core PRIVATE -fsanitize=thread)
endif()
```

Note: TSAN and ASAN cannot be used simultaneously. Run them as separate CI jobs.

### Safe Concurrency Patterns

```cpp
// GOOD: Use std::mutex with lock_guard for simple synchronization
class ThreadSafeCounter {
public:
    void increment() {
        std::lock_guard lock(mutex_);
        count_++;
    }

    [[nodiscard]] size_t get() const {
        std::lock_guard lock(mutex_);
        return count_;
    }

private:
    mutable std::mutex mutex_;
    size_t count_ = 0;
};

// GOOD: Use std::shared_mutex for read-heavy workloads
class EventCache {
public:
    std::optional<SecurityEvent> get(const std::string& key) const {
        std::shared_lock lock(mutex_);  // Multiple readers allowed
        auto it = cache_.find(key);
        if (it != cache_.end()) return it->second;
        return std::nullopt;
    }

    void put(const std::string& key, SecurityEvent event) {
        std::unique_lock lock(mutex_);  // Exclusive access for writes
        cache_[key] = std::move(event);
    }

private:
    mutable std::shared_mutex mutex_;
    std::unordered_map<std::string, SecurityEvent> cache_;
};

// GOOD: Use std::atomic for simple counters
class PipelineMetrics {
    std::atomic<uint64_t> events_processed_{0};
    std::atomic<uint64_t> bytes_processed_{0};
    std::atomic<uint64_t> errors_{0};

public:
    void record_event(size_t bytes) {
        events_processed_.fetch_add(1, std::memory_order_relaxed);
        bytes_processed_.fetch_add(bytes, std::memory_order_relaxed);
    }
};
```

### Deadlock Prevention

```cpp
// RULE: Always acquire multiple locks in a consistent order
// GOOD: Use std::scoped_lock for multiple locks (C++17)
void transfer(Account& from, Account& to, int amount) {
    std::scoped_lock lock(from.mutex_, to.mutex_);  // Deadlock-free
    from.balance_ -= amount;
    to.balance_ += amount;
}

// BAD: Manual lock ordering -- prone to deadlock
void transfer(Account& from, Account& to, int amount) {
    from.mutex_.lock();
    to.mutex_.lock();    // DEADLOCK if another thread locks in reverse order
    // ...
    to.mutex_.unlock();
    from.mutex_.unlock();
}
```

## Security Review Checklist for C++ Code

Before committing C++ code, verify:

- [ ] No raw `new`/`delete` -- use smart pointers
- [ ] All buffer accesses are bounds-checked
- [ ] All external input (network, protobuf, files) is validated
- [ ] No user input in format strings
- [ ] Integer arithmetic is checked for overflow
- [ ] ASAN and TSAN pass in CI
- [ ] Security compilation flags are applied
- [ ] Protobuf messages have size limits
- [ ] Thread synchronization is correct (no data races)
- [ ] No hardcoded credentials or secrets

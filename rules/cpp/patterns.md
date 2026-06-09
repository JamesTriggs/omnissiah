# C++ Design Patterns

> Design patterns for native C++ components.

## RAII Wrapper for the analytics database Connections

```cpp
#pragma once

#include <memory>
#include <string>
#include <vector>
#include <stdexcept>
#include <chrono>

namespace app::database {

struct DbConfig {
    std::string host = "localhost";
    int port = 9000;
    std::string database = "app";
    std::string user = "default";
    std::string password;
    int connect_timeout_seconds = 10;
    int query_timeout_seconds = 60;
    size_t max_block_size = 65536;
};

// RAII wrapper for a single the analytics database connection
class DbConnection {
public:
    explicit DbConnection(const DbConfig& config)
        : config_(config) {
        connect();
    }

    ~DbConnection() {
        disconnect();
    }

    // Non-copyable (each connection is a unique resource)
    DbConnection(const DbConnection&) = delete;
    DbConnection& operator=(const DbConnection&) = delete;

    // Movable
    DbConnection(DbConnection&& other) noexcept
        : config_(std::move(other.config_))
        , handle_(std::exchange(other.handle_, nullptr))
        , connected_(std::exchange(other.connected_, false)) {}

    DbConnection& operator=(DbConnection&& other) noexcept {
        if (this != &other) {
            disconnect();
            config_ = std::move(other.config_);
            handle_ = std::exchange(other.handle_, nullptr);
            connected_ = std::exchange(other.connected_, false);
        }
        return *this;
    }

    // Execute a parameterized query
    void execute(const std::string& query) {
        ensure_connected();
        // Implementation calls underlying the analytics database client library
        execute_impl(query);
    }

    // Insert a batch of events
    void insert_batch(const std::string& table, const std::vector<std::vector<std::string>>& rows) {
        ensure_connected();
        insert_impl(table, rows);
    }

    [[nodiscard]] bool is_connected() const { return connected_; }

    void reconnect() {
        disconnect();
        connect();
    }

private:
    void connect() {
        // Connect to the analytics database using config
        handle_ = create_connection(config_);
        if (!handle_) {
            throw std::runtime_error(
                "Failed to connect to the analytics database at " + config_.host + ":" + std::to_string(config_.port)
            );
        }
        connected_ = true;
    }

    void disconnect() {
        if (handle_) {
            close_connection(handle_);
            handle_ = nullptr;
        }
        connected_ = false;
    }

    void ensure_connected() {
        if (!connected_) {
            throw std::runtime_error("the analytics database connection is not established");
        }
    }

    // Opaque implementation details
    void execute_impl(const std::string& query);
    void insert_impl(const std::string& table, const std::vector<std::vector<std::string>>& rows);
    void* create_connection(const DbConfig& config);
    void close_connection(void* handle);

    DbConfig config_;
    void* handle_ = nullptr;
    bool connected_ = false;
};


// Connection pool using RAII
class DbConnectionPool {
public:
    explicit DbConnectionPool(const DbConfig& config, size_t pool_size = 4)
        : config_(config) {
        for (size_t i = 0; i < pool_size; ++i) {
            pool_.push_back(std::make_unique<DbConnection>(config));
        }
    }

    // Acquire a connection from the pool (RAII-style return)
    class ConnectionGuard {
    public:
        ConnectionGuard(DbConnection* conn, DbConnectionPool* pool)
            : conn_(conn), pool_(pool) {}

        ~ConnectionGuard() {
            if (pool_ && conn_) {
                pool_->release(conn_);
            }
        }

        ConnectionGuard(const ConnectionGuard&) = delete;
        ConnectionGuard& operator=(const ConnectionGuard&) = delete;
        ConnectionGuard(ConnectionGuard&& other) noexcept
            : conn_(std::exchange(other.conn_, nullptr))
            , pool_(std::exchange(other.pool_, nullptr)) {}

        DbConnection* operator->() { return conn_; }
        DbConnection& operator*() { return *conn_; }

    private:
        DbConnection* conn_;
        DbConnectionPool* pool_;
    };

    ConnectionGuard acquire() {
        std::unique_lock lock(mutex_);
        cv_.wait(lock, [this] { return !available_.empty(); });

        auto* conn = available_.back();
        available_.pop_back();
        return ConnectionGuard(conn, this);
    }

private:
    void release(DbConnection* conn) {
        std::lock_guard lock(mutex_);
        if (conn && !conn->is_connected()) {
            try {
                conn->reconnect();
            } catch (const std::exception& e) {
                // Log reconnection failure
            }
        }
        available_.push_back(conn);
        cv_.notify_one();
    }

    DbConfig config_;
    std::vector<std::unique_ptr<DbConnection>> pool_;
    std::vector<DbConnection*> available_;
    std::mutex mutex_;
    std::condition_variable cv_;
};

}  // namespace app::database
```

Usage:

```cpp
// Connection pool is created once and shared
auto pool = std::make_shared<DbConnectionPool>(config, 4);

// Each thread acquires a connection (RAII automatically returns it)
void worker_thread(std::shared_ptr<DbConnectionPool> pool) {
    auto conn = pool->acquire();  // Blocks until a connection is available
    conn->execute("INSERT INTO events ...");
    // Connection automatically returned to pool when conn goes out of scope
}
```

## Protocol Buffer Message Factory Patterns

```cpp
#pragma once

#include <memory>
#include <functional>
#include <unordered_map>
#include <string>

#include "security_event.pb.h"
#include "network_event.pb.h"
#include "file_event.pb.h"
#include "process_event.pb.h"

namespace app::proto {

// Factory for creating and populating protobuf messages
class EventFactory {
public:
    // Create a base SecurityEvent with common fields
    static SecurityEvent create_base_event(
        uint32_t org_id,
        int32_t severity,
        const std::string& event_type
    ) {
        SecurityEvent event;
        event.set_organisation_id(org_id);
        event.set_severity(severity);
        event.set_event_type(event_type);
        event.set_timestamp(std::chrono::system_clock::to_time_t(
            std::chrono::system_clock::now()
        ));
        return event;
    }

    // Create a network event with source/dest information
    static SecurityEvent create_network_event(
        uint32_t org_id,
        int32_t severity,
        const std::string& source_ip,
        uint16_t source_port,
        const std::string& dest_ip,
        uint16_t dest_port,
        const std::string& protocol
    ) {
        auto event = create_base_event(org_id, severity, "network_connection");

        auto* network = event.mutable_network_details();
        network->set_source_ip(source_ip);
        network->set_source_port(source_port);
        network->set_dest_ip(dest_ip);
        network->set_dest_port(dest_port);
        network->set_protocol(protocol);

        return event;
    }

    // Create a process event
    static SecurityEvent create_process_event(
        uint32_t org_id,
        int32_t severity,
        const std::string& process_name,
        uint32_t pid,
        const std::string& command_line
    ) {
        auto event = create_base_event(org_id, severity, "process_execution");

        auto* process = event.mutable_process_details();
        process->set_process_name(process_name);
        process->set_pid(pid);
        process->set_command_line(command_line);

        return event;
    }

    // Validate a deserialized event
    struct ValidationResult {
        bool valid;
        std::string error_message;
    };

    static ValidationResult validate(const SecurityEvent& event) {
        if (event.organisation_id() == 0) {
            return {false, "Missing organisation_id"};
        }
        if (event.timestamp() == 0) {
            return {false, "Missing timestamp"};
        }
        if (event.severity() < 0 || event.severity() > 10) {
            return {false, "Severity out of range [0, 10]: " + std::to_string(event.severity())};
        }
        if (event.event_type().empty()) {
            return {false, "Missing event_type"};
        }
        if (event.event_type().size() > 256) {
            return {false, "event_type too long"};
        }
        return {true, ""};
    }
};


// Type-safe message dispatcher
class EventDispatcher {
public:
    using Handler = std::function<void(const SecurityEvent&)>;

    void register_handler(const std::string& event_type, Handler handler) {
        handlers_[event_type] = std::move(handler);
    }

    void dispatch(const SecurityEvent& event) const {
        auto it = handlers_.find(event.event_type());
        if (it != handlers_.end()) {
            it->second(event);
        } else {
            // Fallback handler for unknown event types
            if (default_handler_) {
                default_handler_(event);
            }
        }
    }

    void set_default_handler(Handler handler) {
        default_handler_ = std::move(handler);
    }

private:
    std::unordered_map<std::string, Handler> handlers_;
    Handler default_handler_;
};

}  // namespace app::proto
```

Usage:

```cpp
using namespace app::proto;

// Create events with factory methods
auto net_event = EventFactory::create_network_event(
    42, 7, "10.0.1.5", 54321, "203.0.113.50", 443, "TCP"
);

// Validate before processing
auto [valid, error] = EventFactory::validate(net_event);
if (!valid) {
    LOG(WARNING) << "Invalid event: " << error;
    return;
}

// Dispatch to type-specific handlers
EventDispatcher dispatcher;
dispatcher.register_handler("network_connection", [](const SecurityEvent& e) {
    analyze_network_event(e);
});
dispatcher.register_handler("process_execution", [](const SecurityEvent& e) {
    analyze_process_event(e);
});
dispatcher.set_default_handler([](const SecurityEvent& e) {
    LOG(INFO) << "Unhandled event type: " << e.event_type();
});

dispatcher.dispatch(net_event);
```

## Multi-Threaded Pipeline Pattern (Producer-Consumer)

The data-loader uses a multi-stage pipeline for data ingestion:

```cpp
#pragma once

#include <atomic>
#include <condition_variable>
#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include <thread>
#include <vector>

namespace app::pipeline {

// Thread-safe bounded queue for inter-stage communication
template<typename T>
class BoundedQueue {
public:
    explicit BoundedQueue(size_t max_size) : max_size_(max_size) {}

    // Push with blocking (waits if queue is full)
    void push(T item) {
        std::unique_lock lock(mutex_);
        not_full_.wait(lock, [this] { return queue_.size() < max_size_ || stopped_; });
        if (stopped_) return;
        queue_.push(std::move(item));
        not_empty_.notify_one();
    }

    // Pop with blocking (waits if queue is empty)
    // Returns false if the queue is stopped and empty (no more items)
    bool pop(T& item) {
        std::unique_lock lock(mutex_);
        not_empty_.wait(lock, [this] { return !queue_.empty() || stopped_; });
        if (queue_.empty() && stopped_) return false;
        item = std::move(queue_.front());
        queue_.pop();
        not_full_.notify_one();
        return true;
    }

    void stop() {
        std::lock_guard lock(mutex_);
        stopped_ = true;
        not_empty_.notify_all();
        not_full_.notify_all();
    }

    [[nodiscard]] size_t size() const {
        std::lock_guard lock(mutex_);
        return queue_.size();
    }

private:
    size_t max_size_;
    std::queue<T> queue_;
    mutable std::mutex mutex_;
    std::condition_variable not_empty_;
    std::condition_variable not_full_;
    bool stopped_ = false;
};


// Pipeline stage that processes items from an input queue and pushes to an output queue
template<typename Input, typename Output>
class PipelineStage {
public:
    using ProcessFunc = std::function<std::vector<Output>(const Input&)>;

    PipelineStage(
        const std::string& name,
        std::shared_ptr<BoundedQueue<Input>> input,
        std::shared_ptr<BoundedQueue<Output>> output,
        ProcessFunc process,
        size_t num_workers = 1
    )
        : name_(name)
        , input_(std::move(input))
        , output_(std::move(output))
        , process_(std::move(process)) {
        for (size_t i = 0; i < num_workers; ++i) {
            workers_.emplace_back(&PipelineStage::worker_loop, this, i);
        }
    }

    ~PipelineStage() {
        stop();
    }

    void stop() {
        if (stopped_.exchange(true)) return;
        input_->stop();
        for (auto& worker : workers_) {
            if (worker.joinable()) worker.join();
        }
    }

    [[nodiscard]] uint64_t items_processed() const {
        return items_processed_.load(std::memory_order_relaxed);
    }

    [[nodiscard]] uint64_t errors() const {
        return errors_.load(std::memory_order_relaxed);
    }

private:
    void worker_loop(size_t worker_id) {
        Input item;
        while (input_->pop(item)) {
            try {
                auto outputs = process_(item);
                for (auto& out : outputs) {
                    output_->push(std::move(out));
                }
                items_processed_.fetch_add(1, std::memory_order_relaxed);
            } catch (const std::exception& e) {
                errors_.fetch_add(1, std::memory_order_relaxed);
                LOG(ERROR) << "Stage '" << name_ << "' worker " << worker_id
                           << " error: " << e.what();
            }
        }
        // When input queue is exhausted, signal output queue to stop
        // (only the last worker should do this)
    }

    std::string name_;
    std::shared_ptr<BoundedQueue<Input>> input_;
    std::shared_ptr<BoundedQueue<Output>> output_;
    ProcessFunc process_;
    std::vector<std::thread> workers_;
    std::atomic<bool> stopped_{false};
    std::atomic<uint64_t> items_processed_{0};
    std::atomic<uint64_t> errors_{0};
};


// Example: Complete data-loader pipeline
class DataIngestionPipeline {
public:
    struct Config {
        size_t queue_size = 10000;
        size_t parse_workers = 4;
        size_t validate_workers = 2;
        size_t write_workers = 2;
    };

    explicit DataIngestionPipeline(const Config& config)
        : raw_queue_(std::make_shared<BoundedQueue<RawData>>(config.queue_size))
        , parsed_queue_(std::make_shared<BoundedQueue<SecurityEvent>>(config.queue_size))
        , validated_queue_(std::make_shared<BoundedQueue<SecurityEvent>>(config.queue_size))
    {
        // Stage 1: Parse raw data into protobuf events
        parse_stage_ = std::make_unique<PipelineStage<RawData, SecurityEvent>>(
            "parse", raw_queue_, parsed_queue_,
            [](const RawData& raw) -> std::vector<SecurityEvent> {
                SecurityEvent event;
                if (event.ParseFromString(raw.data)) {
                    return {std::move(event)};
                }
                return {};  // Skip unparseable data
            },
            config.parse_workers
        );

        // Stage 2: Validate events
        validate_stage_ = std::make_unique<PipelineStage<SecurityEvent, SecurityEvent>>(
            "validate", parsed_queue_, validated_queue_,
            [](const SecurityEvent& event) -> std::vector<SecurityEvent> {
                auto [valid, error] = EventFactory::validate(event);
                if (valid) {
                    return {event};
                }
                LOG(WARNING) << "Dropped invalid event: " << error;
                return {};
            },
            config.validate_workers
        );

        // Stage 3 would be: Write to the analytics database (using connection pool)
    }

    // Feed raw data into the pipeline
    void ingest(RawData data) {
        raw_queue_->push(std::move(data));
    }

    void shutdown() {
        raw_queue_->stop();
        parse_stage_->stop();
        validate_stage_->stop();
    }

private:
    std::shared_ptr<BoundedQueue<RawData>> raw_queue_;
    std::shared_ptr<BoundedQueue<SecurityEvent>> parsed_queue_;
    std::shared_ptr<BoundedQueue<SecurityEvent>> validated_queue_;

    std::unique_ptr<PipelineStage<RawData, SecurityEvent>> parse_stage_;
    std::unique_ptr<PipelineStage<SecurityEvent, SecurityEvent>> validate_stage_;
};

}  // namespace app::pipeline
```

## CMake Dependency Management

### find_package for System Dependencies

```cmake
cmake_minimum_required(VERSION 3.22)
project(app_data_loader VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# System dependencies via find_package
find_package(Boost 1.81 REQUIRED COMPONENTS
    system
    filesystem
    program_options
)

find_package(Protobuf 3.21 REQUIRED)
find_package(Threads REQUIRED)

# Create the main library target
add_library(app_core
    src/event_processor.cpp
    src/packet_handler.cpp
    src/db_writer.cpp
    src/pipeline.cpp
)

target_link_libraries(app_core
    PUBLIC
        Boost::system
        Boost::filesystem
        protobuf::libprotobuf
        Threads::Threads
    PRIVATE
        Boost::program_options
)

target_include_directories(app_core
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
)
```

### FetchContent for Header-Only or Small Dependencies

```cmake
include(FetchContent)

# Google Test (for testing only)
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.14.0
)

# Google Benchmark (for performance testing)
FetchContent_Declare(
    benchmark
    GIT_REPOSITORY https://github.com/google/benchmark.git
    GIT_TAG v1.8.3
)

# spdlog for logging
FetchContent_Declare(
    spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG v1.12.0
)

# Only fetch test dependencies when building tests
if(BUILD_TESTING)
    set(BENCHMARK_ENABLE_TESTING OFF CACHE BOOL "" FORCE)
    FetchContent_MakeAvailable(googletest benchmark)
endif()

FetchContent_MakeAvailable(spdlog)

target_link_libraries(app_core PRIVATE spdlog::spdlog)
```

### Git Submodules for Dependencies

```cmake
# app-data-model is a git submodule
add_subdirectory(external/app-data-model)

target_link_libraries(app_core
    PUBLIC
        app_data_model  # Protobuf-generated library from submodule
)
```

## Boost Usage Patterns

### Boost.Filesystem

```cpp
#include <boost/filesystem.hpp>

namespace fs = boost::filesystem;

// Safe file operations with proper error handling
std::optional<std::string> read_config_file(const fs::path& config_path) {
    if (!fs::exists(config_path)) {
        LOG(WARNING) << "Config file not found: " << config_path;
        return std::nullopt;
    }

    if (!fs::is_regular_file(config_path)) {
        LOG(WARNING) << "Config path is not a regular file: " << config_path;
        return std::nullopt;
    }

    auto file_size = fs::file_size(config_path);
    constexpr size_t kMaxConfigSize = 10 * 1024 * 1024;  // 10 MB
    if (file_size > kMaxConfigSize) {
        LOG(WARNING) << "Config file too large: " << file_size;
        return std::nullopt;
    }

    std::ifstream stream(config_path.string());
    return std::string(std::istreambuf_iterator<char>(stream), {});
}
```

### Boost.Asio (Async I/O)

```cpp
#include <boost/asio.hpp>
#include <boost/asio/steady_timer.hpp>

namespace asio = boost::asio;

class EventListener {
public:
    explicit EventListener(asio::io_context& io, uint16_t port)
        : acceptor_(io, asio::ip::tcp::endpoint(asio::ip::tcp::v4(), port))
        , timer_(io) {
        start_accept();
        start_health_check();
    }

private:
    void start_accept() {
        auto socket = std::make_shared<asio::ip::tcp::socket>(acceptor_.get_executor());
        acceptor_.async_accept(*socket, [this, socket](const boost::system::error_code& ec) {
            if (!ec) {
                handle_connection(std::move(*socket));
            }
            start_accept();  // Accept next connection
        });
    }

    void handle_connection(asio::ip::tcp::socket socket) {
        // Process incoming security event data
        auto buffer = std::make_shared<std::vector<uint8_t>>(65536);
        socket.async_read_some(
            asio::buffer(*buffer),
            [this, socket = std::move(socket), buffer](
                const boost::system::error_code& ec, size_t bytes_read) mutable {
                if (!ec) {
                    process_data(buffer->data(), bytes_read);
                }
            }
        );
    }

    void start_health_check() {
        timer_.expires_after(std::chrono::seconds(30));
        timer_.async_wait([this](const boost::system::error_code& ec) {
            if (!ec) {
                log_health_status();
                start_health_check();
            }
        });
    }

    void process_data(const uint8_t* data, size_t length);
    void log_health_status();

    asio::ip::tcp::acceptor acceptor_;
    asio::steady_timer timer_;
};
```

### Boost.ProgramOptions

```cpp
#include <boost/program_options.hpp>

namespace po = boost::program_options;

struct AppConfig {
    std::string db_host;
    int db_port;
    std::string log_level;
    int worker_threads;
    size_t batch_size;
};

AppConfig parse_command_line(int argc, char* argv[]) {
    po::options_description desc("Data Loader");
    desc.add_options()
        ("help,h", "Show help message")
        ("db-host", po::value<std::string>()->default_value("localhost"), "the analytics database host")
        ("db-port", po::value<int>()->default_value(9000), "the analytics database port")
        ("log-level", po::value<std::string>()->default_value("info"), "Log level (debug, info, warning, error)")
        ("workers", po::value<int>()->default_value(4), "Number of worker threads")
        ("batch-size", po::value<size_t>()->default_value(10000), "Batch size for the analytics database inserts")
    ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);

    if (vm.count("help")) {
        std::cout << desc << std::endl;
        std::exit(0);
    }

    return AppConfig{
        .db_host = vm["db-host"].as<std::string>(),
        .db_port = vm["db-port"].as<int>(),
        .log_level = vm["log-level"].as<std::string>(),
        .worker_threads = vm["workers"].as<int>(),
        .batch_size = vm["batch-size"].as<size_t>(),
    };
}
```

## Data Processing Pipeline Architecture (data-loader Pattern)

High-level architecture of the data-loader:

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────────┐
│   Network    │───>│    Parse     │───>│   Validate   │───>│   the analytics database   │
│   Listener   │    │   Stage      │    │   Stage      │    │   Writer       │
│  (Boost.Asio)│    │  (Protobuf)  │    │  (Business)  │    │  (Batched)     │
└─────────────┘    └──────────────┘    └──────────────┘    └────────────────┘
       │                  │                   │                     │
       │           BoundedQueue        BoundedQueue          Connection
       │           (10k items)         (10k items)              Pool
       │                                                         │
       └── Metrics ─── Prometheus/StatsD ─── Health Check ───────┘
```

```cpp
// main.cpp -- application entry point
#include "pipeline.h"
#include "listener.h"
#include "config.h"

int main(int argc, char* argv[]) {
    auto config = parse_command_line(argc, argv);
    setup_logging(config.log_level);

    LOG(INFO) << "Starting Data Loader v" << APP_VERSION;

    // Create the analytics database connection pool
    auto ch_pool = std::make_shared<DbConnectionPool>(
        DbConfig{
            .host = config.db_host,
            .port = config.db_port,
        },
        config.worker_threads
    );

    // Create the processing pipeline
    DataIngestionPipeline pipeline(DataIngestionPipeline::Config{
        .queue_size = config.batch_size * 2,
        .parse_workers = config.worker_threads,
        .validate_workers = config.worker_threads / 2,
        .write_workers = config.worker_threads / 2,
    });

    // Start the network listener (feeds into pipeline)
    asio::io_context io;
    EventListener listener(io, config.listen_port);

    // Signal handling for graceful shutdown
    asio::signal_set signals(io, SIGINT, SIGTERM);
    signals.async_wait([&](const boost::system::error_code&, int signal) {
        LOG(INFO) << "Received signal " << signal << ", shutting down...";
        pipeline.shutdown();
        io.stop();
    });

    LOG(INFO) << "Listening on port " << config.listen_port;
    io.run();

    LOG(INFO) << "Shutdown complete";
    return 0;
}
```

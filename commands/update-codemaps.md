---
description: Analyze codebase structure and update architecture documentation. Generates codemaps for navigation and onboarding.
---

# Update Codemaps

Analyze the codebase structure across all languages and update architecture documentation.

## Workflow

### 1. Scan Source Files for Imports, Exports, and Dependencies

Perform multi-language analysis across the platform:

**Python Projects**
```bash
# Extract module dependency graph using AST analysis
uv run python -c "
import ast, pathlib, json

def analyze_python_imports(project_path):
    deps = {}
    for f in pathlib.Path(project_path).rglob('*.py'):
        module = str(f.relative_to(project_path)).replace('/', '.').replace('.py', '')
        imports = []
        try:
            tree = ast.parse(f.read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom) and node.module:
                    imports.append(node.module)
        except SyntaxError:
            pass
        deps[module] = imports
    return deps

# Run for each project
print(json.dumps(analyze_python_imports('src/'), indent=2))
"

# Extract Flask-RESTX namespace structure
# Extract FastAPI router structure
# Extract Pydantic model definitions
# Extract SQLAlchemy model relationships
# Extract Celery task registrations
```

**C++ Projects**
```bash
# Extract include dependency graph
# For each .cpp and .h file, parse #include directives

# Generate include graph
# Format: source_file -> [included_headers]

# Extract class hierarchy
# Parse class declarations and inheritance

# Extract namespace structure
# Map namespace -> classes/functions

# CMake target dependency graph
# Parse CMakeLists.txt for add_library, add_executable, target_link_libraries
```

**Vue/TypeScript Projects**
```bash
# Extract Vue component tree
# Parse .vue files for component imports and usage in templates

# Extract Pinia store dependencies
# Map which stores import from which other stores

# Extract composable dependency graph
# Map composable -> composable imports

# Extract route structure
# Parse pages/ directory (Nuxt file-based routing) and router config

# Extract API client calls
# Map components/composables -> API endpoints used
```

**Protocol Buffer Projects**
```bash
# Extract proto dependency graph
# Parse import statements in .proto files

# Extract message type hierarchy
# Map package -> messages -> fields

# Cross-reference proto usage across projects
# Map proto message -> consuming projects (Python, C++, etc.)
```

### 2. Generate Token-Lean Codemaps

Create codemaps in a compact format that maximizes information density while minimizing token usage:

**codemaps/architecture.md** - Overall architecture
```markdown
# Platform Architecture
Updated: [timestamp]

## Service Map
```
[Browser] -> [ui (Nuxt 3)] -> [api-service (Flask)]
                            -> [public-api (FastAPI)]

[api-service] -> [relational DB (app data)]
              -> [analytical DB (analytics)]
              -> [Redis (cache/sessions)]
              -> [task workers (background tasks)]

[data-loader (C++)] -> [analytical DB (bulk insert)]
                     -> [shared-schemas (protobuf)]

[parser-lib (C++)] -> [data-loader]
                    -> [shared-schemas (protobuf)]

[query-parser] -> [api-service (query middleware)]
```

## Inter-Service Dependencies
- api-service <-> public-api: REST API calls
- api-service <-> data-loader: Shared analytical tables
- all services <-> shared-schemas: Protocol Buffer schemas
- ui <-> api-service: REST + WebSocket
```

**codemaps/python-apis.md** - Python API service structure
```markdown
# Python API Services
Updated: [timestamp]

## api-service (Flask)
src/
  apis/           # REST endpoints (Flask-RESTX namespaces)
    query.py      # Query API [ns=/api/v1/query]
    records.py    # Record management [ns=/api/v1/records]
    rules.py      # Rules [ns=/api/v1/rules]
    dashboard.py  # Dashboard data [ns=/api/v1/dashboard]
    users.py      # User management [ns=/api/v1/users]
  app/            # Business logic
    query/        # Query building, execution, validation
    records/      # Record lifecycle management
    processing/   # Processing engine, rule evaluation
    auth/         # JWT auth, RBAC
    audit/        # Audit trail logging
  db/             # Data access layer
    models/       # SQLAlchemy models (relational)
    analytics/    # Analytical DB client & queries
    redis/        # Cache operations
  tasks/          # Background tasks

## public-api (FastAPI)
public_api/
  routers/        # FastAPI routers
  schemas/        # Pydantic request/response models
  services/       # Business logic
  deps/           # Dependency injection
```

**codemaps/cpp-components.md** - C++ component structure
```markdown
# C++ Components
Updated: [timestamp]

## data-loader
src/
  ingestion/      # Data ingestion pipeline
    parser.cpp    # Message parsing (protobuf -> internal)
    inserter.cpp  # Batch insert
    pipeline.cpp  # Multi-threaded processing
  config/         # Configuration management
  monitoring/     # Health checks, metrics
external/
  shared-schemas/  # Protobuf submodule

## parser-lib
src/
  parser/         # Message parsing
  analyzer/       # Traffic analysis
  classifier/     # Message classification
include/
  mylib/          # Public API headers

## Dependency Graph (CMake targets)
data_loader -> parser_lib, app_proto, db_client_cpp, boost
parser_lib -> app_proto, boost
```

**codemaps/frontend.md** - Frontend structure
```markdown
# Frontend (ui)
Updated: [timestamp]

## Page Structure (Nuxt file-based routing)
pages/
  dashboard/
    summary.vue     # Summary dashboard
    index.vue       # Main dashboard
  query/
    index.vue       # Query interface
  items/
    index.vue       # Item list
    [id].vue        # Item detail
  rules/
    rules.vue       # Rule management
  records/
    index.vue       # Record list
    [id].vue        # Record detail
  settings/
    index.vue       # System settings

## Component Tree
components/
  common/           # Shared UI components
  dashboard/        # Dashboard widgets
  query/            # Query editor, results table
  rules/            # Rule builder, category selector
  items/            # Timeline, detail panel
  records/          # Record workflow components

## State Management (Pinia stores)
stores/
  auth.ts           # Authentication state
  dashboard.ts      # Dashboard data & filters
  query.ts          # Query state
  rules.ts          # Rules state
  records.ts        # Record management state
  notifications.ts  # Real-time notifications
```

**codemaps/data.md** - Data model and schema documentation
```markdown
# Data Models & Schemas
Updated: [timestamp]

## Protocol Buffers (shared-schemas)
proto/myapp/
  network_event.proto    # Network event schema
  process_event.proto    # Process execution events
  file_event.proto       # File system events
  auth_event.proto       # Authentication events
  rule.proto             # Rule definitions
  metadata.proto         # Common metadata fields

## Analytical Tables
- network_events        # Network traffic data
- process_events        # Process execution logs
- file_events           # File system activity
- auth_events           # Authentication logs
- results               # Processed results
- saved_queries         # Saved queries

## Relational Tables (application data)
- users                 # User accounts
- items                 # Work items
- rules                 # Rule definitions
- saved_queries         # Saved queries
- audit_log             # Audit trail
- sessions              # User sessions

## Redis Keys
- session:{id}          # User session data
- cache:dashboard:{id}  # Dashboard widget cache
- task:*                # Task queue data
```

### 3. Calculate Diff Percentage

Compare new codemaps against previous versions:

```bash
# For each codemap file
# Calculate line diff percentage
# If changes > 30%, flag for user review
```

### 4. Request Approval for Large Changes

If diff exceeds 30%:
```
CODEMAP UPDATE: architecture.md
Changes detected: 42% of content modified

Key changes:
- New service: query-parser added to service map
- New database: Redis added as session store
- Modified: api-service has 3 new API namespaces

Approve update? (yes/no/review)
```

### 5. Add Freshness Timestamp

Every codemap gets a freshness header:
```markdown
<!-- codemap:updated:2024-01-15T14:30:00Z -->
<!-- codemap:project:my-api -->
<!-- codemap:hash:abc123 -->
```

### 6. Save Reports

Save diff analysis to `.reports/codemap-diff.txt`:
```
Codemap Update Report
Generated: [timestamp]

architecture.md:  Updated (15% changed)
python-apis.md:   Updated (8% changed)
cpp-components.md: No changes
frontend.md:      Updated (22% changed)
data.md:          Updated (5% changed)

Total codemaps: 5
Updated: 4
Unchanged: 1
```

---

## Cross-Language Dependency Tracking

One of the most valuable aspects of codemaps is tracking dependencies across language boundaries:

```markdown
## Cross-Language Dependencies

### Protocol Buffer Consumers
network_event.proto:
  -> Python: src/app/query/query_executor.py (query building)
  -> Python: src/db/analytics/inserter.py (data insertion)
  -> C++: data-loader/src/ingestion/parser.cpp (deserialization)
  -> C++: parser-lib/src/analyzer/event_builder.cpp (serialization)
  -> Analytical DB: network_events table schema (table definition)

### Shared Analytical Tables
network_events:
  Writers: data-loader (C++ bulk insert)
  Readers: api-service (Python query), ui (via API)

### API Contract Dependencies
/api/v1/query/execute:
  Provider: api-service (Flask-RESTX)
  Consumer: ui (Nuxt $fetch)
  Schema: QueryRequest -> QueryResponse (Pydantic)
```

---

## Automation

For automated codemap updates in CI:

```yaml
# CI pipeline snippet
- script: |
    python scripts/generate_codemaps.py
    git diff --stat codemaps/
    if [ $(git diff --stat codemaps/ | wc -l) -gt 0 ]; then
      echo "Codemaps updated - review changes"
    fi
  displayName: 'Update Codemaps'
```

## Integration with Other Commands

- Use `/plan` to reference codemaps when planning new features
- Use `/verify` to ensure codemaps are up to date before PRs
- Use `/refactor-clean` to identify dead code visible in dependency graphs
- Use `/update-docs` to sync documentation with codemap changes

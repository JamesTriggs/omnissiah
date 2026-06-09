# TypeScript/Vue.js Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Vue 3 composable patterns.

## API Response Format

Standard response envelope consumed by the platform UI:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta?: {
    total: number
    offset: number
    limit: number
    request_id: string
  }
}
```

## Vue 3 Composable Patterns

Composables are the Vue 3 equivalent of React hooks. Place them in `composables/` for Nuxt auto-import.

### useAuth -- Authentication Composable

```typescript
// composables/useAuth.ts
import type { User, Organisation } from '~/types'

interface AuthState {
  user: User | null
  organisation: Organisation | null
  isAuthenticated: boolean
  isLoading: boolean
}

export function useAuth() {
  const state = useState<AuthState>('auth', () => ({
    user: null,
    organisation: null,
    isAuthenticated: false,
    isLoading: true,
  }))

  const token = useCookie('app_token')
  const router = useRouter()

  const isAuthenticated = computed(() => state.value.isAuthenticated)
  const currentUser = computed(() => state.value.user)
  const organisationId = computed(() => state.value.organisation?.id)

  async function login(email: string, password: string): Promise<void> {
    state.value.isLoading = true
    try {
      const response = await $fetch<ApiResponse<{ token: string; user: User }>>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      if (!response.success || !response.data) {
        throw new Error(response.error?.message ?? 'Login failed')
      }

      token.value = response.data.token
      state.value.user = response.data.user
      state.value.isAuthenticated = true

      // Fetch organisation context
      await fetchOrganisation()
    } catch (error) {
      state.value.isAuthenticated = false
      state.value.user = null
      throw error
    } finally {
      state.value.isLoading = false
    }
  }

  async function logout(): Promise<void> {
    token.value = null
    state.value.user = null
    state.value.organisation = null
    state.value.isAuthenticated = false
    await router.push('/login')
  }

  async function fetchOrganisation(): Promise<void> {
    if (!state.value.user?.organisation_id) return
    const response = await $fetch<ApiResponse<Organisation>>(
      `/api/v1/organisations/${state.value.user.organisation_id}`
    )
    if (response.success && response.data) {
      state.value.organisation = response.data
    }
  }

  async function refreshToken(): Promise<void> {
    try {
      const response = await $fetch<ApiResponse<{ token: string }>>('/api/v1/auth/refresh', {
        method: 'POST',
      })
      if (response.success && response.data) {
        token.value = response.data.token
      }
    } catch {
      await logout()
    }
  }

  return {
    isAuthenticated,
    currentUser,
    organisationId,
    isLoading: computed(() => state.value.isLoading),
    login,
    logout,
    refreshToken,
  }
}
```

### useThreatData -- Threat Detection Composable

```typescript
// composables/useThreatData.ts
import type { SecurityEvent, ThreatSummary, Technique } from '~/types'

interface ThreatDataOptions {
  autoRefresh?: boolean
  refreshIntervalMs?: number
}

export function useThreatData(options: ThreatDataOptions = {}) {
  const { autoRefresh = false, refreshIntervalMs = 30_000 } = options
  const { organisationId } = useAuth()

  const events = ref<SecurityEvent[]>([])
  const summary = ref<ThreatSummary | null>(null)
  const techniques = ref<Technique[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed aggregations
  const criticalEvents = computed(() =>
    events.value.filter(e => e.severity >= 8)
  )

  const eventsByTechnique = computed(() => {
    const grouped = new Map<string, SecurityEvent[]>()
    for (const event of events.value) {
      if (event.technique_id) {
        const existing = grouped.get(event.technique_id) ?? []
        existing.push(event)
        grouped.set(event.technique_id, existing)
      }
    }
    return grouped
  })

  const severityDistribution = computed(() => {
    const dist = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const event of events.value) {
      if (event.severity >= 8) dist.critical++
      else if (event.severity >= 5) dist.high++
      else if (event.severity >= 3) dist.medium++
      else dist.low++
    }
    return dist
  })

  async function fetchEvents(filters?: Record<string, unknown>): Promise<void> {
    if (!organisationId.value) return

    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ApiResponse<SecurityEvent[]>>('/api/v1/events', {
        params: {
          organisation_id: organisationId.value,
          ...filters,
        },
      })

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Failed to fetch events')
      }

      events.value = response.data ?? []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSummary(timeRange: { start: Date; end: Date }): Promise<void> {
    if (!organisationId.value) return

    const response = await $fetch<ApiResponse<ThreatSummary>>('/api/v1/threats/summary', {
      params: {
        organisation_id: organisationId.value,
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
    })

    if (response.success && response.data) {
      summary.value = response.data
    }
  }

  async function fetchTechniques(): Promise<void> {
    const response = await $fetch<ApiResponse<Technique[]>>('/api/v1/techniques')
    if (response.success && response.data) {
      techniques.value = response.data
    }
  }

  // Auto-refresh for real-time dashboards
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  if (autoRefresh) {
    onMounted(() => {
      refreshInterval = setInterval(fetchEvents, refreshIntervalMs)
    })

    onUnmounted(() => {
      if (refreshInterval) clearInterval(refreshInterval)
    })
  }

  return {
    events: readonly(events),
    summary: readonly(summary),
    techniques: readonly(techniques),
    criticalEvents,
    eventsByTechnique,
    severityDistribution,
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchEvents,
    fetchSummary,
    fetchTechniques,
  }
}
```

### useAnalyticsQuery -- Explorer Query Composable

```typescript
// composables/useAnalyticsQuery.ts
import type { QueryResult, QueryColumn } from '~/types'

interface QueryOptions {
  maxRows?: number
  timeout?: number
}

export function useAnalyticsQuery() {
  const { organisationId } = useAuth()

  const result = ref<QueryResult | null>(null)
  const columns = ref<QueryColumn[]>([])
  const isExecuting = ref(false)
  const error = ref<string | null>(null)
  const executionTimeMs = ref<number>(0)
  const queryHistory = ref<Array<{ query: string; timestamp: Date; rowCount: number }>>([])

  async function executeQuery(
    rawQuery: string,
    options: QueryOptions = {},
  ): Promise<void> {
    if (!organisationId.value) {
      error.value = 'Not authenticated'
      return
    }

    const { maxRows = 10_000, timeout = 30_000 } = options

    isExecuting.value = true
    error.value = null
    const startTime = performance.now()

    try {
      // The backend handles query parsing and access-scope injection.
      // The query is sent as-is -- the server-side parser validates syntax
      // and injects the organisation_id filter.
      const response = await $fetch<ApiResponse<QueryResult>>('/api/v1/explorer/query', {
        method: 'POST',
        body: {
          query: rawQuery,
          organisation_id: organisationId.value,
          max_rows: maxRows,
        },
        timeout,
      })

      executionTimeMs.value = Math.round(performance.now() - startTime)

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Query execution failed')
      }

      result.value = response.data ?? null
      columns.value = response.data?.columns ?? []

      // Track in history
      queryHistory.value.unshift({
        query: rawQuery,
        timestamp: new Date(),
        rowCount: response.data?.rows?.length ?? 0,
      })

      // Keep history bounded
      if (queryHistory.value.length > 50) {
        queryHistory.value = queryHistory.value.slice(0, 50)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Query failed'
      result.value = null
    } finally {
      isExecuting.value = false
    }
  }

  function clearResult(): void {
    result.value = null
    columns.value = []
    error.value = null
    executionTimeMs.value = 0
  }

  async function exportCsv(): Promise<Blob | null> {
    if (!result.value) return null

    const headers = columns.value.map(c => c.name).join(',')
    const rows = result.value.rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return new Blob([`${headers}\n${rows}`], { type: 'text/csv' })
  }

  return {
    result: readonly(result),
    columns: readonly(columns),
    isExecuting: readonly(isExecuting),
    error: readonly(error),
    executionTimeMs: readonly(executionTimeMs),
    queryHistory: readonly(queryHistory),
    executeQuery,
    clearResult,
    exportCsv,
  }
}
```

### usePagination -- Generic Pagination Composable

```typescript
// composables/usePagination.ts
interface PaginationOptions {
  initialLimit?: number
  initialOffset?: number
}

export function usePagination(options: PaginationOptions = {}) {
  const { initialLimit = 25, initialOffset = 0 } = options

  const limit = ref(initialLimit)
  const offset = ref(initialOffset)
  const total = ref(0)

  const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1)
  const totalPages = computed(() => Math.ceil(total.value / limit.value))
  const hasNextPage = computed(() => offset.value + limit.value < total.value)
  const hasPrevPage = computed(() => offset.value > 0)

  function nextPage(): void {
    if (hasNextPage.value) {
      offset.value += limit.value
    }
  }

  function prevPage(): void {
    if (hasPrevPage.value) {
      offset.value = Math.max(0, offset.value - limit.value)
    }
  }

  function goToPage(page: number): void {
    const targetOffset = (page - 1) * limit.value
    if (targetOffset >= 0 && targetOffset < total.value) {
      offset.value = targetOffset
    }
  }

  function setTotal(newTotal: number): void {
    total.value = newTotal
  }

  function reset(): void {
    offset.value = initialOffset
  }

  return {
    limit,
    offset,
    total: readonly(total),
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
    setTotal,
    reset,
  }
}
```

## Pinia Store Patterns

For global state that multiple components share, use Pinia stores:

```typescript
// stores/cases.ts
import { defineStore } from 'pinia'
import type { CaseData, CaseStatus } from '~/types'

export const useCaseStore = defineStore('cases', () => {
  const cases = ref<CaseData[]>([])
  const activeCaseId = ref<string | null>(null)
  const isLoading = ref(false)

  const activeCase = computed(() =>
    cases.value.find(c => c.id === activeCaseId.value) ?? null
  )

  const openCases = computed(() =>
    cases.value.filter(c => c.status === 'open')
  )

  const casesBySeverity = computed(() => {
    const sorted = [...cases.value]
    sorted.sort((a, b) => b.severity - a.severity)
    return sorted
  })

  async function fetchCases(orgId: number): Promise<void> {
    isLoading.value = true
    try {
      const response = await $fetch<ApiResponse<CaseData[]>>('/api/v1/cases', {
        params: { organisation_id: orgId },
      })
      if (response.success && response.data) {
        cases.value = response.data
      }
    } finally {
      isLoading.value = false
    }
  }

  async function updateCaseStatus(caseId: string, status: CaseStatus): Promise<void> {
    await $fetch(`/api/v1/cases/${caseId}`, {
      method: 'PATCH',
      body: { status },
    })
    const caseItem = cases.value.find(c => c.id === caseId)
    if (caseItem) {
      caseItem.status = status
    }
  }

  function setActiveCase(id: string | null): void {
    activeCaseId.value = id
  }

  return {
    cases: readonly(cases),
    activeCase,
    openCases,
    casesBySeverity,
    isLoading: readonly(isLoading),
    fetchCases,
    updateCaseStatus,
    setActiveCase,
  }
})
```

## Repository Pattern (TypeScript)

For complex data access patterns, use a typed repository:

```typescript
// utils/repository.ts
interface Repository<T, CreateDto, UpdateDto> {
  findAll(params?: Record<string, unknown>): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}

// utils/eventRepository.ts
import type { SecurityEvent, CreateEventDto, UpdateEventDto } from '~/types'

export function createEventRepository(orgId: number): Repository<SecurityEvent, CreateEventDto, UpdateEventDto> {
  const basePath = '/api/v1/events'

  return {
    async findAll(params = {}) {
      const response = await $fetch<ApiResponse<SecurityEvent[]>>(basePath, {
        params: { organisation_id: orgId, ...params },
      })
      return response.data ?? []
    },

    async findById(id: string) {
      const response = await $fetch<ApiResponse<SecurityEvent>>(`${basePath}/${id}`, {
        params: { organisation_id: orgId },
      })
      return response.data ?? null
    },

    async create(data: CreateEventDto) {
      const response = await $fetch<ApiResponse<SecurityEvent>>(basePath, {
        method: 'POST',
        body: { ...data, organisation_id: orgId },
      })
      if (!response.success || !response.data) {
        throw new Error(response.error?.message ?? 'Failed to create event')
      }
      return response.data
    },

    async update(id: string, data: UpdateEventDto) {
      const response = await $fetch<ApiResponse<SecurityEvent>>(`${basePath}/${id}`, {
        method: 'PUT',
        body: data,
      })
      if (!response.success || !response.data) {
        throw new Error(response.error?.message ?? 'Failed to update event')
      }
      return response.data
    },

    async delete(id: string) {
      await $fetch(`${basePath}/${id}`, { method: 'DELETE' })
    },
  }
}
```

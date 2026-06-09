---
name: frontend-patterns
description: Frontend development patterns using Vue 3, Nuxt 3, Pinia, TypeScript, Cypress, Playwright, D3.js, and Monaco Editor. Covers data dashboards, analytics visualisations, and code-editor components.
---

# Frontend Development Patterns

Modern frontend patterns built with Vue 3, Nuxt 3, and TypeScript.

## Technology Stack

- **Framework**: Nuxt 3 (Vue 3)
- **Language**: TypeScript (strict mode)
- **State Management**: Pinia
- **Build System**: Vite
- **Testing**: Vitest (unit) + Cypress (E2E for established suites) + **Playwright (E2E for new and standalone Nuxt apps)**
- **Code Editor**: Monaco Editor (query/code editing)
- **Visualization**: D3.js (analytics)
- **Styling**: SCSS with design system tokens
- **Validation**: Vee-validate + yup
- **HTTP Client**: Nuxt useFetch / $fetch

## ⚠️ Frontend Testing Mandate — Playwright Required

**A UI feature is not done until Playwright tests pass against the deployed application.**

This is a hard-learned rule: components can appear to work (build passes, no TS errors) while being completely broken in the browser due to SSR issues, component naming, import errors, or hydration failures — none of which show up in a build.

### When to use Playwright vs Cypress

| Scenario | Tool |
|----------|------|
| App with an existing Cypress suite | Cypress |
| New standalone viewer app | Playwright |
| Any new standalone Nuxt 3 app | Playwright |
| New features in any app without E2E | Add Playwright |

### Playwright Enforcement Rules

1. **Run tests BEFORE reporting a feature as done**
2. **Read failure screenshots** — they tell you exactly what the browser sees
3. **Never say "it should work"** — prove it passes
4. **Deploy first, then test** — test against production, not just local

### Playwright Setup (new Nuxt 3 project)

```bash
npm install -D @playwright/test
npx playwright install chromium

# playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

### Playwright Test Template

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature name', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set auth cookie if needed
    await context.addCookies([{
      name: 'app_user',
      value: JSON.stringify({ login: 'test-user', name: 'Test User', avatarUrl: '', token: 'mock' }),
      domain: new URL(process.env.BASE_URL ?? 'http://localhost:3000').hostname,
      path: '/',
    }])
    await page.goto('/your-page')
  })

  test('component renders and is interactive', async ({ page }) => {
    // Wait for client-side hydration — never assume instant load
    const component = page.locator('.your-component')
    await expect(component).toBeVisible({ timeout: 10000 })

    // Interact and verify
    await component.click()
    await expect(page.locator('.result')).toContainText('expected text')
  })
})
```

### Diagnostic pattern — when tests fail

```typescript
test('diagnose what actually renders', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push('PAGE: ' + err.message))

  await page.goto('/your-page')
  await page.waitForTimeout(5000)

  // Print what's actually in the DOM
  console.log('HTML:', await page.locator('.main-area').innerHTML())
  console.log('JS errors:', errors)
  console.log('Component count:', await page.locator('.your-component').count())
})
```

### Common Nuxt 3 + Playwright gotchas

| Problem | Symptom | Fix |
|---------|---------|-----|
| Component in subdirectory | `<mycomponent>` in HTML (unregistered) | Move to `components/` root |
| SSR crash on client-only lib | Component renders as empty tag | `definePageMeta({ ssr: false })` |
| Wrong import type | Build succeeds, runtime fails | Use named imports `{ X }` not default |
| Hydration mismatch | Component flickers/blank | Wrap with `<ClientOnly>` or `.client.vue` |
| Auth cookie not set | Wrong page shown | Set cookie before `page.goto()` |

## Vue 3 Composition API Patterns

### Reactive State with ref and reactive

```typescript
<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'

// ref for primitives and arrays
const isLoading = ref(false)
const searchQuery = ref('')
const events = ref<AppEvent[]>([])

// reactive for complex objects
const filters = reactive({
  priority: 'all' as 'all' | 'low' | 'medium' | 'high' | 'critical',
  eventType: null as string | null,
  timeRange: 24, // hours
  page: 1,
  limit: 50,
})

// computed for derived state
const filteredEvents = computed(() => {
  let result = events.value
  if (filters.priority !== 'all') {
    result = result.filter(e => e.priority === filters.priority)
  }
  if (filters.eventType) {
    result = result.filter(e => e.event_type === filters.eventType)
  }
  return result
})

const totalPages = computed(() =>
  Math.ceil(filteredEvents.value.length / filters.limit)
)

// watch for side effects
watch(() => filters.priority, (newVal, oldVal) => {
  filters.page = 1 // Reset pagination on filter change
})

watch(searchQuery, useDebounceFn((query: string) => {
  performSearch(query)
}, 300))
</script>
```

### Lifecycle Hooks

```typescript
<script setup lang="ts">
import { onMounted, onUnmounted, onBeforeUnmount } from 'vue'

// WebSocket for real-time events
let ws: WebSocket | null = null

onMounted(async () => {
  // Fetch initial data
  await fetchEvents()

  // Start WebSocket connection for real-time updates
  ws = new WebSocket(`${config.public.wsBaseUrl}/events?tenant=${tenantId}`)
  ws.onmessage = (event) => {
    const newEvent = JSON.parse(event.data) as AppEvent
    events.value.unshift(newEvent) // Add to top of list
  }
})

onBeforeUnmount(() => {
  // Clean up WebSocket
  if (ws) {
    ws.close()
    ws = null
  }
})

// Clean up interval timers
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  refreshInterval.value = setInterval(fetchEvents, 60000) // Refresh every minute
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>
```

### Custom Composables

```typescript
// composables/useEvents.ts
import { ref, computed, watch } from 'vue'
import type { AppEvent, EventFilter, PaginatedResponse } from '~/types'

export function useEvents(tenantId: string) {
  const events = ref<AppEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)

  async function fetchEvents(filter?: EventFilter): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await $fetch<PaginatedResponse<AppEvent>>('/api/v1/events', {
        params: {
          tenant_id: tenantId,
          ...filter,
        },
      })
      events.value = response.data
      total.value = response.meta.total
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load events'
    } finally {
      loading.value = false
    }
  }

  function filterByPriority(events: AppEvent[], minPriority: number): AppEvent[] {
    return events.filter(e => e.priority >= minPriority)
  }

  const highPriorityCount = computed(() =>
    events.value.filter(e => e.priority >= 7).length
  )

  return {
    events,
    loading,
    error,
    total,
    fetchEvents,
    filterByPriority,
    highPriorityCount,
  }
}
```

```typescript
// composables/useDebounce.ts
import { ref, watch } from 'vue'

export function useDebounce<T>(value: Ref<T>, delay: number): Ref<T> {
  const debouncedValue = ref<T>(value.value) as Ref<T>
  let timeout: ReturnType<typeof setTimeout>

  watch(value, (newVal) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      debouncedValue.value = newVal
    }, delay)
  })

  return debouncedValue
}
```

```typescript
// composables/useAnalyticsQuery.ts
export function useAnalyticsQuery() {
  const queryText = ref('')
  const results = ref<QueryResult | null>(null)
  const executing = ref(false)
  const queryError = ref<string | null>(null)
  const executionTime = ref<number>(0)

  async function executeQuery(query: string): Promise<void> {
    executing.value = true
    queryError.value = null
    const start = performance.now()

    try {
      const response = await $fetch<QueryResult>('/api/v1/analytics/query', {
        method: 'POST',
        body: { query },
      })
      results.value = response
      executionTime.value = performance.now() - start
    } catch (e: unknown) {
      queryError.value = e instanceof Error ? e.message : 'Query execution failed'
      results.value = null
    } finally {
      executing.value = false
    }
  }

  function clearResults(): void {
    results.value = null
    queryError.value = null
    executionTime.value = 0
  }

  return {
    queryText,
    results,
    executing,
    queryError,
    executionTime,
    executeQuery,
    clearResults,
  }
}
```

## Nuxt 3 Conventions

### Pages (File-Based Routing)

```
pages/
├── index.vue                    # / (Dashboard)
├── tickets/
│   ├── index.vue               # /tickets (Ticket list)
│   └── [id].vue                # /tickets/:id (Ticket detail)
├── events/
│   ├── index.vue               # /events (Event explorer)
│   └── [id].vue                # /events/:id (Event detail)
├── query-console.vue           # /query-console (Query console)
├── rules/
│   ├── index.vue               # /rules (Rules)
│   └── [id].vue                # /rules/:id (Rule detail)
└── settings/
    ├── index.vue               # /settings
    └── users.vue               # /settings/users
```

### Page Meta and Middleware

```vue
<!-- pages/query-console.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'role-check'],
  meta: {
    requiredRole: 'editor', // Custom meta for role check middleware
    title: 'Query Console',
  },
})

// Page-level data fetching
const { data: savedQueries } = await useFetch('/api/v1/analytics/saved-queries')
</script>
```

### Middleware

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    return navigateTo('/login')
  }

  // Check token expiry
  if (authStore.isTokenExpired) {
    authStore.logout()
    return navigateTo('/login?expired=true')
  }
})

// middleware/role-check.ts
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  const requiredRole = to.meta.requiredRole as string | undefined

  if (requiredRole && !authStore.hasRole(requiredRole)) {
    return navigateTo('/unauthorized')
  }
})
```

### Server API Routes

```typescript
// server/api/v1/events/index.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tenantId = event.context.tenantId // Set by auth middleware

  const response = await $fetch(`${config.apiBaseUrl}/api/v1/events`, {
    params: { ...query, tenant_id: tenantId },
    headers: { Authorization: event.context.authHeader },
  })

  return response
})

// server/api/v1/analytics/query.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const tenantId = event.context.tenantId

  // Validate query before forwarding
  if (!body.query || typeof body.query !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Query is required' })
  }

  if (body.query.length > 50000) {
    throw createError({ statusCode: 400, statusMessage: 'Query too long' })
  }

  return await $fetch(`${config.apiBaseUrl}/api/v1/analytics/query`, {
    method: 'POST',
    body: { query: body.query, tenant_id: tenantId },
    headers: { Authorization: event.context.authHeader },
  })
})
```

### Plugins

```typescript
// plugins/error-handler.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    console.error('Global error:', error, info)

    // Report to error tracking service
    if (process.client) {
      reportError({
        error: error instanceof Error ? error.message : String(error),
        component: instance?.$options?.name ?? 'unknown',
        info,
      })
    }
  }
})

// plugins/auth.client.ts
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()

  // Restore auth state from session
  await authStore.restoreSession()

  // Set up token refresh interval
  if (authStore.isAuthenticated) {
    setInterval(() => authStore.refreshToken(), 5 * 60 * 1000) // Every 5 minutes
  }
})
```

## Pinia State Management

### Store Definition

```typescript
// stores/tickets.ts
import { defineStore } from 'pinia'
import type { Ticket, TicketFilter, TicketCreate, TicketUpdate } from '~/types/tickets'

interface TicketState {
  tickets: Ticket[]
  selectedTicket: Ticket | null
  loading: boolean
  error: string | null
  total: number
}

export const useTicketStore = defineStore('tickets', {
  state: (): TicketState => ({
    tickets: [],
    selectedTicket: null,
    loading: false,
    error: null,
    total: 0,
  }),

  getters: {
    openTickets: (state): Ticket[] =>
      state.tickets.filter(t => t.status === 'open'),

    criticalTickets: (state): Ticket[] =>
      state.tickets.filter(t => t.priority === 'critical'),

    ticketsByStatus: (state) => {
      const grouped = new Map<string, Ticket[]>()
      for (const t of state.tickets) {
        const existing = grouped.get(t.status) ?? []
        grouped.set(t.status, [...existing, t])
      }
      return grouped
    },

    selectedTicketEvents: (state): string[] =>
      state.selectedTicket?.related_event_ids ?? [],
  },

  actions: {
    async fetchTickets(filter?: TicketFilter): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const response = await $fetch<PaginatedResponse<Ticket>>('/api/v1/tickets', {
          params: filter,
        })
        this.tickets = response.data
        this.total = response.meta.total
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to load tickets'
      } finally {
        this.loading = false
      }
    },

    async createTicket(data: TicketCreate): Promise<Ticket | null> {
      try {
        const newTicket = await $fetch<Ticket>('/api/v1/tickets', {
          method: 'POST',
          body: data,
        })
        this.tickets.unshift(newTicket)
        return newTicket
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to create ticket'
        return null
      }
    },

    async updateTicketStatus(ticketId: string, status: string): Promise<void> {
      const ticketIndex = this.tickets.findIndex(t => t.id === ticketId)
      if (ticketIndex === -1) return

      await $fetch(`/api/v1/tickets/${ticketId}`, {
        method: 'PATCH',
        body: { status },
      })

      this.tickets[ticketIndex] = { ...this.tickets[ticketIndex], status }

      if (this.selectedTicket?.id === ticketId) {
        this.selectedTicket = { ...this.selectedTicket, status }
      }
    },

    selectTicket(ticketId: string): void {
      this.selectedTicket = this.tickets.find(t => t.id === ticketId) ?? null
    },

    clearSelection(): void {
      this.selectedTicket = null
    },
  },
})
```

### Composable Store Pattern (Composition API style)

```typescript
// stores/auth.ts
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const tenantId = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isTokenExpired = computed(() => {
    if (!token.value) return true
    const payload = JSON.parse(atob(token.value.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  })
  const hasRole = (role: string) => user.value?.roles?.includes(role) ?? false

  // Actions
  async function login(email: string, password: string): Promise<boolean> {
    try {
      const response = await $fetch<AuthResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      token.value = response.token
      user.value = response.user
      tenantId.value = response.tenant_id

      // Store in session
      if (process.client) {
        sessionStorage.setItem('auth_token', response.token)
      }
      return true
    } catch {
      return false
    }
  }

  function logout(): void {
    token.value = null
    user.value = null
    tenantId.value = null
    if (process.client) {
      sessionStorage.removeItem('auth_token')
    }
  }

  async function restoreSession(): Promise<void> {
    if (process.client) {
      const savedToken = sessionStorage.getItem('auth_token')
      if (savedToken) {
        token.value = savedToken
        // Validate and fetch user profile
        try {
          user.value = await $fetch<User>('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          })
        } catch {
          logout()
        }
      }
    }
  }

  return {
    user, token, tenantId,
    isAuthenticated, isTokenExpired, hasRole,
    login, logout, restoreSession,
  }
})
```

## Component Design for Data Dashboards

### Severity Badge Component
```vue
<!-- components/ui/SeverityBadge.vue -->
<script setup lang="ts">
type Severity = 'low' | 'medium' | 'high' | 'critical'

const props = defineProps<{
  severity: Severity
  score?: number
  compact?: boolean
}>()

const severityConfig = {
  low: { label: 'Low', color: 'var(--color-severity-low)' },
  medium: { label: 'Medium', color: 'var(--color-severity-medium)' },
  high: { label: 'High', color: 'var(--color-severity-high)' },
  critical: { label: 'Critical', color: 'var(--color-severity-critical)' },
}

const config = computed(() => severityConfig[props.severity])
</script>

<template>
  <span
    class="severity-badge"
    :class="[`severity-${severity}`, { compact }]"
    :style="{ '--badge-color': config.color }"
  >
    <span class="severity-dot" />
    <span v-if="!compact" class="severity-label">{{ config.label }}</span>
    <span v-if="score !== undefined" class="severity-score">{{ score }}</span>
  </span>
</template>

<style scoped lang="scss">
.severity-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: color-mix(in srgb, var(--badge-color) 15%, transparent);
  color: var(--badge-color);
}

.severity-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--badge-color);
}
</style>
```

### Event Timeline
```vue
<!-- components/events/EventTimeline.vue -->
<script setup lang="ts">
import type { AppEvent } from '~/types'

const props = defineProps<{
  events: AppEvent[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', event: AppEvent): void
  (e: 'load-more'): void
}>()

const groupedByHour = computed(() => {
  const groups = new Map<string, AppEvent[]>()
  for (const event of props.events) {
    const hour = new Date(event.timestamp).toISOString().slice(0, 13)
    const existing = groups.get(hour) ?? []
    groups.set(hour, [...existing, event])
  }
  return groups
})
</script>

<template>
  <div class="event-timeline">
    <div v-if="loading" class="timeline-loading">
      <SkeletonLoader v-for="i in 5" :key="i" height="60px" />
    </div>

    <template v-else>
      <div
        v-for="[hour, hourEvents] in groupedByHour"
        :key="hour"
        class="timeline-group"
      >
        <div class="timeline-header">
          {{ formatTimelineHeader(hour) }}
          <span class="event-count">{{ hourEvents.length }} events</span>
        </div>

        <div
          v-for="event in hourEvents"
          :key="event.id"
          class="timeline-event"
          @click="emit('select', event)"
        >
          <SeverityBadge :severity="event.priority_label" :score="event.priority" compact />
          <span class="event-type">{{ event.event_type }}</span>
          <span class="event-summary">{{ event.summary }}</span>
          <span class="event-time">{{ formatTime(event.timestamp) }}</span>
        </div>
      </div>

      <button
        v-if="events.length > 0"
        class="load-more-btn"
        @click="emit('load-more')"
      >
        Load more events
      </button>
    </template>
  </div>
</template>
```

### Data Table Component
```vue
<!-- components/ui/DataTable.vue -->
<script setup lang="ts" generic="T extends Record<string, any>">
interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
  width?: string
  render?: (value: any, row: T) => string
}

const props = defineProps<{
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  selectable?: boolean
}>()

const emit = defineEmits<{
  (e: 'sort', column: string, direction: 'asc' | 'desc'): void
  (e: 'row-click', row: T): void
  (e: 'selection-change', selected: T[]): void
}>()

const selectedRows = ref<Set<number>>(new Set())

function toggleSort(column: Column<T>): void {
  if (!column.sortable) return
  const key = String(column.key)
  const newDirection = props.sortBy === key && props.sortDirection === 'asc' ? 'desc' : 'asc'
  emit('sort', key, newDirection)
}

function toggleRow(index: number): void {
  const newSelection = new Set(selectedRows.value)
  if (newSelection.has(index)) {
    newSelection.delete(index)
  } else {
    newSelection.add(index)
  }
  selectedRows.value = newSelection
  emit('selection-change', [...newSelection].map(i => props.data[i]))
}
</script>

<template>
  <div class="data-table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th v-if="selectable" class="checkbox-col">
            <input type="checkbox" @change="toggleAll" />
          </th>
          <th
            v-for="col in columns"
            :key="String(col.key)"
            :style="{ width: col.width }"
            :class="{ sortable: col.sortable, active: sortBy === col.key }"
            @click="toggleSort(col)"
          >
            {{ col.label }}
            <span v-if="col.sortable && sortBy === col.key" class="sort-indicator">
              {{ sortDirection === 'asc' ? '&#9650;' : '&#9660;' }}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length + (selectable ? 1 : 0)">
            <SkeletonLoader v-for="i in 5" :key="i" height="40px" />
          </td>
        </tr>
        <tr
          v-else
          v-for="(row, index) in data"
          :key="index"
          :class="{ selected: selectedRows.has(index) }"
          @click="emit('row-click', row)"
        >
          <td v-if="selectable" class="checkbox-col">
            <input type="checkbox" :checked="selectedRows.has(index)" @click.stop="toggleRow(index)" />
          </td>
          <td v-for="col in columns" :key="String(col.key)">
            <template v-if="col.render">{{ col.render(row[col.key], row) }}</template>
            <template v-else>{{ row[col.key] }}</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

## D3.js Analytics Visualization

### Categorical Heatmap
```typescript
// composables/useCategoryHeatmap.ts
import * as d3 from 'd3'
import type { Ref } from 'vue'

interface CategoryCount {
  item_id: string
  item_name: string
  group: string
  count: number
}

export function useCategoryHeatmap(
  container: Ref<HTMLElement | null>,
  data: Ref<CategoryCount[]>
) {
  // Order of the groups (columns/sections) to render
  const GROUP_ORDER = [
    'acquisition', 'activation', 'engagement', 'retention',
    'conversion', 'expansion', 'support', 'churn',
  ]

  function render(): void {
    if (!container.value || !data.value.length) return

    const el = container.value
    d3.select(el).selectAll('*').remove()

    const margin = { top: 60, right: 20, bottom: 20, left: 150 }
    const width = el.clientWidth - margin.left - margin.right
    const height = Math.max(400, data.value.length * 20)

    const svg = d3.select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const maxCount = d3.max(data.value, d => d.count) ?? 1
    const colorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, maxCount])

    // Group items by group
    const byGroup = d3.group(data.value, d => d.group)

    let yOffset = 0
    for (const group of GROUP_ORDER) {
      const items = byGroup.get(group) ?? []
      if (items.length === 0) continue

      // Group header
      svg.append('text')
        .attr('x', -10)
        .attr('y', yOffset + 15)
        .attr('text-anchor', 'end')
        .attr('font-weight', 'bold')
        .attr('font-size', '11px')
        .text(group.replace(/-/g, ' ').toUpperCase())

      // Item cells
      items.forEach((item, i) => {
        const cellWidth = Math.min(width, 600)
        const cellHeight = 18

        svg.append('rect')
          .attr('x', 0)
          .attr('y', yOffset + i * (cellHeight + 2))
          .attr('width', cellWidth * (item.count / maxCount))
          .attr('height', cellHeight)
          .attr('fill', colorScale(item.count))
          .attr('rx', 2)
          .append('title')
          .text(`${item.item_id}: ${item.item_name} (${item.count})`)

        svg.append('text')
          .attr('x', 5)
          .attr('y', yOffset + i * (cellHeight + 2) + 13)
          .attr('font-size', '10px')
          .attr('fill', item.count > maxCount * 0.5 ? 'white' : 'var(--color-text)')
          .text(`${item.item_id} ${item.item_name}`)
      })

      yOffset += items.length * 20 + 30
    }
  }

  watch(data, render, { deep: true })
  onMounted(() => nextTick(render))

  return { render }
}
```

### Network Flow Graph
```typescript
// composables/useNetworkGraph.ts
import * as d3 from 'd3'

interface NetworkNode {
  id: string
  ip: string
  type: 'internal' | 'external' | 'flagged'
  connections: number
}

interface NetworkEdge {
  source: string
  target: string
  bytes: number
  protocol: string
}

export function useNetworkGraph(
  container: Ref<HTMLElement | null>,
  nodes: Ref<NetworkNode[]>,
  edges: Ref<NetworkEdge[]>
) {
  function render(): void {
    if (!container.value) return

    const el = container.value
    d3.select(el).selectAll('*').remove()

    const width = el.clientWidth
    const height = el.clientHeight || 500

    const svg = d3.select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    const simulation = d3.forceSimulation(nodes.value as any)
      .force('link', d3.forceLink(edges.value as any).id((d: any) => d.id))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))

    // Draw edges
    const link = svg.append('g')
      .selectAll('line')
      .data(edges.value)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.bytes / 1024))

    // Draw nodes
    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes.value)
      .join('circle')
      .attr('r', d => Math.sqrt(d.connections) * 3 + 5)
      .attr('fill', d => {
        switch (d.type) {
          case 'flagged': return 'var(--color-severity-critical)'
          case 'external': return 'var(--color-severity-medium)'
          default: return 'var(--color-primary)'
        }
      })
      .call(d3.drag() as any)

    // Add labels
    const label = svg.append('g')
      .selectAll('text')
      .data(nodes.value)
      .join('text')
      .text(d => d.ip)
      .attr('font-size', '10px')
      .attr('dx', 12)
      .attr('dy', 4)

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)
      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    })
  }

  return { render }
}
```

## Monaco Editor Integration (Query Console)

```vue
<!-- components/query/QueryEditor.vue -->
<script setup lang="ts">
import * as monaco from 'monaco-editor'

const props = defineProps<{
  modelValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'execute'): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (!editorContainer.value) return

  // Register the analytics SQL dialect
  monaco.languages.register({ id: 'analyticssql' })
  monaco.languages.setMonarchTokensProvider('analyticssql', {
    keywords: [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
      'GROUP', 'BY', 'ORDER', 'LIMIT', 'OFFSET', 'HAVING', 'AS',
      'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'UNION', 'ALL',
      'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    ],
    functions: [
      'count', 'sum', 'avg', 'min', 'max', 'uniq', 'uniqExact',
      'toDate', 'toDateTime', 'now', 'today', 'yesterday',
      'toStartOfHour', 'toStartOfDay', 'toStartOfMonth',
      'quantile', 'groupArray', 'arrayJoin',
      '$__timeFilter', '$__tenantId', '$__timeFrom', '$__timeTo',
    ],
    tables: [
      'orders', 'order_items', 'auth_events',
      'page_views', 'payments',
    ],
    tokenizer: {
      root: [
        [/\$__\w+/, 'variable'],
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@functions': 'predefined',
            '@tables': 'type',
            '@default': 'identifier',
          },
        }],
        [/[0-9]+/, 'number'],
        [/'[^']*'/, 'string'],
        [/--.*$/, 'comment'],
      ],
    },
  })

  // Create editor instance
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: 'analyticssql',
    theme: 'vs-dark',
    minimap: { enabled: false },
    lineNumbers: 'on',
    fontSize: 14,
    tabSize: 2,
    wordWrap: 'on',
    automaticLayout: true,
    readOnly: props.readonly,
    suggestOnTriggerCharacters: true,
  })

  // Sync model value
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor!.getValue())
  })

  // Execute query shortcut (Ctrl/Cmd + Enter)
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    emit('execute')
  })
})

onBeforeUnmount(() => {
  editor?.dispose()
})

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  if (editor && editor.getValue() !== newVal) {
    editor.setValue(newVal)
  }
})
</script>

<template>
  <div ref="editorContainer" class="query-editor" />
</template>

<style scoped lang="scss">
.query-editor {
  width: 100%;
  height: 300px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}
</style>
```

## Cypress E2E Testing Patterns

### Custom Commands
```typescript
// cypress/support/commands.ts
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      waitForPageLoad(): Chainable<void>
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type(email)
    cy.get('[data-testid="password-input"]').type(password)
    cy.get('[data-testid="login-btn"]').click()
    cy.url().should('not.include', '/login')
  })
})

Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('[data-testid="page-loading"]').should('not.exist')
})

Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`)
})
```

### E2E Test Patterns
```typescript
// cypress/e2e/dashboard.cy.ts
describe('Dashboard', () => {
  beforeEach(() => {
    cy.login('user@example.com', 'test-password')
    cy.visit('/')
    cy.waitForPageLoad()
  })

  it('displays priority distribution chart', () => {
    cy.getByTestId('priority-chart').should('be.visible')
    cy.getByTestId('priority-chart').find('svg').should('exist')
  })

  it('shows recent events', () => {
    cy.getByTestId('recent-events').should('be.visible')
    cy.getByTestId('event-card').should('have.length.at.least', 1)
  })

  it('navigates to ticket detail on click', () => {
    cy.getByTestId('ticket-card').first().click()
    cy.url().should('match', /\/tickets\/[\w-]+/)
    cy.getByTestId('ticket-detail').should('be.visible')
  })

  it('refreshes data on time range change', () => {
    cy.intercept('GET', '/api/v1/events*').as('fetchEvents')
    cy.getByTestId('time-range-selector').select('1h')
    cy.wait('@fetchEvents')
    cy.getByTestId('event-count').should('exist')
  })
})
```

## SCSS/Styling Patterns

### Design System Tokens
```scss
// assets/scss/_variables.scss
:root {
  // Colors - Severity
  --color-severity-low: #4caf50;
  --color-severity-medium: #ff9800;
  --color-severity-high: #f44336;
  --color-severity-critical: #9c27b0;

  // Colors - Brand
  --color-primary: #1a73e8;
  --color-primary-light: #4a90d9;
  --color-secondary: #5f6368;

  // Colors - UI
  --color-background: #ffffff;
  --color-surface: #f8f9fa;
  --color-border: #dadce0;
  --color-text: #202124;
  --color-text-secondary: #5f6368;

  // Spacing
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  // Typography
  --font-family: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  // Shadows
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);

  // Border radius
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

// Dark theme
[data-theme="dark"] {
  --color-background: #1a1a2e;
  --color-surface: #16213e;
  --color-border: #3a3a5c;
  --color-text: #e8e8e8;
  --color-text-secondary: #a0a0b0;
}
```

## Security: CSP Headers, XSS Prevention, Input Sanitization

### Content Security Policy (Nuxt Config)
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'strict-dynamic'",
          "style-src 'self' 'unsafe-inline'", // Required for Vue scoped styles
          "img-src 'self' data: https:",
          "font-src 'self'",
          "connect-src 'self' https://api.example.com wss://ws.example.com",
          "frame-ancestors 'none'",
        ].join('; '),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  },
})
```

### Input Sanitization with Vee-validate
```vue
<script setup lang="ts">
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'

const schema = yup.object({
  queryName: yup.string()
    .required('Query name is required')
    .max(200, 'Name too long')
    .matches(/^[\w\s\-]+$/, 'Invalid characters in name'),

  queryText: yup.string()
    .required('Query is required')
    .max(50000, 'Query too long')
    .test('no-dangerous-ops', 'Prohibited operation detected',
      (val) => !val || !/\b(DROP|TRUNCATE|ALTER|CREATE|GRANT)\b/i.test(val)),

  timeRange: yup.number()
    .required('Time range is required')
    .oneOf([1, 6, 12, 24, 48, 168], 'Invalid time range'),
})

const { handleSubmit, errors } = useForm({ validationSchema: schema })
const { value: queryName } = useField<string>('queryName')
const { value: queryText } = useField<string>('queryText')
const { value: timeRange } = useField<number>('timeRange')

const onSubmit = handleSubmit(async (values) => {
  await saveQuery(values)
})
</script>
```

## Performance Patterns

### Code Splitting and Lazy Loading
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    componentIslands: true,
  },
})

// Lazy load heavy components
const QueryEditor = defineAsyncComponent(() =>
  import('~/components/query/QueryEditor.vue')
)

const CategoryHeatmap = defineAsyncComponent(() =>
  import('~/components/charts/CategoryHeatmap.vue')
)

const NetworkGraph = defineAsyncComponent(() =>
  import('~/components/charts/NetworkGraph.vue')
)
```

### Virtual Scrolling for Large Datasets
```vue
<!-- components/events/VirtualEventList.vue -->
<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
import type { AppEvent } from '~/types'

const props = defineProps<{
  events: AppEvent[]
}>()

const { list, containerProps, wrapperProps } = useVirtualList(
  computed(() => props.events),
  {
    itemHeight: 60,
    overscan: 10,
  }
)
</script>

<template>
  <div v-bind="containerProps" class="virtual-list-container">
    <div v-bind="wrapperProps">
      <div
        v-for="{ data: event, index } in list"
        :key="event.id"
        class="event-row"
      >
        <EventRow :event="event" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.virtual-list-container {
  height: calc(100vh - 200px);
  overflow-y: auto;
}
</style>
```

### Performance Monitoring
```typescript
// composables/usePerformance.ts
export function usePerformance(label: string) {
  const startTime = ref(0)
  const renderTime = ref(0)

  onMounted(() => {
    startTime.value = performance.now()

    nextTick(() => {
      renderTime.value = performance.now() - startTime.value

      if (renderTime.value > 100) {
        console.warn(`[Performance] ${label} rendered in ${renderTime.value.toFixed(1)}ms`)
      }
    })
  })

  return { renderTime }
}
```

## TypeScript Strict Mode Patterns

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

```typescript
// Type-safe API responses
async function fetchEvents(): Promise<AppEvent[]> {
  const response = await $fetch<ApiResponse<AppEvent[]>>('/api/v1/events')

  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch events')
  }

  return response.data
}

// Exhaustive type checking
function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'low': return 'var(--color-severity-low)'
    case 'medium': return 'var(--color-severity-medium)'
    case 'high': return 'var(--color-severity-high)'
    case 'critical': return 'var(--color-severity-critical)'
    default: {
      const _exhaustive: never = severity
      return _exhaustive
    }
  }
}
```

---

## Project-Specific Rules (Example, Enforced by code review)

These are example conventions a team might enforce in a Nuxt repository. Adapt them to your own
codebase. Violations of agreed conventions should block PR approval.

### API calls: ALWAYS use the shared client, NEVER $fetch directly

If your project routes API calls through a shared client (for example an Axios instance) that a
local mock interceptor hooks into, `$fetch` (Nuxt's ofetch) will **bypass that interceptor** in
mock mode. Only calls through the shared client are intercepted, so a stray `$fetch` becomes
invisible to mocks and breaks local development.

```js
// WRONG — bypasses the mock interceptor, breaks mock mode
const data = await $fetch("/api/issues")

// CORRECT — intercepted by the mock layer, works in mock mode
const { $api } = useNuxtApp()
const { data } = await $api.axios.get("/api/issues")
const { data } = await $api.axios.post("/api/issues", body)
```

The `$api` object is the shared API client, provided via a startup plugin. For endpoints not yet
on the client, call `$api.axios` directly. Keep all backend calls flowing through the shared
client so the mock layer stays effective.

### Components: ALWAYS use Composition API (`<script setup>`)

Options API is banned by team decision. All components must use `<script setup>`.

```vue
<!-- WRONG -->
<script>
export default {
  name: "MyComponent",
  data() { return { count: 0 } },
  methods: { increment() { this.count++ } }
}
</script>

<!-- CORRECT -->
<script setup>
defineOptions({ name: "MyComponent" })
const count = ref(0)
function increment() { count.value++ }
</script>
```

### Design System: Use `<Button />` and `<MenuDropdown />`, never raw HTML

Raw `<button>` and `<select>` elements are not dark-mode safe and bypass design system
accessibility patterns.

```vue
<!-- WRONG -->
<button @click="submit">Save</button>
<select v-model="priority">
  <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
</select>

<!-- CORRECT -->
<Button @click="submit">Save</Button>
<MenuDropdown v-model="priority" arrow secondary @change="priority = $event">
  <MenuOption v-for="opt in options" :key="opt.value" icon :value="opt.value" :label="opt.label" />
</MenuDropdown>
```

Both `Button` and `MenuDropdown` / `MenuOption` are globally registered.

### Colours: NEVER use primitive colour tokens

Primitive tokens (`--primitives-colors-purple-600`, raw hex `#34d399`) break dark mode.
Always use semantic tokens.

```scss
// WRONG
color: var(--primitives-colors-purple-600);
background-color: #34d399;
background-color: var(--primitives-colors-purple-900);

// CORRECT
color: var(--semantic-colours-purple-strong);
background-color: var(--semantic-colours-green-graphic);
background-color: var(--semantic-colours-purple-deep);
```

### Icons: Register in `app/plugins/13.fontawesome.js`, prefer solid (`fas`) variants

All Font Awesome icons must be explicitly imported and registered in the FA plugin file.
Using an unregistered icon renders nothing without any runtime error.

```js
// 1. Import in app/plugins/13.fontawesome.js
import { faTriangleExclamation as fasTriangleExclamation } from "@fortawesome/pro-solid-svg-icons"

// 2. Add to library.add(...)
library.add(fasTriangleExclamation)

// 3. Use in template — prefer solid ('fas') over light ('fal')
<FontAwesomeIcon :icon="['fas', 'triangle-exclamation']" />
```

Before using any icon, check it is registered. `fal` (light) variants require separate imports
from `@fortawesome/pro-light-svg-icons`.

### Utilities: Check existing deps before hand-rolling

```js
// WRONG — hand-rolled formatSize function
formatSize(bytes) {
  if (bytes < 1024) return bytes + " B"
  return (bytes / 1024).toFixed(1) + " KB"
}

// CORRECT — use the existing dep
import prettyBytes from "pretty-bytes"
prettyBytes(file.size)  // "1.2 MB"
```

Check `package.json` and existing component usage before writing utility functions.

### Mock registration: Register all new API routes in the feature mock

Every route used by a feature must be registered with the mock layer so it stays interceptable
in mock mode.

```js
static registerMockHandlers() {
  MyMock.apiMock.registerMockEndpoints([
    { verb: "get", route: "/api/feature/items", method: MyMock.getItems, errorChance: 0 },
  ])
}

// Handler returns a tuple [status, headers, body]:
static getItems() {
  return [200, { "Content-Type": "application/json" }, MyMock.data.items]
}
```

### Branch naming: `ai/` prefix required for AI-authored branches

Any branch where the bulk of the work is done by an LLM must be prefixed with `ai/`:
`ai/feature/UI-XXX-description`, `ai/bugfix/UI-XXX-description`.

### PR template: Fill every section before requesting review

Always use `.github/pull_request_template.md`. An empty or single-line description will
get the PR sent back.

**Remember**: The UI is the primary interface for your users. Every component must be performant (users often work with large datasets), accessible (keyboard navigation for efficiency), and secure (XSS prevention, input sanitization). Prioritize data clarity and rapid comprehension in all UI decisions.

# TypeScript/Vue.js Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Vue 3 + Nuxt 3 specific content.

## Vue 3 Composition API

All new components MUST use the Composition API with `<script setup lang="ts">`. Do not use the Options API.

### Component Structure

```vue
<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import type { SecurityEvent, CaseData } from '~/types'

// --- Props ---
const props = defineProps<{
  organisationId: number
  eventType?: string
}>()

// --- Emits ---
const emit = defineEmits<{
  (e: 'event-selected', event: SecurityEvent): void
  (e: 'filter-changed', filters: Record<string, unknown>): void
}>()

// --- Reactive State ---
const isLoading = ref(false)
const events = ref<SecurityEvent[]>([])
const selectedEvent = ref<SecurityEvent | null>(null)

const filters = reactive({
  severity: 0,
  startDate: null as Date | null,
  endDate: null as Date | null,
})

// --- Computed ---
const filteredEvents = computed(() => {
  return events.value.filter(event => {
    if (filters.severity > 0 && event.severity < filters.severity) return false
    if (filters.startDate && event.timestamp < filters.startDate) return false
    if (filters.endDate && event.timestamp > filters.endDate) return false
    return true
  })
})

const criticalCount = computed(() =>
  events.value.filter(e => e.severity >= 8).length
)

// --- Watchers ---
watch(() => props.eventType, async (newType) => {
  if (newType) await fetchEvents()
})

// --- Methods ---
async function fetchEvents(): Promise<void> {
  isLoading.value = true
  try {
    events.value = await $fetch<SecurityEvent[]>('/api/v1/events', {
      params: {
        organisation_id: props.organisationId,
        event_type: props.eventType,
      },
    })
  } finally {
    isLoading.value = false
  }
}

function selectEvent(event: SecurityEvent): void {
  selectedEvent.value = event
  emit('event-selected', event)
}

// --- Lifecycle ---
onMounted(fetchEvents)
</script>

<template>
  <div class="event-list">
    <div v-if="isLoading" class="loading-spinner">
      Loading events...
    </div>
    <div v-else-if="filteredEvents.length === 0" class="empty-state">
      No events found.
    </div>
    <ul v-else>
      <li
        v-for="event in filteredEvents"
        :key="event.id"
        :class="{ selected: selectedEvent?.id === event.id }"
        @click="selectEvent(event)"
      >
        <span class="severity" :data-level="event.severity">
          {{ event.severity }}
        </span>
        <span class="type">{{ event.event_type }}</span>
        <span class="timestamp">{{ event.timestamp }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.event-list {
  // Component-scoped styles
}
</style>
```

## Reactivity Primitives

### ref vs reactive

```typescript
// Use ref() for primitives and values that get reassigned
const count = ref(0)
const name = ref('')
const isVisible = ref(false)
const items = ref<SecurityEvent[]>([])  // Use ref for arrays that get reassigned

// Use reactive() for objects with known shape that won't be reassigned
const filters = reactive({
  severity: 0,
  startDate: null as Date | null,
  endDate: null as Date | null,
})

// Use computed() for derived values -- NEVER mutate computed refs
const highSeverityCount = computed(() =>
  items.value.filter(i => i.severity >= 7).length
)

// Use shallowRef() for large objects that change as a whole (performance)
const largeDataset = shallowRef<EventRow[]>([])
```

### Immutability

Use spread operator for immutable updates:

```typescript
// WRONG: Mutation
function updateFilter(filters: Filters, key: string, value: unknown) {
  filters[key] = value  // MUTATION!
  return filters
}

// CORRECT: Immutability (for non-reactive objects)
function updateFilter(filters: Filters, key: string, value: unknown): Filters {
  return { ...filters, [key]: value }
}

// CORRECT: Reactive objects can be mutated directly (Vue tracks changes)
filters.severity = 5  // This is fine when filters is reactive()
```

## Nuxt 3 Conventions

### Directory Structure

Follow Nuxt 3 auto-import conventions strictly:

```
app-ui/
  pages/          # Auto-routed pages (file-based routing)
    index.vue     # /
    cases/
      index.vue   # /cases
      [id].vue    # /cases/:id
    explorer/
      index.vue   # /explorer
  components/     # Auto-imported components
    base/         # BaseButton, BaseCard, BaseModal
    event/        # EventList, EventDetail, EventTimeline
    case/         # CaseCard, CaseSummary
    dashboard/    # DashboardWidget, DashboardChart
  composables/    # Auto-imported composables (useXxx)
    useAuth.ts
    useThreatData.ts
    useAnalyticsQuery.ts
  middleware/     # Route middleware
    auth.ts       # Authentication guard
    tenant.ts     # Tenant context validation
  server/         # Server routes (Nitro)
    api/
  plugins/        # Nuxt plugins
  layouts/        # Layout components
    default.vue
    dashboard.vue
  types/          # TypeScript type definitions
    index.ts
    events.ts
    cases.ts
  utils/          # Utility functions (auto-imported)
  stores/         # Pinia stores
```

### Page Meta and Middleware

```typescript
// pages/cases/index.vue
<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'tenant'],
  layout: 'dashboard',
})

const { data: cases } = await useFetch('/api/v1/cases')
</script>
```

### Auto-Imports

Nuxt 3 auto-imports Vue APIs and composables. Do NOT manually import these:

```typescript
// WRONG: Manual import of auto-imported APIs
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFetch } from '#app'

// CORRECT: Just use them directly (Nuxt auto-imports)
const route = useRoute()
const router = useRouter()
const count = ref(0)
const doubled = computed(() => count.value * 2)
```

Exception: Import `type` declarations explicitly when needed for TypeScript:

```typescript
import type { SecurityEvent } from '~/types'
```

## Error Handling

Use async/await with try-catch. Always provide user-friendly error messages.

```typescript
async function loadEvents(): Promise<void> {
  isLoading.value = true
  error.value = null

  try {
    const response = await $fetch<ApiResponse<SecurityEvent[]>>('/api/v1/events', {
      params: { organisation_id: orgId.value },
    })

    if (!response.success) {
      throw new Error(response.error?.message ?? 'Unknown error')
    }

    events.value = response.data ?? []
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load events'
    error.value = message
    // Use Nuxt's built-in error handling
    showError({ statusCode: 500, message })
  } finally {
    isLoading.value = false
  }
}
```

## Input Validation

Use Vee-validate with Zod schemas for form validation:

```typescript
import { useForm, useField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

const schema = toTypedSchema(
  z.object({
    name: z.string().min(1, 'Name is required').max(200),
    severity: z.number().int().min(1).max(10),
    description: z.string().max(5000),
    techniqueId: z.string().regex(/^T\d{4}(\.\d{3})?$/, 'Invalid technique ID').optional(),
  })
)

const { handleSubmit, errors } = useForm({ validationSchema: schema })
const { value: name } = useField('name')
const { value: severity } = useField('severity')
```

## TypeScript Strictness

### Type Definitions

Always define explicit types for component interfaces:

```typescript
// types/events.ts
export interface SecurityEvent {
  id: string
  timestamp: Date
  event_type: string
  source_ip: string | null
  dest_ip: string | null
  severity: number
  description: string
  technique_id: string | null
  technique_name: string | null
  organisation_id: number
}

export interface EventFilters {
  severity: number
  startDate: Date | null
  endDate: Date | null
  eventType: string | null
  sourceIp: string | null
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  meta: {
    total: number
    offset: number
    limit: number
  }
}
```

### Avoid `any`

```typescript
// BAD: Using any
function processData(data: any): any {
  return data.items.map((item: any) => item.name)
}

// GOOD: Explicit types
function processData(data: EventResponse): string[] {
  return data.items.map((item: SecurityEvent) => item.description)
}

// ACCEPTABLE: unknown with type narrowing
function handleError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unknown error occurred'
}
```

## Console Output

- No `console.log` statements in production code
- Use a structured logger or Nuxt's built-in `useLogger` in development
- See hooks for automatic detection of console.log statements

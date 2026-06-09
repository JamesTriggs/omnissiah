# TypeScript/Vue.js Testing

> This file extends [common/testing.md](../common/testing.md) with Vue 3 + Nuxt 3 specific content.

## Testing Stack

| Tool | Purpose | Scope |
|------|---------|-------|
| **Vitest** | Unit testing | Components, composables, utilities |
| **Cypress** | E2E testing | Full user flows, API integration |
| **Vue Test Utils** | Component testing | Individual component behavior |

## Unit Testing with Vitest

### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '#app': resolve(__dirname, '.nuxt/types'),
    },
  },
})
```

### Testing Composables

```typescript
// tests/composables/useThreatData.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useThreatData } from '~/composables/useThreatData'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

// Mock useAuth
vi.mock('~/composables/useAuth', () => ({
  useAuth: () => ({
    organisationId: computed(() => 42),
    isAuthenticated: computed(() => true),
  }),
}))

describe('useThreatData', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia())
    vi.clearAllMocks()
  })

  it('fetches events for the current organisation', async () => {
    const mockEvents = [
      { id: '1', severity: 8, event_type: 'alert', technique_id: 'RULE-100' },
      { id: '2', severity: 3, event_type: 'login', technique_id: null },
    ]

    mockFetch.mockResolvedValueOnce({
      success: true,
      data: mockEvents,
    })

    const { events, fetchEvents } = useThreatData()

    await fetchEvents()

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/events', {
      params: expect.objectContaining({ organisation_id: 42 }),
    })
    expect(events.value).toHaveLength(2)
  })

  it('computes critical events correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: [
        { id: '1', severity: 9 },
        { id: '2', severity: 3 },
        { id: '3', severity: 8 },
      ],
    })

    const { criticalEvents, fetchEvents } = useThreatData()
    await fetchEvents()

    expect(criticalEvents.value).toHaveLength(2)
  })

  it('computes severity distribution', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: [
        { id: '1', severity: 1 },
        { id: '2', severity: 4 },
        { id: '3', severity: 6 },
        { id: '4', severity: 9 },
      ],
    })

    const { severityDistribution, fetchEvents } = useThreatData()
    await fetchEvents()

    expect(severityDistribution.value).toEqual({
      low: 1,
      medium: 1,
      high: 1,
      critical: 1,
    })
  })

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { error, fetchEvents } = useThreatData()
    await fetchEvents()

    expect(error.value).toBe('Network error')
  })

  it('groups events by technique', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: [
        { id: '1', technique_id: 'RULE-100' },
        { id: '2', technique_id: 'RULE-100' },
        { id: '3', technique_id: 'RULE-200' },
        { id: '4', technique_id: null },
      ],
    })

    const { eventsByTechnique, fetchEvents } = useThreatData()
    await fetchEvents()

    expect(eventsByTechnique.value.get('RULE-100')).toHaveLength(2)
    expect(eventsByTechnique.value.get('RULE-200')).toHaveLength(1)
    expect(eventsByTechnique.value.has(null as unknown as string)).toBe(false)
  })
})
```

### Testing Components

```typescript
// tests/components/EventList.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EventList from '~/components/event/EventList.vue'
import type { SecurityEvent } from '~/types'

const mockEvents: SecurityEvent[] = [
  {
    id: '1',
    timestamp: new Date('2025-01-15T10:30:00Z'),
    event_type: 'alert_raised',
    source_ip: '10.0.1.5',
    dest_ip: '203.0.113.50',
    severity: 9,
    description: 'Trojan detected on endpoint',
    technique_id: 'RULE-101',
    technique_name: 'PowerShell',
    organisation_id: 42,
  },
  {
    id: '2',
    timestamp: new Date('2025-01-15T11:00:00Z'),
    event_type: 'suspicious_login',
    source_ip: '192.168.1.100',
    dest_ip: null,
    severity: 5,
    description: 'Login from unusual location',
    technique_id: 'RULE-300',
    technique_name: 'Valid Accounts',
    organisation_id: 42,
  },
]

describe('EventList', () => {
  it('renders a list of events', () => {
    const wrapper = mount(EventList, {
      props: { events: mockEvents, isLoading: false },
    })

    const items = wrapper.findAll('[data-test="event-item"]')
    expect(items).toHaveLength(2)
  })

  it('shows loading state', () => {
    const wrapper = mount(EventList, {
      props: { events: [], isLoading: true },
    })

    expect(wrapper.find('[data-test="loading"]').exists()).toBe(true)
  })

  it('shows empty state when no events', () => {
    const wrapper = mount(EventList, {
      props: { events: [], isLoading: false },
    })

    expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('emits event-selected when an event is clicked', async () => {
    const wrapper = mount(EventList, {
      props: { events: mockEvents, isLoading: false },
    })

    await wrapper.find('[data-test="event-item"]').trigger('click')

    expect(wrapper.emitted('event-selected')).toBeTruthy()
    expect(wrapper.emitted('event-selected')![0]).toEqual([mockEvents[0]])
  })

  it('displays severity badge with correct class', () => {
    const wrapper = mount(EventList, {
      props: { events: mockEvents, isLoading: false },
    })

    const badge = wrapper.find('[data-test="severity-badge"]')
    expect(badge.classes()).toContain('severity-critical')
  })
})
```

### Testing Utilities

```typescript
// tests/utils/queryValidator.test.ts
import { describe, it, expect } from 'vitest'
import { useQueryValidator } from '~/composables/useQueryValidator'

describe('useQueryValidator', () => {
  const { validateQuery } = useQueryValidator()

  it('accepts valid SELECT queries', () => {
    expect(validateQuery('SELECT * FROM events WHERE severity > 5').valid).toBe(true)
  })

  it('rejects system database access', () => {
    const result = validateQuery('SELECT * FROM system.processes')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('disallowed')
  })

  it('rejects DROP statements', () => {
    expect(validateQuery('DROP TABLE events').valid).toBe(false)
  })

  it('rejects url() function', () => {
    expect(validateQuery("SELECT * FROM url('http://evil.com')").valid).toBe(false)
  })

  it('rejects queries exceeding maximum length', () => {
    const longQuery = 'SELECT ' + 'x'.repeat(11_000)
    expect(validateQuery(longQuery).valid).toBe(false)
  })

  it('rejects INSERT statements', () => {
    expect(validateQuery('INSERT INTO events VALUES (1, 2, 3)').valid).toBe(false)
  })
})
```

## E2E Testing with Cypress

### Batch Organization

The framework organises Cypress tests into batches by feature area:

| Batch | Feature Area | Command |
|-------|-------------|---------|
| `batch_00` | Explorer | `npm run test:cypress-run-batch batch_00` |
| `batch_01` | Dashboards | `npm run test:cypress-run-batch batch_01` |
| `batch_02` | Investigation & Cases | `npm run test:cypress-run-batch batch_02` |
| `batch_03` | Settings & Admin | `npm run test:cypress-run-batch batch_03` |
| `batch_04` | Alerts & Notifications | `npm run test:cypress-run-batch batch_04` |

### Directory Structure

```
cypress/
  e2e/
    batch_00/                  # Explorer tests
      explorer-query.cy.ts
      explorer-results.cy.ts
      explorer-export.cy.ts
    batch_01/                  # Dashboard tests
      dashboard-overview.cy.ts
      dashboard-widgets.cy.ts
      dashboard-filters.cy.ts
    batch_02/                  # Investigation tests
      case-creation.cy.ts
      case-workflow.cy.ts
      investigation-timeline.cy.ts
    batch_03/                  # Settings tests
      user-management.cy.ts
      organisation-settings.cy.ts
    batch_04/                  # Alert tests
      alert-rules.cy.ts
      notification-channels.cy.ts
  fixtures/
    events.json
    cases.json
    users.json
  support/
    commands.ts
    e2e.ts
```

### Cypress Configuration

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 10_000,
    requestTimeout: 15_000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
  },
})
```

### Custom Commands

```typescript
// cypress/support/commands.ts

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>
      selectOrganisation(orgName?: string): Chainable<void>
      executeExplorerQuery(query: string): Chainable<void>
      waitForEvents(): Chainable<void>
    }
  }
}

Cypress.Commands.add('login', (email = 'test@example.com', password = 'test-password') => {
  cy.session([email], () => {
    cy.visit('/login')
    cy.get('[data-test="email-input"]').type(email)
    cy.get('[data-test="password-input"]').type(password)
    cy.get('[data-test="login-button"]').click()
    cy.url().should('not.include', '/login')
  })
})

Cypress.Commands.add('selectOrganisation', (orgName = 'Test Organisation') => {
  cy.get('[data-test="org-selector"]').click()
  cy.get('[data-test="org-option"]').contains(orgName).click()
  cy.get('[data-test="org-selector"]').should('contain', orgName)
})

Cypress.Commands.add('executeExplorerQuery', (query: string) => {
  cy.get('[data-test="query-editor"]').clear().type(query, { delay: 10 })
  cy.get('[data-test="execute-button"]').click()
  cy.get('[data-test="query-spinner"]').should('not.exist')
})

Cypress.Commands.add('waitForEvents', () => {
  cy.get('[data-test="loading-spinner"]').should('not.exist')
  cy.get('[data-test="event-list"]').should('exist')
})
```

### Explorer E2E Tests (batch_00)

```typescript
// cypress/e2e/batch_00/explorer-query.cy.ts
describe('Explorer - Query Execution', () => {
  beforeEach(() => {
    cy.login()
    cy.selectOrganisation()
    cy.visit('/explorer')
  })

  it('executes a basic event query', () => {
    cy.executeExplorerQuery('SELECT * FROM events LIMIT 10')

    cy.get('[data-test="results-table"]').should('be.visible')
    cy.get('[data-test="result-row"]').should('have.length.at.most', 10)
    cy.get('[data-test="execution-time"]').should('be.visible')
  })

  it('shows error for invalid query syntax', () => {
    cy.executeExplorerQuery('SELEC * FRM events')

    cy.get('[data-test="query-error"]').should('be.visible')
    cy.get('[data-test="query-error"]').should('contain', 'syntax')
  })

  it('prevents dangerous queries on client side', () => {
    cy.get('[data-test="query-editor"]').type('DROP TABLE events')
    cy.get('[data-test="execute-button"]').click()

    cy.get('[data-test="validation-error"]').should('be.visible')
    cy.get('[data-test="validation-error"]').should('contain', 'disallowed')
  })

  it('exports results to CSV', () => {
    cy.executeExplorerQuery('SELECT * FROM events LIMIT 5')

    cy.get('[data-test="export-csv"]').click()
    cy.readFile('cypress/downloads/explorer-export.csv').should('exist')
  })

  it('preserves query history', () => {
    cy.executeExplorerQuery('SELECT count() FROM events')
    cy.executeExplorerQuery('SELECT * FROM events LIMIT 1')

    cy.get('[data-test="query-history"]').click()
    cy.get('[data-test="history-item"]').should('have.length', 2)
  })
})
```

### Dashboard E2E Tests (batch_01)

```typescript
// cypress/e2e/batch_01/dashboard-overview.cy.ts
describe('Dashboard - Overview', () => {
  beforeEach(() => {
    cy.login()
    cy.selectOrganisation()
    cy.visit('/dashboard')
  })

  it('displays threat summary widgets', () => {
    cy.get('[data-test="widget-total-events"]').should('be.visible')
    cy.get('[data-test="widget-critical-count"]').should('be.visible')
    cy.get('[data-test="widget-technique-coverage"]').should('be.visible')
  })

  it('loads the technique heatmap', () => {
    cy.get('[data-test="technique-heatmap"]').should('be.visible')
    cy.get('[data-test="technique-cell"]').should('have.length.at.least', 1)
  })

  it('filters dashboard by time range', () => {
    cy.get('[data-test="time-range-selector"]').click()
    cy.get('[data-test="range-option-24h"]').click()

    // Widgets should reload
    cy.get('[data-test="widget-loading"]').should('not.exist')
    cy.get('[data-test="widget-total-events"]').should('be.visible')
  })

  it('navigates to event details from dashboard', () => {
    cy.get('[data-test="recent-events"] [data-test="event-item"]').first().click()
    cy.url().should('match', /\/events\/[a-z0-9-]+/)
  })
})
```

### Investigation E2E Tests (batch_02)

```typescript
// cypress/e2e/batch_02/case-creation.cy.ts
describe('Investigation - Case Creation', () => {
  beforeEach(() => {
    cy.login()
    cy.selectOrganisation()
    cy.visit('/cases')
  })

  it('creates a new security case', () => {
    cy.get('[data-test="create-case-button"]').click()

    cy.get('[data-test="case-name"]').type('Suspicious PowerShell Activity')
    cy.get('[data-test="case-severity"]').select('8')
    cy.get('[data-test="case-description"]').type('Multiple PowerShell executions detected')
    cy.get('[data-test="technique"]').type('RULE-101')
    cy.get('[data-test="submit-case"]').click()

    cy.url().should('match', /\/cases\/[a-z0-9-]+/)
    cy.get('[data-test="case-title"]').should('contain', 'Suspicious PowerShell Activity')
  })

  it('validates required fields', () => {
    cy.get('[data-test="create-case-button"]').click()
    cy.get('[data-test="submit-case"]').click()

    cy.get('[data-test="error-case-name"]').should('be.visible')
    cy.get('[data-test="error-case-severity"]').should('be.visible')
  })
})
```

## Running Tests

```bash
# Unit tests
npm run test:unit                           # Run all unit tests
npm run test:unit -- --watch               # Watch mode for development
npm run test:unit -- --coverage            # Generate coverage report

# E2E tests by batch
npm run test:cypress-run-batch batch_00    # Explorer
npm run test:cypress-run-batch batch_01    # Dashboards
npm run test:cypress-run-batch batch_02    # Investigation
npm run test:cypress-run-batch batch_03    # Settings
npm run test:cypress-run-batch batch_04    # Alerts

# E2E interactive mode (for debugging)
npm run test:cypress-open

# All tests
npm run test                                # Unit + E2E
```

## Agent Support

- **e2e-runner** -- Cypress E2E testing specialist for writing and debugging full user-flow tests
- **tdd-guide** -- Test-driven development guidance for composables and components

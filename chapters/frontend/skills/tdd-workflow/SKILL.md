---
name: tdd-workflow
description: Test-driven development for Vue 3 / Nuxt 3 / TypeScript — Vitest for unit tests, Cypress for E2E. No Python, no C++.
---

# TDD Workflow — Frontend Chapter (Vue 3 / Nuxt 3 / TypeScript)

Test-driven development for the platform frontend. Unit tests with Vitest, component tests with Vue Test Utils, E2E with Cypress. No Python, no C++.

---

## The TDD Loop

```
Write failing test → implement minimum code → pass → refactor → repeat
```

Never write implementation before a test exists for it. Never skip the red phase.

---

## Tool Stack

| Layer | Tool |
|-------|------|
| Unit / component | Vitest + Vue Test Utils |
| E2E | Cypress |
| Type checking | vue-tsc |
| Linting | ESLint (eslint-plugin-vue) |
| Formatting | Prettier |

---

## Unit Tests with Vitest

### File placement
```
src/
  components/ThreatCard.vue
  components/__tests__/ThreatCard.test.ts   ← colocated
  composables/useThreatData.ts
  composables/__tests__/useThreatData.test.ts
```

### Component test structure (Vue Test Utils)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ThreatCard from '../ThreatCard.vue'

describe('ThreatCard', () => {
  const defaultProps = {
    threat: { id: '1', severity: 'high', title: 'Port scan detected' }
  }

  it('renders threat title', () => {
    const wrapper = mount(ThreatCard, { props: defaultProps })
    expect(wrapper.text()).toContain('Port scan detected')
  })

  it('applies high-severity class when severity is high', () => {
    const wrapper = mount(ThreatCard, { props: defaultProps })
    expect(wrapper.classes()).toContain('threat-card--high')
  })

  it('emits dismiss event with threat id on button click', async () => {
    const wrapper = mount(ThreatCard, { props: defaultProps })
    await wrapper.find('[data-cy=dismiss]').trigger('click')
    expect(wrapper.emitted('dismiss')?.[0]).toEqual(['1'])
  })
})
```

### Composable test structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useThreatData } from '../useThreatData'

vi.mock('~/lib/app-api', () => ({
  fetchThreats: vi.fn()
}))

describe('useThreatData', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty array before fetch', () => {
    const { threats } = useThreatData()
    expect(threats.value).toEqual([])
  })

  it('populates threats after successful fetch', async () => {
    const { fetchThreats } = await import('~/lib/app-api')
    vi.mocked(fetchThreats).mockResolvedValue([{ id: '1' }])

    const { threats, load } = useThreatData()
    await load()
    expect(threats.value).toHaveLength(1)
  })
})
```

### Pinia store tests

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useThreatStore } from '../threatStore'

describe('threatStore', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('adds threat to active list', () => {
    const store = useThreatStore()
    store.addThreat({ id: '1', severity: 'high' })
    expect(store.activeThreats).toHaveLength(1)
  })
})
```

---

## Running Unit Tests

```bash
npm run test:unit              # watch mode
npm run test:unit -- --run    # single pass (CI)
npm run test:unit -- --coverage  # with coverage report
```

Target: **85% line coverage** on composables and stores. Components: cover all props, emits, and slots.

---

## E2E Tests with Cypress

### File placement
```
cypress/
  e2e/
    threat-dashboard.cy.ts
    explorer.cy.ts
    case-management.cy.ts
  support/
    commands.ts    ← custom commands
    e2e.ts
```

### Anatomy of a Cypress test

```typescript
describe('Threat Dashboard', () => {
  beforeEach(() => {
    cy.login()           // custom command — sets auth token
    cy.visit('/threats')
  })

  it('displays threats from API', () => {
    cy.intercept('GET', '/api/v1/threats*', { fixture: 'threats.json' }).as('getThreats')
    cy.wait('@getThreats')
    cy.get('[data-cy=threat-card]').should('have.length.greaterThan', 0)
  })

  it('filters by severity', () => {
    cy.get('[data-cy=severity-filter]').select('high')
    cy.get('[data-cy=threat-card]').each(card => {
      cy.wrap(card).find('[data-cy=severity-badge]').should('have.text', 'HIGH')
    })
  })
})
```

### data-cy attributes are mandatory

Every interactive element tested by Cypress must have `data-cy` — never use CSS classes or text as selectors in E2E tests. They break on style changes.

### Custom commands (`cypress/support/commands.ts`)

```typescript
Cypress.Commands.add('login', () => {
  cy.request('POST', '/api/auth/login', {
    email: Cypress.env('TEST_USER'),
    password: Cypress.env('TEST_PASS')
  }).then(({ body }) => {
    window.localStorage.setItem('auth_token', body.token)
  })
})
```

### Running E2E tests

```bash
npm run test:cypress-open     # interactive (development)
npm run test:cypress-run      # headless (CI)
```

---

## TypeScript Discipline in Tests

Always type props, emits, and API responses explicitly — do not use `any`.

```typescript
// ✓
const wrapper = mount(ThreatCard, {
  props: { threat: { id: '1', severity: 'high' as const, title: 'Test' } }
})

// ✗
const wrapper = mount(ThreatCard, { props: { threat: {} as any } })
```

Run `vue-tsc --noEmit` before committing. Tests that pass Vitest but fail vue-tsc are not done.

---

## Mocking the App API

Use `cy.intercept()` in Cypress. Use `vi.mock('~/lib/app-api')` in Vitest. Never hit a real API in unit or E2E tests — use fixtures.

```
cypress/fixtures/
  threats.json
  cases.json
  devices.json
```

---

## Coverage Requirements

| Area | Target |
|------|--------|
| Composables | 90% |
| Pinia stores | 90% |
| Vue components (logic) | 80% |
| Utility functions | 95% |
| E2E golden paths | 100% of user-facing flows |

Check coverage: `npm run test:unit -- --coverage --run`

---

## TDD Sequence for a New Component

1. Write the component interface (props, emits) in a `.test.ts` file — red
2. Create the `.vue` stub that satisfies the interface — green
3. Add behaviour tests one at a time — red → green each
4. Add the Cypress E2E test for the user journey — red
5. Implement the real behaviour — green
6. Run `vue-tsc --noEmit` and `npm run lint` — both must pass before PR

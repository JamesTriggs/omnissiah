---
description: Generate and run end-to-end tests with Cypress or Playwright. Creates test journeys for dashboards, query editors, list/detail views, and multi-step workflows.
---

# E2E Command

This command generates, maintains, and executes end-to-end tests for the application UI.

**Tool selection:**
- Established suites and most apps → **Cypress**
- SSR-heavy or standalone Nuxt apps → **Playwright**

## The Rule

**A UI feature is not done until E2E tests pass against the deployed application.**

This is non-negotiable. Build passing != feature working. SSR issues, component naming, broken imports, and hydration failures are invisible to the build but obvious in a browser.

## What This Command Does

1. **Select the right tool** — Cypress for established suites, Playwright for SSR/standalone apps
2. **Generate test journeys** — Create tests for the user flows being built
3. **Run tests against a deployed environment** — Not local, not mocked, the real deployed URL
4. **Read screenshots on failure** — The screenshot tells you what the browser actually sees
5. **Fix root causes** — Not just make tests pass, fix why the UI was broken
6. **Capture artifacts** — Screenshots, traces on failures

## When to Use

Use `/e2e` when:
- A UI feature is being marked as complete
- Testing critical user journeys (dashboard, query editor, lists, detail views)
- Verifying multi-step workflows work end-to-end
- Preparing for production deployment
- Adding coverage for new features

## How It Works

The E2E workflow will:

1. **Analyze user flow** and identify test scenarios
2. **Generate the test** using custom commands and page objects
3. **Run tests** in headless Chrome (CI) or interactive mode (dev)
4. **Capture failures** with screenshots and video recordings
5. **Generate report** with results and artifacts
6. **Identify flaky tests** and recommend fixes

## Test Batch Organization

E2E tests are organized into batches for parallel CI execution:

| Batch | Area | Command |
|-------|------|---------|
| `batch_00` | Query editor | `npm run test:e2e -- --batch batch_00` |
| `batch_01` | Dashboards & overview | `npm run test:e2e -- --batch batch_01` |
| `batch_02` | Lists & detail views | `npm run test:e2e -- --batch batch_02` |
| `batch_03` | Rules | `npm run test:e2e -- --batch batch_03` |
| `batch_04` | Settings & config | `npm run test:e2e -- --batch batch_04` |

---

## Example: Dashboard E2E Test

```
User: /e2e Test the dashboard overview and record drill-down

Agent:
# E2E Test Generation: Dashboard Overview

## Test Scenario Identified

**User Journey:** View Dashboard -> Filter by Severity -> Drill into Record -> View Record Details

**Test Coverage:**
1. Navigate to dashboard
2. Verify dashboard widgets render with data
3. Apply severity filter
4. Click on a record row
5. Verify record detail panel opens
6. Verify category mapping displays

## Generated Test Code

```typescript
// cypress/e2e/dashboard/overview.cy.ts
describe('Dashboard Overview', () => {
  beforeEach(() => {
    cy.login('user@example.test', 'test-password')
    cy.visit('/dashboard')
    cy.waitForApi('/api/v1/dashboard/summary')
  })

  it('displays summary widgets with data', () => {
    // Verify main dashboard widgets
    cy.getByTestId('widget-critical').should('be.visible')
    cy.getByTestId('widget-total-records').should('be.visible')
    cy.getByTestId('widget-active-items').should('be.visible')

    // Verify widgets contain numeric values
    cy.getByTestId('widget-critical')
      .find('.widget-value')
      .invoke('text')
      .should('match', /^\d+$/)

    cy.screenshot('dashboard-loaded')
  })

  it('filters records by severity level', () => {
    // Open severity filter
    cy.getByTestId('severity-filter').click()
    cy.getByTestId('severity-option-critical').click()

    // Wait for filtered API response
    cy.waitForApi('/api/v1/records?severity=critical')

    // Verify table shows only critical records
    cy.getByTestId('records-table')
      .find('tbody tr')
      .should('have.length.greaterThan', 0)

    cy.getByTestId('records-table')
      .find('[data-severity]')
      .each(($el) => {
        expect($el.attr('data-severity')).to.equal('critical')
      })

    cy.screenshot('filtered-critical-records')
  })

  it('drills into record details from table row', () => {
    // Click first record row
    cy.getByTestId('records-table')
      .find('tbody tr')
      .first()
      .click()

    // Verify detail panel opens
    cy.getByTestId('record-detail-panel').should('be.visible')

    // Verify key fields are displayed
    cy.getByTestId('record-source').should('be.visible')
    cy.getByTestId('record-destination').should('be.visible')
    cy.getByTestId('record-timestamp').should('be.visible')
    cy.getByTestId('record-category').should('be.visible')

    cy.screenshot('record-detail-panel')
  })

  it('navigates to a work item from record detail', () => {
    cy.getByTestId('records-table')
      .find('tbody tr')
      .first()
      .click()

    cy.getByTestId('record-detail-panel')
      .find('[data-action="open-item"]')
      .click()

    // Should navigate to the item page
    cy.url().should('contain', '/items/')
    cy.getByTestId('item-timeline').should('be.visible')
  })
})
```

---

## Example: Query Editor E2E Test (Monaco Editor)

```
User: /e2e Test the query editor and results flow

Agent:
# E2E Test Generation: Query Flow

## Generated Test Code

```typescript
// cypress/e2e/query/query-execution.cy.ts
describe('Query Execution', () => {
  beforeEach(() => {
    cy.login('user@example.test', 'test-password')
    cy.visit('/query')
    cy.waitForApi('/api/v1/query/stock-queries')
  })

  it('loads the query editor with Monaco ready', () => {
    // Verify Monaco editor container is visible
    cy.getByTestId('query-editor')
      .should('be.visible')

    // Verify Monaco editor has initialized (check for monaco-specific class)
    cy.get('.monaco-editor').should('exist')

    // Verify stock queries sidebar
    cy.getByTestId('stock-queries-panel').should('be.visible')
    cy.getByTestId('stock-query-item').should('have.length.greaterThan', 0)

    cy.screenshot('query-editor-loaded')
  })

  it('executes a stock query and displays results', () => {
    // Select a stock query from the sidebar
    cy.getByTestId('stock-query-item')
      .contains('Recent Errors')
      .click()

    // Verify query is loaded into Monaco editor
    cy.get('.monaco-editor .view-lines')
      .should('contain.text', 'SELECT')

    // Set time range
    cy.getByTestId('time-range-picker').click()
    cy.getByTestId('time-range-option-24h').click()

    // Execute query
    cy.getByTestId('execute-query-btn').click()

    // Wait for query results
    cy.waitForApi('/api/v1/query/execute', { timeout: 30000 })

    // Verify results table appears
    cy.getByTestId('query-results-table').should('be.visible')
    cy.getByTestId('query-results-table')
      .find('thead th')
      .should('have.length.greaterThan', 0)

    // Verify result count is displayed
    cy.getByTestId('result-count')
      .should('be.visible')
      .and('not.contain', '0 results')

    cy.screenshot('query-results')
  })

  it('types a custom query in Monaco editor and executes', () => {
    // Use the Monaco editor instance if exposed
    cy.window().then((win) => {
      const editor = (win as any).__MONACO_EDITOR__
      if (editor) {
        editor.setValue(
          "SELECT source, count() as cnt\nFROM events\nWHERE event_type = 'error'\nGROUP BY source\nORDER BY cnt DESC\nLIMIT 10"
        )
      }
    })

    // Execute
    cy.getByTestId('execute-query-btn').click()
    cy.waitForApi('/api/v1/query/execute', { timeout: 30000 })

    // Verify results
    cy.getByTestId('query-results-table').should('be.visible')
    cy.getByTestId('query-results-table')
      .find('thead th')
      .should('contain', 'source')
      .and('contain', 'cnt')
  })

  it('shows query syntax error feedback', () => {
    cy.window().then((win) => {
      const editor = (win as any).__MONACO_EDITOR__
      if (editor) {
        editor.setValue('SELCT invalid syntax here')
      }
    })

    cy.getByTestId('execute-query-btn').click()

    // Verify error message is shown
    cy.getByTestId('query-error-panel')
      .should('be.visible')
      .and('contain.text', 'Syntax error')

    cy.screenshot('query-syntax-error')
  })

  it('saves and loads a custom query', () => {
    // Type a query
    cy.window().then((win) => {
      const editor = (win as any).__MONACO_EDITOR__
      if (editor) {
        editor.setValue("SELECT * FROM events LIMIT 5")
      }
    })

    // Save query
    cy.getByTestId('save-query-btn').click()
    cy.getByTestId('save-query-name').type('My Test Query')
    cy.getByTestId('save-query-confirm').click()

    // Verify saved in sidebar
    cy.getByTestId('saved-queries-tab').click()
    cy.getByTestId('saved-query-item')
      .contains('My Test Query')
      .should('be.visible')

    // Load saved query
    cy.getByTestId('saved-query-item')
      .contains('My Test Query')
      .click()

    cy.get('.monaco-editor .view-lines')
      .should('contain.text', 'SELECT')
  })
})
```

---

## Example: Rule Management E2E Test

```
User: /e2e Test rule creation and management

Agent:
# E2E Test Generation: Rule Management

## Generated Test Code

```typescript
// cypress/e2e/rules/rule-management.cy.ts
describe('Rule Management', () => {
  beforeEach(() => {
    cy.login('admin@example.test', 'test-password')
    cy.visit('/rules')
    cy.waitForApi('/api/v1/rules')
  })

  it('displays the rules list with categories', () => {
    cy.getByTestId('rules-table').should('be.visible')
    cy.getByTestId('rules-table')
      .find('tbody tr')
      .should('have.length.greaterThan', 0)

    // Verify category column
    cy.getByTestId('rules-table')
      .find('[data-column="category"]')
      .first()
      .should('not.be.empty')

    cy.screenshot('rules-list')
  })

  it('creates a new rule', () => {
    cy.getByTestId('create-rule-btn').click()

    // Fill in rule details
    cy.getByTestId('rule-name-input').type('Test Repeated Failure Rule')
    cy.getByTestId('rule-description-input').type(
      'Detects multiple failed attempts from a single source'
    )

    // Select severity
    cy.getByTestId('rule-severity-select').click()
    cy.getByTestId('severity-option-high').click()

    // Select category
    cy.getByTestId('category-select').click()
    cy.getByTestId('category-search-input').type('access')
    cy.getByTestId('category-option-access').click()

    // Define rule logic (query or condition builder)
    cy.getByTestId('rule-logic-tab-query').click()
    cy.window().then((win) => {
      const editor = (win as any).__RULE_EDITOR__
      if (editor) {
        editor.setValue(
          "SELECT source, count() as attempts\nFROM events\nWHERE event_type = 'failed'\nGROUP BY source\nHAVING attempts > 10"
        )
      }
    })

    // Set threshold
    cy.getByTestId('rule-threshold-input').clear().type('10')
    cy.getByTestId('rule-window-select').click()
    cy.getByTestId('window-option-5m').click()

    // Save rule
    cy.getByTestId('save-rule-btn').click()
    cy.waitForApi('/api/v1/rules', { method: 'POST' })

    // Verify success notification
    cy.getByTestId('notification-success')
      .should('be.visible')
      .and('contain.text', 'Rule created')

    // Verify rule appears in list
    cy.visit('/rules')
    cy.getByTestId('rules-table')
      .should('contain.text', 'Test Repeated Failure Rule')

    cy.screenshot('rule-created')
  })

  it('enables and disables a rule', () => {
    cy.getByTestId('rules-table')
      .find('tbody tr')
      .first()
      .within(() => {
        // Toggle rule status
        cy.getByTestId('rule-toggle').click()
      })

    cy.waitForApi('/api/v1/rules/*', { method: 'PATCH' })

    // Verify status changed
    cy.getByTestId('notification-success').should('be.visible')
  })

  it('filters rules by category', () => {
    cy.getByTestId('category-filter').click()
    cy.getByTestId('category-option-access').click()

    cy.waitForApi('/api/v1/rules?category=access')

    cy.getByTestId('rules-table')
      .find('tbody tr')
      .each(($row) => {
        cy.wrap($row)
          .find('[data-column="category"]')
          .should('contain.text', 'Access')
      })
  })
})
```

---

## Example: Multi-Step Workflow E2E Test

```
User: /e2e Test the workflow from record to work item

Agent:
# E2E Test Generation: Record-to-Item Workflow

## Generated Test Code

```typescript
// cypress/e2e/items/record-to-item.cy.ts
describe('Workflow: Record to Item', () => {
  beforeEach(() => {
    cy.login('user@example.test', 'test-password')
  })

  it('creates a work item from a record', () => {
    // Start from dashboard
    cy.visit('/dashboard')
    cy.waitForApi('/api/v1/dashboard/summary')

    // Click on a critical record
    cy.getByTestId('records-table')
      .find('[data-severity="critical"]')
      .first()
      .click()

    // Start an item
    cy.getByTestId('record-detail-panel')
      .find('[data-action="open-item"]')
      .click()

    // Verify item page loads
    cy.url().should('contain', '/items/')
    cy.getByTestId('item-timeline').should('be.visible')

    // Verify record is added to the item timeline
    cy.getByTestId('timeline-entry')
      .should('have.length.greaterThan', 0)

    cy.screenshot('item-created')
  })

  it('adds related records to an item', () => {
    cy.visit('/items')
    cy.waitForApi('/api/v1/items')

    // Open first item
    cy.getByTestId('item-row').first().click()
    cy.waitForApi('/api/v1/items/*')

    // Search for related records
    cy.getByTestId('add-link-btn').click()
    cy.getByTestId('link-search-input').type('10.0.1.50')
    cy.waitForApi('/api/v1/records/search')

    // Select related records
    cy.getByTestId('link-search-result')
      .first()
      .find('input[type="checkbox"]')
      .check()

    cy.getByTestId('add-selected-links-btn').click()
    cy.waitForApi('/api/v1/items/*/links', { method: 'POST' })

    // Verify timeline updated
    cy.getByTestId('timeline-entry')
      .should('have.length.greaterThan', 1)

    cy.screenshot('links-added')
  })

  it('escalates an item to a record', () => {
    cy.visit('/items')
    cy.getByTestId('item-row').first().click()
    cy.waitForApi('/api/v1/items/*')

    // Escalate
    cy.getByTestId('escalate-btn').click()

    // Fill in details
    cy.getByTestId('title-input').type('Follow-up - 10.0.1.50')
    cy.getByTestId('priority-select').click()
    cy.getByTestId('priority-option-high').click()
    cy.getByTestId('assignee-select').click()
    cy.getByTestId('assignee-option').first().click()

    // Confirm escalation
    cy.getByTestId('confirm-escalate-btn').click()
    cy.waitForApi('/api/v1/records', { method: 'POST' })

    // Verify redirect
    cy.url().should('contain', '/records/')
    cy.getByTestId('status-badge')
      .should('contain.text', 'Open')

    // Verify links are carried over
    cy.getByTestId('links-tab').click()
    cy.getByTestId('link-item')
      .should('have.length.greaterThan', 0)

    cy.screenshot('record-created-from-item')
  })

  it('adds notes to an item', () => {
    cy.visit('/items')
    cy.getByTestId('item-row').first().click()

    // Add a note
    cy.getByTestId('add-note-btn').click()
    cy.getByTestId('note-editor')
      .type('Initial analysis indicates a recurring pattern. Source 10.0.1.50 repeats every 60 seconds.')

    cy.getByTestId('save-note-btn').click()
    cy.waitForApi('/api/v1/items/*/notes', { method: 'POST' })

    // Verify note appears in timeline
    cy.getByTestId('timeline-entry')
      .last()
      .should('contain.text', 'recurring pattern')
  })
})
```

---

## Running Tests

```bash
# Run specific test file
npx cypress run --spec cypress/e2e/dashboard/overview.cy.ts

# Run a test batch (CI mode)
npm run test:e2e -- --batch batch_00   # Query editor tests
npm run test:e2e -- --batch batch_01   # Dashboard tests
npm run test:e2e -- --batch batch_02   # List/detail tests
npm run test:e2e -- --batch batch_03   # Rule tests

# Interactive mode (development)
npx cypress open

# Run all E2E tests
npx cypress run

# Run with specific browser
npx cypress run --browser chrome
npx cypress run --browser firefox

# Run with video recording
npx cypress run --config video=true
```

## Test Report

```
E2E Test Results

Status:     ALL TESTS PASSED
Total:      18 tests across 4 spec files
Passed:     18 (100%)
Failed:     0
Flaky:      0
Duration:   45.2s

Artifacts:
  Screenshots: 12 files (cypress/screenshots/)
  Videos: 0 files (only on failure)

Batches:
  batch_00 (Query editor):  5/5 passed
  batch_01 (Dashboards):    4/4 passed
  batch_02 (Lists/detail):  5/5 passed
  batch_03 (Rules):         4/4 passed
```

## Test Artifacts

When tests run, the following artifacts are captured:

**On All Tests:**
- Screenshots taken at key checkpoints via `cy.screenshot()`
- Mochawesome HTML report for results visualization

**On Failure Only:**
- Screenshot of the failing state (automatic)
- Video recording of the full test run
- Console and network logs

## Viewing Artifacts

```bash
# Screenshots are saved in cypress/screenshots/
open cypress/screenshots/

# Videos are saved in cypress/videos/
open cypress/videos/

# View Mochawesome report
open cypress/reports/mochawesome.html
```

## Flaky Test Detection

If a test fails intermittently:

```
FLAKY TEST DETECTED: cypress/e2e/query/query-execution.cy.ts

Test passed 7/10 runs (70% pass rate)

Common failure:
"Timed out retrying: expected '[data-testid=query-results-table]' to be visible"

Recommended fixes:
1. Add explicit wait: cy.waitForApi('/api/v1/query/execute', { timeout: 30000 })
2. Increase default command timeout in cypress.config.ts
3. Check for race conditions in API response handling
4. Verify the query isn't timing out under load

Quarantine recommendation: Mark with it.skip() until root cause is fixed
```

## Custom Cypress Commands

The following custom commands are available:

```typescript
// cypress/support/commands.ts

// Login with session caching
cy.login(email: string, password: string)

// Wait for specific API call to complete
cy.waitForApi(urlPattern: string, options?: { method?: string, timeout?: number })

// Get element by data-testid attribute
cy.getByTestId(testId: string)

// Interact with Monaco editor instances
cy.setMonacoValue(selector: string, value: string)

// Wait for a long-running query to complete (longer timeout)
cy.waitForQuery(timeout?: number)
```

## Critical Flows

**CRITICAL (Must Always Pass):**
1. User can log in and reach the dashboard
2. Dashboard displays data
3. Query editor loads and executes stock queries
4. Rules can be viewed and toggled
5. Work item can be created from a record
6. Record can be created from a work item
7. Detail panel shows complete information

**IMPORTANT:**
1. Custom query execution
2. Rule creation with category mapping
3. Item link management
4. Dashboard filtering and drill-down
5. Time range selection affects all views
6. Export functionality (CSV, PDF)
7. Role-based access restrictions

## Best Practices

**DO:**
- Use `data-testid` attributes for all interactive elements
- Use `cy.waitForApi()` instead of arbitrary `cy.wait()` calls
- Use `cy.login()` with session caching to speed up tests
- Test critical user journeys end-to-end
- Run tests before merging to main
- Review screenshots when tests fail
- Use Page Object pattern for complex pages

**DON'T:**
- Use brittle CSS class selectors (classes change with styling)
- Test implementation details (test user behavior)
- Run E2E tests against production
- Ignore flaky tests (fix root cause)
- Skip artifact review on failures
- Test every edge case with E2E (use unit tests for those)
- Hardcode test data that depends on database state

## Important Notes

**CRITICAL:**
- E2E tests must use a dedicated test environment, never production
- Queries in tests should use time-bounded data to ensure consistent results
- Tests that create rules should clean up created rules in `afterEach`
- Authentication tokens in tests must use test-only credentials
- Never expose real customer data in test fixtures

## CI/CD Integration

```yaml
# ci-pipeline.yml
- stage: E2E
  jobs:
    - job: E2ETests
      pool:
        vmImage: 'ubuntu-latest'
      strategy:
        matrix:
          batch_00:
            BATCH: batch_00
          batch_01:
            BATCH: batch_01
          batch_02:
            BATCH: batch_02
          batch_03:
            BATCH: batch_03
      steps:
        - script: npm ci
        - script: npm run test:e2e -- --batch $(BATCH)
        - task: PublishTestResults@2
          inputs:
            testResultsFiles: 'cypress/results/*.xml'
          condition: always()
        - publish: cypress/screenshots
          artifact: e2e-screenshots-$(BATCH)
          condition: failed()
```

## Integration with Other Commands

- Use `/plan` to identify critical journeys to test
- Use `/tdd` for unit tests (faster, more granular)
- Use `/e2e` for integration and user journey tests
- Use `/verify` for full pre-merge verification
- Use `/test-coverage` to check if E2E covers critical paths

---

## Playwright (SSR & Standalone Nuxt Apps)

For SSR-heavy apps and standalone Nuxt 3 apps, use **Playwright** instead of Cypress.

### Why Playwright for SSR Apps

Nuxt 3 SSR introduces a class of bugs invisible to the build:
- Component naming (subdirectory prefix) renders components as unknown HTML elements
- SSR execution of client-only libraries (Tiptap, Monaco) produces empty shells
- Broken module imports can silently produce empty renders

These only show up in a real browser. Playwright runs against the deployed URL and reads what's actually there.

### Running Playwright Tests

```bash
cd path/to/your-app

# Against a deployed environment (default)
BASE_URL=https://app.example.internal npx playwright test --reporter=list

# Against local dev server
BASE_URL=http://localhost:3000 npx playwright test --reporter=list

# Headed (watch the browser)
npx playwright test --headed

# Single test file
npx playwright test tests/editor.spec.ts --reporter=list

# Diagnostic — when something's broken, run this first
npx playwright test tests/diagnose-editor.spec.ts --reporter=list
```

### Reading Failures

On failure, Playwright saves screenshots to `test-results/`. Always read the screenshot:

```bash
# Screenshots are PNG — read them with the Read tool
# test-results/<test-name>/test-failed-1.png
```

The screenshot tells you what the browser actually rendered. Compare against what you expected. Common patterns:

| Screenshot shows | Root cause |
|-----------------|-----------|
| Raw lowercase tag `<wikieditor>` | Component in subdirectory, named wrong |
| Empty white/dark area | SSR crash, component never mounted |
| Loading spinner stuck | API call failing or timing out |
| Auth gate instead of feature | Cookie not set in test |

### Playwright Checklist

When adding a new UI feature in an SSR app:

- [ ] Write a Playwright test that verifies the key interaction (TDD — write test first)
- [ ] Build: `npm run build` — must pass
- [ ] Deploy to server
- [ ] Run: `BASE_URL=https://app.example.internal npx playwright test --reporter=list`
- [ ] All tests pass — only then mark the feature as done
- [ ] Commit the test file alongside the feature code

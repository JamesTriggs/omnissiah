---
description: Restate requirements, assess risks, and create step-by-step implementation plan. WAIT for user CONFIRM before touching any code.
---

# Plan Command

This command creates a comprehensive implementation plan before writing any code, tailored to polyglot architectures spanning backend, frontend, native, and shared-schema layers.

## What This Command Does

1. **Restate Requirements** - Clarify what needs to be built
2. **Identify Risks** - Surface potential issues and blockers
3. **Create Step Plan** - Break down implementation into phases
4. **Wait for Confirmation** - MUST receive user approval before proceeding

## When to Use

Use `/plan` when:
- Starting a new feature across any service
- Making significant architectural changes
- Working on complex refactoring
- Multiple files/components/services will be affected
- Requirements are unclear or ambiguous
- Cross-service changes (e.g., new schema message + API endpoint + UI component)
- Adding new business logic
- Database schema changes (analytical or relational)
- Query-layer migration work

## How It Works

The planner will:

1. **Analyze the request** and restate requirements in clear terms
2. **Identify affected services** across the stack (Python, C++, Vue, shared schemas)
3. **Break down into phases** with specific, actionable steps
4. **Identify dependencies** between components and services
5. **Assess risks** and potential blockers
6. **Estimate complexity** (High/Medium/Low)
7. **Present the plan** and WAIT for your explicit confirmation

## Example Usage

```
User: /plan I need to add an event tagging feature so users can label records and filter by tag

Agent (planner):
# Implementation Plan: Record Tagging

## Requirements Restatement
- Allow users to attach one or more tags to a record
- Support filtering the record list by tag
- Tags are scoped per account and reusable across records
- Display tags in the record detail view and the list view

## Affected Services
- **shared-schemas**: New message/field for tags on a record
- **data-loader**: May need a new column or index for tag lookup
- **api-service**: New endpoints for tag CRUD and tag filtering
- **ui**: Tag editor component, tag filter control

## Implementation Phases

### Phase 1: Data Model (shared-schemas)
- Add `Tag` message and a repeated `tags` field to the record schema
- Generate bindings for Python and C++
- Estimated: 1-2 hours

### Phase 2: Database Schema
- Create a `tags` table and a `record_tags` join table
- Add an index on (account_id, tag) for filtering
- Create an Alembic migration for the relational tables
- Estimated: 2-3 hours

### Phase 3: Service Logic (api-service)
- Create a `TagService` class in `src/app/tags/`
- Implement tag attach/detach and tag-filtered queries
- Add a background task for tag usage counts
- Estimated: 4-6 hours

### Phase 4: API Endpoints (api-service)
- Add `/api/v1/records/{id}/tags` endpoints (attach, detach, list)
- Add a `?tag=` filter to `/api/v1/records`
- Add request/response models
- Estimated: 2-3 hours

### Phase 5: Frontend (ui)
- Add a tag editor component on the record detail view
- Add a tag filter control to the list view
- Estimated: 4-5 hours

### Phase 6: Testing
- Unit tests for tag service (pytest)
- Integration tests for API endpoints
- Component tests for Vue components
- End-to-end test for the tag-and-filter flow
- Estimated: 3-4 hours

## Dependencies
- Phase 1 must complete before Phases 2, 3, 4, 5
- Phase 2 must complete before Phase 3
- Phase 3 must complete before Phase 4
- Phase 4 must complete before Phase 5
- Phase 6 runs alongside each phase (TDD)

## Risks
- HIGH: tag-filter query performance with large datasets
- MEDIUM: migration ordering across services
- LOW: schema backward compatibility (new field, non-breaking)

## Estimated Complexity: HIGH
- Data Model: 1-2 hours
- Database: 2-3 hours
- Backend: 6-9 hours
- Frontend: 4-5 hours
- Testing: 3-4 hours
- Total: 16-23 hours

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
```

## Important Notes

**CRITICAL**: The planner will **NOT** write any code until you explicitly confirm the plan with "yes" or "proceed" or similar affirmative response.

If you want changes, respond with:
- "modify: [your changes]"
- "different approach: [alternative]"
- "skip phase 2 and do phase 3 first"
- "reduce scope to just the backend"

## Plan Template Structure

Every plan should include:

1. **Requirements Restatement** - What exactly will be built
2. **Affected Services** - Which services are impacted
3. **Implementation Phases** - Ordered, actionable steps
4. **Dependencies** - What blocks what
5. **Risks** - Categorized as HIGH/MEDIUM/LOW
6. **Security Notes** - If applicable to security-sensitive features
7. **Complexity Estimate** - Time estimates per phase
8. **Confirmation Gate** - Always wait for user approval

## Planning Considerations

### Cross-Service Impact Analysis
When a change spans multiple services, the plan must address:
- Serialized-schema compatibility (backward/forward)
- API contract changes (versioning strategy)
- Database migration ordering (schema before API)
- Feature flag strategy for gradual rollout
- Deployment ordering across services

### Security Review Requirements
For security-related features, the plan must include:
- Threat model analysis
- Input validation strategy
- Audit logging requirements
- Access control requirements

### Performance Considerations
For data-intensive features, the plan must address:
- Query performance (explain plans)
- Data volume estimates
- Index strategy
- Materialized view vs. query-time computation
- Caching strategy

## Integration with Other Commands

After planning:
- Use `/tdd` to implement with test-driven development
- Use `/build-fix` if build errors occur during implementation
- Use `/verify` to validate each phase before moving to next
- Use `/python-review` to review Python implementation quality
- Use `/e2e` to create end-to-end tests for UI features
- Use `/test-coverage` to verify coverage meets thresholds
- Use `/update-codemaps` to update architecture docs after implementation

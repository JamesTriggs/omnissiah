---
description: Database migration workflow for relational schema changes (Alembic), analytical store schema changes, and serialized-schema evolution. Invokes the migrator agent to design safe, zero-downtime migrations.
---

# Migrate Command

Plan and execute database schema changes using the **migrator** agent — a specialist that ensures migrations are zero-downtime and backwards-compatible.

## Usage

```
/migrate [description of the schema change needed]
/migrate "add score column to records table"
/migrate "create new analytical table for events"
/migrate "add optional context field to the event schema"
/migrate "backfill assignee_id from assigned_user_id in records"
```

## When to Use

Use `/migrate` when:
- Adding or removing columns in relational tables
- Creating new relational tables
- Changing analytical-store table schemas (add columns, TTL, materialized views)
- Evolving a serialized message schema
- Backfilling data across large tables
- Planning a zero-downtime schema change for a production table
- Creating a new materialized view for aggregations
- Adding database indexes

## What This Command Does

The migrator agent:

1. **Analyses the change** — What needs to change, which database, how much data is affected
2. **Designs the safe migration strategy** — Zero-downtime approach, multi-step if needed
3. **Writes the migration file** — Alembic migration script, analytical-store SQL, or schema change
4. **Checks data-access scoping** — New tables/columns include scoping keys appropriately
5. **Writes tests** — Migration applies cleanly, rollback works, data integrity preserved
6. **Documents trade-offs** — Estimates table lock time for large ALTER TABLE operations

## Migration Safety Principles

The migrator agent enforces these safety rules automatically:

### Relational (Alembic)
- New columns must be nullable or have a safe default
- NOT NULL constraints added in a **second migration** after backfill
- Column removals require code to stop reading the column first
- Large-table indexes use online/non-locking algorithms where supported
- Backfills over 100K rows use batched updates or background tasks

### Analytical store
- New columns have DEFAULT values where the engine backfills automatically
- Large schema changes on big tables use CREATE + INSERT SELECT + swap
- TTL/retention changes applied with the engine's modify-TTL statement
- Materialized views populated only on non-production-scale data

### Serialized schemas (e.g. Protocol Buffers / Avro)
- Never reuse field numbers/IDs from removed fields
- Never change a field's wire type
- New fields are always optional
- Removed fields are reserved by both number and name

## Example Output

```
MIGRATION PLAN
══════════════
Change:    Add score (Float) to records table
Database:  Relational (api service)
Table:     records
Est. rows: 2.3M (prod)

STRATEGY: Two-step zero-downtime migration
  Step 1 (this PR): Add nullable column + index
  Step 2 (next PR): Add NOT NULL after backfill task

MIGRATION FILE: migrations/versions/abc123_add_score_to_records.py
  upgrade():   ADD COLUMN score FLOAT NULL
               CREATE INDEX ix_records_score ON records (account_id, score)
  downgrade(): DROP INDEX ix_records_score
               DROP COLUMN score

DATA SCOPING: ✓ Index includes the scope key as first column

TESTS:
  ✓ Migration applies on fresh DB
  ✓ Migration rolls back cleanly
  ✓ Full test suite passes
```

## Running Migrations

After the migration file is created:

```bash
# Review the generated migration
cat migrations/versions/<revision>_<name>.py

# Test locally
alembic upgrade head

# Verify rollback works
alembic downgrade -1
alembic upgrade head  # re-apply

# Run tests
<your unit test command> && <your integration test command>
```

## Multi-Step Migrations

For complex changes, `/migrate` produces a phased plan:

```
Phase 1 (Deploy first):
  - Add nullable column
  - Deploy code that writes to new column

Phase 2 (Run after Phase 1 is stable):
  - Backfill existing rows
  - Add NOT NULL constraint

Phase 3 (Cleanup after Phase 2):
  - Remove old column
  - Remove dual-write code
```

## Related Commands

- `/plan` — For broader feature planning before running `/migrate`
- `/verify` — Run verification after migration is applied
- `/code-review` — Review migration code before merging

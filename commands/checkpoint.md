---
description: Create and verify workflow checkpoints. Save named snapshots of progress for rollback and continuity across sessions.
---

# Checkpoint Command

Create or verify a checkpoint in your workflow.

## Usage

`/checkpoint [create|verify|list] [name]`

## Create Checkpoint

When creating a checkpoint:

1. Run `/verify quick` to ensure current state is clean
2. Create a git stash or commit with checkpoint name
3. Log checkpoint to `.claude/checkpoints.log`:

```bash
echo "$(date +%Y-%m-%d-%H:%M) | $CHECKPOINT_NAME | $(git rev-parse --short HEAD)" >> .claude/checkpoints.log
```

4. Report checkpoint created

## Verify Checkpoint

When verifying against a checkpoint:

1. Read checkpoint from log
2. Compare current state to checkpoint:
   - Files added since checkpoint
   - Files modified since checkpoint
   - Test pass rate now vs then
   - Coverage now vs then

3. Report:
```
CHECKPOINT COMPARISON: $NAME
============================
Files changed: X
Tests: +Y passed / -Z failed
Coverage: +X% / -Y%
Build: [PASS/FAIL]
```

## List Checkpoints

Show all checkpoints with:
- Name
- Timestamp
- Git SHA
- Status (current, behind, ahead)

## Workflow

Typical checkpoint flow:

```
[Start] --> /checkpoint create "feature-start"
   |
[Implement] --> /checkpoint create "core-done"
   |
[Test] --> /checkpoint verify "core-done"
   |
[Refactor] --> /checkpoint create "refactor-done"
   |
[PR] --> /checkpoint verify "feature-start"
```

## Rollback Using Auto-Stash Checkpoints

The `git-checkpoint` hook automatically creates a git stash snapshot before every destructive git operation (commit, reset, rebase, merge). These snapshots are stored in `~/.claude/checkpoints/`.

### View auto-stash history

```bash
cat ~/.claude/checkpoints/stash-history.log
```

Each line shows: `timestamp | stash-ref | before: <command>`

### Rollback to last auto-stash

```bash
# Read the last stash ref
STASH_REF=$(cat ~/.claude/checkpoints/last-stash-ref)

# Preview what would be restored
git stash show $STASH_REF

# Apply the stash (keeps the ref for safety)
git stash apply $STASH_REF
```

### Rollback to a specific checkpoint

```bash
# Find the ref from stash history
cat ~/.claude/checkpoints/stash-history.log

# Apply a specific ref
git stash apply <ref-from-history>
```

**Note:** Auto-stash uses `git stash create` which does not add to the normal stash list (`git stash list`). The refs are only stored in `~/.claude/checkpoints/stash-history.log`.

## Arguments

$ARGUMENTS:
- `create <name>` - Create named checkpoint
- `verify <name>` - Verify against named checkpoint
- `list` - Show all checkpoints
- `rollback` - Rollback to last auto-stash checkpoint
- `rollback-history` - Show auto-stash checkpoint history
- `clear` - Remove old checkpoints (keeps last 5)

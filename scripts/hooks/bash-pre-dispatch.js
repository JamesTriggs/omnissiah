/**
 * bash-pre-dispatch.js — Single dispatcher for all Bash PreToolUse checks.
 *
 * Checks (in order):
 *   1. Git push policy — BLOCKS push to main/master (any form: direct,
 *      refspec, HEAD:main, feature:main, force, delete, refs/heads/main,
 *      +main, bare `git push` while HEAD is on main/master). Force push
 *      to feature branches warns via stderr but allows.
 *
 * Dev-server (`npm run dev`, `uvicorn`, `flask run`, etc.) and install
 * commands (`npm install`, `pip install`, etc.) are intentionally NOT
 * blocked here — Claude runs them when the user approves. This matches
 * commits 747b636 / 83edc65 on main.
 *
 * Hook protocol (post-4312f0c):
 *   - Allow: exit 0, no stdout
 *   - Block: write reason to stderr, exit 2
 *
 * Input format: reads `tool_input.command` (new Claude Code shape) with
 * fallback to `command` (legacy), matching the rest of the Bash hooks.
 *
 * Known limitations: regex on the raw command string — `echo "git push origin main"`
 * in a heredoc is not blocked; commands obfuscated via `eval` are not caught.
 */

'use strict';

const { execSync } = require('child_process');

const PROTECTED_BRANCHES = new Set(['main', 'master']);

/**
 * Read the current git branch. Returns null if not in a git repo or git is unavailable.
 * Isolated so tests can inject a stub.
 *
 * Portability: no shell redirections in the command — `2>/dev/null` is Unix-only
 * and would break Windows. `stdio: ['ignore', 'pipe', 'ignore']` discards stderr
 * at the spawn level, which is cross-platform.
 */
function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Normalise a git refspec to its target branch name.
 *   refs/heads/foo → foo
 *   refs/remotes/origin/foo → foo
 *   +main → main (strip force-update marker)
 *   src:dst → dst (destination side of refspec)
 */
function normaliseTarget(refspec) {
  if (!refspec) return null;
  let target = refspec;
  if (target.includes(':')) {
    const parts = target.split(':');
    target = parts[parts.length - 1];
  }
  target = target.replace(/^\+/, '');
  target = target.replace(/^refs\/heads\//, '');
  target = target.replace(/^refs\/remotes\/[^/]+\//, '');
  return target || null;
}

/**
 * Check a `git push ...` command against the push policy.
 *
 * @param {string} cmd - the full shell command string
 * @param {{getBranch?: () => string | null}} [opts]
 * @returns {null | {decision: 'block'|'allow', reason?: string, warning?: string}}
 *   null if the command is not a git push — caller should continue other checks.
 */
function checkGitPush(cmd, opts = {}) {
  if (!/\bgit\s+push\b/.test(cmd)) return null;

  // Isolate the push portion: from `git push` up to next chain separator.
  const m = cmd.match(/git\s+push\b([^;&|]*)/);
  const argsStr = m && m[1] ? m[1].trim() : '';
  const tokens = argsStr.split(/\s+/).filter(Boolean);

  const flags = tokens.filter(t => t.startsWith('-'));
  const positional = tokens.filter(t => !t.startsWith('-'));

  const isForce = flags.some(f =>
    f === '-f' || f === '--force' || f === '--force-with-lease' || f.startsWith('--force=')
  );
  const isDelete = flags.includes('--delete') || flags.includes('-d');
  // `git push --tags` AND `git push <remote> --tags` are both tags-only forms.
  // Positional[0] is the remote name — not a branch target — so <= 1 is correct.
  const isTagsOnly = flags.includes('--tags') && positional.length <= 1;

  if (isTagsOnly) {
    return { decision: 'allow' };
  }

  // Gather target branches from positional refspecs.
  // Form: git push [<remote> [<refspec> ...]]
  const targets = [];
  if (positional.length > 1) {
    for (const refspec of positional.slice(1)) {
      const t = normaliseTarget(refspec);
      if (t) targets.push(t);
    }
  } else if (isDelete && positional.length === 1) {
    // `git push --delete <branch>` — no remote, branch is in positional[0]
    const t = normaliseTarget(positional[0]);
    if (t) targets.push(t);
  } else {
    // No explicit refspec — push uses current branch
    const getBranch = opts.getBranch || getCurrentBranch;
    const current = getBranch();
    if (current) targets.push(current);
  }

  const realTargets = targets.filter(Boolean);

  const protectedHit = realTargets.find(t => PROTECTED_BRANCHES.has(t));
  if (protectedHit) {
    const verb = isDelete ? 'Deleting' : (isForce ? 'Force-pushing' : 'Pushing');
    return {
      decision: 'block',
      reason:
        `[HOOK] BLOCKED: ${verb} to protected branch '${protectedHit}'. ` +
        `Changes to main/master should go through a PR. ` +
        `Push to a feature branch and open a PR: ` +
        `\`git checkout -b feature/your-change && git push -u origin HEAD && gh pr create\`.`,
    };
  }

  // Force push to unprotected branch: warn but allow.
  if (isForce) {
    const target = realTargets[0] || 'current branch';
    return {
      decision: 'allow',
      warning:
        `[HOOK] WARNING: Force push to '${target}'. ` +
        `Confirm this will not overwrite a collaborator's work. ` +
        `Prefer --force-with-lease if you haven't already.`,
    };
  }

  return { decision: 'allow' };
}

/**
 * Evaluate all bash pre-checks. Exported for tests.
 * @returns {{decision: 'block'|'allow', reason?: string, warning?: string}}
 */
function evaluate(cmd, opts) {
  const push = checkGitPush(cmd, opts);
  if (push) return push;
  return { decision: 'allow' };
}

module.exports = {
  checkGitPush,
  normaliseTarget,
  evaluate,
};

// CLI entry point — guarded so tests can import without running
if (require.main === module) {
  let data = '';
  process.stdin.on('data', chunk => (data += chunk));
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      // New Claude Code hook format nests command under tool_input; fall back
      // to the legacy flat `command` for backward compatibility.
      const cmd = (input.tool_input && input.tool_input.command) || input.command || '';
      const result = evaluate(cmd);

      if (result.warning) {
        process.stderr.write(result.warning + '\n');
      }

      if (result.decision === 'block') {
        process.stderr.write((result.reason || '[HOOK] BLOCKED') + '\n');
        process.exit(2);
      }
      // Allow: exit 0, no stdout output (post-4312f0c protocol)
    } catch {
      // Allow on parse error — fail-open so malformed input doesn't halt Claude
    }
    process.exit(0);
  });
}

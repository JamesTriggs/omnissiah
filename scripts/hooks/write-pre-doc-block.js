/**
 * write-pre-doc-block.js — PreToolUse hook for Write tool calls.
 *
 * Blocks writing to consolidated documentation files (DOCUMENTATION.md,
 * ALL_DOCS.md, CONSOLIDATED.*). Documentation should stay modular and
 * co-located with code.
 *
 * Exit codes:
 *   0 = allow (no stdout output)
 *   2 = block (reason written to stderr)
 */

'use strict';

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const fp = (input.tool_input && input.tool_input.file_path) || input.file_path || '';
    if (/DOCUMENTATION\.md|ALL_DOCS\.md|CONSOLIDATED/i.test(fp)) {
      process.stderr.write('[HOOK] BLOCKED: Do not consolidate documentation into single files. Keep documentation modular and co-located with code.\n');
      process.exit(2);
      return;
    }
  } catch (e) {
    // Allow on parse error
  }
  process.exit(0);
});

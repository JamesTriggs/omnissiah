// Reference implementation — logic is duplicated in bash-pre-dispatch.js (hooks.json Bash PreToolUse).
// This file is NOT called at runtime; it exists for standalone testing and backward compatibility.
let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const cmd = input.command || '';
    if (/uvicorn|nuxt\s+dev|npm\s+run\s+dev|flask\s+run|python\s+-m\s+uvicorn|gunicorn/.test(cmd)) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: '[HOOK] BLOCKED: Dev server commands should be run by the user, not Claude. Provide the command for the user to run instead.'
      }));
    } else {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
    }
  } catch (e) {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  }
  process.exit(0);
});

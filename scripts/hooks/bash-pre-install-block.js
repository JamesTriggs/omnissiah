// Reference implementation — logic is duplicated in bash-pre-dispatch.js (hooks.json Bash PreToolUse).
// This file is NOT called at runtime; it exists for standalone testing and backward compatibility.
let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const cmd = input.command || '';
    if (/npm\s+install|yarn\s+add|pip\s+install|uv\s+add|uv\s+sync|apt-get\s+install|brew\s+install/.test(cmd)) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: '[HOOK] BLOCKED: Installation commands should be run by the user, not Claude. Provide the command for the user to run instead.'
      }));
    } else {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
    }
  } catch (e) {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  }
  process.exit(0);
});

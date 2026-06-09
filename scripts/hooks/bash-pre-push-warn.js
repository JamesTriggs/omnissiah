// Reference implementation — logic is shared with bash-pre-dispatch.js via the
// exported checkGitPush(). bash-pre-dispatch.js is the hook wired in hooks.json;
// this standalone entry point exists for backward compatibility and targeted tests.
//
// Policy: BLOCKS pushes to main/master (any form — direct, via refspec, force, delete).
//         Warns on force push to feature branches. Allows everything else.

'use strict';

const { checkGitPush } = require('./bash-pre-dispatch');

if (require.main === module) {
  let data = '';
  process.stdin.on('data', chunk => (data += chunk));
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      const cmd = input.command || '';
      const result = checkGitPush(cmd);
      if (result) {
        if (result.warning) process.stderr.write(result.warning + '\n');
        const { warning, ...decision } = result;
        process.stdout.write(JSON.stringify(decision));
      } else {
        process.stdout.write(JSON.stringify({ decision: 'allow' }));
      }
    } catch {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
    }
    process.exit(0);
  });
}

const { spawnSync } = require('child_process');
const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const fp = input.file_path || '';
    if (!/\.(cpp|cc|cxx|h|hpp|hxx)$/.test(fp) || !fs.existsSync(fp)) { process.exit(0); return; }

    const result = spawnSync(
      'cppcheck',
      ['--quiet', '--enable=warning,style,performance', fp],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    if (result.error) {
      process.stderr.write('[HOOK] INFO: cppcheck not found. Install to enable C++ static analysis.\n');
      process.exit(0); return;
    }

    const output = ((result.stdout || '') + (result.stderr || '')).trim();
    if (output) {
      process.stderr.write(`[HOOK] cppcheck warnings in ${fp}:\n${output.slice(0, 500)}\n`);
    }
  } catch (e) {}
  process.exit(0);
});

const { spawnSync } = require('child_process');
const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const fp = input.file_path || '';
    if (!/\.py$/.test(fp) || !fs.existsSync(fp)) { process.exit(0); return; }

    const result = spawnSync(
      'mypy',
      ['--ignore-missing-imports', '--no-error-summary', fp],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    if (result.error) { process.exit(0); return; } // mypy not installed — skip silently

    const output = (result.stdout || '') + (result.stderr || '');
    if (result.status !== 0 && output.trim()) {
      process.stderr.write(`[HOOK] mypy type errors in ${fp}:\n${output.split('\n').slice(0, 10).join('\n')}\n`);
    }
  } catch (e) {}
  process.exit(0);
});

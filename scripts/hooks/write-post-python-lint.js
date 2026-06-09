const { spawnSync } = require('child_process');
const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const fp = input.file_path || '';
    if (!/\.py$/.test(fp) || !fs.existsSync(fp)) { process.exit(0); return; }

    const format = spawnSync('ruff', ['format', fp], { stdio: ['ignore', 'ignore', 'pipe'] });
    const check = spawnSync('ruff', ['check', '--fix', fp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    if (format.error || check.error) {
      process.stderr.write('[HOOK] INFO: ruff not found. Install with: pip install ruff\n');
    } else if (check.status !== 0) {
      const output = (check.stdout || '') + (check.stderr || '');
      process.stderr.write(`[HOOK] ruff lint errors in ${fp} (could not auto-fix):\n${output.split('\n').slice(0, 10).join('\n')}\n`);
    } else {
      process.stderr.write(`[HOOK] Ruff formatted and linted: ${fp}\n`);
    }
  } catch (e) {}
  process.exit(0);
});

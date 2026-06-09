const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';

/** Resolve eslint binary: prefer local node_modules/.bin to avoid npx startup overhead */
function resolveEslint() {
  const localEslint = path.join(process.cwd(), 'node_modules', '.bin',
    isWindows ? 'eslint.cmd' : 'eslint');
  if (fs.existsSync(localEslint)) return { bin: localEslint, args: [] };
  return { bin: isWindows ? 'npx.cmd' : 'npx', args: ['eslint'] };
}

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const fp = input.file_path || '';
    if (!/\.vue$/.test(fp) || !fs.existsSync(fp)) { process.exit(0); return; }

    const { bin, args } = resolveEslint();
    const result = spawnSync(
      bin,
      [...args, '--no-error-on-unmatched-pattern', fp],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    if (result.error) { process.exit(0); return; } // npx not available — skip silently

    // ESLint writes its lint report to stdout; stderr is only for internal ESLint warnings.
    // Merge both streams so we catch all output regardless of ESLint version behaviour.
    const output = (result.stdout || '') + (result.stderr || '');
    const matches = output.split('\n').filter(l => /error|warning/.test(l)).slice(0, 10);
    if (result.status !== 0 && matches.length > 0) {
      process.stderr.write(`[HOOK] ESLint Vue errors in ${fp}:\n${matches.join('\n')}\n`);
    }
  } catch (e) {}
  process.exit(0);
});

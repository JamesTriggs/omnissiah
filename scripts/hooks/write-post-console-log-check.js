const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const fp = input.file_path || '';
    if (!/\.(js|ts|vue|jsx|tsx)$/.test(fp) || !fs.existsSync(fp)) { process.exit(0); return; }

    const content = fs.readFileSync(fp, 'utf8');
    const lines = content.split('\n');
    const matches = [];
    lines.forEach((line, idx) => {
      if (/console\.(log|warn|error|debug|info)/.test(line) && !/\/\/.*console/.test(line)) {
        matches.push(`  Line ${idx + 1}: ${line.trim()}`);
      }
    });
    if (matches.length > 0) {
      process.stderr.write(`[HOOK] console.log statements found in ${fp}:\n${matches.slice(0, 5).join('\n')}\n`);
    }
  } catch (e) {}
  process.exit(0);
});

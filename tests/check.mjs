import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const files = ['src/main.js', ...readdirSync('src/game').filter(f => f.endsWith('.js')).map(f => `src/game/${f}`)];
for (const file of files)
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`Sintassi OK: ${files.length} moduli.`);

/**
 * Tests des Backends: `node --test` über test/**\/*.test.ts, höchstens 10 Dateien zugleich (je eine Wegwerf-Datenbank).
 *
 *   node scripts/test.ts [muster …]
 */
import { spawnSync } from 'node:child_process';

const patterns = process.argv.slice(2);
const r = spawnSync(process.execPath, [
  '--test', '--test-concurrency=10', '--test-reporter=spec',
  ...(patterns.length ? patterns : ['test/**/*.test.ts']),
], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
process.exit(r.status ?? 1);

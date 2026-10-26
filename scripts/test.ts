/**
 * Tests: `node --test` über test/**\/*.test.ts mit höchstens 10 Dateien gleichzeitig (jede Datei hat ihre eigene
 * Wegwerf-Datenbank). Argumente werden weitergereicht, z. B. `npm test -- test/platform/rls.test.ts`.
 * Datenbank: TEST_POSTGRES_URL oder POSTGRES_SUPERUSER_PASSWORD (+ POSTGRES_PORT, Standard 5433), sonst aus .env.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('-'));
const flags = args.filter(a => a.startsWith('-'));
const concurrency = Math.min(10, Math.max(1, cpus().length));
const envFile = existsSync(join(root, '.env')) ? ['--env-file=.env'] : [];
const r = spawnSync(process.execPath, [
  ...envFile, '--test', `--test-concurrency=${concurrency}`, '--test-reporter=spec', ...flags,
  ...(files.length ? files : ['test/**/*.test.ts']),
], { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
process.exit(r.status ?? 1);

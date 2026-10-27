/**
 * Startbefehl von PPM: `api`, `worker`, `mcp`, `migrate`, `tenant …`, `rotate-keys [--dry-run]`
 * (siehe `runCli` in @vollholz/platform). Im Image mit `node --import @vollholz/platform/preload src/cli.ts <befehl>`.
 */
import { runCli } from '@vollholz/platform';
import { app } from './app.ts';

await runCli(app);

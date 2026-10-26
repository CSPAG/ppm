/**
 * Werte für die Betriebsskripte (migrate, tenant, rotate-keys): direkt aus `<NAME>` oder aus der Datei in
 * `<NAME>_FILE` (Docker/Kubernetes Secrets), wie die Prozesse über config/env.ts.
 */
import { readFileSync } from 'node:fs';

export function secretEnv(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env[name]) return env[name];
  const file = env[`${name}_FILE`];
  return file ? readFileSync(file, 'utf8').trim() || undefined : undefined;
}

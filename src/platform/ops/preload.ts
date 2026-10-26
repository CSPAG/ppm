/**
 * Wird vor allen anderen Modulen geladen (`node --import ./src/platform/ops/preload.ts …`, im Image über den
 * Entrypoint): startet die Telemetrie. Liest nur die Variablen der Telemetrie selbst; die volle Prüfung der
 * Konfiguration macht der Einstiegspunkt danach (Exit 78).
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { startTelemetry } from './telemetry.ts';

const entry = basename(process.argv[1] ?? '', '.ts');
const service = ['api', 'worker', 'mcp'].includes(entry) ? entry : 'script';
let version = '0.0.0';
try { version = (JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { version: string }).version; } catch { /* ohne package.json */ }

startTelemetry({
  service, version,
  namespace: process.env.OTEL_SERVICE_NAMESPACE || 'ppm',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || null,
  metrics: /^(true|1)$/i.test(process.env.METRICS_ENABLED ?? ''),
});

/**
 * Konfiguration nur über Umgebungsvariablen (Leitentscheidung L8). `VARS` ist die einzige Quelle: daraus entstehen die
 * geprüfte, typisierte Konfiguration beim Start, `.env.example` und `docs/konfiguration.md` (`npm run env:docs`).
 *
 * Die Variablen des Baukastens kommen aus `IAM_VARS('ppm')` und werden nicht nachgebaut; die App ergänzt ihre eigenen
 * (`APP_VARS`) und ordnet Geheimnisse den Diensten zu, die sie lesen (Geheimnisse je Dienst, docs/betrieb.md).
 * Fehler werden alle gesammelt; die Einstiegspunkte enden dann mit Exit 78 (EX_CONFIG).
 */
import { ConfigError, IAM_VARS, iamConfig, iamConfigErrors, parseDuration, readVars, type IamConfig, type Mode, type Service, type VarSpec } from '@vollholz/iam';

export const PRODUCT = 'ppm';
export const SCHEMA = 'ppm';
export { ConfigError, type Service };

/** Exit-Code bei ungültiger Konfiguration (sysexits.h EX_CONFIG). */
export const EXIT_CONFIG = 78;

/**
 * Dienste, die eine Variable des Baukastens lesen (für die Tabelle «Geheimnisse je Dienst» und die Pflicht je Dienst).
 * Was hier fehlt, gilt für alle Dienste.
 */
const IAM_SERVICES: Record<string, Service[]> = {
  DATABASE_URL: ['api'],
  DATABASE_ADMIN_URL: [],
  DATABASE_WORKER_URL: ['worker'],
  OIDC_BFF_CLIENT_SECRET: ['api'],
  OIDC_BFF_PRIVATE_KEY: ['api'],
  SESSION_SECRET: ['api'],
  KEYCLOAK_MGMT_CLIENT_ID: ['api'],
  KEYCLOAK_MGMT_PRIVATE_KEY: ['api'],
  KEYCLOAK_MGMT_CLIENT_SECRET: ['api'],
  KEYCLOAK_SYNC_CLIENT_ID: ['worker'],
  KEYCLOAK_SYNC_PRIVATE_KEY: ['worker'],
  KEYCLOAK_SYNC_CLIENT_SECRET: ['worker'],
  ENTRA_CLIENT_SECRET: ['api'],
  ENCRYPTION_KEYS: ['api', 'worker'],
  MCP_CLIENT_SECRET: ['mcp'],
  MCP_PRIVATE_KEY: ['mcp'],
  MCP_DPOP_KEY: ['mcp'],
};

/** Variablen der App (ausserhalb des Baukastens). */
export const APP_VARS: VarSpec[] = [
  { name: 'LOG_LEVEL', kind: 'enum', group: 'Allgemein', values: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'], default: 'info', description: 'Stufe der Logs (JSON auf stdout).' },

  { name: 'HTTP_HOST', kind: 'string', group: 'HTTP', default: '0.0.0.0', services: ['api'], description: 'Adresse, an der die API lauscht.' },
  { name: 'HTTP_PORT', kind: 'int', group: 'HTTP', default: '8080', services: ['api'], description: 'Port der API (REST, BFF, Webapp).' },
  { name: 'TRUST_PROXY', kind: 'string', group: 'HTTP', default: 'false', description: 'Vertrauen in `X-Forwarded-*`: `false`, `true`, Anzahl der Proxys oder Liste von Adressen/Netzen. Hinter Caddy bzw. Ingress `1`.' },
  { name: 'BODY_LIMIT', kind: 'int', group: 'HTTP', default: '1048576', description: 'Grösste Anfrage in Bytes.' },
  { name: 'RATE_LIMIT_MAX', kind: 'int', group: 'HTTP', default: '600', description: 'Anfragen je Zeitfenster und Principal in der Organisation (ohne Anmeldung je IP). Die Oberfläche (Sitzung) ist nie begrenzt.' },
  { name: 'RATE_LIMIT_WINDOW', kind: 'duration', group: 'HTTP', default: '1m', description: 'Zeitfenster des Rate-Limits.' },
  { name: 'IDEMPOTENCY_TTL', kind: 'duration', group: 'HTTP', default: '24h', description: 'Aufbewahrung gespeicherter Antworten zu `Idempotency-Key`.' },
  { name: 'WEB_DIST_DIR', kind: 'string', group: 'HTTP', default: 'web/dist', services: ['api'], description: 'Verzeichnis des Builds der Webapp (relativ zur Wurzel oder absolut).' },

  { name: 'WORKER_CONCURRENCY', kind: 'int', group: 'Worker', default: '4', services: ['worker'], description: 'Gleichzeitige Jobs je Worker-Instanz.' },
  { name: 'WORKER_TENANT_LIMIT', kind: 'int', group: 'Worker', default: '2', services: ['worker'], description: 'Höchstens so viele laufende Jobs je Organisation über alle Instanzen.' },
  { name: 'WORKER_POLL_INTERVAL', kind: 'duration', group: 'Worker', default: '1s', services: ['worker'], description: 'Abstand der Abfragen der Warteschlange, wenn nichts fällig war.' },
  { name: 'JOB_RETENTION', kind: 'duration', group: 'Worker', default: '14d', services: ['worker'], description: 'Aufbewahrung erledigter und endgültig gescheiterter Jobs sowie verteilter Ereignisse der Outbox.' },
  { name: 'WEBHOOK_TIMEOUT', kind: 'duration', group: 'Worker', default: '10s', services: ['worker'], description: 'Feste Gesamtfrist je Zustellung eines Webhooks (Verbindung, Senden, Antwort).' },
  { name: 'WEBHOOK_MAX_RESPONSE_BYTES', kind: 'int', group: 'Worker', default: '65536', services: ['worker'], description: 'Grösste gelesene Antwort eines Webhook-Empfängers; danach Abbruch.' },
  { name: 'WEBHOOK_ALLOW_PRIVATE', kind: 'bool', group: 'Worker', default: 'false', description: 'Nur Entwicklung und Tests: Webhooks an private und lokale Adressen erlauben (SSRF-Schutz aus). In Produktion verboten.' },

  { name: 'MCP_HOST', kind: 'string', group: 'MCP', default: '0.0.0.0', services: ['mcp'], description: 'Adresse, an der der MCP-Dienst lauscht.' },
  { name: 'MCP_PORT', kind: 'int', group: 'MCP', default: '8081', services: ['mcp'], description: 'Port des MCP-Dienstes (Streamable HTTP unter `/mcp`).' },

  { name: 'OPS_HOST', kind: 'string', group: 'Betrieb', default: '0.0.0.0', description: 'Adresse des Betriebs-Endpunkts.' },
  { name: 'OPS_PORT', kind: 'int', group: 'Betrieb', default: '9090', description: 'Port des Betriebs-Endpunkts (`/healthz`, `/readyz`, `/metrics`) jedes Prozesses.' },
  { name: 'METRICS_ENABLED', kind: 'bool', group: 'Betrieb', default: 'false', description: 'Metriken im Prometheus-Format unter `/metrics` des Betriebs-Endpunkts.' },
  { name: 'SHUTDOWN_DELAY', kind: 'duration', group: 'Betrieb', default: '5s', description: 'Wartezeit nach SIGTERM mit `/readyz` 503, bevor der Server schliesst (Load Balancer nimmt die Instanz heraus).' },
  { name: 'SHUTDOWN_TIMEOUT', kind: 'duration', group: 'Betrieb', default: '20s', description: 'Höchstdauer des geordneten Beendens; danach Exit 1.' },
  { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', kind: 'url', group: 'Betrieb', description: 'OTLP/HTTP-Empfänger für Traces und Metriken (z. B. `http://otel-collector:4318`). Ohne Angabe keine Traces.' },
  { name: 'OTEL_SERVICE_NAMESPACE', kind: 'string', group: 'Betrieb', default: 'ppm', description: 'Namensraum der Dienste in der Telemetrie (`service.namespace`); `service.name` ist `ppm-<dienst>`.' },
];

export const VARS: VarSpec[] = [
  ...IAM_VARS(PRODUCT).map(v => (v.name in IAM_SERVICES ? { ...v, services: IAM_SERVICES[v.name] } : v)),
  ...APP_VARS,
];

export interface PlatformConfig {
  mode: Mode;
  service: Service | null;
  iam: IamConfig;
  log: { level: string };
  http: { host: string; port: number; trustProxy: boolean | number | string[]; bodyLimit: number; idempotencyTtlMs: number; webDist: string };
  rateLimit: { max: number; windowMs: number };
  worker: { concurrency: number; tenantLimit: number; pollMs: number; retentionMs: number };
  webhooks: { timeoutMs: number; maxResponseBytes: number; allowPrivate: boolean };
  mcp: { host: string; port: number };
  ops: { host: string; port: number; metrics: boolean; shutdownDelayMs: number; shutdownTimeoutMs: number; otlpEndpoint: string | null; serviceNamespace: string };
}

function trustProxy(v: string): boolean | number | string[] {
  if (/^(true|false)$/i.test(v)) return /^true$/i.test(v);
  if (/^\d+$/.test(v)) return Number(v);
  return v.split(',').map(x => x.trim()).filter(Boolean);
}

/** Prüfungen der App über die des Baukastens hinaus. */
function appErrors(raw: Record<string, string | undefined>, mode: Mode, service: Service | null): string[] {
  const errors: string[] = [];
  const usesDb = service === null || service === 'api' || service === 'worker';
  if (mode === 'production') {
    if (usesDb && raw.DATABASE_SSL !== 'verify-full') errors.push('DATABASE_SSL muss in Produktion verify-full sein');
    if (/^(true|1)$/i.test(raw.WEBHOOK_ALLOW_PRIVATE ?? '')) errors.push('WEBHOOK_ALLOW_PRIVATE=true ist in Produktion nicht erlaubt (SSRF-Schutz)');
  }
  for (const k of ['HTTP_PORT', 'MCP_PORT', 'OPS_PORT']) {
    const n = Number(raw[k]);
    if (raw[k] && /^\d+$/.test(raw[k]!) && (n < 1 || n > 65535)) errors.push(`${k}: 1 bis 65535`);
  }
  for (const k of ['WORKER_CONCURRENCY', 'WORKER_TENANT_LIMIT']) if (raw[k] && /^\d+$/.test(raw[k]!) && Number(raw[k]) < 1) errors.push(`${k}: mindestens 1`);
  if (raw.TRUST_PROXY && !/^(true|false|\d+)$/i.test(raw.TRUST_PROXY) && raw.TRUST_PROXY.split(',').some(x => !/^[\w.:/-]+$/.test(x.trim()))) errors.push('TRUST_PROXY: false, true, Anzahl oder Liste von Adressen/Netzen');
  return errors;
}

/**
 * Liest und prüft die Konfiguration für `service` (`null`: Skripte und Tests, alle Prüfungen). Wirft `ConfigError` mit
 * allen Meldungen.
 */
export function loadPlatformConfig(env: NodeJS.ProcessEnv, service: Service | null): PlatformConfig {
  const { raw, mode, errors } = readVars(env, VARS, service);
  errors.push(...iamConfigErrors(raw, mode, service), ...appErrors(raw, mode, service));
  if (errors.length) throw new ConfigError('Konfiguration ungültig:\n  - ' + errors.join('\n  - '));
  const s = (k: string) => raw[k] ?? '';
  const n = (k: string) => Number(raw[k]);
  const d = (k: string) => parseDuration(raw[k] ?? '0');
  const b = (k: string) => /^(true|1)$/i.test(raw[k] ?? '');
  return {
    mode, service,
    iam: iamConfig(raw, mode),
    log: { level: s('LOG_LEVEL') },
    http: { host: s('HTTP_HOST'), port: n('HTTP_PORT'), trustProxy: trustProxy(s('TRUST_PROXY')), bodyLimit: n('BODY_LIMIT'), idempotencyTtlMs: d('IDEMPOTENCY_TTL'), webDist: s('WEB_DIST_DIR') },
    rateLimit: { max: n('RATE_LIMIT_MAX'), windowMs: d('RATE_LIMIT_WINDOW') },
    worker: { concurrency: n('WORKER_CONCURRENCY'), tenantLimit: n('WORKER_TENANT_LIMIT'), pollMs: d('WORKER_POLL_INTERVAL'), retentionMs: d('JOB_RETENTION') },
    webhooks: { timeoutMs: d('WEBHOOK_TIMEOUT'), maxResponseBytes: n('WEBHOOK_MAX_RESPONSE_BYTES'), allowPrivate: b('WEBHOOK_ALLOW_PRIVATE') },
    mcp: { host: s('MCP_HOST'), port: n('MCP_PORT') },
    ops: {
      host: s('OPS_HOST'), port: n('OPS_PORT'), metrics: b('METRICS_ENABLED'), shutdownDelayMs: d('SHUTDOWN_DELAY'), shutdownTimeoutMs: d('SHUTDOWN_TIMEOUT'),
      otlpEndpoint: raw.OTEL_EXPORTER_OTLP_ENDPOINT || null, serviceNamespace: s('OTEL_SERVICE_NAMESPACE'),
    },
  };
}

/** Für Einstiegspunkte: Konfiguration laden oder mit allen Meldungen und Exit 78 enden. */
export function loadOrExit(env: NodeJS.ProcessEnv, service: Service | null): PlatformConfig {
  try {
    return loadPlatformConfig(env, service);
  } catch (e) {
    if (e instanceof ConfigError) {
      process.stderr.write(`${JSON.stringify({ level: 'fatal', service, msg: e.message })}\n`);
      process.exit(EXIT_CONFIG);
    }
    throw e;
  }
}

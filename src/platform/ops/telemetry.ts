/**
 * OpenTelemetry: Traces (http, pg, undici) über OTLP/HTTP, wenn `OTEL_EXPORTER_OTLP_ENDPOINT` gesetzt ist; Metriken
 * über OTLP und/oder im Prometheus-Format am Betriebs-Endpunkt (`METRICS_ENABLED`). Gestartet von `preload.ts`, bevor
 * ein anderes Modul geladen wird (sonst greift die Instrumentierung von http und pg nicht).
 */
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader, type MetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;
let prometheus: PrometheusExporter | null = null;

/** Prometheus-Exporter (ohne eigenen Server; ausgeliefert über ops/server.ts) oder null. */
export const prometheusExporter = () => prometheus;

export interface TelemetryOptions { service: string; version: string; namespace: string; otlpEndpoint: string | null; metrics: boolean }

export function startTelemetry(o: TelemetryOptions): void {
  if (sdk) return;
  const readers: MetricReader[] = [];
  if (o.metrics) { prometheus = new PrometheusExporter({ preventServerStart: true }); readers.push(prometheus); }
  if (o.otlpEndpoint) readers.push(new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter({ url: `${o.otlpEndpoint}/v1/metrics` }), exportIntervalMillis: 30_000 }));
  if (!readers.length && !o.otlpEndpoint) return;
  sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: `ppm-${o.service}`, [ATTR_SERVICE_VERSION]: o.version, 'service.namespace': o.namespace }),
    ...(o.otlpEndpoint ? { traceExporter: new OTLPTraceExporter({ url: `${o.otlpEndpoint}/v1/traces` }) } : {}),
    metricReaders: readers,
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: req => /^\/(healthz|readyz|metrics)$/.test(req.url ?? '') }),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
      new UndiciInstrumentation(),
    ],
  });
  sdk.start();
}

/** Telemetrie leeren und beenden (geordnetes Beenden). */
export async function stopTelemetry(): Promise<void> {
  const s = sdk;
  sdk = null;
  await s?.shutdown().catch(() => undefined);
}

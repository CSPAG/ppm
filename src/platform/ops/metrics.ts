/**
 * Metriken über OpenTelemetry (kein prom-client): Dauer je Route, Jobs, Outbox. Ohne gestartete Telemetrie sind die
 * Instrumente No-ops.
 */
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('ppm');

export const httpDuration = meter.createHistogram('ppm_http_request_duration', {
  description: 'Dauer der Anfragen je Route', unit: 's',
  advice: { explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] },
});
export const jobsTotal = meter.createCounter('ppm_jobs_total', { description: 'Abgeschlossene Jobs je Art und Ergebnis' });
export const jobDuration = meter.createHistogram('ppm_job_duration', { description: 'Dauer der Jobs', unit: 's' });
export const outboxDispatched = meter.createCounter('ppm_outbox_dispatched_total', { description: 'Verteilte Ereignisse der Outbox' });
export const webhookDeliveries = meter.createCounter('ppm_webhook_deliveries_total', { description: 'Zustellungen von Webhooks je Ergebnis' });

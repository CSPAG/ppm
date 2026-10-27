/** Tabellen des Querschnitts aus @vollholz/platform (platform_001_core): Warteschlange, Idempotenz, Outbox. */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    job: async (tx, t) => { await tx.query("INSERT INTO ppm.job (tenant_id, kind) VALUES ($1, 'probe')", [t]); return "kind = 'probe'"; },
    idempotency_key: async (tx, t) => {
      await tx.query("INSERT INTO ppm.idempotency_key (tenant_id, principal_id, key, method, path, request_hash, expires_at) VALUES ($1, gen_random_uuid(), 'probe', 'POST', '/x', 'h', now() + interval '1 h')", [t]);
      return "key = 'probe'";
    },
    outbox_event: async (tx, t) => { await tx.query("INSERT INTO ppm.outbox_event (tenant_id, type) VALUES ($1, 'probe.created')", [t]); return "type = 'probe.created'"; },
  },
  policies: [
    // Scheduler (platform_001_core): lesen über alle Mandanten, schreiben ohne Kontext oder nur im gesetzten Mandanten
    'ppm.job.sched_read PERMISSIVE SELECT ppm_sched USING true CHECK -',
    'ppm.job.sched_write PERMISSIVE ALL ppm_sched USING ((app.tenant_id() IS NULL) OR (tenant_id = app.tenant_id())) CHECK ((app.tenant_id() IS NULL) OR (tenant_id = app.tenant_id()))',
    'ppm.outbox_event.sched_read PERMISSIVE SELECT ppm_sched USING true CHECK -',
    'ppm.outbox_event.sched_write PERMISSIVE ALL ppm_sched USING ((app.tenant_id() IS NULL) OR (tenant_id = app.tenant_id())) CHECK ((app.tenant_id() IS NULL) OR (tenant_id = app.tenant_id()))',
    'ppm.idempotency_key.sched_cleanup PERMISSIVE DELETE ppm_sched USING (expires_at < now()) CHECK -',
    'ppm.idempotency_key.sched_read PERMISSIVE SELECT ppm_sched USING (expires_at < now()) CHECK -',
  ],
};

-- 001 Kern der App (nach den Migrationen von @vollholz/iam): Warteschlange, Idempotenz, Outbox.
-- RLS und tenant_isolation setzt app.secure_tenant_tables() nach jeder Migration (Runner). Die Indizes des Schedulers
-- über alle Mandanten (fällige Jobs, unverteilte Ereignisse) sind die einzige dokumentierte Ausnahme von «tenant_id zuerst».

-- ---------- Warteschlange (worker/queue.ts)
CREATE TABLE ppm.job (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant(id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  payload      jsonb NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts     int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 100),
  run_at       timestamptz NOT NULL DEFAULT now(),
  dedupe_key   text,
  locked_by    text,
  heartbeat_at timestamptz,
  last_error   text,
  -- Ergebnis für lange Läufe (202 mit Location /v1/vorgaenge/{id}); wer den Job ausgelöst hat
  result       jsonb,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  PRIMARY KEY (tenant_id, id)
);
-- Ein offener Job je Schlüssel (enqueue mit ON CONFLICT DO NOTHING)
CREATE UNIQUE INDEX job_dedupe ON ppm.job (tenant_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running');
-- Ausnahme «tenant_id zuerst»: Scheduler über alle Mandanten
CREATE INDEX job_due ON ppm.job (run_at) WHERE status = 'queued';
CREATE INDEX job_running ON ppm.job (heartbeat_at) WHERE status = 'running';
CREATE INDEX job_finished ON ppm.job (finished_at) WHERE status IN ('done', 'failed');

-- ---------- Idempotency-Key (http/idempotency.ts)
CREATE TABLE ppm.idempotency_key (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL,
  key          text NOT NULL CHECK (length(key) BETWEEN 1 AND 255),
  method       text NOT NULL,
  path         text NOT NULL,
  request_hash text NOT NULL,
  status       int,
  headers      jsonb,
  body         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, key)
);
CREATE INDEX idempotency_key_expires ON ppm.idempotency_key (expires_at);

-- ---------- Outbox (core/events.ts: emit() in derselben Transaktion; Verteilung im Worker)
CREATE TABLE ppm.outbox_event (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant(id) ON DELETE CASCADE,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  subject       text,
  data          jsonb NOT NULL DEFAULT '{}',
  source        text NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  attempts      int NOT NULL DEFAULT 0,
  last_error    text,
  PRIMARY KEY (tenant_id, id)
);
-- Ausnahme «tenant_id zuerst»: Verteilung über alle Mandanten
CREATE INDEX outbox_event_pending ON ppm.outbox_event (occurred_at) WHERE dispatched_at IS NULL;
CREATE INDEX outbox_event_dispatched ON ppm.outbox_event (dispatched_at) WHERE dispatched_at IS NOT NULL;

SELECT app.secure_tenant_tables();

-- Scheduler (ppm_sched, nur Login ppm_worker): Warteschlange, Outbox und Aufräumen über alle Mandanten. Die fachliche
-- Arbeit eines Jobs läuft danach im Kontext seines Mandanten (withTenant).
CREATE POLICY sched_all ON ppm.job TO ppm_sched USING (true) WITH CHECK (true);
CREATE POLICY sched_all ON ppm.outbox_event TO ppm_sched USING (true) WITH CHECK (true);
CREATE POLICY sched_cleanup ON ppm.idempotency_key FOR DELETE TO ppm_sched USING (expires_at < now());
GRANT SELECT, INSERT, UPDATE, DELETE ON ppm.job, ppm.outbox_event TO ppm_sched;
GRANT SELECT, DELETE ON ppm.idempotency_key TO ppm_sched;

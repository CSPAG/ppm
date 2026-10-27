-- Ausgehende Webhooks (Modul webhooks, BC AM.03.02 Schnittstelle konfigurieren): Abonnements je Organisation und
-- Zustellungen nach Standard Webhooks (https://www.standardwebhooks.com). Das Geheimnis liegt nur verschlüsselt vor
-- (seal/unseal aus @vollholz/platform). Zustellungen tragen die Daten ihres Ereignisses selbst, damit die Aufbewahrung
-- der Outbox (OUTBOX_RETENTION) keine offenen Zustellungen entfernt.

CREATE TABLE ppm.webhook_subscription (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  url          text NOT NULL CHECK (url ~ '^https?://' AND length(url) <= 2000),
  description  text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  secret_enc   text NOT NULL,
  event_types  text[] NOT NULL CHECK (cardinality(event_types) BETWEEN 1 AND 50),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT app.principal_id(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE ppm.webhook_delivery (
  tenant_id         uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id   uuid NOT NULL,
  event_id          uuid NOT NULL,
  event_type        text NOT NULL,
  event_subject     text,
  event_data        jsonb NOT NULL,
  event_created_at  timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts          int NOT NULL DEFAULT 0,
  next_attempt_at   timestamptz NOT NULL DEFAULT now(),
  last_status       int,
  last_error        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  delivered_at      timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, subscription_id, event_id),
  FOREIGN KEY (tenant_id, subscription_id) REFERENCES ppm.webhook_subscription (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX webhook_delivery_tenant ON ppm.webhook_delivery (tenant_id, subscription_id, created_at);
-- Ausnahme von «tenant_id zuerst»: Zustellung über alle Mandanten
CREATE INDEX webhook_delivery_due ON ppm.webhook_delivery (next_attempt_at) WHERE status = 'pending';

SELECT app.secure_tenant_tables();

-- Worker (ppm_sched): lesen über alle Mandanten; schreiben ohne Kontext (Abholen, Abschluss, Aufräumen), mit gesetztem
-- app.tenant_id nur in diesem Mandanten
GRANT SELECT ON ppm.webhook_subscription TO ppm_sched;
CREATE POLICY sched_read ON ppm.webhook_subscription FOR SELECT TO ppm_sched USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON ppm.webhook_delivery TO ppm_sched;
CREATE POLICY sched_read ON ppm.webhook_delivery FOR SELECT TO ppm_sched USING (true);
CREATE POLICY sched_write ON ppm.webhook_delivery TO ppm_sched
  USING (app.tenant_id() IS NULL OR tenant_id = app.tenant_id()) WITH CHECK (app.tenant_id() IS NULL OR tenant_id = app.tenant_id());

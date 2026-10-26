-- 003 Ausgehende Webhooks (Profil outbox): Standard Webhooks, Geheimnis mit Umschlagverschlüsselung, Zustellungen.
-- Nur org-admin (webhook:admin, ohne Scope) verwaltet sie; der Worker stellt im Kontext des Mandanten zu.

CREATE TABLE ppm.webhook (
  tenant_id   uuid NOT NULL REFERENCES ppm.tenant(id) ON DELETE CASCADE,
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  url         text NOT NULL CHECK (url ~ '^https?://' AND length(url) <= 2000),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  events      text[] NOT NULL CHECK (cardinality(events) BETWEEN 1 AND 50),
  secret_enc  bytea NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  version     int NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE ppm.webhook_delivery (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant(id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  webhook_id      uuid NOT NULL,
  event_id        uuid NOT NULL,
  event_type      text NOT NULL,
  -- CloudEvent, wie es zugestellt wird (unabhängig von der Aufbewahrung der Outbox)
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts        int NOT NULL DEFAULT 0,
  response_status int,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, webhook_id) REFERENCES ppm.webhook (tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, webhook_id, event_id)
);
CREATE INDEX webhook_delivery_webhook ON ppm.webhook_delivery (tenant_id, webhook_id, created_at DESC);

SELECT app.secure_tenant_tables();

-- Nur mit webhook:admin an org (Personen mit org-admin; der Worker arbeitet mit voller Sicht)
CREATE POLICY webhook_admin ON ppm.webhook AS RESTRICTIVE TO ppm_app USING (app.read_all_of('webhook:admin')) WITH CHECK (app.read_all_of('webhook:admin'));
CREATE POLICY webhook_delivery_admin ON ppm.webhook_delivery AS RESTRICTIVE TO ppm_app USING (app.read_all_of('webhook:admin')) WITH CHECK (app.read_all_of('webhook:admin'));

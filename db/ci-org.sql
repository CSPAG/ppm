-- Nur CI: Prüforganisation mit org-admin, damit der Konformitätstest der Datenbank («jede Organisation hat einen
-- org-admin») eine Organisation vorfindet. Als Besitzer-Rolle (Policies owner_tenant des Baukastens), idempotent.
\set ON_ERROR_STOP on
SELECT set_config('app.tenant_id', app.resolve_tenant('ci', null, 'CI', true)::text, false);
INSERT INTO ppm.principal (tenant_id, kind, subject, display_name) VALUES (app.tenant_id(), 'user', 'ci-admin', 'CI Admin')
  ON CONFLICT (tenant_id, kind, subject) DO UPDATE SET display_name = excluded.display_name RETURNING id AS principal \gset
INSERT INTO ppm.authz_tuple (tenant_id, subject, relation, object_type) VALUES (app.tenant_id(), 'user:' || :'principal', 'org-admin', 'org')
  ON CONFLICT DO NOTHING;

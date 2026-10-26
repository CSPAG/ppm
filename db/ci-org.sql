-- Nur CI: Prüforganisation «ci» mit einer Person als org-admin, damit `iam-conformity-test --db` nach den Migrationen
-- eine aktive Organisation findet («Jede Organisation hat einen org-admin»). Als Besitzer-Rolle ppm_owner ausführen.
-- Nie in Produktion.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.tenant_id', app.resolve_tenant('ci', NULL, 'CI-Prüforganisation', true)::text, true) AS tenant \gset
INSERT INTO ppm.principal (tenant_id, kind, subject, display_name, email, clearance)
  VALUES (app.tenant_id(), 'user', 'ci-admin', 'CI Admin', 'ci-admin@ci.example', 2)
  ON CONFLICT (tenant_id, kind, subject) DO NOTHING;
INSERT INTO ppm.authz_tuple (tenant_id, subject, relation, object_type, object_id)
  SELECT app.tenant_id(), 'user:' || id, 'org-admin', 'org', NULL FROM ppm.principal WHERE tenant_id = app.tenant_id() AND subject = 'ci-admin'
  ON CONFLICT DO NOTHING;
COMMIT;

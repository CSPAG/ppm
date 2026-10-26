# Mandantentrennung

Ein Mandant ist eine **Organisation in Keycloak** (sichtbar immer «Organisation»). Alle Organisationen teilen eine
Datenbank; jede Zeile mit Mandantendaten trägt `tenant_id`, und **PostgreSQL erzwingt die Trennung** mit Row Level
Security (Leitentscheidung L4). Die Anwendung prüft zusätzlich Rechte, verlässt sich für die Trennung aber nicht auf
sich selbst.

## Bedrohungsmodell

| Bedrohung | Angriff bzw. Fehler | Massnahmen |
|---|---|---|
| Fremde Organisation | Person aus B liest, ändert oder löscht Daten von A über bekannte oder geratene IDs, Listen, Suche, Cursor, Verlauf, Vorgänge | Genau eine Organisation je Anfrage aus dem Token bzw. `X-Tenant` (Mitgliedschaft geprüft); `req.tx` setzt `app.tenant_id`; RLS `tenant_isolation`; fremde IDs → 404 wie unbekannte; Cursor an die Abfrage gebunden; Vorgänge nur für den Auslöser. Test: `tenant-isolation.test.ts` |
| Gesperrte Organisation | Mitglieder oder Jobs einer gesperrten Organisation arbeiten weiter | `tenant suspend`: Anfragen 403 (Baukasten), Jobs gesperrter Mandanten holt der Worker nicht ab (`app.suspended_tenants()`). Tests: `worker.test.ts`, Baukasten |
| Maschinen-Clients | Client liest über seine Freigabe hinaus oder in fremden Organisationen | Client gilt nur in Organisationen, die ihn freigegeben haben (Principal und Tupel je Mandant); **Rolle ∩ Scope**; DPoP bzw. mTLS Pflicht (gestohlene Tokens nutzlos); `members:admin`, `access:admin`, `webhook:admin` in keinem Scope; nie automatische Anlage von Mandanten |
| MCP | Werkzeug umgeht Rechte oder mischt Organisationen | MCP-Dienst ist Client der REST-API ohne Datenbank: dieselben Prüfungen und dieselbe RLS; Token Exchange im Namen der Person, DPoP-gebunden; Werkzeug nur, wenn sein Recht in der Organisation gilt; bei mehreren Organisationen ausdrücklicher Parameter `organisation`. Nur Tokens der Host-Clients (`MCP_HOST_CLIENT_IDS`). Test: `mcp.test.ts` |
| Worker und Scheduler | Job läuft im falschen Mandanten oder sieht über alle Mandanten mehr als nötig | Nur `ppm_sched` (Login `ppm_worker`) sieht **Warteschlange und Outbox** über alle Mandanten (Policies `sched_*`), darf abgelaufene Idempotency-Keys löschen; jede fachliche Arbeit eines Jobs bzw. Abnehmers läuft danach mit `fullTx` im Mandanten des Jobs. Ohne Kontext sieht der Worker sonst nichts. Tests: `rls.test.ts` (Spalte `sched`), `worker.test.ts` |
| SSRF | Webhook-Adresse zielt auf interne Dienste (Datenbank, Metadaten, Betriebs-Endpunkte), DNS-Rebinding, langsame Gegenstellen | [`core/ssrf.ts`](../src/platform/core/ssrf.ts): nur http(s), keine Zugangsdaten in der Adresse, erlaubte Ports, jede aufgelöste Adresse gegen private, lokale, Link-Local-, Multicast- und reservierte Netze geprüft und die Verbindung daran festgehalten, keine Weiterleitungen, feste Gesamtfrist, Grössengrenze; `WEBHOOK_ALLOW_PRIVATE` in Produktion verboten. Test: `webhooks.test.ts` |
| Klassifizierung | Person sieht innerhalb der eigenen Organisation Einträge über ihrer Freigabestufe | Spalte `classification` (0–2) und `app.clearance()` in den Policies der Lesesicht; Schreiben nur bis zur eigenen Stufe (`req.needClearance`); 403 ohne Inhalt in der eigenen Organisation. Tests: `rls.test.ts` (Lesesicht), `projekt.test.ts` |
| Fehler im eigenen Code | Abfrage ohne `WHERE tenant_id`, vergessene Policy, neue Tabelle ohne RLS, Rolle mit `BYPASSRLS` | RLS `FORCE` auch für Besitzer, Laufzeit-Rollen ohne `BYPASSRLS` und ohne Tabellenbesitz; Vollständigkeitsprüfungen in `rls.test.ts` (jede Tabelle, Policies, Rechte, `SECURITY DEFINER`, `PUBLIC`), absichtlich entfernte Policy fällt auf |
| Rechte am Ort | Person ohne Recht an der Organisation sieht Projekte, an denen sie nichts hat | Lesesicht: restriktive Policies mit `app.read_all()` bzw. `app.has_tuple()`; Listen zeigen nur Lesbares |
| Geheimnisse | Auslesen von Webhook-Geheimnissen oder Entra-Zugängen über die Datenbank oder Logs | Umschlagverschlüsselung mit Datenschlüssel je Mandant (AAD), Rotation; Redaction in den Logs |

## Massnahmen je Schicht

| Schicht | Massnahme | Ort |
|---|---|---|
| Anmeldung | Organisation aus dem Claim `organization`, Mitgliedschaft und Status geprüft, Wechsel nur ausdrücklich | `@vollholz/iam` (`iamPlugin`) |
| Anwendung | `req.need`/`req.needSomewhere`/`req.needClearance` vor jeder Arbeit; 404 für Fremdes; `req.tx` immer im Kontext | Routen der Module |
| Transaktion | `withTenant` setzt zu Beginn `SET LOCAL app.tenant_id`, `app.principal_id`, `app.principal_kind` und die Einstellungen der **Lesesicht** (`app.read_all`, `app.write_all`, `app.clearance`, Relationen …); tauglich für PgBouncer im Transaktionsmodus. Es gibt keinen Weg, Mandantentabellen ohne Kontext abzufragen | [`db/pool.ts`](../src/platform/db/pool.ts), [`authz/view.ts`](../src/platform/authz/view.ts) |
| Hintergrund | `fullTx`: volle Sicht ohne Person, aber immer im Mandanten des Jobs | [`authz/view.ts`](../src/platform/authz/view.ts), [`worker/queue.ts`](../src/platform/worker/queue.ts) |
| Datenbank | `ENABLE` + `FORCE ROW LEVEL SECURITY`, Policy `tenant_isolation` (`USING` und `WITH CHECK` auf `app.tenant_id()`) über `app.secure_tenant_tables()` am Ende jeder Migration; restriktive Policies der Lesesicht | [`db/migrations/`](../db/migrations) |
| Rollen | `ppm_owner` (Migrationen, `NOBYPASSRLS`), `ppm_app` (Gruppe der Laufzeit), `ppm_sched` (Scheduler), Logins `ppm_runtime` (API) und `ppm_worker` (Worker); keine besitzt `BYPASSRLS`, die Laufzeit besitzt keine Tabelle; `GRANT` nur an `ppm_app`/`ppm_sched`, nie `PUBLIC` | [`db/bootstrap.sql`](../db/bootstrap.sql) |
| Scheduler | Policies `sched_all` auf `job` und `outbox_event`, `sched_cleanup` (nur `DELETE` abgelaufener Zeilen) auf `idempotency_key`, nur für `ppm_sched` | [`001_core.sql`](../db/migrations/001_core.sql) |
| `SECURITY DEFINER` | nur die Funktionen des Baukastens mit Begründung (Mandant auflösen, gesperrte Mandanten, Plattform, Entra, Konto, Protokoll); Liste `SECURITY_DEFINER` in `rls.test.ts` | Migrationen von `@vollholz/iam` |
| Tests | `rls.test.ts`: Prüfungen des Test-Kits (`tenantTableProblems`, `grantedTableProblems`, `readViewProblems`, `securityDefinerProblems`, `publicSchemaProblems`, `publicExecuteProblems`, `bypassRoleProblems`), Matrix je Tabelle (fremder Mandant sieht, ändert, löscht nichts; Schreiben in fremden Mandanten scheitert; ohne Kontext nichts; Scheduler nur mit `sched`), Lesesicht, entfernte Policy. `tenant-isolation.test.ts`: über die API für jede Route der App-Tags (Vollständigkeit gegen die OpenAPI) | [`test/platform/`](../test/platform) |

Die Indizes des Schedulers über alle Mandanten (`job_due`, `job_running`, `job_finished`, `outbox_event_pending`,
`outbox_event_dispatched`, `idempotency_key_expires`) sind die einzige dokumentierte Ausnahme von «`tenant_id`
zuerst».

## Inventar der Tabellen im Schema `ppm`

Stand nach den Migrationen von `@vollholz/iam` und `001`–`003` der App. «R» = restriktive Policy. Tabellen des
Baukastens prüft identity-kit selbst; hier über `KIT_TABLES` und die Prüfungen des Test-Kits abgedeckt. Neue Tabellen
der App gehören in die `MATRIX` von [`rls.test.ts`](../test/platform/rls.test.ts).

### Tabellen der App

| Tabelle | Herkunft | `tenant_id` | RLS | Policies | Rechte | Testmatrix |
|---|---|:-:|---|---|---|---|
| `job` | `001_core.sql` | ✓ | FORCE | `tenant_isolation`, `sched_all` (`ppm_sched`) | `ppm_app` alle, `ppm_sched` alle | `sched` |
| `idempotency_key` | `001_core.sql` | ✓ | FORCE | `tenant_isolation`, `sched_cleanup` (`ppm_sched`, nur `DELETE` abgelaufener) | `ppm_app` alle, `ppm_sched` `SELECT`, `DELETE` | ✓ |
| `outbox_event` | `001_core.sql` | ✓ | FORCE | `tenant_isolation`, `sched_all` (`ppm_sched`) | `ppm_app` alle, `ppm_sched` alle | `sched` |
| `projekt` | `002_projekt.sql` | ✓ | FORCE | `tenant_isolation`; R: `projekt_read`, `projekt_insert`, `projekt_update`, `projekt_delete` (Lesesicht, Klassifizierung) | `ppm_app` alle | ✓ |
| `projekt_version` | `002_projekt.sql` | ✓ | FORCE | `tenant_isolation`; R: `projekt_version_read`, `projekt_version_insert` | `ppm_app` `SELECT`, `INSERT` (nur anhängen) | `appendOnly` |
| `webhook` | `003_webhooks.sql` | ✓ | FORCE | `tenant_isolation`; R: `webhook_admin` (`webhook:admin` an `org`) | `ppm_app` alle | ✓ |
| `webhook_delivery` | `003_webhooks.sql` | ✓ | FORCE | `tenant_isolation`; R: `webhook_delivery_admin` | `ppm_app` alle | ✓ |

### Tabellen des Baukastens (`KIT_TABLES`)

| Tabelle | `tenant_id` | RLS | Policies | Rechte `ppm_app` | Bemerkung |
|---|:-:|---|---|---|---|
| `tenant` | – | ENABLE | `tenant_self` (nur der eigene Mandant) | `SELECT` | Mandantenzeile selbst (`WITHOUT_TENANT`); Anlage und Status über `SECURITY DEFINER` |
| `principal` | ✓ | FORCE | `tenant_isolation`, `owner_tenant` (`ppm_owner`) | alle | Personen und Clients je Mandant |
| `authz_tuple` | ✓ | FORCE | `tenant_isolation`, `owner_tenant` (`ppm_owner`) | alle | Rollen an Orten |
| `member_invitation` | ✓ | FORCE | `tenant_isolation` | alle | Einladungen |
| `audit_log` | ✓ | FORCE | `tenant_isolation`, `owner_tenant` (`ppm_owner`) | `SELECT`, `INSERT` | Protokoll mit Hash-Kette, nur anhängen |
| `audit_anchor` | ✓ | FORCE | `tenant_isolation` | `SELECT`, `INSERT` | Anker der Hash-Kette |
| `entra_connection` | ✓ | FORCE | `tenant_isolation`, `entra_scan` (`ppm_owner`, nur mit `app.entra_scan`) | alle | Verbindung zu Microsoft Entra ID (Geheimnisse verschlüsselt) |
| `entra_consent` | ✓ | FORCE | `tenant_isolation` | alle | Admin-Zustimmung |
| `entra_consent_link` | ✓ | FORCE | `tenant_isolation` | alle | Links an die Entra-Administration |
| `session` | – | – | – | alle | Sitzungen der Oberfläche (BFF): verschlüsselt, Zugriff nur über die zufällige Sitzungs-ID (`WITHOUT_TENANT`) |
| `rate_limit` | – | – | – | alle | Zähler je Route und Schlüssel, keine Mandantendaten (`WITHOUT_TENANT`) |
| `replay_guard` | – | – | – | alle | Replay-Schutz (DPoP-Proofs, Logout-Tokens), nur Schlüssel und Ablauf (`WITHOUT_TENANT`) |
| `account` | – | – | – | keine | Konten über alle Organisationen; nur über `SECURITY DEFINER` (`app.account_*`) |
| `platform_audit_log` | – | – | – | keine | Protokoll der Plattform-Administration; nur über `app.platform_audit(…)` |

**Begründung der Ausnahmen:** `tenant` ist der Mandant selbst und sieht nur sich (`tenant_self`). `session`,
`rate_limit` und `replay_guard` enthalten keine fachlichen Daten eines Mandanten, sondern technische Schlüssel mit
Ablauf; der Zugriff erfolgt nur über nicht ratbare Schlüssel, und der Worker räumt sie alle 5 Minuten auf. `account`
und `platform_audit_log` sind bewusst mandantenübergreifend (Konto ohne Organisation, Plattform-Administration) und für
die Laufzeit nur über geprüfte Funktionen erreichbar. Die Policies `owner_tenant` und `entra_scan` gelten nur für die
Besitzer-Rolle (Bootstrap der ersten Organisation, Prüfungen des Baukastens) und auch dort nur im gesetzten Kontext.

## Löschen eines Mandanten

`tenant delete` sperrt den Mandanten und löscht die Zeilen der App-Tabellen oben (Liste `APP_TENANT_TABLES` in
[`ops/tenants.ts`](../src/platform/ops/tenants.ts)) als Superuser, weil RLS auch die Besitzer-Rolle bindet. Daten des
Baukastens bleiben als Nachweis ([offene-punkte.md](offene-punkte.md), Punkt 8; Runbook in
[betrieb.md](betrieb.md#mandanten-sperren-entsperren-löschen)).

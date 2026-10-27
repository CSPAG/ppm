# Mandantentrennung

Eine Datenbank für alle Organisationen; jede Organisation (Keycloak-Organisation) ist ein Mandant mit eigener
`tenant_id`. Grundsatz: Die Datenbank erzwingt die Trennung selbst – ein Fehler in der App darf keine Daten einer
anderen Organisation preisgeben.

## Bedrohungsmodell

| Angreifer | Ziel | Abwehr |
|---|---|---|
| Person einer anderen Organisation | fremde Daten lesen, ändern, Existenz von IDs erkennen | Organisation aus dem Token, RLS je Mandant, 404 für fremde wie für unbekannte IDs |
| Person ohne Rolle oder mit zu wenig Rechten | Daten lesen oder ändern | Rechte über Tupel (`req.need`), Lesesicht in RLS, Klassifizierung bis zur Freigabestufe |
| Kompromittierter Maschinen-Client | mehr tun als freigegeben | Rolle ∩ Scope, Freigabe je Organisation, DPoP-gebundene Tokens |
| Fehler in der App (fehlende Prüfung, falsches SQL) | Abfluss über Organisationsgrenzen | RLS `FORCE` auch für die Besitzer-Rolle, Laufzeit-Rollen ohne `BYPASSRLS`, kein Weg ohne Kontext |
| Abrufe an Adressen aus Daten (Webhooks) | internes Netz erreichen (SSRF) | `safeRequest` (`@vollholz/platform`): nur öffentliche Adressen, festgehaltene Auflösung, keine Weiterleitungen |

## Schutzschichten

1. **Token und Organisation:** `@vollholz/iam` prüft Signatur, Aussteller, Zielgruppe und ggf. DPoP; genau eine
   Organisation je Anfrage.
2. **Rechte:** Rollen als Tupel in der Datenbank, Entscheidung mit Kette der Orte und Scope.
3. **Kontext:** Jede fachliche Transaktion setzt `app.tenant_id`, `app.principal_id` und die Lesesicht per
   `set_config(…, true)` (nur bis zum Ende der Transaktion).
4. **RLS:** Jede Tabelle mit `tenant_id` hat `ENABLE` und `FORCE ROW LEVEL SECURITY` und die Policy
   `tenant_isolation` (`app.secure_tenant_tables()` nach jeder Migration); Fachtabellen zusätzlich restriktive
   Policies der Lesesicht.
5. **Rollen** (`db/bootstrap.sql`): `ppm_owner` besitzt alle Objekte und führt Migrationen aus;
   `ppm_runtime` (API) und `ppm_worker` sind Mitglieder von `ppm_app` bzw. zusätzlich
   `ppm_sched`; keine Rolle hat `BYPASSRLS`, die Laufzeit besitzt keine Tabelle.

## Inventar (Schema `ppm`)

Tabellen der App:

| Tabelle | Inhalt | Policies ausser `tenant_isolation` |
|---|---|---|
| `job` | Warteschlange | `sched_read` (Scheduler liest über alle Mandanten), `sched_write` (ohne Kontext oder nur im gesetzten Mandanten) |
| `idempotency_key` | gespeicherte Antworten | `sched_read`, `sched_cleanup` (nur abgelaufene) |
| `outbox_event` | Ereignisse | `sched_read`, `sched_write` |
| `handlungsfeld` | Handlungsfelder | `handlungsfeld_read`, `_insert`, `_update`, `_delete` (restriktiv: `app.has_permission(…)`, Recht an der Organisation) |
| `handlungsfeld_version` | Verlauf, nur anhängen (kein UPDATE/DELETE für die Laufzeit) | `handlungsfeld_version_read` (restriktiv) |
| `webhook_subscription` | Abonnements, Geheimnis verschlüsselt | `sched_read` |
| `webhook_delivery` | Zustellungen (mit Kopie der Ereignisdaten, ohne Fremdschlüssel auf die Outbox) | `sched_read`, `sched_write` |

Tabellen des Baukastens mit `tenant_id` (geprüft im Paket und mit den Prüfungen des Test-Kits): `principal`,
`authz_tuple`, `member_invitation`, `audit_log`, `audit_anchor`, `entra_connection`, `entra_consent`,
`entra_consent_link`. Policies dort: `owner_tenant` (Besitzer-Rolle im Kontext, Ersteinrichtung) an `principal`,
`authz_tuple`, `audit_log`; `entra_scan` an `entra_connection`.

Tabellen ohne `tenant_id` mit Rechten der Laufzeit:

| Tabelle | Begründung |
|---|---|
| `tenant` | Mandantenzeile selbst: Policy `tenant_self` (nur der eigene Mandant), Schreiben nur Name und Einstellungen |
| `session` | Sitzungen der Oberfläche, verschlüsselt, Zugriff nur über die zufällige Sitzungs-ID |
| `rate_limit` | Zähler je Route und Schlüssel, keine Mandantendaten |
| `replay_guard` | Replay-Schutz (DPoP-Proofs, Logout-Tokens), nur Schlüssel und Ablauf |

Ohne Rechte der Laufzeit: `account`, `platform_audit_log` (Zugriff nur über Funktionen des Baukastens).

**Ausnahmen vom Grundsatz «`tenant_id` zuerst in Indizes»** – der Scheduler sucht über alle Mandanten:
`job_due` (`run_at`, offene Jobs), `job_running` (`heartbeat_at`), `outbox_event_pending` (`created_at`,
unverteilt), `webhook_delivery_due` (`next_attempt_at`, offen).

**Scheduler:** `ppm_sched` (Login nur über `ppm_worker`) liest und ändert Warteschlange, Outbox
und Zustellungen über alle Mandanten, liest Abonnements und räumt abgelaufene Idempotenz auf. Fachliche Arbeit eines
Jobs läuft immer im Kontext seines Mandanten. SECURITY-DEFINER-Funktionen gibt es nur im Baukasten, jede mit
Begründung in `test/app/rls.test.ts`.

## Prüfungen

| Prüfung | Inhalt |
|---|---|
| `test/app/rls.test.ts` | Vollständigkeit gegen den Katalog (jede Tabelle mit `tenant_id` in der Matrix oder im Baukasten), RLS `FORCE`, Prüfungen des Test-Kits (Rechte, Lesesicht, SECURITY DEFINER, PUBLIC, Rollen), Liste aller Policies, eine entfernte Policy fällt auf, Matrix: B sieht/ändert/löscht nichts von A, ohne Kontext keine Zeilen |
| `test/app/tenant-isolation.test.ts` | über die API: fremde IDs = unbekannte IDs (404, ohne Daten), Listen nur der eigenen Organisation; jede Route der App-Module abgedeckt |
| `npx iam-conformity-test` | Vertrag mit identity-kit: Repository (jeder PR), Datenbank (`--db`, in CI nach den Migrationen), Realm (`--realm`) |

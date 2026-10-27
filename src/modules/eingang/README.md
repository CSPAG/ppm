# Modul `eingang`

Aufgaben («Zu tun»), Mitteilungen und Stellvertretung (BC AM.01.03, UC-016 Schritt 4, UX-E3). Grundlage:
[Fachmodell 2.1, 3.4, 4](../../../docs/fachmodell.md#4-aufgaben-und-eingang). Das Modul kennt kein Fachmodul; die
Fachmodule nutzen es über `index.ts`.

## Aufgaben öffnen und schliessen

Das Modul, dem der Ablauf gehört, öffnet und schliesst seine Aufgaben **in derselben Transaktion** wie die auslösende
Änderung. Die Arten und Empfänger stehen in [Fachmodell 4.2](../../../docs/fachmodell.md#42-aufgaben-je-rolle).

```ts
import { aufgabe } from '../eingang/index.ts';

// in req.tx(async tx => { … }) bzw. ctx.tx(async tx => { … }) eines Jobs
await aufgabe.oeffnen(tx, {
  art: 'statusbericht.erstellen',                       // <modul>.<verb>
  bezug: { typ: 'statusbericht', id: bericht.id },      // fachlicher Bezug (Text, z. B. UUID oder '2026-10')
  empfaenger: { person: pl },                           // oder { recht: 'statusbericht:review' }
                                                        // oder { recht: 'sitzung:write', ort: { typ: 'portfolio', id } }
  titel: 'Statusbericht Oktober erstellen',             // Sie-Form, mit Objekt
  kontext: '2026-014 Neues KIS · als PL',               // optional: Projekt und Rolle
  link: '/projekte/2026-014/bericht?periode=2026-10',   // führt direkt zur Aktion (I-B1)
  frist: { datum: '2026-10-25', art: 'kalendertage' },  // optional; Art immer angeben (UX-E11)
});
await aufgabe.erledigen(tx, { art: 'statusbericht.erstellen', bezug: { typ: 'statusbericht', id: bericht.id } });
await aufgabe.entfallen(tx, { art: 'vertrag.unterzeichnen', bezug: { typ: 'vertrag_version', id } }); // nicht mehr nötig
```

- **Idempotent:** Je (Art, Bezug, Empfänger) ist höchstens eine Aufgabe offen. Erneutes `oeffnen` führt Titel, Kontext,
  Link und Frist nach (Sammelaufgabe «Statusberichte Oktober prüfen · 8 neu») – Jobs dürfen täglich öffnen.
- **Schliessen** ohne `empfaenger` schliesst alle offenen Aufgaben der Art zum Bezug (z. B. alle drei Unterzeichnungen),
  auch solche, die die handelnde Person nicht sieht. `erledigt` = die Handlung ist getan, `entfallen` = nicht mehr nötig.
- **Empfänger Recht:** sichtbar für alle, die das Recht am Ort haben (`app.has_permission`); Rollenwechsel wirken
  sofort. Am Ort `org` ohne `ort`.
- **Von Hand erledigen** (`manuell: true`) nur für Aufgaben ohne fachlichen Übergang (z. B. «Unterlagen lesen»); sonst
  schliesst die Handlung selbst die Aufgabe, und `POST /v1/eingang/aufgaben/:id/erledigen` antwortet 409.
- Fristen nie als Konstante: aus `phasenmodell.frist` (Fachmodell 2.14).

## Mitteilungen

```ts
import { mitteilung } from '../eingang/index.ts';
await mitteilung.senden(tx, { an: person, bezug: { typ: 'idee', id }, text: 'Ihre Projektidee wurde zurückgewiesen.', link: `/portfolio/ideen?o=${nr}` });
```

Information ohne Handlung; nur im Eingang, E-Mail mit Link folgt mit einem Netz-Adapter (A-44).

## Stellvertretung

Eine Person erfasst im Profil Vertretung, Zeitraum (Kalendertage in Europe/Zurich, beide eingeschlossen) und ob die
Vertretung unterzeichnen darf (UX-OF-10, A-31). Wirkung im Zeitraum:

- Personen-Aufgaben der vertretenen Person erscheinen auch der Vertretung, mit `vertretung` (Lesesicht AUFGABE).
- Die Vertretung erhält befristete Tupel mit den Rollen der vertretenen Person an Portfolios und Projekten (nicht an
  der Organisation); liegt der Beginn in der Zukunft, setzt sie der Job `eingang.stellvertretung_aktivieren`. Beenden
  entzieht sie sofort.
- **Unterschriften:** Die Rollen `sp`, `pl`, `ctl` enthalten `vertrag:sign`. Das unterzeichnende Modul (AP-E3-2) prüft
  bei einer Unterschrift in Vertretung zusätzlich:

```ts
import { stellvertretung } from '../eingang/index.ts';
const v = await stellvertretung.aktiv(tx, { vertretene: sp, vertreter: me });
if (!v?.unterschriften) throw forbidden('Unterschriften sind in dieser Stellvertretung nicht erteilt.');
// Unterschrift mit in_vertretung_von = sp; Anzeige «‹Vertretung› in Vertretung von ‹Person›» (darstellung.md)
```

- Banner «Sie handeln in Vertretung von …» (I-Z2): `stellvertretung.vertretene(tx, me)` liefert die heute vertretenen
  Personen.

## Kopf je Rolle

Jedes Fachmodul bietet `GET /v1/<modul>/kopf` mit den Kennzahlen der Person (Fachmodell 4.1); die Startseite
(`web/src/features/eingang`) ruft die Köpfe der Module auf, für die die Person ein Recht hat. Der Eingang selbst liefert
`GET /v1/eingang/anzahl` (offen, überfällig, nächste Frist) für den Zähler an «Eingang» (I-N3).

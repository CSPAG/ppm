# Modul `sitzung`

Sitzungen der Gremien (UC-006, Kernablauf [K3](../../../docs/ux/ablaeufe/K3-gremiumssitzung.md)). Grundlage:
[Fachmodell 2.9, 3.4, 4.2](../../../docs/fachmodell.md#29-sitzung). AP-E2-1 baut die Vorbereitung (Sitzung,
Traktandenvorschläge, Arten-Registry, Einladungen, Unterlagenstand, Versand, Aufgabe «Sitzung vorbereiten»); AP-E2-2
ergänzt Sitzungsmodus, Entscheide, Auflagen und Protokoll in eigenen Dateien (`entscheid*`, `protokoll*`) mit je einer
Zeile in `index.ts` (`ROUTEN`, `mcpTools`).

## Traktandenart registrieren

Das Modul, dem das Geschäft gehört, registriert seine Art beim Laden seines Moduls (in seiner `index.ts`). `sitzung`
importiert es nie (Rückwirkung über Registrierung, Fachmodell 1.1).

```ts
import { registriereTraktandenart } from '../sitzung/index.ts';

registriereTraktandenart({
  art: 'gate',                                   // nur Arten aus Fachmodell 2.9
  label: 'Gate-Review',                          // optional, sonst Vorgabe des Moduls
  dauerMin: 35,                                  // Zeitbedarf beim Aufnehmen (UC-006 Schritt 2)
  zusammenfassung: async (tx, bezug) => ({ titel, antrag: 'Freigabe Phase P2 und Projektvertrag Version 2.0' }),
  unterlagen: async (tx, bezug) => [{ art: 'packet', titel: 'Gate Review Packet', bereit, qualityCheck: 'bestanden', hinweis: 'Quality-Check bestanden 28.10.' }],
  ergebnisse: [{ schluessel: 'freigegeben', label: 'Freigegeben' }, …],   // AP-E2-2
  beiEntscheid: async (tx, e) => { … },          // AP-E2-2: in der Transaktion des Entscheids
});
```

- **Bezug:** `{ typ, id, projektId }`. Ein Geschäft, das die UE direkt einplant (PP.04.05), hat den Bezug
  `{ typ: 'projekt', id: <projekt> }`; die Art löst ihn in `zusammenfassung`, `unterlagen` und `beiEntscheid` auf
  (z. B. auf den offenen Gate-Antrag des Projekts).
- **Unterlagen:** Ohne Funktion braucht die Art keine Unterlagen (Stand `keine`). Stand je Traktandum: `bereit`, wenn
  alle bereit sind; `quality_check_offen`, wenn eine Unterlage `qualityCheck: 'offen'` hat; sonst `fehlt`. Eine nicht
  registrierte Art gilt als `fehlt`. Beim Versand wird der Stand festgehalten (`ppm.unterlage`).
- **Fest:** `fest: true` setzt die Art in jede neue Sitzung (Portfoliobericht als Traktandum 1, UC-006 Schritt 4).

## Geschäft vorschlagen

In der Transaktion der auslösenden Änderung, auch ohne `sitzung:write` (Eskalation durch die PL, Änderungsantrag):

```ts
import { traktandum } from '../sitzung/index.ts';

await traktandum.vorschlagen(tx, {
  art: 'eskalation', bezug: { typ: 'eskalation', id }, projektId,   // Gremium: entscheidendes des Portfolios (A-45)
  titel: 'Eskalation Lieferverzug', antrag: 'Massnahme beschliessen',
});
await traktandum.zuruecknehmen(tx, { art: 'aenderung', bezug: { typ: 'vertrag_version', id } }); // solange nicht versendet
```

- **Idempotent** je (Art, Bezug): ein offenes Traktandum behält seinen Stand, Titel und Antrag werden nachgeführt.
- Der Vorschlag erscheint in den Vorschlägen jeder offenen Sitzung des Gremiums, bis die UE ihn aufnimmt.

## Ablauf

| Schritt | Route | Wirkung |
|---|---|---|
| Sitzung entsteht | Lauf `sitzung.fristen` (stündlich) oder `POST /v1/gremien/{kuerzel}/sitzungen` | ab `sitzung_vorbereiten` (15 Arbeitstage) Aufgabe `sitzung.vorbereiten` an `sitzung:write` am Portfolio, Frist Versand |
| Aufnehmen | `POST /v1/sitzungen/{id}/traktanden` | Zeitbedarf der Art, «via SNS-VR» (Gate, Meilenstein eines Projekts in P0/P1 mit SNS-VR im Gremienweg), Einladungen PL, CTL, SP |
| Verschieben | `POST /v1/traktanden/{id}/verschieben` | auf den nächsten Termin; PL und SP werden mit dem Versand informiert |
| Versenden | `POST /v1/sitzungen/{id}/versenden` | Unterlagen festgehalten, Aufgabe `sitzung.lesen` an `sitzung:read`, Einladungen gebündelt je Person, Versand mit Vorlauf protokolliert |

Lesesicht: Traktanden, Einladungen und Unterlagen vor dem Versand nur mit `sitzung:write`; danach Mitglieder
(`sitzung:read` am Portfolio, vertrauliche Geschäfte nur mit `projekt:vertraulich`) und Eingeladene (nur ihr Traktandum).

## Sitzung durchführen (AP-E2-2)

Dateien `entscheid*` und `protokoll*` (Migration 140). Ablauf nach UC-006 Schritte 6–9 und K3 Schritte 7–10:

| Schritt | Route | Wirkung |
|---|---|---|
| Starten | `POST /v1/sitzungen/{id}/starten` | nach dem Versand: Sitzungsmodus (`laufend`); `GET /v1/sitzungen/{id}/entscheide` liefert je Traktandum Optionen und Entscheid |
| Entscheid | `PUT /v1/traktanden/{id}/entscheid` | Ergebnis aus `ergebnisse` der Art, Begründung Pflicht, Auflagen (bei `mit_auflagen` mindestens eine), Weiterleitung an den VR (A4); `beiEntscheid` sofort in derselben Transaktion |
| Korrektur | dieselbe Route mit `If-Match` | bis zum Schliessen, Verlauf in `entscheid_version` (A-30); `beiEntscheid` läuft erneut mit dem neuen Ergebnis |
| Schliessen | `POST /v1/sitzungen/{id}/schliessen` | Protokollentwurf; Traktanden ohne Entscheid und zurückgestellte Geschäfte (`zurueckgestellt`) werden Vorschläge der nächsten Sitzung; Auflagen werden Aufgaben `auflage.erfuellen`; Aufgabe `protokoll.versenden` (Frist `protokoll`); PL, SP und Verantwortliche erhalten je Person eine Mitteilung (I-B3) |
| SNS-VR | `PUT /v1/traktanden/{id}/entscheid/sns` | nur «via SNS-VR», nach dem Schliessen, einmal: jetzt läuft `beiEntscheid` mit `viaSns: true` |
| Protokoll | `GET/PUT /v1/sitzungen/{id}/protokoll`, `…/protokoll/versand`, `POST …/protokoll/versenden` | bereinigen (Anwesende, Notizen, Bemerkungen), Vorschau der Empfänger, Versand mit Arbeitstagen nach der Sitzung (K3-4) |
| Auflage | `POST /v1/auflagen/{id}/erfuellen` | verantwortliche Person, Vertretung oder `sitzung:write`; erledigt die Aufgabe |
| Liste | `GET /v1/entscheide` | Filter Projekt, Gremium, `anVr`, `auflagen=offen` (UI-36; MCP `list_entscheide`) |

Für die Art heisst das:

- **Ergebnisse:** `ergebnisse` der Registry gilt; eine noch nicht registrierte Art erhält die Optionen aus K3 Schritt 8.
  Leere Liste = Kenntnisnahme ohne Entscheid (Portfoliobericht); solche Traktanden werden nicht weitergeschoben.
- **`beiEntscheid`** muss idempotent sein und die Wirkung dem **zuletzt** übergebenen Ergebnis angleichen (Korrektur in
  der Sitzung, A-30). Bei «via SNS-VR» kommt der Aufruf erst mit dem Entscheid des SNS-VR (`viaSns: true`, A1).
- Die Folge ist sofort im Datenbestand; Benachrichtigungen an Betroffene schickt `sitzung` beim Schliessen.

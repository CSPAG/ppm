# Übernahme aus dem Excel-Dashboard (AP-E0-7)

Einmalige Übernahme der laufenden Projekte (K16, A-14) über `POST /v1/projekte/uebernahme`. Die Spalten folgen dem
heutigen «Dashboard Transformationsprogramm» (Q6 F7, Q8 Kap. 8.3); das Excel-Original liegt nicht im Repository.

| Datei | Inhalt |
|---|---|
| `vorlage.csv` | Kopfzeile in der erwarteten Reihenfolge |
| `beispiel.csv` | synthetisches Beispiel (erfundene Daten, für Tests und Erklärung) |

## Spalten

| Spalte (Kopfzeile) | Pflicht | Wert | Ziel |
|---|---|---|---|
| Index | nein | Nummer im Dashboard, z. B. `07` | Herkunft des Projekts; dieselbe Zeile wird nicht zweimal übernommen |
| Strategisches Handlungsfeld | nein | Bezeichnung wie unter Ziele › Handlungsfelder | Handlungsfeld des Projekts |
| Priorität | nein | Text | Herkunft |
| Projektname | ja | höchstens 200 Zeichen | Name |
| Thema / Inhalt | nein | Text | Herkunft |
| ProjektleiterIn | nein | E-Mail-Adresse (eindeutig) oder Name einer Person der Organisation | Projektleitung in der Projektorganisation (Rolle am Projekt) |
| Projektphase | ja | `P0` bis `P4` | Phase |
| Abschluss per | nein | Datum `TT.MM.JJJJ` | «Abschluss per» im Bericht der Übernahmeperiode |
| Meilenstein Termin | nein | Datum `TT.MM.JJJJ` | mit Text: Eintrag im Meilensteinplan der aktuellen Phase |
| Nächster Meilenstein | nein | Text, höchstens 500 Zeichen | «Nächster Meilenstein» im Bericht der Übernahmeperiode |
| Status | nein | `im Plan` oder `kritisch` | Status im Bericht der Übernahmeperiode (Vorperiode des ersten Berichts) |
| Trend | nein | `↗` `→` `↘` oder `aufwärts`, `gleichbleibend`, `abwärts` | Trend im selben Bericht |
| Begründung, Massnahme | bei `kritisch` | Text | im selben Bericht (UC-004 A2; im Dashboard nicht vorhanden, darum zusätzlich) |

Excel: «Speichern unter» → «CSV UTF-8 (durch Trennzeichen getrennt)». Trennzeichen `;` oder `,`, Felder mit
Trennzeichen oder Zeilenumbruch in Anführungszeichen. Die Projektnummer vergibt PPM neu («JJJJ-NNN», A-47).

## Ablauf

1. Personen der Projektleitung, Handlungsfelder und Portfolio sind erfasst.
2. Prüflauf: `speichern: false` – Ergebnis je Zeile mit Fehlern, nichts gespeichert.
3. Speichern: `speichern: true` – nur wenn keine Zeile einen Fehler hat (sonst 422 mit demselben Ergebnis).

```json
POST /v1/projekte/uebernahme
{ "csv": "<Inhalt der Datei>", "portfolio": "transformation", "periode": "2026-09", "speichern": false }
```

`periode` ist die Periode der übernommenen Werte (ohne Angabe der Vormonat); der erste Bericht im System folgt danach.
Rechte an der Organisation: `projekt:create`, `projekt:write`, `projekt:organisation`, `statusbericht:write`.

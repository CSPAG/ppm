# K6 Ziele festlegen und Zielerreichung berichten

| | |
|---|---|
| **Rollen** | primär GL (legt Ziele, Jahresziele, Metriken fest), UE (pflegt im System, erfasst Freigaben, publiziert, erstellt Quartalsreporting, übergibt den Budgetbedarf); im System pflegt, wer alle Portfolios führt (Master Entscheid 18); beteiligt PRAT (verabschiedet in [K3](K3-gremiumssitzung.md)), VR (über die UE) |
| **Gerät** | Desktop; GL liest und beurteilt auch auf dem Tablet |
| **Use Cases** | [UC-011](../../anhang/use-cases.md#uc-011-ziele-im-jahreszyklus-festlegen) (alle Schritte, A1–A2), [UC-012](../../anhang/use-cases.md#uc-012-quartalsreporting-an-den-vr-erstellen) (alle Schritte, A1) |
| **Oberflächen** | UI-38 Zielzyklus, UI-39 Freigabe der Jahresziele, UI-31 Roadmap, UI-40 Zielerreichung, UI-41 Quartalsreporting |
| **Arbeitsraum** | Ziele `/ziele/2027`, Zielerreichung `/ziele/2026/zielerreichung?quartal=q3`, Quartalsreporting `/ziele/2026/quartalsreporting?quartal=q3` |
| **Etappe** | E6 (Handlungsfelder und strategische Ziele als Stammdaten bereits in E0) |

Ziele setzen (jährlich) und ihre Erreichung berichten (quartalsweise) sind für GL und UE eine Geschichte: dieselben
Ziele, dieselbe Hierarchie, dieselben Metriken. Darum ein Kernablauf.

## Job-Story

- **GL:** Wenn der Zielzyklus beginnt, will ich die Jahresziele aus den strategischen Zielen ableiten und sehen, welche
  Projekte beitragen, damit dem VR ein vollständiges Set mit Metriken vorliegt.
- **UE:** Wenn ein Quartal endet, will ich den Bericht an den VR aus Dashboard und Zielerreichung erzeugen statt zusammenkopieren,
  damit der PRAT ihn rechtzeitig verabschieden kann.

## Zielgrössen

| Nr. | Grösse | Zielwert | Messung |
|---|---|---|---|
| K6-1 | Jahresziel mit Metrik, Zielwert und Hauptaktivität anlegen | ≤ 3 Min. | Aufgabentest |
| K6-2 | Vom Projekt zum strategischen Ziel und zurück | ≤ 2 Klicks | automatischer Test |
| K6-3 | Zielerreichung eines Quartals für 30 Ziele erfassen | ≤ 20 Min. | Aufgabentest |
| K6-4 | Entwurf Quartalsreporting nach erfasster Zielerreichung bereit zur Traktandierung | ≤ 30 Min., ohne Dateien ausserhalb des Systems | Aufgabentest |

## Einstieg

- **Eingang (GL, UE):** «Zielzyklus 2027 starten» im Jahreszyklus (Q6 F2; Zeitpunkt in der Konfiguration), «Jahresziele 2027
  vervollständigen · Vorlage an den VR bis ‹Datum›»; «Quartalsreporting Q3 erstellen» nach Quartalsende, sobald das
  Dashboard abgeschlossen ist (UC-012 Vorbedingung).
- **Projektakte:** Strategiebezug verlinkt auf das Ziel in Ziele (G3).

## Ablauf

**Ziele festlegen (UC-011; Seitentyp Arbeitsfläche):**

1. **Zielzyklus 2027** (Schritt 1): links der Baum Handlungsfeld › strategisches Ziel › Jahresziel › Hauptaktivität ›
   Projekt; je Handlungsfeld Leitsatz und Stossrichtungen, je strategischem Ziel die Zielerreichung. Rechts das
   gewählte Element zum Bearbeiten, darunter der Prüfbericht («3 Ziele ohne Metrik»). Kopf: «Zielzyklus 2027 · in Arbeit ·
   Freigabe VR geplant ‹Datum›».
   **Strategie-Aktualisierung** (A1, UE): Handlungsfeld, Leitsatz, Stossrichtungen bearbeiten; das System versioniert und
   zeigt im Seitenpanel «Betrifft 4 Ziele, 11 Projekte».
2. **Strategische Ziele aktualisieren** (Schritt 2): bearbeiten wie jedes Element; Verlauf zeigt frühere Stände (G11).
3. **Jahresziel hinzufügen** (Schritt 3) unter einem strategischen Ziel.
4. **Hauptaktivitäten** (Schritt 4) mit Verantwortlichen (Person); **Projekt zuordnen** per Suche; **Projektidee anstossen**
   führt in den Assistenten von [K4](K4-projektidee.md) mit vorausgefülltem Strategiebezug.
5. **Metrik** (Schritt 5): je Ziel Metrik und Zielwert; ohne Metrik markiert der Baum das Ziel (G4).
6. **Zur Freigabe vorlegen** (Schritt 6; Seitentyp Assistent): Prüfung (alle Ziele mit Metrik), Zusammenfassung (Anzahl
   Ziele je Handlungsfeld, Änderungen zum Vorjahr), Wirkung: «32 Jahresziele werden ‹zur Freigabe› gesetzt. Änderungen
   danach sind als ‹geändert nach Vorlage› markiert.» Danach Z9 (UX-E13). Die Unterlagen für den VR lassen sich als Dokument herunterladen (der VR ist
   kein Benutzer, UX-E8).
7. **Freigabe erfassen** (Schritt 7, UE): Datum und Entscheid des VR. «Freigegeben» setzt die Jahresziele in Kraft.
   «Anpassungen verlangt» (A2) mit Rückmeldungen setzt sie auf «in Arbeit» zurück und informiert die GL; weiter bei Schritt 3.
8. **Roadmap publizieren** (Schritt 8, UE): Vorschau der Roadmap (Zeitplan der Projekte je Handlungsfeld und Ziel), Wirkung
   «Alle angemeldeten Personen sehen die Roadmap 2027 lesend.» (Kreis offen, [UX-OF-14](../fahrplan.md#offene-fragen)).
   **Vor der Freigabe publizieren** (UC-011 A3; UX-E12): Sind die Jahresziele noch nicht in Kraft, zeigt die Aktion vorher
   «Die Roadmap erscheint mit dem Vermerk ‹Jahresziele noch nicht freigegeben›.» Der Vermerk entfällt mit der Freigabe.
9. **Budgetbedarf übergeben** (Schritt 9): Verweis auf Portfolio › Finanzen › Budgetprozess (UC-010, Seitentyp Assistent,
   ohne eigene Spezifikation).

**Zielerreichung und Quartalsreporting (UC-012):**

10. **Zielerreichung** (Schritte 1–2; Seitentyp Arbeitsfläche): Tabelle je Ziel mit Metrik, Zielwert, letztem Stand und
    Feld für den neuen Stand mit Kommentar; GL und UE bearbeiten gemeinsam, jeder Stand mit Datum und Person. Fortschritt im
    Kopf: «24 von 30 Zielen nachgeführt».
11. **Bericht erstellen** (Schritt 3): Das System erzeugt den Entwurf mit Gesamtstatus, Fortschritten und Meilensteinen,
    wesentlichen Entwicklungen, kritischen Portfoliorisiken, Abhängigkeiten und Eskalationen, finanziellen und
    organisatorischen Auswirkungen und den zur Weiterleitung markierten Geschäften (UC-006 A4). Jede Zahl führt zu ihrer
    Herkunft (G11).
12. **Kommentieren und traktandieren** (Schritt 4) → Vorschlag für die nächste PRAT-Sitzung ([K3](K3-gremiumssitzung.md)).
13. **Verabschiedung** (Schritt 5) in K3: «Verabschiedet» → Stand «verabschiedet», **Als Dokument herunterladen** für den VR.
    «Anpassungen verlangt» (A1) → Stand «in Arbeit», weiter bei Schritt 11.
14. **Rückmeldungen des VR erfassen** (Schritt 6): Text und Aufträge mit Verantwortlichen und Termin; Aufträge werden
    Aufgaben im Eingang.

## Zustände

| Zustand | Gestaltung |
|---|---|
| Z9 Zur Freigabe | Banner «Jahresziele 2027 liegen dem VR zur Freigabe vor (seit ‹Datum›).» Ändern bleibt möglich; Änderungen sind «geändert nach Vorlage» markiert und im Verlauf sichtbar (UX-E13) |
| Z9 In Kraft | Banner «Jahresziele 2027 in Kraft seit ‹Datum›»; Änderungen über eine neue Version mit Verlauf |
| Z4 Teilweise (Quartalsreporting) | Dashboard des Quartalsendes noch nicht abgeschlossen: Entwurf möglich, Hinweis «Statusberichte September noch nicht abgeschlossen; Zahlen können sich ändern.» |
| Z2 Leer (neuer Zyklus) | «Zielzyklus 2028 ist leer. Übernehmen Sie die strategischen Ziele und die nicht erreichten Jahresziele von 2027.» mit **Aus 2027 übernehmen** |

## Regeln und Rückmeldungen

| Regel (Quelle) | Zeitpunkt | Stufe | Text | Ausweg |
|---|---|---|---|---|
| Jedes Ziel hat eine Metrik (UC-011 Schritt 5) | *vorher* im Baum, *dabei* beim Vorlegen | Sperre beim Vorlegen | «Metrik fehlt: 3 Jahresziele haben keine Metrik (2.1.3, 4.2.1, 5.1.2). Ergänzen Sie Metrik und Zielwert.» | Sprung zum Ziel |
| Jahresziel ohne Hauptaktivität oder Projekt | *vorher* im Prüfbericht | Hinweis | «Jahresziel 3.2.1 hat noch keine Hauptaktivität.» | – |
| Zielerreichung unvollständig (UC-012 Schritt 2) | *danach* bei «Bericht erstellen» | Warnung | «Zielerreichung Q3: 6 von 30 Zielen ohne neuen Stand. Sie erscheinen mit dem Stand von Q2.» | nachführen oder so erstellen |

## Texte

- Schaltflächen: «Jahresziel hinzufügen», «Projekt zuordnen», «Projektidee anstossen», «Zur Freigabe vorlegen», «Freigabe
  erfassen», «Roadmap publizieren», «Bericht erstellen», «Als Dokument herunterladen»
- Ebenen in der Oberfläche: «Handlungsfeld», «Strategisches Ziel», «Jahresziel», «Hauptaktivität», «Projekt» (Glossar)

## Barrierefreiheit und Tastatur

- Zielbaum als Baum nach WAI-ARIA (Pfeiltasten auf- und zuklappen, Enter öffnet), Ebene wird angesagt.
- Zielerreichung: Tabelle mit direkter Eingabe, Tab springt zum nächsten Ziel.

## Abnahmekriterien

- [ ] «Zur Freigabe vorlegen» ist gesperrt, solange ein Jahresziel keine Metrik hat, und nennt die Ziele.
- [ ] Nach dem Vorlegen sind die Jahresziele nicht mehr bearbeitbar, bis die UE den Entscheid des VR erfasst.
- [ ] «Anpassungen verlangt» setzt die Jahresziele auf «in Arbeit» und informiert die GL.
- [ ] Ein Projekt, das im Vertrag einem Ziel zugeordnet ist, erscheint im Baum unter diesem Ziel.
- [ ] Der Entwurf des Quartalsreportings enthält die im PRAT zur Weiterleitung markierten Geschäfte.
- [ ] Aufträge des VR erscheinen als Aufgaben im Eingang der Verantwortlichen.

## Entscheide und offene Fragen

- Entscheid: Ziele setzen und berichten in einem Arbeitsraum mit einer Hierarchie (G3).
- Entscheid: VR und SNS-VR erhalten Dokumente; Freigaben erfasst die UE (UX-E8, Vorschlag K02).
- Offen: Ebenen der Ziele (K17); Kreis der Roadmap ([UX-OF-14](../fahrplan.md#offene-fragen)).

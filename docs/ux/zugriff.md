# Zugriff: Schloss im Kopf und vertrauliches Portfolio

Entscheidungsvorlage für die Master-Session. Sie ergänzt den Bereich «Zugriff» (UX-E14, UI-51; gebaut in
`web/src/features/projekt/Zugriff.tsx`) um drei Dinge: eine Schaltfläche mit Schloss im Kopf von Projekt und Portfolio,
eine Darstellung im Stil der Beschränkungen von Confluence und die Kennzeichnung «vertraulich» am Portfolio.

| | |
|---|---|
| Stand | 29. Oktober 2026 |
| Status | Übernommen am 30.10.2026 (Master Entscheid 22, UX-E15, A-76, AP-E9-1); offen K36. Etappe 1 (Anzeigen) ist umgesetzt (#213), Etappe 2 (vertraulich am Portfolio) ist das Paket AP-E9-1. |
| Betrifft | UI-51, UI-52, UC-016 A2, Master-Entscheide 13, 14, 16, 18, A-34, A-70, A-71, A-73, [darstellung.md](darstellung.md) |
| Vorbild | Beschränkungen in Confluence ([Doku Cloud](https://support.atlassian.com/confluence-cloud/docs/add-or-remove-page-restrictions/)): Sehen wird an Unterseiten vererbt und kann dort nur enger werden |

## Was schon gilt

| Ebene | Rolle (Funktion als Beispiel) | Darf am Ort |
|---|---|---|
| je Projekt | Projekt führen (Projektmanager:in) | lesen, bearbeiten, Zugriff verwalten |
| | Projekt steuern (Projektauftraggeber:in) | lesen, unterzeichnen und entscheiden als Vermerk |
| | Projekt mitlesen (z. B. Kernteam) | lesen |
| je Portfolio | Portfolio führen (Projektportfoliomanager:in) | alle Projekte des Portfolios lesen und bearbeiten, Projekte anlegen, Zugriff verwalten |
| | Portfolio steuern (Portfolio-Auftraggeber:in) | alle Projekte des Portfolios lesen, Initialisierungen freigeben, Entscheide zu Verträgen vermerken |
| | Gremium (z. B. PRAT) | alle Projekte des Portfolios lesen |
| übergreifend | alle Portfolios führen | alles führen, dazu was keinem Portfolio gehört |
| | alle Portfolios lesen | alles lesen ausser Ressourcen |
| Grundlage | Mitglied | Projekte auflisten (Kopfdaten), Ziele und eingereichte Ideen lesen, eigene Ideen erfassen |

- Wer an einem Ort eine Rolle hat, sieht dort auch Beträge und vertrauliche Projekte; Mitglieder ohne weitere Rolle sehen
  beides nicht (Entscheid 13).
- «Vertraulich» gibt es heute nur am Projekt: Für Mitglieder fehlt es in jeder Liste (Entscheid 13, UX-OF-13).
- Den Zugriff verwaltet, wer am Ort führt, im Bereich «Zugriff» oder in Administration › Zugänge. Die Projektorganisation
  wirkt nicht auf den Zugriff (Entscheid 16, A-71).
- Der Bereich «Zugriff» zeigt heute zwei Gruppen («am Projekt» und «über das Portfolio oder übergreifend») mit den Spalten
  Person, Rolle, Über, Befristet und «Warum?».

## Entscheide aus der Besprechung

| Nr. | Entscheid |
|---|---|
| Z-1 | **Der Standard bleibt nach Rolle** wie in den Entscheiden 13 und 14. Es gibt kein «Alle können lesen». |
| Z-2 | **Ein vertrauliches Portfolio wird gebraucht.** Wer es nicht sehen darf, sieht es auch nicht in Listen. |
| Z-3 | **Kein Schalter «Standard / eingeschränkt»:** oben steht die Stufe, darunter immer die Liste der Rollen und Personen, wie in Confluence. |
| Z-4 | **Wer das Objekt lesen darf, sieht alle Namen** (gilt im Bereich «Zugriff» schon). |
| Z-5 | **Eingestellt wird nur die Stufe;** was jemand darf (lesen, bearbeiten), folgt der Rolle. Zugriff geben, befristen und entfernen bleibt wie im Bereich «Zugriff». |

## 1 Schaltfläche «Zugriff» im Kopf

- Im Kopf der Projektakte und des Portfolios: Personen-Symbol und «Zugriff»; bei einem vertraulichen Objekt Schloss und
  «Zugriff · vertraulich».
- Ein Klick öffnet eine Kurzübersicht (mobil als Blatt von unten, I-M3):
  1. dein Zugriff mit Grund, z. B. «Du kannst bearbeiten, weil du das Projekt führst.» (`GET /v1/access/explain`);
  2. die Stufe, bei Vererbung mit «geerbt von Portfolio ‹Name›»;
  3. je Rolle die Anzahl Personen, aufklappbar zu den Namen: am Projekt (führen, steuern, mitlesen), über das Portfolio
     (führen, steuern, Gremium), für alle Portfolios (führen, lesen), Mitglieder (auflisten oder kein Zugriff); am
     Portfolio zusätzlich «über seine Projekte» (siehe Abschnitt 2);
  4. «Alle anzeigen» führt in den Bereich «Zugriff»; «Zugriff geben» für alle, die hier führen.
- Wer nur auflisten darf, sieht in der Kopfansicht keine Schaltfläche; dort steht schon der Hinweis, wer Zugriff gibt.
- Das ist der Wunsch nach einem Schloss wie in Confluence: Der Zugriff ist von jeder Stelle des Objekts einen Klick
  entfernt, der Bereich bleibt der Ort zum Verwalten.

## 2 Bereich «Zugriff» im Stil von Confluence

Ergänzungen zum heutigen Bereich (Seitentyp Liste + Schublade bleibt):

- **Stufe oben:** «Alle Mitglieder sehen die Kopfdaten» oder «Vertraulich». Wer am Ort führt, wählt sie; alle anderen
  sehen sie als Text. Ist sie geerbt, steht «Vertraulich, weil das Portfolio ‹Name› vertraulich ist» ohne Auswahl.
- **Spalte «Darf»** neben «Rolle», in Worten aus der Rolle: «auflisten», «lesen», «lesen und bearbeiten»,
  dazu «verwaltet Zugriff». So beantwortet die Liste direkt, wer auflisten, lesen und bearbeiten darf.
- **Am Portfolio eine Gruppe «über seine Projekte»:** wer nur an einem Projekt des Portfolios eine Rolle hat, mit
  «Darf» = «Portfolio auflisten» (Name, dazu das eigene Projekt). Ohne diese Gruppe fehlten bei einem vertraulichen
  Portfolio Personen, die es sehen: `GET /v1/access` liefert nur Rollen am Ort und an den Orten darüber, nicht an den
  Projekten darunter.
- **Letzte Zeile «Alle Mitglieder»** wie «Jeder» in Confluence: «Kopfdaten auflisten», bei vertraulich «kein Zugriff».
- Einträge über das Portfolio oder für alle Portfolios bleiben ohne «Entfernen» und nennen, wo sie geändert werden (heute
  schon so).

## 3 Vertraulich am Portfolio

- **Kennzeichnung «vertraulich» auch am Portfolio.** Mitglieder ohne weitere Rolle finden das Portfolio nirgends: nicht in
  Listen, Filtern, Suche, Befehlspalette, Roadmap und nicht bei den Ideen. Seine Projekte gelten für sie als vertraulich.
- **Wer es weiter sieht:** alle mit einer Rolle am Portfolio, an einem seiner Projekte oder für alle Portfolios
  (Entscheid 13 unverändert). Wer nur an einem Projekt eine Rolle hat, sieht sein Projekt und den Namen des Portfolios.
- **Vererbung wie in Confluence, nur enger:** Ein Projekt in einem vertraulichen Portfolio ist vertraulich und kann nicht
  offener gestellt werden. In einem nicht vertraulichen Portfolio bleibt «vertraulich» je Projekt wie heute.
- **Wer es setzt:** am Portfolio, wer das Portfolio führt (Portfolio führen, alle Portfolios führen); am Projekt, wer das
  Projekt führt (heute `projekt:write`).
- **Wirkung vorher** (I-R1 Stufe 3, I-F5): «Mitglieder ohne Rolle sehen das Portfolio und seine 6 Projekte nicht mehr.»
  Die Änderung steht im Änderungsprotokoll.
- **Weiche Regel** (G1, Entscheid 16): Wer Zugriff auf ein vertrauliches Portfolio gibt, sieht denselben Hinweis wie heute
  beim vertraulichen Projekt.

## 4 Listen

- Ein Schloss mit «vertraulich» steht nur bei vertraulichen Objekten: Meine Projekte, Alle Projekte (UI-52), Portfolios und
  Gremien, Auswahlfelder für Portfolios. Sonst gibt es kein Symbol in der Zeile (I-L2); den Zugriff einer Zeile zeigt
  die Schublade bzw. die Akte.
- Im Kopf von «Alle Projekte» ein Satz: «Die Kopfdaten sehen alle Mitglieder. Inhalte und Beträge liest, wer am Projekt,
  am Portfolio oder für alle Portfolios eine Rolle hat.»

## 5 Symbol

- Das Schloss steht heute für «vertraulich» und für den Stand «Abgeschlossen» (Periode, Sitzung;
  [darstellung.md](darstellung.md#bearbeitungsstand)), auch auf «Monat abschliessen» und «Sitzung schliessen». Im
  Sitzungsmodus erscheinen beide Bedeutungen nebeneinander (I-X4).
- Seit UX-E13 bleibt ein abgeschlossenes Objekt änderbar; das Schloss passt dort nicht mehr.
- **Vorschlag:** Das Schloss bedeutet nur noch «vertraulich». «Abgeschlossen» erhält einen Kalender mit Haken (Periode und
  Sitzung sind Termine); das Symbol ist in `web/src/ui/icons.ts` zu ergänzen.

## Texte

| Stelle | Text |
|---|---|
| Schaltfläche | «Zugriff» / «Zugriff · vertraulich» |
| Dein Zugriff | «Du kannst das Projekt bearbeiten – Rolle «Projekt führen» am Projekt.» / «Du kannst das Projekt lesen – Rolle «Alle Portfolios lesen» für alle Portfolios.» / «Du kannst das Projekt lesen – Rolle «Gremium» über das Portfolio.» |
| Stufe | «Alle Mitglieder sehen die Kopfdaten.» / «Vertraulich: Nur wer hier, am Portfolio oder für alle Portfolios eine Rolle hat, sieht das Projekt.» |
| Geerbt | «Vertraulich, weil das Portfolio ‹Name› vertraulich ist.» |
| Zeile Mitglieder | «Alle Mitglieder» · «Kopfdaten auflisten» bzw. «kein Zugriff» |
| Wirkung | Titel «Portfolio ‹Name› vertraulich machen?»; Text «Mitglieder ohne Rolle sehen das Portfolio und seine 6 Projekte nicht mehr.»; Schaltflächen «Vertraulich machen» / «Abbrechen» |
| Markierung | Schloss + «vertraulich» |

## Umsetzung

### Etappe 1: Anzeigen (nur Webapp)

Umgesetzt am 29.10.2026:

- Schaltfläche und Kurzübersicht (gemeinsamer Baustein `web/src/ui/Zugriff.tsx`) im Kopf der Projektakte und in der
  Schublade des Portfolios unter Administration › Portfolios und Gremien; ein eigener Kopf des Portfolios fehlt bisher.
  Daten aus `useAccessList` und `GET /v1/access/explain`, «Darf» aus den Rechten der Rolle im Katalog.
- Im Bereich «Zugriff»: Stufe oben; am Projekt stellt um, wer es bearbeitet (`can.write`, `PATCH /v1/projekte/{id}` mit
  `vertraulich`), nach einer Bestätigung mit der Wirkung. Spalte «Darf», Zeile «Alle Mitglieder».
- Symbol «Abgeschlossen» (Stand, «Monat abschliessen», «Sitzung schliessen») ist der Kalender mit Haken; der Hinweis
  «zur Freigabe» im Zielzyklus zeigt die Uhr.
- Markierung «vertraulich» in den Listen und der Satz im Kopf von «Alle Projekte» bestanden schon.

### Etappe 2: Vertraulich am Portfolio

Paket mit eigenem Migrationsbereich ([fachmodell.md 7](../fachmodell.md#7-arbeitspakete)).

- Datenmodell: `portfolio.vertraulich` ([fachmodell.md 2.4](../fachmodell.md#24-portfolio)).
- Setzen über eine eigene Route, z. B. `PUT /v1/portfolios/{id}/vertraulich`, geprüft am Ort mit
  `req.need('projekt:write', { type: 'portfolio', id })`: Dieses Recht haben «Portfolio führen» und «alle Portfolios
  führen». `PATCH /v1/portfolios/{id}` prüft `portfolio:admin`, und das gilt nur übergreifend (Ort `org`); wer ein
  Portfolio führt, soll damit nicht alle Portfolios verwalten. Will die Master-Session ein eigenes Recht, dann eines mit
  Ort `portfolio` in [fachmodell.md 3.2](../fachmodell.md#32-rechte).
- Zugriff «über seine Projekte»: eigene Abfrage der App über die Rollen an den Projekten des Portfolios, weil
  `GET /v1/access` nur den Ort und die Orte darüber liefert; alternativ eine Erweiterung im Baukasten.
- Lesesicht ([fachmodell.md 3.4](../fachmodell.md#34-policies-der-lesesicht)): `portfolio_read` lässt Mitglieder ein
  vertrauliches Portfolio nur sehen, wenn sie am Portfolio, an einem seiner Projekte oder übergreifend eine Rolle haben;
  in `projekt_read` gilt ein Projekt als vertraulich, wenn es selbst oder sein Portfolio vertraulich ist; dazu Ideen mit
  Zuordnung zum Portfolio, Roadmap und die Auswahlfelder.
- Wirkung vor dem Setzen (Anzahl betroffener Projekte und Ideen) als eigene Abfrage.
- Testmatrix (`test/app/matrix/`): Mitglied, Rolle nur am Projekt, Gremium, alle Portfolios lesen gegen ein vertrauliches
  Portfolio.

## Offene Fragen

| Nr. | Frage | Vorschlag | Klärt |
|---|---|---|---|
| 1 | Genügt «vertraulich am Portfolio» (verborgen vor Mitgliedern) für den echten Fall, oder muss ein Portfolio auch vor «alle Portfolios lesen» verborgen werden? | Zuerst «vertraulich». Reicht das nicht, sind die Freigabestufen von identity-kit der Weg (Entscheid 13): Typ `classified`, Stufe je Person, Lesen nur bei `classification <= app.clearance()`. Zu prüfen ist, ob der Baukasten das auch für einen Typ mit Kindern (Portfolio) erlaubt. | Fachseite, Master-Session |
| 2 | Sehen Mitglieder eingereichte Ideen, die einem vertraulichen Portfolio zugeordnet sind? | nein | Master-Session |
| 3 | Kurzübersicht im Kopf, oder führt die Schaltfläche direkt in den Bereich? | Kurzübersicht; sie ist die Antwort auf «wer darf hier was», der Bereich der Ort zum Verwalten | Fachseite |
| 4 | Symbol für «Abgeschlossen»? | Kalender mit Haken | Master-Session |
| 5 | Erscheint die Administration (`org-admin`) in der Liste? Sie hat technisch alle Rechte. | ja, als Zeile «Administration · technischer Zugriff» | Master-Session, Informationssicherheit |

## Abnahmekriterien

- [ ] Im Kopf von Projektakte und Portfolio steht «Zugriff»; die Kurzübersicht zeigt nach einem Klick den eigenen Zugriff mit
      Grund und die Rollen mit Anzahl.
- [ ] Der Bereich «Zugriff» zeigt oben die Stufe, je Zeile, was die Person darf, und als letzte Zeile die Mitglieder.
- [ ] Ein Mitglied ohne Rolle findet ein vertrauliches Portfolio und seine Projekte nirgends: Listen, Suche,
      Befehlspalette, Roadmap, Ideen, Exporte, MCP.
- [ ] Wer nur an einem Projekt im vertraulichen Portfolio eine Rolle hat, sieht sein Projekt und den Namen des Portfolios
      und steht im Zugriff des Portfolios unter «über seine Projekte».
- [ ] Wer ein Portfolio führt, aber nicht alle Portfolios, kann es vertraulich machen.
- [ ] Vor dem Setzen von «vertraulich» steht die Wirkung; die Änderung steht im Änderungsprotokoll.
- [ ] Das Schloss erscheint nur bei vertraulichen Objekten.

## Übernahme

Übernommen am 30.10.2026:

- **Masterdokument:** Entscheid 22.
- **UX-Schicht:** UX-E15; UI-51 in [informationsarchitektur.md](informationsarchitektur.md); in
  [darstellung.md](darstellung.md) Symbol «Abgeschlossen» und unter Sensible Daten das vertrauliche Portfolio; UX-OF-13
  ergänzt.
- **Bauplan:** `portfolio.vertraulich` (2.4), Lesesicht (3.4), Annahme A-76 (mit den Vorschlägen zu den Fragen 2 und 5),
  Paket AP-E9-1 mit Migrationen 470–479.
- **Klärungsliste:** Frage 1 als K36, Vorschlag zu K32 ergänzt.

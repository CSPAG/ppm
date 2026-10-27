# K4 Projektidee einreichen und qualifizieren

| | |
|---|---|
| **Rollen** | primär AS (reicht ein), UE (prüft, ordnet zu, traktandiert); beteiligt SP (vorgesehener Sponsor, qualifiziert mit), DIR (gibt Kategorie C frei), Gremium (entscheidet in [K3](K3-gremiumssitzung.md)) |
| **Gerät** | AS Desktop, auch Telefon; UE Desktop |
| **Use Cases** | [UC-001](../../anhang/use-cases.md#uc-001-projektidee-erfassen-und-qualifizieren) (alle Schritte, A1–A5) |
| **Oberflächen** | UI-01 Eingang, UI-02 Formular Projektidee, UI-03 Ideenpool, UI-04 Idee prüfen |
| **Arbeitsraum** | Portfolio › Ideen `/portfolio/ideen`, neue Idee `/portfolio/ideen/neu`, Idee `/portfolio/ideen/<nr>` |
| **Etappe** | E4 |

## Job-Story

- **AS:** Wenn ich eine Idee für ein Projekt habe, will ich sie ohne Vorwissen über das PM-Handbuch einreichen und danach
  sehen, wo sie steht, damit sie nicht in einem Postfach versandet.
- **UE:** Wenn eine Idee eingeht, will ich ähnliche Ideen und alle Angaben für die Einordnung an einem Ort sehen, damit ich
  sie rasch zusammenführe, zurückfrage oder dem richtigen Gremium vorlege.

## Zielgrössen

| Nr. | Grösse | Zielwert | Messung |
|---|---|---|---|
| K4-1 | Idee erstmals ohne Hilfe einreichen | ≥ 90 % der Personen ohne Erfahrung mit dem System | Aufgabentest mit 5 Mitarbeitenden ausserhalb UE |
| K4-2 | Zeit zum Einreichen, Inhalte vorbereitet | ≤ 10 Min. | Aufgabentest |
| K4-3 | Anteil Ideen mit Rückfrage wegen ungenügender Angaben (A2) | ≤ 20 % (Vorschlag) | Betrieb |
| K4-4 | Durchlaufzeit Einreichung → bereit für das Gremium | Median ≤ 20 Arbeitstage (Vorschlag) | Betrieb |

## Einstieg

- **Eingang:** Schaltfläche **Projektidee einreichen** im Kopf für Antragstellende; für alle übrigen in der Befehlspalette.
- **Direktlink** `/portfolio/ideen/neu`, z. B. aus dem Intranet oder dem Innovationsprozess (Herkunft dann vorausgefüllt).
- **Ziele:** «Projektidee anstossen» an einer Hauptaktivität (UC-011 Schritt 4, [K6](K6-ziele.md)); Strategiebezug vorausgefüllt (I-F2).
- **Eingang (UE):** «Projektidee prüfen · ‹Titel›» (UC-001 Schritt 2) mit Benachrichtigung.

## Ablauf

**Einreichen (AS, Seitentyp Assistent, 4 Schritte, Entwurf wird gespeichert I-F7):**

1. **Worum geht es?** Titel, Ausgangslage, Zielsetzung (UC-001 Schritt 1). Unter jedem Feld ein Satz Hilfe mit Beispiel
   aus der Vorlage (I-X5).
2. **Bezug zur Strategie:** Handlungsfeld mit Leitsatz, darunter die strategischen Ziele des Felds zur Wahl; betroffene
   Bereiche (Organisationseinheiten, Mehrfachauswahl); Herkunft der Idee (Innovationsprozess, Strategieprozess, Bereich).
3. **Erste Einschätzung:** Nutzen, Aufwand, Relevanz je als «hoch / mittel / tief» mit einem Satz Begründung (Skala
   Vorschlag, K01).
4. **Zusammenfassung** mit Wirkung (I-F5): «Die Unternehmensentwicklung erhält Ihre Idee zur Prüfung. Sie sehen den Stand
   jederzeit unter ‹Meine Ideen›.» → **Projektidee einreichen** (Schritt 2). Fehlende Pflichtfelder: Sperre mit Sprung zum
   Schritt. Danach Bestätigungsseite mit dem nächsten Schritt in einem Satz und Link auf «Meine Ideen».

**Stand verfolgen (AS):** Portfolio › Ideen zeigt Antragstellenden nur die eigenen Ideen mit Status (darstellung.md) und
dem letzten Ereignis («in Prüfung seit Fr 3.10.»). Jede Änderung des Status erreicht die Person als Benachrichtigung (I-B1).

**Prüfen (UE):**

5. **Ideenpool** (Seitentyp Liste + Schublade): Standard «wartet am längsten zuerst», Filter Status, Handlungsfeld,
   Herkunft; Ansicht **Funnel «Pre-P0»** nach Status (Ansicht in der Adresse, G8).
6. **Idee öffnen** (Schritt 3) als eigene Seite: links die Idee, rechts **Ähnliche Ideen** (gleiches Handlungsfeld oder
   gleiche betroffene Bereiche) mit Status.
   - **Zusammenführen** (A1): an einer ähnlichen Idee → Dialog (unumkehrbar, wirkt auf andere): Wahl der führenden Idee,
     Vorschau der übernommenen Angaben, «Beide Antragstellenden werden informiert.» → **Ideen zusammenführen**. Die andere
     Idee steht danach als «zusammengeführt» mit Link auf die führende.
7. **Leitfragen zum Eintritt P0** (Schritt 4): strategische Relevanz, Projektziel, klinische Fragestellung, ICT-Einbindung,
   Infrastruktur, je Antwort als Text; das Feld «vorgesehener Sponsor» (Person). Der Sponsor sieht die Idee lesend und
   kann die Antworten ergänzen, wenn die UE ihn einlädt (Vorschlag; wie der Sponsor mitwirkt, sagt UC-001 nicht).
   - **Rückfrage stellen** (A2): Textfeld, Status «in Ergänzung»; AS erhält «Rückfragen zu Ihrer Idee beantworten», der
     Assistent öffnet sich mit den Rückfragen über den betroffenen Feldern; **Erneut einreichen** legt die Prüfaufgabe
     wieder an (A2.2).
   - **Zurückweisen** (A3): Dialog mit Begründung (Pflicht), Wirkung «‹Name› wird mit Ihrer Begründung informiert.» Ob die
     UE allein zurückweisen darf, ist offen (K07); bis zur Klärung ist die Aktion vorhanden und protokolliert, und die
     Zurückweisung erscheint im nächsten Portfoliobericht.
8. **Kategorie zuordnen** (Schritt 5): Kriterienraster (Relevanz, Anzahl betroffener Direktionen, Abhängigkeiten, Bedarf an
   zentraler Priorisierung und Finanzierung, Change-Aufwand) je «hoch / mittel / tief». Das System zeigt die naheliegende
   Kategorie als Vorschlag mit Herleitung (G11); die UE wählt A, B oder C als Gesamtbeurteilung (Q8 Kap. 6: keine starre
   Logik). Wirkung: «Kategorie A · Transformation · zuständig PRAT».
   - **Kategorie C** (A4): **Der Direktion ‹Name› übergeben**; die Direktion erhält im Eingang «Initialisierung freigeben»
     mit **Initialisierung freigeben** / **Zurückweisen** (A4.2). Bei Freigabe entsteht das Projekt in P0 im Portfolio der
     Direktion; weiter in [K2](K2-projektvertrag.md).
9. **Für das Gremium traktandieren** (Schritt 6): Die Idee erscheint als Vorschlag in der nächsten Sitzung des zuständigen
   Gremiums ([K3](K3-gremiumssitzung.md)); Status «traktandiert».
10. **Entscheid** (Schritt 7) in K3: «Initialisierung freigegeben» mit Sponsor und Projektleitung (wer benennt, offen K06).
    Wirkung: «Projekt ‹Titel› entsteht in Phase P0 mit den Angaben der Idee. ‹AS› wird informiert. ‹PL› erhält die
    Aufgabe ‹Projektvertrag erstellen›.» **Zurückgestellt** (A5): Idee bleibt im Pool mit Auflagen, Status
    «zurückgestellt», weiter bei Schritt 7; **abgelehnt**: Status «zurückgewiesen», AS informiert.

## Zustände

| Zustand | Gestaltung |
|---|---|
| Z2 Leer (Meine Ideen) | «Sie haben noch keine Idee eingereicht. Ideen für Projekte nimmt die Unternehmensentwicklung jederzeit entgegen.» mit **Projektidee einreichen** |
| Z2 Leer (Ideenpool UE) | «Keine Ideen zu prüfen.» mit Datum der letzten Einreichung |
| Entwurf (AS) | Assistent merkt sich den Stand; in «Meine Ideen» als «Entwurf · zuletzt bearbeitet Mo 6.10.» mit «Weiter bearbeiten» |
| In Ergänzung | AS: Banner mit den Rückfragen; UE: Zeile «wartet auf ‹Name› seit 5 Tagen» |
| Zusammengeführt | Idee nur lesbar, Banner «Zusammengeführt mit ‹führende Idee› am ‹Datum›» mit Link |
| Z8 Nur lesen (AS nach Einreichen) | Inhalt lesbar; Bewertung und Kriterienraster der UE sind für AS nicht sichtbar (darstellung.md, Sensible Daten) |

## Regeln und Rückmeldungen

| Regel (Quelle) | Zeitpunkt | Stufe | Text | Ausweg |
|---|---|---|---|---|
| Pflichtfelder der Idee (UC-001 Schritt 2) | *dabei* je Assistentschritt beim «Weiter» und beim Einreichen | Sperre | «Zielsetzung fehlt: Ohne Ziel kann die Unternehmensentwicklung die Idee nicht einordnen. Beschreiben Sie in zwei, drei Sätzen, was erreicht werden soll.» | Feld ausfüllen |
| Ähnliche Idee (UC-001 Schritt 3, A1) | *vorher* beim Öffnen durch die UE | Hinweis | «Ähnlich: 2 Ideen im Handlungsfeld Patientenorientierung mit gleichen Bereichen.» | Zusammenführen oder weiter prüfen |
| Kategorie widerspricht dem Raster | *dabei* bei der Wahl | Hinweis | «Raster: 4 von 5 Kriterien hoch, das spricht für Kategorie A. Sie haben B gewählt; halten Sie den Grund fest.» | Begründung (optional) |
| Zurückweisen ohne Begründung (UC-001 A3) | *dabei* | Sperre | «Begründung fehlt: ‹Name› erfährt sonst nicht, warum die Idee nicht weiterverfolgt wird.» | Begründung erfassen |

## Texte

- Schaltflächen: «Projektidee einreichen», «Erneut einreichen», «Rückfrage stellen», «Ideen zusammenführen», «Zurückweisen»,
  «Für das Gremium traktandieren», «Der Direktion übergeben», «Initialisierung freigeben»
- Bestätigung: «Ihre Idee ist eingereicht. Die Unternehmensentwicklung prüft sie und meldet sich bei Rückfragen. Den Stand
  sehen Sie unter ‹Meine Ideen›.»
- Status für AS in Klartext: «eingereicht», «in Ergänzung», «in Prüfung», «dem Gremium vorgelegt», «freigegeben», «zurückgestellt»,
  «zurückgewiesen», «zusammengeführt»

## Barrierefreiheit und Tastatur

- Assistent: Schrittanzeige mit Text («Schritt 2 von 4: Bezug zur Strategie»), Fokus beim Wechsel auf die Überschrift des
  Schritts; «Zurück» ohne Datenverlust.
- Ideenpool: Funnel hat eine Listen-Alternative mit denselben Zahlen.

## Abnahmekriterien

- [ ] Eine Person ohne Recht in einem anderen Arbeitsraum erreicht vom Eingang aus den Assistenten mit einem Klick.
- [ ] Aus einer Hauptaktivität angestossen, sind Handlungsfeld und strategisches Ziel vorausgefüllt.
- [ ] Ein abgebrochener Assistent bietet beim nächsten Öffnen den Entwurf an.
- [ ] Nach dem Einreichen hat die UE eine Prüfaufgabe im Eingang, und AS sieht die Idee als «eingereicht».
- [ ] Die Prüfansicht zeigt ähnliche Ideen mit gleichem Handlungsfeld oder gleichen Bereichen.
- [ ] Zusammenführen schliesst die zweite Idee als «zusammengeführt» und informiert beide Antragstellenden.
- [ ] Nach einer Rückfrage sieht AS die Rückfragen über den betroffenen Feldern.
- [ ] Kategorie C übergibt die Idee der Direktion; die Direktion gibt sie im Eingang frei, danach existiert ein Projekt in P0.
- [ ] AS sieht weder Kriterienraster noch Bewertung der UE.

## Entscheide und offene Fragen

- Entscheid: Assistent statt langer Formularseite, weil Antragstellende selten und ungeübt sind (Seitentyp Assistent).
- Entscheid: Das Kriterienraster schlägt eine Kategorie vor, die UE entscheidet (Q8 Kap. 6, G11).
- Offen: Wer benennt Sponsor und Projektleitung (K06); darf die UE allein zurückweisen (K07); wie wirkt der Sponsor bei den
  Leitfragen mit; sehen Antragstellende ähnliche Ideen anderer ([UX-OF-11](../fahrplan.md#offene-fragen); bis zur Klärung nein).

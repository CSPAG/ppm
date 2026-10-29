# K5 Portfolio priorisieren und Szenario entscheiden

| | |
|---|---|
| **Rollen** | primär UE (bewertet, erstellt Szenarien, bereitet den Entscheid vor); beteiligt Gremium (legt Modell fest, entscheidet in [K3](K3-gremiumssitzung.md)); Budgetrahmen, Kapazität und Auslastung führt ebenfalls die UE (keine Rollen FI und RM, Master Entscheide 12, 15) |
| **Gerät** | Desktop ab 1280 px (Arbeitsfläche); Gremiumsmitglieder lesen Matrix und Szenariovergleich auf Tablet und in der Projektion |
| **Use Cases** | [UC-008](../../anhang/use-cases.md#uc-008-portfolio-priorisieren-und-ausbalancieren) (alle Schritte, A1–A2); Auslastung aus UC-009 Schritt 5 |
| **Oberflächen** | UI-19 Bewertungsmodell, UI-20 Bewertungsmaske, UI-21 Portfolio-Matrix, UI-22 Szenarien, UI-23 Auslastung |
| **Arbeitsraum** | Portfolio › Priorisierung `/portfolio/priorisierung/<bewertung|matrix|szenarien|modell>?portfolio=transformation` |
| **Etappe** | E5 |

## Job-Story

- **UE:** Wenn neue Projekte dazukommen oder sich der Rahmen ändert, will ich Varianten der Reihenfolge durchspielen und
  sofort sehen, wo Budget und Kapazität reissen, damit das Gremium zwischen echten Alternativen entscheidet.
- **Gremiumsmitglied:** Wenn die Priorisierung traktandiert ist, will ich verstehen, welche Projekte unter der Wasserlinie
  liegen und warum, damit ich die Folgen meines Entscheids kenne.

## Zielgrössen

| Nr. | Grösse | Zielwert | Messung |
|---|---|---|---|
| K5-1 | Rang verschieben → Wasserlinie und Engpässe aktualisiert | ≤ 200 ms sichtbare Reaktion, Neuberechnung ≤ 1 s bei 60 Projekten | automatischer Test mit Messung |
| K5-2 | Bewertung von 15 Projekten × 7 Kriterien nur mit Tastatur | ≤ 10 Min. | Aufgabentest |
| K5-3 | Entscheidungsvorlage ohne Arbeit ausserhalb des Systems | 0 Excel- oder Präsentationsdateien | Aufgabentest, Betrieb |
| K5-4 | Gremiumsmitglieder nennen nach dem Szenariovergleich die Projekte unter der Wasserlinie und den Engpass | ≥ 90 % richtig | Aufgabentest |

## Einstieg

- **Portfolio › Priorisierung** über die Navigation; Einstieg nach Ereignis aus dem Eingang der UE: «Neue Projekte in P0
  seit der letzten Priorisierung: 3» (UC-008 Ausgangslage) und im Jahreszyklus «Priorisierung 2027 vorbereiten».
- **Sitzung** ([K3](K3-gremiumssitzung.md)): das Traktandum «Priorisierung und Szenario» öffnet den Szenariovergleich lesend.

## Ablauf

**Aufbau (Seitentyp Arbeitsfläche):** Reiter **Bewertung**, **Matrix**, **Szenarien**; im Kopf Portfolio und «Ist-Stand
seit ‹Datum des letzten Entscheids›»; rechts das Seitenpanel mit Details zum gewählten Projekt.

1. **Übersicht** (UC-008 Schritt 1): Liste der Projekte mit Phase, Business Case (Kosten, Nutzen), Ressourcenbedarf (Grösse
   oder FTE), Status und bisherigem Rang.
2. **Bewerten** (Schritt 2): Raster Projekte × Kriterien (Strategiebeitrag, Transformationsrelevanz, betroffene Bereiche,
   Komplexität und Abhängigkeiten, Finanzierungsbedarf, Ressourcenverfügbarkeit, Kommunikations- und Change-Aufwand). Je
   Zelle «hoch / mittel / tief» (Vorschlag K01; ob ein gewichteter Score dazukommt, entscheidet V10). Fortschritt im Kopf:
   «12 von 14 Projekten bewertet». Automatisches Speichern (I-R3).
3. **Abhängigkeiten und Portfoliorisiken** (Schritt 3) im Seitenpanel des Projekts: «Abhängigkeit hinzufügen» (auch die aus
   den Verträgen erscheinen hier), «Portfoliorisiko erfassen» in der Schublade.
4. **Matrix** (Schritt 4): Nutzen × Risiko mit den Feldern «Priorisieren», «Rasch umsetzen», «Opportunistisch umsetzen»,
   «Hinterfragen»; Kreisgrösse = Kosten. Umschaltbar auf Ressourcen × Nutzen. Auswahl eines Projekts zeigt seine
   Abhängigkeiten als Linien. «Wie wird das berechnet?» zeigt, wie Nutzen und Risiko aus der Bewertung entstehen (G11;
   Herleitung offen bis K01). Jede Matrix hat eine Tabelle als Alternative.
5. **Szenario anlegen** (Schritt 5): «Szenario anlegen» kopiert den Ist-Stand. Banner «Szenario ‹B›: Der Ist-Stand des
   Portfolios ändert sich nicht.» Rangliste per Ziehen oder Alt+↑/↓, je Projekt Startzeitpunkt (Monat). Live: die
   **Wasserlinie**, wo kumulierter Budget- oder Kapazitätsbedarf den Rahmen übersteigt, Projekte darunter abgesetzt; unter
   der Liste die Engpässe je Quartal und Rolle aus der Auslastung (UI-23, UC-009 Schritt 5).
6. **Szenarien vergleichen** (Schritt 6): bis drei nebeneinander mit Kosten, Nutzen, Risiko, Strategiebeitrag, Projekten
   unter der Wasserlinie und Engpässen; Unterschiede hervorgehoben. **Als Antrag wählen** erzeugt die Entscheidungsvorlage
   als Vorschau.
7. **Für das Gremium traktandieren** (Schritt 7): Vorschlag in der nächsten Sitzung (K3).
8. **Entscheid** (Schritt 8) in K3: «Szenario ‹B› gewählt» mit Wirkung: «Rang und Start von 14 Projekten werden Ist-Stand.
   9 Projektauftraggeber:innen und Projektleitungen werden informiert. 2 laufende Projekte liegen unter der Wasserlinie.» Für jedes laufende
   Projekt unter der Wasserlinie verlangt die Entscheidmaske «Zurückstellen», «Sistieren» oder «Abbrechen» (A2); Sistieren
   und Abbrechen leiten UC-015 ein.

**Modell und Budgetrahmen** (A1, Reiter «Modell», Seitentyp Liste + Schublade): Kriterien und Budgetrahmen je Kategorie als
Entwurf, traktandieren, nach Entscheid «in Kraft ab ‹Datum›». Frühere Bewertungen zeigen die Version des Modells,
mit der sie entstanden (G11).

## Zustände

| Zustand | Gestaltung |
|---|---|
| Z4 Teilweise | Budgetrahmen fehlt (K20): Wasserlinie nur nach Kapazität, Hinweis «Ohne Budgetrahmen zeigt die Wasserlinie nur die Kapazität.» Ressourcenbedarf nur als Grösse: Kapazitätsrechnung mit Richtwerten je Grösse, gekennzeichnet «geschätzt» |
| Z2 Leer (Szenarien) | «Noch kein Szenario. Ein Szenario ist eine Kopie des Ist-Stands, mit der Sie Reihenfolge und Start durchspielen.» mit **Szenario anlegen** |
| Z7 Konflikt | Projekt hat sich seit Anlage des Szenarios geändert (neuer Bedarf, Phase): Hinweis am Projekt «Bedarf geändert am ‹Datum›», Szenario rechnet mit dem neuen Wert |
| Mobil | Matrix und Szenariovergleich nur lesend; Bewerten und Umordnen nur ab 1024 px, Hinweis statt Bearbeiten-Elemente |

## Regeln und Rückmeldungen

| Regel (Quelle) | Zeitpunkt | Stufe | Text | Ausweg |
|---|---|---|---|---|
| Budget über Rahmen (UC-008 Schritt 5) | *dabei* beim Umordnen, *danach* im Vergleich | Warnung | «Budget 2027: CHF 14,2 Mio. statt höchstens 12,0 Mio. (Transformation). Unter der Wasserlinie: 2 Projekte.» | Rang oder Start ändern |
| Kapazität überbucht (UC-008 Schritt 5, UC-009 A1) | *dabei* | Warnung | «Kapazität Q2 2027: 7,5 FTE Projektleitung statt höchstens 5,0. Betroffen: 3 Projekte.» | Start verschieben |
| Abhängigkeit verletzt (UC-008 Schritt 3) | *vorher* am Projekt, *dabei* beim Umordnen | Warnung | «Abhängigkeit: ‹A› braucht ‹B›, liegt aber vor ‹B› bzw. startet früher.» | Reihenfolge anpassen |
| Unvollständige Bewertung | *danach* bei «Als Antrag wählen» | Warnung | «Bewertung: 2 Projekte ohne Bewertung. Sie erscheinen in der Vorlage als ‹nicht bewertet›.» | bewerten oder so vorlegen |
| Ungedeckter Bedarf (UC-009 A2) | *vorher* am Projekt | Hinweis | «Ressourcen: Bedarf Projektleitung in P2 ungedeckt.» | – |

## Texte

- Schaltflächen: «Szenario anlegen», «Szenarien vergleichen», «Als Antrag wählen», «Für das Gremium traktandieren»,
  «Abhängigkeit hinzufügen», «Portfoliorisiko erfassen»
- Felder der Matrix: «Priorisieren», «Rasch umsetzen», «Opportunistisch umsetzen», «Hinterfragen»
- Banner: «Szenario ‹B›: Der Ist-Stand des Portfolios ändert sich nicht.»

## Barrierefreiheit und Tastatur

- Bewertungsraster: Pfeiltasten, **1 / 2 / 3** für tief / mittel / hoch, Zeilen- und Spaltenköpfe für Bildschirmleser.
- Rangliste: Alt+↑/↓ statt Ziehen; nach jeder Verschiebung wird angesagt «‹Projekt› auf Rang 5, über der Wasserlinie».
- Matrix: Projekte per Tab erreichbar, Position als Text («Nutzen hoch, Risiko tief, Feld Rasch umsetzen»).

## Abnahmekriterien

- [ ] Ein Szenario ändert den Ist-Stand nicht; nach dem Verwerfen ist das Portfolio unverändert.
- [ ] Verschieben eines Projekts aktualisiert Wasserlinie und Engpässe innert 1 s bei 60 Projekten.
- [ ] Die Wasserlinie trennt die Projekte dort, wo der kumulierte Bedarf den Rahmen übersteigt; ohne Budgetrahmen nach Kapazität.
- [ ] Eine verletzte Abhängigkeit erzeugt eine Warnung am betroffenen Projekt.
- [ ] «Als Antrag wählen» erzeugt eine Entscheidungsvorlage mit allen verglichenen Szenarien.
- [ ] Der Entscheid in K3 verlangt für jedes laufende Projekt unter der Wasserlinie einen Folgeentscheid.
- [ ] Die Bewertung eines Projekts zeigt die Version des Bewertungsmodells.
- [ ] Bewerten und Umordnen gehen vollständig mit Tastatur.

## Entscheide und offene Fragen

- Entscheid: Bewertung als Einschätzung je Kriterium ohne Score, bis V10 entschieden ist (Vorschlag K01); das Raster lässt
  eine Score-Spalte zu, ohne den Ablauf zu ändern.
- Entscheid: Szenarien sind Kopien, nie der Ist-Stand; nur der Entscheid des Gremiums übernimmt ein Szenario (UC-008
  Schritt 5, 8).
- Offen: Herleitung von Nutzen und Risiko in der Matrix (K01, [UX-OF-18](../fahrplan.md#offene-fragen)); Budgetrahmen je Kategorie
  (K20); Kapazität je Pool oder FTE × Monate (K22).

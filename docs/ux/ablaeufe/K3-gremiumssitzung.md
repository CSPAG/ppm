# K3 Gremiumssitzung vorbereiten und durchführen

| | |
|---|---|
| **Rollen** | primär UE (bereitet vor, erfasst, protokolliert); Gremiumsmitglieder PRAT bzw. GLPA (lesen, entscheiden); beteiligt PL, CTL, SP (stellen vor) |
| **Gerät** | UE Desktop, in der Sitzung Laptop am Beamer; Mitglieder Tablet und Laptop, Lesen auch Telefon |
| **Use Cases** | [UC-006](../../anhang/use-cases.md#uc-006-prat-sitzung-vorbereiten-und-durchführen) (alle Schritte, A1–A4); Entscheidschritte aus UC-001 Schritt 7 und A5, UC-002 Schritt 11 und A6, UC-003 Schritt 9–10 und A6, UC-007 A1, UC-008 Schritt 7–8 und A2, UC-012 Schritt 4–5, UC-013 Schritt 3–4, UC-015 Schritt 5–6 und A2 |
| **Oberflächen** | UI-01 Eingang, UI-33 Sitzung, UI-34 Entscheidmaske, UI-35 Protokoll, UI-36 Entscheide und Auflagen, UI-17 Dashboard, UI-18 Risikolage, UI-29 Portfoliobericht |
| **Arbeitsraum** | Gremien › Sitzungen `/gremien/prat/sitzungen/2026-11-12` |
| **Etappe** | E2 |

Der Ablauf gilt für jedes Gremium mit Sitzungen (PRAT, GLPA; UC-006 ist für den PRAT beschrieben, der Gremienweg ist
konfigurierbar, AM.02.04). Entscheide einer Direktion (Kategorie C) laufen ohne Sitzung über den Eingang (UC-001 A4).

## Job-Story

- **UE:** Wenn die Sitzung naht, will ich aus den anstehenden Geschäften eine Traktandenliste zusammenstellen und sehen,
  welche Unterlagen noch fehlen, damit der Versand 5 Arbeitstage vorher steht und nichts von Hand zusammengesucht wird.
- **Gremiumsmitglied:** Wenn die Unterlagen kommen, will ich je Geschäft sofort den Antrag und die Hauptänderungen sehen,
  damit ich vorbereitet entscheide, auch wenn ich nur das Tablet dabei habe.
- **UE in der Sitzung:** Wenn der PRAT entscheidet, will ich den Entscheid in Sekunden erfassen, damit Phase, Baseline und
  Dashboard danach stimmen, ohne dass ich nachträglich etwas übertragen muss.

## Zielgrössen

| Nr. | Grösse | Zielwert | Messung |
|---|---|---|---|
| K3-1 | Unterlagen ≥ 5 Arbeitstage vor der Sitzung versendet (Q8 Kap. 8.1) | 100 % der Sitzungen | Betrieb, Versandprotokoll |
| K3-2 | Traktandenliste aus Vorschlägen zusammenstellen und versandbereit machen (6 Traktanden, ohne Kommentar zum Portfoliobericht) | ≤ 30 Min. (Vorschlag) | Aufgabentest |
| K3-3 | Entscheid in der Sitzung erfassen | ≤ 60 s je Traktandum ab Wortlaut des Entscheids | Aufgabentest, Messung im Sitzungsmodus |
| K3-4 | Protokoll ≤ 3 Arbeitstage nach der Sitzung versendet (Q8 Kap. 8.1) | 100 % der Sitzungen | Betrieb |
| K3-5 | Gremiumsmitglied findet zu einem Traktandum Antrag und Hauptänderungen ohne Hilfe (PPM-5) | ≥ 90 %, ≤ 30 s, auf dem Tablet | Aufgabentest |

## Einstieg

- **Eingang (UE):** «PRAT-Sitzung Mi 12.11. vorbereiten · Versand bis Mi 5.11.» (UC-006 Schritt 1), rund 15 Arbeitstage
  vor der Sitzung (Vorschlag, [UX-OF-5](../fahrplan.md#offene-fragen)).
- **Eingang und Benachrichtigung (Mitglieder):** «Unterlagen PRAT Mi 12.11. bereit» → Sitzung, lesend.
- **Eingang (Eingeladene):** «Sie stellen ‹Projekt› am Mi 12.11. im PRAT vor · ca. 14:20» → Traktandum.
- **Befehlspalette:** «Nächste Sitzung öffnen».

## Ablauf

**Vorbereiten (UE, Seitentyp Arbeitsfläche):**

1. **Sitzung öffnen** (Schritt 1). Kopf: Gremium, Datum, Ort, «Versand bis Mi 5.11. · in 4 Arbeitstagen». Links die
   Traktandenliste mit Zeitbedarf und Summe gegen die Sitzungsdauer («2 h 50 von 3 h»). Rechts die **Vorschläge**,
   gruppiert: Portfoliobericht, eingeplante Gate-Reviews (UC-003), Meilensteinabnahmen, Eskalationen (aus [K1](K1-statusbericht.md)),
   Änderungen mit Wirkung auf Scope, Budget oder Ressourcen (UC-007 A1), Initialisierungen (UC-001), Priorisierung und
   Szenario (UC-008), Quartalsreporting (UC-012), Jahresrückblick (UC-013), Exit-Gates (UC-015) und nicht behandelte
   Traktanden der letzten Sitzung.
2. **Traktandum aufnehmen** (Schritt 2) per «Aufnehmen» oder Ziehen (G9); das System setzt den Zeitbedarf (Gate-Review 35
   Min.: Präsentation 20, Diskussion 10, Entscheid 5) und die Eingeladenen (PL, CTL, SP) vor (I-F2). Reihenfolge per
   Ziehen oder «Nach oben» / «Nach unten». Ein Traktandum eines Projekts in P0 oder P1 bis zur Freigabe von P2 trägt
   automatisch «via SNS-VR» (A1).
3. **Unterlagenstand** (Schritt 3) je Traktandum als Badge: «Gate Review Packet bereit · Quality-Check bestanden 28.10.»,
   «Quality-Check offen» oder «Unterlagen fehlen». Das **Gate Review Packet** (UC-003 Schritt 9) stellt das System aus
   Vertrag, Business Case, Leitfragen und Hauptänderungen zusammen; die UE sieht es als Vorschau.
   **Unterlagen fehlen** (A2): Warnung am Traktandum mit **Auf nächste Sitzung verschieben**; umkehrbar (Toast mit
   Rückgängig), PL und SP werden mit dem Versand informiert.
4. **Portfoliobericht** (Schritt 4): Traktandum 1 «Bericht der Programmleitung» ist immer gesetzt. «Portfoliobericht
   erzeugen» erstellt ihn aus dem abgeschlossenen Dashboard (Seitentyp Bericht); die UE ergänzt Kommentare.
5. **Unterlagen versenden** (Schritt 5) mit Vorschau der Wirkung (I-R1 Stufe 3): «9 Mitglieder des PRAT erhalten
   Traktandenliste, Portfoliobericht und 3 Gate Review Packets. 7 Eingeladene erhalten Einladung und Zeitfenster. Frist 5
   Arbeitstage: eingehalten.» Ein bewusster Klick; das System protokolliert den Versand. Einladungen gehen gebündelt mit
   dem Versand, nicht bei jedem Aufnehmen (I-B3).

**Lesen (Gremiumsmitglied, Tablet):**

6. Die Sitzung lesend: je Traktandum zuoberst der **Antrag** in einem Satz («Freigabe Phase P2 und Projektvertrag Version
   2.0»), darunter Hauptänderungen, Business Case in Kennzahlen, Status und Trend, dann die Unterlagen online und als PDF.

**Durchführen (UE, Sitzungsmodus für die Projektion):**

7. **Sitzung starten** schaltet in den Sitzungsmodus: grosse Schrift, Traktandenliste links, Unterlagen rechts.
   Traktandum 1 zeigt Dashboard und Risikolage des Portfolios (Schritt 6).
8. **Entscheid erfassen** je Traktandum (Schritt 7) in der Entscheidmaske unter den Unterlagen. Die Optionen hängen von der
   Art ab:

   | Art | Optionen |
   |---|---|
   | Gate-Review, Initialisierung | Freigegeben · Mit Auflagen freigegeben · Zurückgestellt · Abgelehnt bzw. Gestoppt |
   | Änderung (UC-007 A1) | Freigegeben · Abgelehnt |
   | Meilensteinabnahme | Abgenommen · Nicht abgenommen |
   | Eskalation | Erledigt mit Massnahme · Zurückgestellt |
   | Priorisierung und Szenario (UC-008) | Szenario ‹Name› gewählt; je laufendem Projekt unter der Wasserlinie Zurückstellen · Sistieren · Abbrechen (A2) |
   | Sistieren oder Abbrechen | Sistiert · Abgebrochen · Weiterführen |
   | Quartalsreporting, Jahresrückblick | Verabschiedet · Anpassungen verlangt |
   | Exit-Gate P4 (UC-015) | Abgeschlossen · Nacharbeiten verlangt |

   Begründung ist Pflicht. Vor dem Erfassen zeigt die Maske die Wirkung (I-F5): «Gate P1–P2 freigegeben: Version 2.0 wird
   Baseline, Projekt wechselt in Phase P2, Dashboard wird nachgeführt. Projektleitung und Sponsor werden nach der Sitzung
   informiert.» Erfassen ist bestätigt (I-R2): erst nach Antwort des Servers als erledigt markiert.
   - **Auflagen** (A3): je Auflage Text, Termin, Verantwortliche; sie werden Aufgaben im Eingang. Zurückgestellte
     Traktanden werden für die Folgesitzung vorgeschlagen.
   - **Via SNS-VR** (A1): Erfasst wird die **Stellungnahme des PRAT**; das Traktandum bleibt «Entscheid SNS-VR ausstehend»,
     bis die UE dessen Entscheid nachträgt (Ablauf offen, K02).
   - **An den VR weiterleiten** (A4): Kontrollkästchen; das Geschäft wird für das nächste Quartalsreporting markiert
     (UC-012; Weiterleitung ausserhalb des Quartals offen, K03).
9. **Sitzung schliessen** (Schritt 8): Hinweis auf Traktanden ohne Entscheid («2 Traktanden werden für die nächste Sitzung
   vorgeschlagen»); das System erzeugt den Protokollentwurf und führt das Dashboard nach. Jetzt erst gehen die
   Benachrichtigungen an PL, SP und Verantwortliche von Auflagen, gebündelt je Person (I-B3).

**Protokoll (UE, Seitentyp Arbeitsfläche):**

10. **Protokoll bereinigen** (Schritt 9): Entwurf mit Traktanden, Entscheiden, Begründungen, Auflagen; automatisches
    Speichern; Kopf «Versand bis Mo 17.11. · in 3 Arbeitstagen». **Protokoll versenden** mit Vorschau der Empfänger.
    Nicht behandelte Traktanden erscheinen als Vorschläge der nächsten Sitzung.

## Zustände

| Zustand | Gestaltung |
|---|---|
| Z2 Leer (neue Sitzung) | «Noch keine Traktanden. Rechts stehen 7 Vorschläge aus Gates, Eskalationen und Änderungen.» |
| Versandfrist überschritten | Banner «Versand: 3 statt mindestens 5 Arbeitstage vor der Sitzung» (Warnung, siehe Regeln) |
| Z8 Nur lesen (Mitglieder, Eingeladene) | keine Bearbeiten-Elemente; Eingeladene sehen nur ihr Traktandum und die öffentlichen Teile der Traktandenliste |
| Z9 Sitzung geschlossen | Banner «Sitzung geschlossen am Mi 12.11. · Protokoll im Entwurf» bzw. «Protokoll versendet am Fr 14.11.» |
| Entscheid SNS-VR ausstehend | Badge am Traktandum und am Projekt; das Projekt wechselt die Phase erst danach |
| Verbindung unterbrochen in der Sitzung | Banner (Z6); eingegebene Entscheide bleiben lokal und sind als «nicht gespeichert» gekennzeichnet, bis die Verbindung zurück ist (I-F7) |

## Regeln und Rückmeldungen

| Regel (Quelle) | Zeitpunkt | Stufe | Text | Ausweg |
|---|---|---|---|---|
| Unterlagen 5 Arbeitstage vor der Sitzung (UC-006 Schritt 5, A2; Q8 Kap. 8.1) | *vorher* am Traktandum, *dabei* beim Versand | Warnung | «Unterlagen: Gate Review Packet für ‹Projekt› fehlt, Versand in 2 Arbeitstagen. Verschieben Sie das Traktandum auf Mi 10.12. oder warten Sie auf die Unterlagen.» | **Auf nächste Sitzung verschieben** |
| Quality-Check nicht bestanden (UC-006 A2) | *vorher* am Traktandum | Warnung | «Quality-Check: offen für ‹Projekt›. Ohne bestandenen Quality-Check wird das Geschäft nicht behandelt.» | verschieben |
| Zeitbedarf über Sitzungsdauer | *dabei* beim Aufnehmen | Hinweis | «Zeitbedarf: 3 h 20 statt höchstens 3 h.» | Traktandum verschieben oder Zeit kürzen |
| Gremienweg via SNS-VR (UC-006 A1; Q8 Kap. 5.1) | *vorher* automatisch am Traktandum | Hinweis | «Via SNS-VR: Der Entscheid des PRAT ist eine Stellungnahme; er gilt erst mit dem SNS-VR.» | – |
| Entscheid ohne Begründung (UC-006 Schritt 7) | *dabei* | Sperre | «Begründung fehlt: Sie erscheint im Protokoll und beim Projekt.» | Begründung erfassen |
| Protokoll nach 2–3 Arbeitstagen (Q8 Kap. 8.1) | *vorher* im Eingang | Hinweis, ab Tag 4 Warnung | «Protokoll PRAT 12.11.: Versand fällig seit Mo 17.11.» | Protokoll versenden |

## Texte

- Schaltflächen: «Aufnehmen», «Auf nächste Sitzung verschieben», «Portfoliobericht erzeugen», «Unterlagen versenden»,
  «Sitzung starten», «Entscheid erfassen», «Sitzung schliessen», «Protokoll versenden»
- Wirkung Versand: «9 Mitglieder des PRAT erhalten Traktandenliste, Portfoliobericht und 3 Gate Review Packets.»
- Benachrichtigung Mitglieder: «Unterlagen PRAT Mi 12.11. bereit: 6 Traktanden, davon 3 Gate-Reviews.»
- Toast nach Entscheid: «Entscheid erfasst: Gate P1–P2 freigegeben.»

## Barrierefreiheit und Tastatur

- Traktandenliste: Reihenfolge auch mit **Alt+↑ / Alt+↓**; Ziehen ist nur Abkürzung (I-M2, G9).
- Sitzungsmodus: **→ / ←** nächstes bzw. vorheriges Traktandum, **E** öffnet die Entscheidmaske; Zoom bis 200 % für die
  Projektion ohne Verlust (Q-B6).
- Das Erfassen eines Entscheids wird angesagt; Badges der Unterlagen haben Symbol und Text.

## Abnahmekriterien

- [ ] Eine neue Sitzung zeigt als Vorschläge alle eingeplanten Gate-Reviews, Eskalationen und Änderungsanträge des Gremiums.
- [ ] Aufnehmen eines Gate-Reviews setzt 35 Minuten und PL, CTL, SP als Eingeladene.
- [ ] Ein Traktandum eines Projekts in P1 trägt automatisch «via SNS-VR».
- [ ] Ein Traktandum ohne bestandenen Quality-Check zeigt die Warnung und lässt sich mit einem Klick verschieben.
- [ ] «Unterlagen versenden» zeigt vorher Anzahl Empfänger und Unterlagen und protokolliert den Versand mit Zeitpunkt.
- [ ] Nach «Gate freigegeben» stehen Phase und Baseline des Projekts richtig, bevor die Sitzung geschlossen wird.
- [ ] Auflagen erscheinen als Aufgaben im Eingang der Verantwortlichen, mit Termin.
- [ ] Benachrichtigungen an PL und SP gehen erst beim Schliessen der Sitzung, gebündelt je Person.
- [ ] Der Protokollentwurf enthält jedes Traktandum mit Entscheid und Begründung.
- [ ] Ein Mitglied öffnet auf einem Tablet (768 px) ein Traktandum und sieht den Antrag ohne Scrollen.

## Entscheide und offene Fragen

- Entscheid: Wirkung eines Entscheids sofort im Datenbestand (UC-006 Schritt 7), Benachrichtigungen erst beim Schliessen
  der Sitzung. So lässt sich ein falsch erfasster Entscheid in der Sitzung korrigieren, ohne dass Betroffene widersprüchliche
  Meldungen erhalten. Wie die Korrektur selbst geht, ist offen ([UX-OF-9](../fahrplan.md#offene-fragen)).
- Entscheid: Einladungen gebündelt mit dem Versand statt beim Aufnehmen (I-B3). Präzisiert UC-006 Schritt 2.
- Entscheid: Unterlagen im System lesen, PDF als Download, E-Mail nur mit Link (UX-E9).
- Offen: SNS-VR und VR (K02, K03); Rhythmus der GLPA (K08); vertrauliche Traktanden ([UX-OF-13](../fahrplan.md#offene-fragen)).

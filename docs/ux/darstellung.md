# Fachliche Darstellung

Die Kernobjekte sehen überall gleich aus: im Eingang, in Listen, in der Projektakte, im Dashboard, in der Sitzung, in
Benachrichtigungen und in erzeugten Dokumenten. Jede Darstellung ist ein wiederverwendbarer Baustein (Etappe E0) und wird
nicht je Ablauf nachgebaut.

## Formate

Region Schweiz (de-CH, Q-S2). Beispiele sind erfunden.

| Was | Darstellung | Beispiel |
|---|---|---|
| Datum zum Planen (Fristen, Sitzungen, Meilensteine) | Wochentag, Tag, Monat; Jahr nur, wenn nicht das laufende (I-T3) | «Mi 12.11.», «Mi 31.3.2027» |
| Frist nahe (≤ 14 Tage) | relativ und absolut (I-T2) | «Sa 25.10. · in 3 Tagen», «überfällig seit Sa 25.10.» |
| Frist in Arbeitstagen (Versand, Protokoll; Q8) | Arbeitstage ausdrücklich nennen | «Versand bis Mi 5.11. · in 4 Arbeitstagen» |
| Entscheide, Protokoll, Unterschriften, Verlauf | immer absolut mit Zeit | «Mi 12.11.2026, 15:42» |
| Periode | Monat und Jahr ausgeschrieben | «Oktober 2026» |
| Quartal | «Q3 2026» | |
| Phase | Kürzel und Name; in engen Spalten nur das Kürzel mit Name als Tooltip und für Bildschirmleser | «P1 Konzept und Planung», «P1» |
| Gate | «Gate» + Phasen mit Halbgeviertstrich; Eintritt und Exit ausgeschrieben | «Gate P1–P2», «Gate Eintritt P0», «Gate Exit P4» |
| Version | Nummer und Stand | «Version 2.0 · Baseline seit Mi 10.12.», «Entwurf 1.1 · in Arbeit» |
| Beträge im Detail | CHF, Tausendertrennzeichen Apostroph, ohne Rappen | «CHF 1'250'000» |
| Beträge in Listen, Dashboard, Matrix | CHF in Mio. mit zwei Stellen, unter 1 Mio. in Tsd. | «CHF 1,25 Mio.», «CHF 380 Tsd.» |
| Abweichung | Vorzeichen, Betrag oder Dauer und Prozent | «+CHF 300 Tsd. · +14 %», «+3 Wochen» |
| Personalbedarf | FTE mit einer Stelle; Grösse vor P1–P2 | «2,5 FTE · Mrz–Dez 2027», «Grösse M» |
| Projektnummer | Jahr und laufende Nummer | «2026-014» |

## Projekt (Dashboard-Zeile)

Die Zeile entspricht dem heutigen Dashboard (Q6 F7), damit Gremien und UE sie wiedererkennen.

- **klein** (Eingang, Traktandum, Auswahl): Projektname, Phase, Status-Symbol mit Trend.
- **mittel** (Dashboard, Monatsabschluss, Meine Projekte): Nummer, Handlungsfeld, Projektname, Thema, Projektleitung, Phase
  aktuell und «Abschluss per», nächster Meilenstein (Termin und Text), Status, Status Vorperiode, Trend.
- **gross** (Projektübersicht): zusätzlich Phasenleiste P0–P4 mit Gates (erledigt, aktuell, eingeplant mit Sitzungsdatum),
  Projektauftraggeber:in und Projektleitung, Business Case in Kennzahlen, letzte Entscheide.
- Mobil wird die Zeile zur Karte mit Projektname, Status mit Trend und nächstem Meilenstein (I-L6).
- Projekte «via SNS-VR», mit offener Eskalation, «nicht gemeldet» oder offenem Vermerk («ohne Freigabe») tragen ein Badge mit Text.

## Projektstatus und Trend

Der Projektstatus ist zweistufig (Q8 Kap. 9, AM.02.02) und wird nie mit dem Bearbeitungsstand verwechselt: Er erscheint
immer als Kreis mit Symbol, der Bearbeitungsstand als Badge mit Rahmen.

| Status | Symbol | Text | Farbe |
|---|---|---|---|
| Im Plan | gefüllter Kreis mit Haken | «Im Plan» | grün |
| Kritisch | gefüllter Kreis mit Ausrufezeichen | «Kritisch» | rot |
| Nicht gemeldet (UC-005 A3) | gestrichelter Kreis | «Nicht gemeldet» + Status der Vorperiode | neutral |

| Trend | Symbol | Text für Bildschirmleser |
|---|---|---|
| aufwärts | Pfeil schräg nach oben | «Trend aufwärts» |
| gleichbleibend | Pfeil nach rechts | «Trend gleichbleibend» |
| abwärts | Pfeil schräg nach unten | «Trend abwärts» |

Ein Wechsel gegenüber der Vorperiode wird als «Im Plan → Kritisch» gezeigt, nicht nur durch Farbe (Q-B5).

## Bearbeitungsstand

Ein Satz Badges für alle Objekte mit Bearbeitungsstand: Projektidee, Projektvertrag (Version), Statusbericht,
Änderungsantrag, Traktandum, Jahresziele, Quartalsreporting, Projekt.

| Familie | Symbol | Farbe | Stände (Beispiele je Objekt) |
|---|---|---|---|
| Entwurf, in Arbeit | Stift | neutral | Idee «Entwurf»; Vertrag «in Arbeit»; Jahresziele «in Arbeit»; Bericht «Entwurf» |
| Wartet auf andere | Uhr + «wartet auf ‹Name/Stelle›» | blau | Idee «eingereicht», «in Prüfung», «in Ergänzung» (wartet auf AS); Vertrag «in Prüfung», «zur Unterzeichnung 1 von 2»; Bericht «eingereicht», «zurückgegeben»; Jahresziele «zur Freigabe»; Traktandum «Entscheid SNS-VR ausstehend» |
| Traktandiert | Kalender + Sitzungsdatum | blau | Idee, Vertrag, Änderung, Bericht an den VR: «traktandiert PRAT Mi 10.12.» |
| Erledigt positiv | Haken | grün | Idee «freigegeben»; Vertrag «abgenommen» (Baseline); Bericht «geprüft»; Änderung «freigegeben»; Jahresziele «in Kraft»; Quartalsreporting «verabschiedet»; Projekt «abgeschlossen» |
| Erledigt negativ | Kreuz | rot | Idee «zurückgewiesen»; Änderung «abgelehnt»; Projekt «abgebrochen» |
| Ruhend, beendet ohne Entscheid | Strich | neutral | Idee «zusammengeführt», «zurückgestellt»; Projekt «zurückgezogen», «sistiert» |
| Abgeschlossen | Kalender mit Haken | neutral | Periode «abgeschlossen»; Sitzung «geschlossen»; Änderungen danach bleiben möglich und tragen «geändert nach Abschluss» (UX-E13). Das Schloss steht nur für «vertraulich» ([zugriff.md](zugriff.md#5-symbol)) |
| Vermerk offen | Kreis gestrichelt + Text | gelb | «ohne Freigabe», «Quality-Check offen», «Unterschrift offen», «Abnahme offen», «ohne Gate-Entscheid»; verschwindet, sobald der Vermerk nachgetragen ist (UX-E12) |
| Geändert nach … | Stift + Datum | neutral | «geändert nach Einreichen», «geändert nach Versand», «geändert nach Vorlage», «geändert nach Abschluss»; führt in den Verlauf (UX-E13) |

## Regelprüfung

| Stufe | Beispiele | Verhalten |
|---|---|---|
| **Sperre** | Pflichtangaben fehlen (UC-002 A3, UC-003 A3, UC-004 Schritt 7, UC-001 Schritt 2); «Kritisch» ohne Begründung und Massnahme (UC-004 A2); Jahresziel ohne Metrik (UC-011 Schritt 5); Freigabe einer Änderung an Scope, Budget oder Ressourcen durch die Projektauftraggeber:in vermerken (UC-007 A1, das vermerkt der PRAT); Ablehnen, Zurückweisen, Nicht unterzeichnen ohne Begründung | wird nicht ausgeführt; Meldung nennt alle Lücken mit Sprung zur Stelle. Nur für unvollständige oder widersprüchliche Eingaben, nie für fehlende Prüfung, Unterschrift oder Freigabe (UX-E12) |
| **Warnung** | wesentliche Abweichung (UC-004 A1, UC-010 A2; Schwelle K11); Unterlagen nicht 5 Arbeitstage vor der Sitzung (UC-006 A2); Budget oder Kapazität im Szenario überschritten (UC-008 Schritt 5); Überbuchung (UC-009 A1); unbeantwortete Leitfragen; fehlende oder ungeprüfte Berichte beim Periodenabschluss (UC-005 Schritt 5, A3); weiter ohne Quality-Check, Unterschrift, Freigabe oder Abnahme (UX-E12) | wird ausgeführt bzw. ist zulässig, bleibt am Objekt markiert; Begründung wo die Quelle sie verlangt |
| **Hinweis** | ähnliche Ideen (UC-001 Schritt 3); Gremienweg via SNS-VR (UC-006 A1); Abweichung zur Baseline im Entwurf; ungedeckter Bedarf (UC-009 A2) | nur am Objekt und im Prüfbericht |

Mustertexte nach «‹Regel›: ‹Ist› statt ‹Grenze› (‹wer, wann›). ‹Vorschlag›.» (I-P2):

- «Termin: Abschluss P2 neu 15.5.2027 statt 31.3.2027 laut Baseline (+6 Wochen). Beantragen Sie eine Änderung oder eskalieren Sie.»
- «Unterlagen: Versand 3 statt mindestens 5 Arbeitstage vor der Sitzung (PRAT Mi 12.11.). Verschieben Sie das Traktandum oder versenden Sie mit Vermerk.»
- «Kapazität Q2 2027: 7,5 FTE Projektleitung statt höchstens 5,0. Verschieben Sie den Start eines der 3 betroffenen Projekte.»

Die Quelle der Regel (PM-Handbuch Kapitel, Projektvertrag) ist auf Wunsch einblendbar (I-P2).

## Sensible Daten

Das PPM führt kaum Gesundheits- oder Lohndaten; sensibel sind vor allem Personen und strategische Vorhaben (G12, I-Z3).

| Daten | Wer sieht den Grund | Was andere sehen |
|---|---|---|
| Abwesenheiten aus dem HR-System (RK.01.02, falls übernommen, K23) | niemand im PPM; der Grund wird nicht übernommen | UE und PL: verfügbare Kapazität bzw. «nicht verfügbar ‹Zeitraum›» |
| Zuteilung und Auslastung einzelner Personen (UC-009) | UE, die Person selbst | PL: Zuteilung zum eigenen Projekt; übrige: nur Summen je Rolle |
| Bewertung, Kriterienraster und Begründung einer Idee (UC-001) | UE, vorgesehene Projektauftraggeber:in, Gremium | AS: Status und Begründung des Entscheids |
| Zurückweisungs-, Ablehnungs- und Abbruchsbegründungen | Betroffene (AS bzw. PL, AG), UE, Gremium | übrige: nur der Stand |
| Gremienunterlagen vor dem Versand, Protokollentwurf | UE | Mitglieder ab Versand; Eingeladene nur ihr Traktandum |
| Vertrauliche Projekte und Traktanden (z. B. Reorganisation, Standortfragen) | alle mit einer Rolle am Projekt, an seinem Portfolio oder übergreifend (Master Entscheid 13) | Mitglieder ohne weitere Rolle: das Projekt fehlt in jeder Liste |
| Vertrauliche Portfolios | alle mit einer Rolle am Portfolio, an einem seiner Projekte (nur Name und eigenes Projekt) oder übergreifend (Master Entscheid 22, A-76) | Mitglieder ohne weitere Rolle: Portfolio, seine Projekte und zugeordnete Ideen fehlen überall; Auslastung und Finanzsummen zählen ohne Namen |
| Exporte mit Personennamen (Dashboard, Protokoll) | – | Dokument trägt in der Kopfzeile «Intern · enthält Personendaten» (G12) |

## Personen

- Namensform: «Vorname Nachname»; in engen Spalten «V. Nachname». Funktion im Projekt dahinter, wo sie zählt: «Lea Brunner (Kernteam)».
- Funktionen erscheinen ausgeschrieben («Projektauftraggeber:in», «Projektleitung»); weitere Funktionen so, wie die
  Organisation sie erfasst (Master Entscheid 17). Gremien heissen wie bei der Insel: PRAT, GLPA, SNS-VR.
- Vertretung (I-Z2): «Sandra Frei in Vertretung von Daniel Keller» in Entscheiden, Unterschriften und Verlauf.

## Kosten

- Beträge sieht, wer am Projekt, an seinem Portfolio oder übergreifend eine Rolle hat; Mitglieder ohne weitere Rolle sehen
  keine (Master Entscheid 13).
- CAPEX und OPEX sind getrennt ausgewiesen, Summen zeigen beide Teile auf Wunsch.
- Prognose, Budget und Ist erscheinen immer in dieser Reihenfolge; fehlt Ist, steht «noch nicht verfügbar», nicht «0».

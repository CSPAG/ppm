# Fahrplan

Etappen als vertikale Scheiben: Jede liefert einen Kernablauf vollständig und wird gegen dessen Zielgrössen abgenommen
([pruefung.md](rahmen/pruefung.md#bei-der-abnahme-einer-etappe)). Reihenfolge nach fachlichen Abhängigkeiten: Zuerst muss
das Portfolio mit seinen laufenden Projekten im System sein und monatlich berichtet werden (es löst das Excel-Dashboard ab,
Q8 Kap. 8.3); darauf baut die Gremiumssitzung, die das Dashboard und die Eskalationen braucht; dann die Gates, die
Traktanden für das Gremium erzeugen; dann der Zufluss neuer Ideen, die Priorisierung über das gefüllte Portfolio und
zuletzt der Zielzyklus. Technologie und Bauplanung sind nicht Teil der UX-Schicht.

| Etappe | Inhalt | Ablauf | Fachliche Voraussetzung (Use Cases) | Abnahme |
|---|---|---|---|---|
| **E0 Fundament** | Navigation nach Arbeitsräumen und Recht, Eingang mit Kopf je Rolle und «Zu tun», Befehlspalette, Kontomenü mit Stellvertretung; Bausteine aus [darstellung.md](darstellung.md) (Projektzeile, Status und Trend, Bearbeitungsstand, Formate, Regelmeldung); Texte zentral je Sprache; Benutzer aus dem Verzeichnisdienst, Rollen je Portfolio und Projekt (Master Entscheid 18), Verlauf am Objekt (UX-E13); Handlungsfelder und strategische Ziele als Stammdaten (Q9); Übernahme der laufenden Projekte aus dem Excel-Dashboard (Vorschlag K16) | – | UC-016 (Grundfunktion), UC-017 (Organisation, Codetabellen, Phasenmodell, Portfolios und Gremien) | Q-L1, Q-L6, Q-B1–B6 auf allen Bausteinen; G1-Prüfung des Eingangs je Rolle |
| **E1 Monatsbericht** | Statusbericht, Monatsabschluss, Terminabweichungen, Dashboard der Periode | [K1](ablaeufe/K1-statusbericht.md) | UC-004, UC-005, UC-014 (Dashboard) | K1-1 bis K1-5, PPM-1, PPM-3 |
| **E2 Gremium** | Sitzung, Traktandenvorschläge, Versand, Sitzungsmodus, Entscheide, Protokoll; Portfoliobericht und Risikolage | [K3](ablaeufe/K3-gremiumssitzung.md) | UC-006, UC-014 (Portfoliobericht, Risikolage) | K3-1 bis K3-5, PPM-5 |
| **E3 Projektvertrag und Gate** | Projektakte mit Kapiteln, Gate-Modus, Versionsvergleich, Quality-Check, Unterzeichnen auf dem Telefon, Änderungsantrag, Dokumentausgabe; Vermerke statt Sperren (UX-E12) | [K2](ablaeufe/K2-projektvertrag.md) | UC-002, UC-003, UC-007; Pflichtangaben je Phase (K13) | K2-1 bis K2-5, PPM-2, PPM-4 |
| **E4 Ideen** | Assistent Projektidee, Ideenpool mit Funnel, Prüfung und Kategorie, Übergabe an Direktionen | [K4](ablaeufe/K4-projektidee.md) | UC-001 | K4-1 bis K4-4 |
| **E5 Priorisierung** | Bewertung, Matrix, Szenarien mit Wasserlinie, Bewertungsmodell; Auslastung | [K5](ablaeufe/K5-priorisierung.md) | UC-008, UC-009 (Auslastung); V10/K01, K20, K22 | K5-1 bis K5-4 |
| **E6 Ziele** | Zielzyklus, Freigabe, Roadmap, Zielerreichung, Quartalsreporting | [K6](ablaeufe/K6-ziele.md) | UC-011, UC-012 | K6-1 bis K6-4 |
| **E7 Ausbauen** | übrige Use Cases nach Seitentypen ohne eigene Spezifikation: Abschluss (UC-015), Ressourcenplanung (UC-009), Finanzen (UC-010), Jahresrückblick (UC-013), Ad-hoc-Auswertungen (UC-014), Administration vollständig (UC-016–018) mit dem Bereich «Zugriff» am Projekt und Portfolio (UX-E14) | – | UC-009, 010, 013, 014, 015, 016–018 | Q-W1 und Q-W2 je Rolle, PPM-6 |

Abnahmeergebnisse werden hier je Etappe nachgetragen (erreicht / nicht erreicht mit Massnahme).

Vor dem Bau jeder Etappe wird der Kernablauf mit 3–5 Personen der Rolle an realen Fällen durchgespielt
([pruefung.md](rahmen/pruefung.md#vor-dem-bau-ablauf-durchspielen)); das entspricht dem Prototyp-Test mit PL, UE und PRAT aus
dem Masterdokument (Abschnitt 13, Schritt 5).

## Offene Fragen

Fachliche Fragen stehen in der [Klärungsliste](../anhang/klaerungsliste.md) (K01–K25) und werden dort geklärt. Hier nur, was
die Oberfläche betrifft.

| Nr. | Frage | Betrifft | Vorschlag bis zur Klärung | Klärt |
|---|---|---|---|---|
| UX-OF-1 | Anrede in der Oberfläche: Sie oder Du? | alle Texte, Q-S4, UX-E7 | **Entschieden 28.10.2026: «Du»** | – |
| UX-OF-2 | Sprachen: nur Deutsch, oder auch Französisch bzw. Englisch? | Q-S1, Q-S3 | nur Deutsch; Texte trotzdem zentral und übersetzbar | UE |
| UX-OF-3 | Stimmen Gerät, Umgebung und Häufigkeit der Rollen ([nutzungskontexte.md](nutzungskontexte.md))? | UX-E1, alle Abläufe | Annahmen wie beschrieben | Interviews mit PL, AG, UE, PRAT |
| UX-OF-4 | Wann erscheint die Aufgabe «Statusbericht erstellen»? | K1 | am 18., 7 Tage vor dem Stichtag | UE |
| UX-OF-5 | Wann erscheinen «Gate vorbereiten» und «Sitzung vorbereiten»? | K2, K3 | 30 bzw. 15 Arbeitstage vor der Sitzung, im Phasenmodell konfigurierbar | UE |
| UX-OF-6 | Zugriff von unterwegs und von privaten Geräten (Telefon der Projektauftraggeber:innen) | UX-E1, K2 | Zugriff wie andere interne Web-Anwendungen der Insel | ICT (DTI), Informationssicherheit |
| UX-OF-7 | Darf die UE unauffällige Statusberichte gesammelt bestätigen? | K1 | ja, Berichte mit Auffälligkeit nicht | UE |
| UX-OF-8 | Höchstens ein Entwurf je Projekt: Wird eine Änderung während der Gate-Vorbereitung im Gate-Entwurf aufgenommen? | K2, UX-E5 | ja | UE |
| UX-OF-9 | Wie wird ein in der Sitzung falsch erfasster Entscheid korrigiert? | K3 | bis zum Schliessen der Sitzung durch die UE korrigierbar, mit Verlauf; danach nur über ein neues Traktandum | UE, PRAT |
| UX-OF-10 | Genügt Unterzeichnen als protokollierter Klick? Dürfen Stellvertretungen unterzeichnen? | K2 | Klick mit Protokoll; Stellvertretung nur, wenn im Profil ausdrücklich für Unterschriften erteilt; die Unterschrift ist ein Vermerk und hält nichts an (UX-E12) | Rechtsdienst, UE |
| UX-OF-11 | Sehen Antragstellende ähnliche Ideen anderer, bevor sie einreichen? | K4, G4 | **Entschieden 29.10.2026: ja**, alle Mitglieder lesen eingereichte Ideen (Master Entscheid 14) | – |
| UX-OF-12 | Wer sieht das Dashboard des ganzen Portfolios, wer Beträge? | IA Sichtbarkeit, darstellung.md | **Entschieden 29.10.2026:** Alle Mitglieder listen Projekte auf (Kopfdaten); Dashboard und Beträge sieht, wer am Portfolio bzw. Projekt eine Rolle hat (Master Entscheide 13, 14) | – |
| UX-OF-13 | Gibt es vertrauliche Projekte oder Traktanden mit eingeschränktem Kreis? | darstellung.md, K3 | **Entschieden 29.10.2026:** Kennzeichnung «vertraulich»; sichtbar für alle mit einer Rolle am Projekt, Portfolio oder übergreifend, nicht für Mitglieder (Master Entscheid 13) | – |
| UX-OF-14 | Wer sieht die publizierte Roadmap? | K6 | alle angemeldeten Personen, lesend | GL, UE |
| UX-OF-15 | Lesen Gremiumsmitglieder im System, oder brauchen sie die Unterlagen als PDF per E-Mail? | K3, UX-E9 | im System, PDF zum Herunterladen; E-Mail nur mit Link | PRAT-Sekretariat (UE), Informationssicherheit |
| UX-OF-16 | Was geschieht mit einem Statusbericht, der nach Abschluss der Periode eingeht? | K1 | wird angenommen, gilt für die nächste Periode; im Dashboard der abgeschlossenen Periode bleibt «nicht gemeldet» | UE |
| UX-OF-17 | Wie wird die Abweichung je Dimension beurteilt (Skala)? | K1, UC-004 Schritt 7 | «keine / gering / wesentlich» mit Kommentar | UE |
| UX-OF-18 | Wie entstehen Nutzen und Risiko für die Matrix? | K5, K01 | aus der Bewertung je Kriterium nach einer festen, angezeigten Zuordnung | UE, PRAT |
| UX-OF-19 | Wie bleibt der Eingang übersichtlich, wenn eine Person viele Kopfkarten hat (UE mit Finanzen und Ressourcen)? | IA Startseite, Master Entscheid 15 | Kopfkarten einklappbar, Wahl gespeichert; «Zu tun» bleibt vollständig | UE |

## Rückfluss an die Anforderungen

Präzisierungen, Lücken und Widersprüche, die bei der UX-Schicht aufgefallen sind. Sie werden im Masterdokument entschieden
und danach in Funktionsbaum und Use Cases nachgeführt (Generator `anhang/generator/`).

| UC | Schritt | Art | Vorschlag |
|---|---|---|---|
| Master §9 | Kern | Präzisierung | Kernabläufe der UX-Schicht: UC-004 mit UC-005 (K1), UC-002 mit UC-003 und UC-007 (K2), UC-006 (K3), UC-001 (K4), UC-008 (K5), UC-011 mit UC-012 (K6). In der Use-Case-Liste UC-001, UC-005, UC-007 und UC-012 als Teil eines Kernablaufs kennzeichnen. |
| Master §7 | Prüfregel | Präzisierung | «Eingang» ist die Startseite jeder Rolle mit Kopf je Rolle; der Arbeitsraum «Projekt» heisst in der Oberfläche «Projekte», «Gremium» heisst «Gremien» (Mehrzahl, weil mehrere Gremien und Projekte). |
| UC-004 | Ausgangslage | Lücke | Zeitpunkt der Berichtsaufgabe festlegen (UX-OF-4). |
| UC-004 | 1, 7 | Präzisierung | Alle Werte der Vorperiode vorausgefüllt, ausser Status und Trend; diese wählt die PL jeden Monat neu. |
| UC-004 | 8 | Präzisierung | Einreichen ist 10 s rückgängig zu machen. *Überholt durch UX-E13:* danach bleibt der Bericht änderbar, als Version mit Vermerk (UC-004 A4). |
| UC-005 | Ausgangslage | Präzisierung | Statt einer Prüfaufgabe je Bericht eine Sammelaufgabe je Periode im Eingang der UE. |
| UC-005 | 3 | Präzisierung | Sammelbestätigung für Berichte ohne Auffälligkeit (UX-OF-7). |
| UC-005 | 5, A3 | Lücke | Umgang mit Berichten, die nach dem Abschluss eingehen (UX-OF-16). |
| UC-002, UC-003, UC-007 | 1 bzw. 2 | Präzisierung | Höchstens ein Entwurf je Projekt; eine Änderung während der Gate-Vorbereitung wird im Gate-Entwurf aufgenommen (UX-OF-8). |
| UC-003 | 2 | Präzisierung | «Entwurf für Phase ‹n› anlegen» als eine Aktion aus der Gate-Aufgabe, mit Wirkung davor. |
| UC-007 | A1 | Präzisierung | Ob eine Änderung Scope, Budget oder Ressourcen betrifft, leitet das System aus den geänderten Kapiteln ab; welche Kapitel das sind, legt die UE im Phasenmodell fest (UC-017 Schritt 3 ergänzen). |
| UC-002, UC-003 | 10 bzw. 8 | Lücke | Rechtliche Form der Unterschrift und Unterschrift in Vertretung (UX-OF-10); UC-016 Schritt 4 regelt nur Freigaben. |
| UC-006 | 2 | Präzisierung | Einladungen gehen gebündelt mit dem Versand der Unterlagen (Schritt 5), nicht beim Anlegen des Traktandums. |
| UC-006 | 7–8 | Präzisierung, Lücke | Wirkung eines Entscheids sofort, Benachrichtigungen beim Schliessen der Sitzung; Korrektur eines erfassten Entscheids fehlt (UX-OF-9). |
| UC-001 | 4 | Lücke | Wie die vorgesehene Projektauftraggeber:in bei den Leitfragen mitwirkt (im System oder ausserhalb). |
| UC-001 | 5 | Präzisierung | Das Kriterienraster schlägt eine Kategorie vor; die UE entscheidet (Q8 Kap. 6). |
| UC-011 | 6–7 | Präzisierung | Der VR erhält ein Dokument, die UE erfasst den Entscheid (UX-E8). *Überholt durch UX-E13:* Die Jahresziele bleiben ab «zur Freigabe» änderbar, markiert «geändert nach Vorlage» (UC-011 Schritt 6). |
| UC-011 | 8 | Lücke | Kreis der publizierten Roadmap (UX-OF-14). |
| UC-012 | 5 | Präzisierung | «Dem VR bereitstellen» heisst: Dokument herunterladen bzw. versenden durch die UE; der VR ist kein Benutzer. |
| UC-014 | 1 | Lücke | *Erledigt* mit UX-OF-12 (Master Entscheide 13, 14). |

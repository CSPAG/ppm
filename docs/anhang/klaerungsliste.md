# Klärungsliste PPM (Insel Gruppe)

Entwurf, Stand 26. Oktober 2026. Vorbereitung für das Durchgehen der Use Cases mit PL, UE und PRAT. Die Liste bündelt alle offenen Punkte aus [PPM-Master.md](../PPM-Master.md#12-offene-punkte) und alle [OFFEN] aus Funktionsbaum und Use Cases. Je Frage: Fundstelle, Vorschlag von CSP als Diskussionsgrundlage und mit wem zu klären. Die Vorschläge sind **nicht entschieden**; Antworten werden im Masterdokument als Entscheid oder Annahme eingetragen.

## A Governance und Gremien

Klären mit: UE (Programmleitung), PRAT

| Nr | Frage | Fundstelle | Vorschlag CSP |
|---|---|---|---|
| K01 | Bewertet das System die Vorhaben mit einem gewichteten Score, oder nur mit einer Einschätzung je Kriterium und einer Gesamtbeurteilung durch das Gremium? | V10; PP.01.02; UC-008 Schritt 2 | Ohne Score: je Kriterium hoch/mittel/tief, Gesamtbeurteilung durch das Gremium, wie im PM-Handbuch (Q8 Kap. 6.1, 6.2). |
| K02 | Wie werden Geschäfte in P0 und P1 dem SNS-VR vorgelegt, und wie kommt dessen Entscheid ins System? | UC-006 A1; Q8 Kap. 5.1, 8.1 | SNS-VR als eigenes Gremium im System; die UE erfasst Vorlage und Entscheid, die Mitglieder sind keine Systembenutzer. |
| K03 | Gibt es Weiterleitungen an den VR ausserhalb des Quartalsreportings? | UC-006 A4; Q8 Kap. 8.1 | Ja, als Ausnahme; die UE erfasst Weiterleitung und Entscheid. |
| K04 | Ist der Programmauftraggeber der VR oder der VR-Präsident? | Q8 Kap. 1, 5.1 und Glossar «VRP» | VR, wie in Kap. 1 und 5.1; Glossar im PM-Handbuch angleichen. |
| K05 | Wer gehört zur Sponsoren-Koalition? Unterzeichnen «Auftraggeber» und «Sponsor» im Projektvertrag getrennt? | Q7 Kopf, Kap. 12; Q8 Abb. 7 | Koalition = weitere GL-Mitglieder, im Vertrag als Liste geführt; eine Unterschrift für Auftraggeber/Sponsor. |
| K06 | Wer benennt Sponsor und Projektleitung, wenn die Initialisierung freigegeben wird? | UC-001 Schritt 7 | Das Gremium benennt den Sponsor, der Sponsor die Projektleitung. |
| K07 | Darf die UE eine Idee allein zurückweisen, oder entscheidet immer das Gremium? | UC-001 A3 | Die UE weist offensichtlich ungeeignete Ideen zurück und informiert das Gremium; alle anderen entscheidet das Gremium. |
| K08 | Gelten für Kategorie B Projektvertrag, Quality-Check der UE und monatliches Dashboard? In welchem Rhythmus tagt die GLPA? | Q8 Kap. 1, 7 | Ja, gleicher Mindeststandard wie Kategorie A; Rhythmus der GLPA erfragen. |
| K09 | Soll das System die Portfolios der Direktionen (Kategorie C) führen? | Annahme Abschnitt 11; UC-017 A1 | Ja, freiwillig, ohne Pflicht-Gates und Pflicht-Reporting. |
| K10 | Wie wird ein sistiertes Vorhaben wieder aufgenommen? | UC-015 A1 | Das Gremium beschliesst die Wiederaufnahme; der Vertrag wird über ein Gate fortgeschrieben (UC-003). |

## B Reporting, Projektvertrag und Konfiguration

Klären mit: UE, PMO, Projektleitungen

| Nr | Frage | Fundstelle | Vorschlag CSP |
|---|---|---|---|
| K11 | Ab welcher Schwelle ist eine Abweichung bei Termin, Kosten oder Umfang wesentlich? | UC-004 A1; UC-007; UC-010 A2; Q8 Kap. 9 «Toleranzen» | Toleranzen je Vorhaben im Projektvertrag festlegen, mit Standardwerten aus dem Phasenmodell; Werte mit der UE bestimmen. |
| K12 | Was gilt, wenn ein Statusbericht bis Monatsende fehlt? | UC-005 A3 | Werte der Vorperiode mit Vermerk «nicht gemeldet», im Dashboard sichtbar. |
| K13 | Welche Angaben des Projektvertrags sind je Phase Pflicht? | UC-002 A3; UC-003 A3; UC-017 Schritt 3; Q7; Q8 Anhang 1 | Aus Q7 und der Deliverable-Matrix (Q8 Anhang 1) einen Vorschlag ableiten und mit der UE festlegen. |
| K14 | Wann erscheint die Finalversion des PM-Handbuchs (heute 0.92)? | Q8 | Termin erfragen; danach Abgleich der Spezifikation. |
| K15 | Gilt eine neue Version des Phasenmodells auch für Vorhaben, die bereits in der Phase laufen? | UC-017 Schritt 5 | Ab dem nächsten Gate des Vorhabens. |
| K16 | Werden die laufenden Vorhaben aus dem heutigen Excel-Dashboard übernommen? | Systemgrenze; Q8 Kap. 6.3 | Ja, einmalig: Stammdaten, Phase, Status, Trend, nächster Meilenstein, Verantwortliche. |

## C Ziele

Klären mit: UE, GL

| Nr | Frage | Fundstelle | Vorschlag CSP |
|---|---|---|---|
| K17 | Sind die «3–5-Jahresziele» (Q6 F1) und «Dreijahresziele» (F2) die strategischen Ziele 2030 (F3)? Ist «kurz-, mittel- und langfristige Ziele» (Q9) eine eigene Stufe? | Abschnitt 4; ZM.01.02 | Strategische Ziele = Ziele 2030; keine zusätzliche Stufe. |

## D Finanzen

Klären mit: Finanzen

| Nr | Frage | Fundstelle | Vorschlag CSP |
|---|---|---|---|
| K18 | Woher kommen die Ist-Kosten, in welchem Rhythmus, und wie werden sie einem Vorhaben zugeordnet? | PC.01.02; UC-010 Schritt 1, A1 | Monatlich aus dem ERP über einen Kostenträger je Vorhaben. |
| K19 | Wie wird aus den Kosten je Phase das Budget je Jahr abgeleitet? | PC.01.05; UC-010 Schritt 5 | Zeitanteilig nach den Phasenterminen, durch FI korrigierbar. |
| K20 | Gibt es Budgetrahmen je Portfoliokategorie? | PP.01.03; UC-008 A1 | Erfragen; ohne Rahmen entfällt die Budget-Wasserlinie im Szenario. |
| K21 | Wie ist der Business Case aufgebaut (Kosten, Nutzen, Top Line, Bottom Line)? Gibt es eine Vorlage? | PC.03.04; Q6 F8; Q8 Kap. 13 | Vorlage Business Case anfordern. |

## E Ressourcen und Benutzer

Klären mit: Ressourcenmanagement, HR, ICT

| Nr | Frage | Fundstelle | Vorschlag CSP |
|---|---|---|---|
| K22 | Wer übernimmt die Rolle Ressourcenmanagement? Reicht die Planung in FTE × Monate je Rolle und Phase, oder braucht es Pools? | RK.01.01; UC-009; Q7 Kap. 9.2; Q8 Abb. 3 | Start mit FTE × Monate je Rolle und Phase («Ressourcensteuerung auf Top-Level»); Pools später. |
| K23 | Kommen Benutzer, Personal- und Abwesenheitsdaten aus HR-System oder Verzeichnisdienst? | RK.01.02; UC-009 Schritt 1; UC-016 Schritt 1 | Benutzer aus dem Verzeichnisdienst; Abwesenheiten erst mit einer Planung je Pool. |

## F ICT und Infrastruktur

Klären mit: DTI, DBI

| Nr | Frage | Fundstelle | Vorschlag CSP |
|---|---|---|---|
| K24 | Wie werden die eigenen Projekt- und Investitionsprozesse von ICT und Infrastruktur angebunden (Meldung, Status, Freigaben)? | RK.02.06; UC-002 A2; Q8 Abb. 4 | Meldung aus dem PPM, Status und Freigaben als Information zurück; Umfang mit DTI und DBI klären. |

## G Begriffe

Klären mit: UE

| Nr | Frage | Fundstelle | Vorschlag CSP |
|---|---|---|---|
| K25 | Wofür stehen AeD, DPF, DLF, DMS, DP, DTI, DIB bzw. DBI, PFLE, DRC, «CP» in Phase 1 und «Streams»? | Q6 F1, F2, F6, F7; Q8 Abb. 1, 4 | Liste der Direktionen mit Kürzeln anfordern; «CP» und «Streams» erfragen. |

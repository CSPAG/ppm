# UX-Rahmen

**Projektneutral.** Dieser Ordner beschreibt, wie ein Projekt von fachlichen Anforderungen (Funktionsbaum, Use Cases)
zu einer Oberfläche kommt, die sich gut bedienen lässt. Er enthält keine Angaben zu einem bestimmten Produkt und lässt
sich unverändert in andere Projekte übernehmen. Was nur für ein Projekt gilt, steht im übergeordneten Ordner `docs/ux/`
des Projekts.

| Datei | Inhalt |
|---|---|
| [grundsaetze.md](grundsaetze.md) | 12 Leitsätze mit je einer Prüffrage |
| [qualitaetsziele.md](qualitaetsziele.md) | nicht-funktionale UX-Anforderungen mit Standardwerten (Leistung, Barrierefreiheit, Geräte, Sprache) |
| [interaktion.md](interaktion.md) | verbindliche Interaktionsregeln: Navigation, Seitentypen, Listen, Formulare, Rückmeldung, Zustände, Prüfungen, Rechte |
| [vorlage-ablauf.md](vorlage-ablauf.md) | Vorlage für die UX-Spezifikation eines Kernablaufs |
| [pruefung.md](pruefung.md) | wie UX geprüft und gemessen wird; UX-Definition of Done für jeden Pull Request |

## Wo die UX-Schicht steht

```
Funktionsbaum (BM › BD › BC)        was das Geschäft braucht
  └─ Use Cases (UC)                 was System und Akteure tun, Schritt für Schritt
       └─ UX-Schicht                wie es sich bedient: für wen, wo, wie schnell, in welchem Zustand
            └─ Code (Features)      wie es gebaut ist
```

- Ein Use Case sagt, **was** passiert. Die UX-Schicht sagt, **wie** eine Person es erlebt: Einstieg, Gerät, Anzahl
  Schritte, Rückmeldung, Zustände, Texte und messbare Zielgrössen.
- Die UX-Schicht darf einen Use Case **präzisieren** (z. B. «Speichern» wird zu automatischem Speichern), aber nicht
  widersprechen. Bei einem Widerspruch wird der Use Case angepasst, nicht stillschweigend die Oberfläche.
- Querschnittliches (Navigation, Zustände, Formulare …) wird **einmal** geregelt ([interaktion.md](interaktion.md)) und
  nicht in jedem Ablauf wiederholt. Ein Ablauf beschreibt nur, was an ihm besonders ist.

## Vorgehen

1. **Nutzungskontexte** beschreiben (`nutzungskontexte.md`): je Rolle Gerät, Umgebung, Häufigkeit, Zeitdruck, die eine
   Frage, die sie beim Öffnen beantwortet haben will, und was für sie Erfolg ist. Rollen aus dem Akteurskatalog der Use
   Cases übernehmen, nicht neu erfinden.
2. **Informationsarchitektur** festlegen (`informationsarchitektur.md`): Oberflächen aus dem UI-Katalog zu wenigen
   **Arbeitsflächen** zusammenfassen, nach Aufgabe und nicht nach Datenobjekt oder Modul. Je Rolle sichtbare
   Arbeitsflächen und Startseite. Jede Oberfläche des Katalogs genau einer Arbeitsfläche zuordnen.
3. **Kernabläufe** wählen: die 5–8 Abläufe, die über den Erfolg entscheiden. Kriterien: Häufigkeit × Anzahl Personen,
   Zeitdruck, Folgen eines Fehlers (Recht, Geld, Gesundheit). Alles andere folgt den Regeln aus
   [interaktion.md](interaktion.md) ohne eigene Spezifikation.
4. **Kernabläufe spezifizieren** (`ablaeufe/`, nach [vorlage-ablauf.md](vorlage-ablauf.md)): Job-Story, Zielgrössen,
   Ablauf aus Sicht der Person, Zustände, Regeln, Texte, Abnahmekriterien. Jede Zielgrösse ist messbar.
5. **Fachliche Darstellungsregeln** festhalten (`darstellung.md`): wie die Kernobjekte der Domäne überall gleich
   aussehen (Zeiten, Beträge, Status, Personen, sensible Daten).
6. **Fahrplan** (`fahrplan.md`): Etappen als vertikale Scheiben, je mit Abnahme über die Zielgrössen. Die erste Etappe
   baut das Fundament (Navigation, Bausteine), jede weitere liefert einen Kernablauf vollständig.
7. **Prüfen** ([pruefung.md](pruefung.md)): Abläufe vor dem Bau mit echten Personen durchspielen, jede Etappe gegen die
   Zielgrössen abnehmen, im Betrieb messen.

## Übernahme in ein neues Projekt

1. Ordner `rahmen/` nach `docs/ux/rahmen/` kopieren, nicht ändern. Abweichungen gehören ins Projekt
   (`docs/ux/README.md`, Abschnitt «Abweichungen vom Rahmen») mit Begründung.
2. Im Projekt anlegen:

   | Datei | Mindestinhalt |
   |---|---|
   | `docs/ux/README.md` | Überblick, Zielwerte des Projekts, Abweichungen vom Rahmen, Projektentscheide |
   | `docs/ux/nutzungskontexte.md` | Tabelle je Rolle (Schritt 1) |
   | `docs/ux/informationsarchitektur.md` | Arbeitsflächen, Sichtbarkeit je Rolle, Zuordnung UI-Katalog, Adressen |
   | `docs/ux/darstellung.md` | Darstellungsregeln der Domäne |
   | `docs/ux/ablaeufe/K<n>-<name>.md` | ein Kernablauf je Datei |
   | `docs/ux/fahrplan.md` | Etappen, Abnahme, offene Fragen |

3. In den Arbeitsregeln des Projekts (z. B. `CLAUDE.md`) verankern: Vor einem neuen Feature den passenden Kernablauf
   lesen oder ergänzen; jeder Pull Request mit Oberfläche erfüllt die UX-Definition of Done ([pruefung.md](pruefung.md)).

Stand des Rahmens: Version 1.1 (gegenüber 1.0 nur domänenneutrale Beispiele, Regeln unverändert).

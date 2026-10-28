/**
 * Grundbestand der Vorlagen (AM.03.01 Grundfunktion, AP-E3-5): die Vorlage «Projektvertrag» nach Q7 (PM-Handbuch,
 * Vorlage Projektvertrag) mit Deckblatt «Vorliegende Version», Kapiteln 1–13 und Kopfzeile «Intern · enthält
 * Personendaten» (G12, darstellung.md «Sensible Daten»). Er gilt, solange die Organisation für die Art keine eigene
 * Vorlage aktiv gesetzt hat (AP-E7-7, `store.ts`); das PDF setzt immer der Grundbestand.
 */
import type { Art } from './arten.ts';

export interface Vorlage {
  art: Art;
  /** Fassung der Vorlage; erscheint im Dokument (Fusszeile). */
  version: string;
  name: string;
  /** Quelle der Gliederung. */
  quelle: string;
  /** Kopfzeile jeder Seite (G12). */
  kopfzeile: string;
  /** Titel des Deckblatts. */
  titel: string;
  /** Gliederung: Nummer und Titel der Kapitel bzw. Abschnitte, in der Reihenfolge des Dokuments. */
  gliederung: readonly { nr: string; titel: string }[];
  grundbestand: true;
}

/** Kopfzeile für Dokumente mit Personendaten (G12). */
export const PERSONENDATEN = 'Intern · enthält Personendaten';

const PROJEKTVERTRAG: Vorlage = {
  art: 'projektvertrag',
  version: '1',
  name: 'Projektvertrag',
  quelle: 'PM-Handbuch, Vorlage Projektvertrag (Q7)',
  kopfzeile: PERSONENDATEN,
  titel: 'Projektvertrag',
  gliederung: [
    { nr: '1', titel: 'Ausgangslage / Problembeschreibung' },
    { nr: '2', titel: 'Strategiebezug' },
    { nr: '3', titel: 'Ziele und Nutzenbeitrag' },
    { nr: '4', titel: 'Lösungsansatz' },
    { nr: '5', titel: 'Abgrenzung' },
    { nr: '6', titel: 'Abhängigkeiten von anderen Projekten / Schnittstellen' },
    { nr: '7', titel: 'Projektplanung und Lieferergebnisse' },
    { nr: '7.1', titel: 'Projektphasen und Lieferergebnisse' },
    { nr: '7.2', titel: 'Zusammenfassung Projektplanung' },
    { nr: '8', titel: 'Projektstruktur und Organisation' },
    { nr: '9', titel: 'Ressourcen' },
    { nr: '9.1', titel: 'Kosten' },
    { nr: '9.2', titel: 'Personal' },
    { nr: '10', titel: 'Risiko-Management' },
    { nr: '11', titel: 'Change Management' },
    { nr: '11.1', titel: 'Stakeholder-Management' },
    { nr: '11.2', titel: 'Kommunikation' },
    { nr: '12', titel: 'Freigabe' },
    { nr: '13', titel: 'Beilagen' },
  ],
  grundbestand: true,
};

const GRUNDBESTAND: Partial<Record<Art, Vorlage>> = { projektvertrag: PROJEKTVERTRAG };

/** Grundbestand einer Art; null, wenn das System für sie keinen mitliefert. */
export const grundbestand = (art: Art): Vorlage | null => GRUNDBESTAND[art] ?? null;

/** Grundbestand des Projektvertrags (Layout der Ausgabe). */
export const aktuell = (_art: 'projektvertrag'): Vorlage => PROJEKTVERTRAG;

/** Titel eines Abschnitts der Gliederung, z. B. `titelVon(v, '9.1')` → «Kosten». */
export function titelVon(v: Vorlage, nr: string): string {
  const g = v.gliederung.find(x => x.nr === nr);
  if (!g) throw new Error(`Abschnitt ${nr} fehlt in der Vorlage ${v.name}`);
  return g.titel;
}

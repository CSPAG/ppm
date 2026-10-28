/**
 * Katalog der Umsysteme und ihrer Daten (BC AM.03.02; UC-018 Schritt 3): nur, was der Master (§3 «Umsysteme») und die
 * Annahmen nennen. Adresse und Protokoll der Umsysteme stehen nicht in docs/ (Annahme AP-E7-3, umsetzungsstand.md): Die Verarbeitung der Daten bringt
 * das Fachmodul mit (z. B. Ist-Kosten mit AP-E7-4) und registriert sie hier; ohne Verarbeitung schlägt ein Lauf mit
 * «noch nicht verfügbar» fehl, der Testlauf prüft nur die Verbindung.
 */
import type { Tx } from '@vollholz/platform';

export type Richtung = 'eingehend' | 'ausgehend';
export type Rhythmus = 'manuell' | 'taeglich' | 'woechentlich' | 'monatlich';
export const RHYTHMEN: readonly Rhythmus[] = ['manuell', 'taeglich', 'woechentlich', 'monatlich'];

export interface Eintrag {
  umsystem: string;
  umsystemLabel: string;
  daten: string;
  datenLabel: string;
  richtung: Richtung;
  /** Herkunft im Bauplan (Annahme, Klärung, BC). */
  quelle: string;
}

export const KATALOG: readonly Eintrag[] = [
  { umsystem: 'erp', umsystemLabel: 'ERP', daten: 'ist_kosten', datenLabel: 'Ist-Kosten je Kostenträger und Monat', richtung: 'eingehend', quelle: 'A-16 (K18), PC.01.02' },
  { umsystem: 'hr', umsystemLabel: 'HR-System', daten: 'personal', datenLabel: 'Personal- und Abwesenheitsdaten', richtung: 'eingehend', quelle: 'RK.01.02 (K23 offen)' },
  { umsystem: 'budget', umsystemLabel: 'Budgetprozess', daten: 'jahresbedarf', datenLabel: 'Jahresbedarf der Vorhaben', richtung: 'ausgehend', quelle: 'A-17 (K19), PC.01.05' },
];

export const eintrag = (umsystem: string, daten: string): Eintrag | undefined => KATALOG.find(e => e.umsystem === umsystem && e.daten === daten);

/** Name einer Schnittstelle für Aufgaben und Meldungen: «ERP · Ist-Kosten je Kostenträger und Monat». */
export const nameVon = (umsystem: string, daten: string): string => {
  const e = eintrag(umsystem, daten);
  return e ? `${e.umsystemLabel} · ${e.datenLabel}` : `${umsystem} · ${daten}`;
};

/**
 * Verarbeitung der Daten, vom Fachmodul registriert (Registrierung statt Import, zielarchitektur.md Checkliste 3).
 * Eingehend: die Antwort des Umsystems übernehmen (in der Transaktion des Laufs) und die Zahl der Datensätze liefern.
 * Ausgehend: den Inhalt für das Umsystem liefern (JSON) mit der Zahl der Datensätze.
 */
export interface Verarbeitung {
  uebernehmen?(tx: Tx, antwort: string): Promise<number>;
  liefern?(tx: Tx): Promise<{ inhalt: unknown; umfang: number }>;
}

const verarbeitungen = new Map<string, Verarbeitung>();

/** Verarbeitung für Daten des Katalogs setzen (`null` entfernt sie, z. B. in Tests). */
export function verarbeitungSetzen(daten: string, v: Verarbeitung | null): void {
  if (!KATALOG.some(e => e.daten === daten)) throw new Error(`Daten «${daten}» nicht im Katalog der Schnittstellen`);
  if (v) verarbeitungen.set(daten, v);
  else verarbeitungen.delete(daten);
}

export const verarbeitung = (daten: string): Verarbeitung | undefined => verarbeitungen.get(daten);

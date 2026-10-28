/**
 * Dokumentmodell der Ausgabe (AM.03.01, DM.02.07): eine Folge von Blöcken, unabhängig vom Format. Die Fachmodule füllen
 * es mit ihren Daten (z. B. `vertrag` den Projektvertrag), die Vorlage bestimmt Kopf, Fuss und Gliederung, die Schreiber
 * (`docx.ts`, `pdf.ts`) setzen es im Layout der Vorlage. Texte sind fertig formatiert (Datum, Beträge, Namen).
 */
export type Block =
  /** Titel des Dokuments (Deckblatt). */
  | { art: 'titel'; text: string; untertitel?: string }
  /** Kapitelüberschrift (Ebene 1, mit Nummer) bzw. Abschnitt (Ebene 2). */
  | { art: 'ueberschrift'; text: string; ebene: 1 | 2 }
  /** Fliesstext; Zeilenumbrüche im Text bleiben erhalten. Leer: `leer` wird kursiv gesetzt. */
  | { art: 'absatz'; text: string; leer?: string }
  /** Beschriftete Felder (zwei Spalten, z. B. «Version: 0.1»). */
  | { art: 'felder'; zeilen: readonly (readonly [string, string])[] }
  /** Tabelle mit Kopfzeile; `breiten` als Anteile (Summe beliebig). Leer: `leer` als Hinweis. */
  | { art: 'tabelle'; kopf: readonly string[]; zeilen: readonly (readonly string[])[]; breiten?: readonly number[]; leer?: string };

export interface Dokument {
  /** Titel in den Eigenschaften der Datei. */
  titel: string;
  /** Kopfzeile jeder Seite, z. B. «Intern · enthält Personendaten» (G12). */
  kopfzeile: string;
  /** Fusszeile jeder Seite; «Seite n von m» setzt der Schreiber dahinter. */
  fusszeile: string;
  bloecke: readonly Block[];
}

export const FORMATE = ['pdf', 'docx'] as const;
export type Format = (typeof FORMATE)[number];

export const MIME: Record<Format, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** «Seite 3 von 7» (de-CH). */
export const seiteVon = (n: number, m: number) => `Seite ${n} von ${m}`;

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
  /** Fliesstext; Zeilenumbrüche im Text bleiben erhalten. Leer: `leer` wird kursiv gesetzt. `feld`: Datenfeld für Vorlagen. */
  | { art: 'absatz'; text: string; leer?: string; feld?: string }
  /** Beschriftete Felder (zwei Spalten, z. B. «Version: 0.1»); `felder[i]` = Datenfeld der Zeile i für Vorlagen. */
  | { art: 'felder'; zeilen: readonly (readonly [string, string])[]; felder?: readonly (string | null)[] }
  /** Tabelle mit Kopfzeile; `breiten` als Anteile (Summe beliebig). Leer: `leer` als Hinweis. `feld`: als Text für Vorlagen. */
  | { art: 'tabelle'; kopf: readonly string[]; zeilen: readonly (readonly string[])[]; breiten?: readonly number[]; leer?: string; feld?: string };

export interface Dokument {
  /** Titel in den Eigenschaften der Datei. */
  titel: string;
  /** Kopfzeile jeder Seite, z. B. «Intern · enthält Personendaten» (G12). */
  kopfzeile: string;
  /** Fusszeile jeder Seite; «Seite n von m» setzt der Schreiber dahinter. */
  fusszeile: string;
  bloecke: readonly Block[];
  /** Weitere Datenfelder für Vorlagen, die im Layout des Grundbestands nicht als eigener Block stehen (z. B. Projektname). */
  felder?: Readonly<Record<string, string>>;
}

/**
 * Werte der Datenfelder eines Dokuments (UC-018 Schritt 2): aus den Blöcken mit `feld` und `felder`; Tabellen als Text
 * mit einer Zeile je Eintrag («P1 · Meilenstein · Lösungskonzept · 15.01.2027»). Dieselben Werte wie im Grundbestand.
 */
export function werte(d: Dokument): Record<string, string> {
  const out: Record<string, string> = { ...d.felder };
  for (const b of d.bloecke) {
    if (b.art === 'absatz' && b.feld) out[b.feld] = b.text.trim();
    else if (b.art === 'felder' && b.felder) b.felder.forEach((f, i) => { if (f) out[f] = b.zeilen[i]?.[1] ?? ''; });
    else if (b.art === 'tabelle' && b.feld) out[b.feld] = b.zeilen.map(z => z.filter(x => x.trim() && x !== '–').join(' · ')).join('\n');
  }
  return out;
}

export const FORMATE = ['pdf', 'docx'] as const;
export type Format = (typeof FORMATE)[number];

export const MIME: Record<Format, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** «Seite 3 von 7» (de-CH). */
export const seiteVon = (n: number, m: number) => `Seite ${n} von ${m}`;

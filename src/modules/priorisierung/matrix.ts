/**
 * Einordnung in die Portfolio-Matrix (BC PP.03.04, UC-008 Schritt 4; Q6 F9): Nutzen und Risiko je Projekt aus der
 * Bewertung je Kriterium nach der festen, angezeigten Zuordnung des Bewertungsmodells (A-39, UX-OF-18). Kein Score für
 * die Gesamtbeurteilung (A-01): je Achse nur der Durchschnitt der Einschätzungen der zugeordneten Kriterien (tief = 1,
 * mittel = 2, hoch = 3); über 2 «hoch», unter 2 «tief», genau 2 «auf der Grenze» – dort beurteilt das Gremium.
 * Felder nach Q6 F9: Nutzen hoch und Risiko hoch «Priorisieren», Nutzen hoch und Risiko tief «Rasch umsetzen», Nutzen
 * tief und Risiko tief «Opportunistisch umsetzen», Nutzen tief und Risiko hoch «Hinterfragen».
 */

export type Einschaetzung = 'hoch' | 'mittel' | 'tief';
export type Stufe = 'hoch' | 'tief' | 'grenze';
export type Feld = 'priorisieren' | 'rasch_umsetzen' | 'opportunistisch' | 'hinterfragen';

export const PUNKTE: Record<Einschaetzung, number> = { tief: 1, mittel: 2, hoch: 3 };

export interface Achse {
  /** Durchschnitt 1–3, auf zwei Stellen; null ohne bewertetes Kriterium dieser Achse. */
  wert: number | null;
  stufe: Stufe | null;
  /** bewertete von zugeordneten Kriterien */
  bewertet: number;
  von: number;
}

export function achse(kriterien: readonly string[], bewertung: ReadonlyMap<string, Einschaetzung>): Achse {
  const werte = kriterien.flatMap(k => { const e = bewertung.get(k); return e ? [PUNKTE[e]] : []; });
  if (!werte.length) return { wert: null, stufe: null, bewertet: 0, von: kriterien.length };
  const wert = Math.round((werte.reduce((s, x) => s + x, 0) / werte.length) * 100) / 100;
  return { wert, stufe: wert > 2 ? 'hoch' : wert < 2 ? 'tief' : 'grenze', bewertet: werte.length, von: kriterien.length };
}

/** Feld der Matrix; null, solange eine Achse fehlt oder auf der Grenze liegt. */
export function feld(nutzen: Achse, risiko: Achse): Feld | null {
  if (!nutzen.stufe || !risiko.stufe || nutzen.stufe === 'grenze' || risiko.stufe === 'grenze') return null;
  if (nutzen.stufe === 'hoch') return risiko.stufe === 'hoch' ? 'priorisieren' : 'rasch_umsetzen';
  return risiko.stufe === 'hoch' ? 'hinterfragen' : 'opportunistisch';
}

/** Ressourcenbedarf eines Projekts: Summe FTE × Monate (RK.02.05) und grösste gemeldete Grösse S/M/L (RK.02.01). */
export function ressourcen(bedarf: readonly Record<string, unknown>[]): { fteMonate: number | null; groesse: 'S' | 'M' | 'L' | null } {
  let fteMonate: number | null = null;
  let groesse: 'S' | 'M' | 'L' | null = null;
  const rang = { S: 1, M: 2, L: 3 } as const;
  for (const b of bedarf) {
    if (typeof b.fte === 'number' && typeof b.vonMonat === 'string' && typeof b.bisMonat === 'string') {
      const monate = (Number(b.bisMonat.slice(0, 4)) * 12 + Number(b.bisMonat.slice(5, 7))) - (Number(b.vonMonat.slice(0, 4)) * 12 + Number(b.vonMonat.slice(5, 7))) + 1;
      fteMonate = Math.round(((fteMonate ?? 0) + b.fte * monate) * 100) / 100;
    }
    if (b.groesse === 'S' || b.groesse === 'M' || b.groesse === 'L') {
      if (!groesse || rang[b.groesse] > rang[groesse]) groesse = b.groesse;
    }
  }
  return { fteMonate, groesse };
}

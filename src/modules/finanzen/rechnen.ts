/**
 * Rechnungen der Finanzen ohne Datenbank (UC-010 Schritte 2, 3, 5): Summen aus dem Register `kosten`, Abweichung mit
 * Toleranz (A-10: ohne Wert keine Warnung «wesentlich») und Jahresbedarf zeitanteilig nach den Phasenterminen (A-17).
 */

export type Art = 'capex' | 'opex';
export const ARTEN: readonly Art[] = ['capex', 'opex'];
export const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;

/** Kostenposition, wie sie `projektdaten` liefert (Beträge `null`, wenn nicht erfasst). */
export interface Position { phase: string; art: Art; budgetBaseline: number | null; prognose: number | null }
/** Meilenstein mit Terminen «JJJJ-MM-TT». */
export interface Termin { phase: string; terminBaseline: string | null; terminAktuell: string | null }

const rund = (n: number) => Math.round(n * 100) / 100;
const summe = (werte: readonly (number | null)[]): number | null => (werte.some(w => w !== null) ? rund(werte.reduce<number>((s, w) => s + (w ?? 0), 0)) : null);

/** Prognose einer Position; ohne Prognose gilt das Budget (UC-004: Prognose = aktuelle Erwartung). */
export const erwartet = (p: Position): number | null => p.prognose ?? p.budgetBaseline;

export interface Summen { budget: number | null; prognose: number | null }
export const summen = (ps: readonly Position[]): Summen => ({ budget: summe(ps.map(p => p.budgetBaseline)), prognose: summe(ps.map(erwartet)) });

/** Budget und Prognose je Phase und Art (nur vorhandene Kombinationen, in der Reihenfolge der Phasen). */
export function jePhase(ps: readonly Position[]): ({ phase: string; art: Art } & Summen)[] {
  const out: ({ phase: string; art: Art } & Summen)[] = [];
  for (const phase of PHASEN) for (const art of ARTEN) {
    const teil = ps.filter(p => p.phase === phase && p.art === art);
    if (teil.length) out.push({ phase, art, ...summen(teil) });
  }
  return out;
}

/**
 * Abweichung der Prognose vom Budget. «wesentlich», wenn sie die Toleranz in Prozent des Budgets übersteigt (A-10, K11);
 * ohne Toleranz oder ohne Budget nie wesentlich.
 */
export function abweichung(s: Summen, toleranzProzent: number | null): { betrag: number | null; prozent: number | null; wesentlich: boolean } {
  if (s.budget === null || s.prognose === null) return { betrag: null, prozent: null, wesentlich: false };
  const betrag = rund(s.prognose - s.budget);
  const prozent = s.budget > 0 ? Math.round((betrag / s.budget) * 1000) / 10 : null;
  const wesentlich = toleranzProzent !== null && s.budget > 0 && betrag > (s.budget * toleranzProzent) / 100;
  return { betrag, prozent, wesentlich };
}

const tag = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;
const datum = (t: number) => new Date(t * 86_400_000).toISOString().slice(0, 10);
const termin = (m: Termin) => m.terminAktuell ?? m.terminBaseline;

/**
 * Zeitraum je Phase aus den Meilensteinen (Annahme zu A-17): Ende = spätester Termin der Phase; Beginn = Tag nach dem
 * Ende der letzten früheren Phase mit Terminen, sonst der früheste Termin der Phase. Ohne Termin keine Angabe.
 */
export function phasenZeitraeume(ms: readonly Termin[]): Map<string, { von: string; bis: string }> {
  const out = new Map<string, { von: string; bis: string }>();
  let vorher: number | null = null;
  for (const phase of PHASEN) {
    const t = ms.filter(m => m.phase === phase).map(termin).filter((d): d is string => d !== null).map(tag);
    if (!t.length) continue;
    const bis = Math.max(...t);
    const von = vorher !== null && vorher < bis ? vorher + 1 : Math.min(...t);
    out.set(phase, { von: datum(von), bis: datum(bis) });
    vorher = bis;
  }
  return out;
}

/** Anteil eines Zeitraums (beide Tage eingeschlossen) im Jahr. */
export function anteilImJahr(z: { von: string; bis: string }, jahr: number): number {
  const von = tag(z.von), bis = tag(z.bis);
  const a = Math.max(von, tag(`${jahr}-01-01`)), b = Math.min(bis, tag(`${jahr}-12-31`));
  return b < a ? 0 : (b - a + 1) / (bis - von + 1);
}

export interface Bedarf { capex: number; opex: number }

/**
 * Jahresbedarf eines Projekts (UC-010 Schritt 5, A-17): Prognose je Phase und Art zeitanteilig auf das Jahr nach den
 * Phasenterminen. Phasen ohne Termin zählen nicht und werden genannt (`ohneTermine`).
 */
export function jahresbedarf(ps: readonly Position[], ms: readonly Termin[], jahr: number): { bedarf: Bedarf; ohneTermine: string[] } {
  const z = phasenZeitraeume(ms);
  const bedarf: Bedarf = { capex: 0, opex: 0 };
  const ohne = new Set<string>();
  for (const p of ps) {
    const betrag = erwartet(p);
    if (!betrag) continue;
    const zr = z.get(p.phase);
    if (!zr) { ohne.add(p.phase); continue; }
    bedarf[p.art] += betrag * anteilImJahr(zr, jahr);
  }
  return { bedarf: { capex: rund(bedarf.capex), opex: rund(bedarf.opex) }, ohneTermine: PHASEN.filter(ph => ohne.has(ph)) };
}

/** Periode «JJJJ-MM» in Zürich zum Zeitpunkt. */
export const periode = (jetzt: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit' }).format(jetzt).slice(0, 7);

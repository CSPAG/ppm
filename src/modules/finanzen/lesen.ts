/**
 * Finanzen je Projekt zusammenstellen (UC-010 Schritte 2–3, 5): Budget und Prognose aus dem Register `kosten`
 * (`projektdaten`), Ist-Kosten aus dem ERP über den Kostenträger (A-16), gültige Toleranz «Kosten» (A-10: Baseline des
 * Projektvertrags, sonst Phasenmodell), Begründungen; Jahresbedarf (A-17).
 */
import type { Tx } from '@vollholz/platform';
import { projektdaten } from '../projektdaten/index.ts';
import { vertrag } from '../vertrag/index.ts';
import { abweichung, ARTEN, jahresbedarf, jePhase, summen, type Art, type Position, type Termin } from './rechnen.ts';
import * as store from './store.ts';

export interface ProjektFinanzen {
  id: string; nummer: string; name: string; phase: string; portfolioId: string;
  kostentraeger: string | null;
  budget: number | null; prognose: number | null;
  /** Summe der Ist-Kosten; `null`, solange das ERP nichts geliefert hat («noch nicht verfügbar»). */
  ist: number | null;
  istBis: string | null;
  istJeArt: Record<Art, number | null>;
  abweichung: { betrag: number | null; prozent: number | null; wesentlich: boolean };
  toleranzProzent: number | null;
  phasen: { phase: string; art: Art; budget: number | null; prognose: number | null }[];
  verlauf: { monat: string; capex: number; opex: number }[];
  begruendung: { periode: string; text: string; version: number; geaendertAt: string } | null;
}

/**
 * Gültige Toleranz «Kosten» in Prozent je Projekt (A-10): Baseline des Projektvertrags, sonst Phasenmodell
 * (`vertrag.toleranzen`); ohne Wert oder in anderer Einheit keine. Liest in voller Sicht: die Projekte hat der Aufrufer
 * schon nach der Lesesicht gewählt, die Toleranz ist nicht vertraulich (auch die PL ohne `phasenmodell:read`).
 */
async function toleranzen(voll: Tx, ids: readonly string[]): Promise<Map<string, number | null>> {
  const t = await vertrag.toleranzen(voll, ids);
  return new Map(ids.map(id => {
    const k = t.get(id)?.find(x => x.dimension === 'kosten');
    return [id, k && k.einheit === 'prozent' ? k.wert : null];
  }));
}

export const positionen = async (tx: Tx, projektId: string): Promise<Position[]> =>
  (await projektdaten.lesen(tx, 'kosten', { projektId })).map(e => ({
    phase: e.phase as string, art: e.art as Art, budgetBaseline: (e.budgetBaseline as number | null) ?? null, prognose: (e.prognose as number | null) ?? null,
  }));

/** Finanzen der Projekte unter der Lesesicht von `tx`; `voll` (volle Sicht) liest die gültige Toleranz. */
export async function finanzen(tx: Tx, projekte: readonly store.ProjektRow[], voll: Tx = tx): Promise<ProjektFinanzen[]> {
  const ids = projekte.map(p => p.id);
  // nacheinander: eine Transaktion, eine Verbindung
  const kt = await store.kostentraeger(tx, ids);
  const ist = await store.ist(tx, ids);
  const begr = await store.begruendungen(tx, ids);
  const tol = await toleranzen(voll, ids);
  const out: ProjektFinanzen[] = [];
  for (const p of projekte) {
    const ps = await positionen(tx, p.id);
    const s = summen(ps);
    const eigene = ist.filter(i => i.projekt_id === p.id);
    const monate = [...new Set(eigene.map(i => i.monat))].sort();
    const jeArt = (a: Art) => (eigene.some(i => i.art === a) ? Math.round(eigene.filter(i => i.art === a).reduce((x, i) => x + i.betrag, 0) * 100) / 100 : null);
    const b = begr.find(x => x.projekt_id === p.id);
    const t = tol.get(p.id) ?? null;
    out.push({
      id: p.id, nummer: p.nummer, name: p.name, phase: p.phase, portfolioId: p.portfolio_id,
      kostentraeger: kt.get(p.id)?.nummer ?? null,
      budget: s.budget, prognose: s.prognose,
      ist: eigene.length ? Math.round(eigene.reduce((x, i) => x + i.betrag, 0) * 100) / 100 : null,
      istBis: monate.at(-1) ?? null,
      istJeArt: Object.fromEntries(ARTEN.map(a => [a, jeArt(a)])) as Record<Art, number | null>,
      abweichung: abweichung(s, t), toleranzProzent: t,
      phasen: jePhase(ps),
      verlauf: monate.map(monat => ({
        monat,
        capex: eigene.filter(i => i.monat === monat && i.art === 'capex').reduce((x, i) => x + i.betrag, 0),
        opex: eigene.filter(i => i.monat === monat && i.art === 'opex').reduce((x, i) => x + i.betrag, 0),
      })),
      begruendung: b ? { periode: b.periode, text: b.text, version: b.version, geaendertAt: b.updated_at.toISOString() } : null,
    });
  }
  return out;
}

export interface BedarfZeile { projektId: string; nummer: string; name: string; portfolioId: string; capex: number; opex: number; ohneTermine: string[] }

/** Berechneter Jahresbedarf der aktiven Projekte (A-17), vor den Korrekturen von FI. */
export async function bedarf(tx: Tx, jahr: number): Promise<BedarfZeile[]> {
  const out: BedarfZeile[] = [];
  for (const p of await store.projekte(tx)) {
    const ps = await positionen(tx, p.id);
    const ms: Termin[] = (await projektdaten.lesen(tx, 'meilenstein', { projektId: p.id })).map(m => ({
      phase: m.phase as string, terminBaseline: (m.terminBaseline as string | null) ?? null, terminAktuell: (m.terminAktuell as string | null) ?? null,
    }));
    const j = jahresbedarf(ps, ms, jahr);
    out.push({ projektId: p.id, nummer: p.nummer, name: p.name, portfolioId: p.portfolio_id, ...j.bedarf, ohneTermine: j.ohneTermine });
  }
  return out;
}

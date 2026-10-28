/**
 * Meilensteinabnahme (BC PS.02.03; UC-006 Schritt 7; fachmodell.md 2.6, 2.9; AP-E2-4): Meldet die Projektleitung im
 * Statusbericht einen erreichten Meilenstein mit Abnahme durch das Gremium (UC-004 Schritt 2, Register `meilenstein`,
 * `abnahme = 'gremium'`), schlägt das Einreichen ihn dem entscheidenden Gremium als Traktandum der Art `meilenstein` vor.
 * «Abgenommen» trägt das Datum der Abnahme über `projektdaten` ins Register, sofort in der Transaktion des Entscheids.
 */
import { systemActor, type Actor, type Tx } from '@vollholz/platform';
import { projektdaten } from '../projektdaten/index.ts';
import { registriereTraktandenart, traktandum, type EntscheidFolge, type FolgeKontext } from '../sitzung/index.ts';
import * as store from './store.ts';

/** Gremium nimmt ab oder nicht (K3 Schritt 8, Art «Meilensteinabnahme»). */
export const ERGEBNISSE = [{ schluessel: 'abgenommen', label: 'Abgenommen' }, { schluessel: 'nicht_abgenommen', label: 'Nicht abgenommen' }] as const;

interface Meilenstein { id: string; projektId: string | null; text: string; art: string; abnahme: string; erreichtAm: string | null; abgenommenAm: string | null }

const datumCh = (d: string) => { const [j, m, t] = d.split('-'); return `${Number(t)}.${Number(m)}.${j}`; };

/** Meilenstein aus dem Register (unter der Lesesicht der Person). */
async function meilenstein(tx: Tx, projektId: string, id: string): Promise<Meilenstein | null> {
  return ((await projektdaten.lesen(tx, 'meilenstein', { projektId })) as unknown as Meilenstein[]).find(m => m.id === id) ?? null;
}

const titelVon = (p: { nummer: string }, m: Meilenstein) => `Meilensteinabnahme ${p.nummer}: ${m.text}`;
const antragVon = (m: Meilenstein) => `Abnahme des Meilensteins «${m.text}»${m.erreichtAm ? `, erreicht am ${datumCh(m.erreichtAm)}` : ''}`;

/**
 * Einreichen: erreichte, noch nicht abgenommene Meilensteine mit Abnahme durch das Gremium vorschlagen (idempotent je
 * Meilenstein). Ohne entscheidendes Gremium kein Vorschlag; das Einreichen scheitert daran nicht.
 */
export async function beimEinreichen(tx: Tx, r: store.Row, _who: Actor): Promise<void> {
  const p = await store.projekt(tx, r.projekt_id);
  if (!p) return;
  const offen = ((await projektdaten.lesen(tx, 'meilenstein', { projektId: p.id })) as unknown as Meilenstein[])
    .filter(m => m.abnahme === 'gremium' && m.erreichtAm && !m.abgenommenAm);
  for (const m of offen) {
    try {
      await traktandum.vorschlagen(tx, { art: 'meilenstein', bezug: { typ: 'meilenstein', id: m.id }, projektId: p.id, titel: titelVon(p, m), antrag: antragVon(m) });
    } catch (err) {
      if ((err as { status?: number }).status !== 409) throw err;
      return;
    }
  }
}

/**
 * Folge des Entscheids (fachmodell.md 2.9): «Abgenommen» setzt das Datum der Abnahme im Register (heute in der
 * Schweiz). Die Abnahme zurückzunehmen bietet `projektdaten` nicht an; eine Korrektur auf «Nicht abgenommen» bleibt
 * darum im Entscheid sichtbar, das Datum im Register bleibt (Folgearbeit).
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge, k?: FolgeKontext): Promise<void> {
  if (f.ergebnis !== 'abgenommen' || f.bezug.typ !== 'meilenstein' || !f.bezug.projektId) return;
  const m = await meilenstein(tx, f.bezug.projektId, f.bezug.id);
  if (!m || m.abgenommenAm) return;
  const heute = (await tx.query<{ d: string }>("SELECT to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYY-MM-DD') AS d")).rows[0]!.d;
  // Abnahme durch das Gremium (PS.02.03): im Audit des Meilensteins die Person, die den Entscheid erfasst (UE)
  await projektdaten.meilensteinAbnehmen(tx, k?.akteur ?? systemActor('system'), m.id, heute);
}

/** Art `meilenstein` in der Registry der Sitzung (fachmodell.md 2.9; `projektdaten` liegt unter `sitzung`). */
export function registriereAbnahme(): void {
  registriereTraktandenart({
    art: 'meilenstein',
    label: 'Meilensteinabnahme',
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => {
      if (bezug.typ !== 'meilenstein' || !bezug.projektId) return null;
      const [p, m] = [await store.projekt(tx, bezug.projektId), await meilenstein(tx, bezug.projektId, bezug.id)];
      return p && m ? { titel: titelVon(p, m), antrag: antragVon(m) } : null;
    },
    beiEntscheid,
  });
}

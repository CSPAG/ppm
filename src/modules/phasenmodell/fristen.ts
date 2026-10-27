/**
 * Fristen für andere Module (docs/fachmodell.md 2.14): Wert aus der Version in Kraft, Datum über die Arbeitstage mit den
 * Feiertagen der Organisation (A-43). Fristen stehen nie als Konstante im Code der Module (A-26, A-27, Q8 Kap. 8.1, 8.4).
 *
 * Bezug je Schlüssel: `gate_vorbereiten`, `sitzung_vorbereiten`, `versand` liegen vor dem Sitzungsdatum, `protokoll`
 * danach; `bericht_aufgabe` und `bericht_stichtag` sind Tage im Monat der Periode (Monatsende, wenn der Monat kürzer ist).
 */
import type { Tx } from '@vollholz/platform';
import { addiereArbeitstage, arbeitstageZwischen, ausTagesZahl, plusTage, tagesZahl, type Datum } from './arbeitstage.ts';
import { feiertage } from './feiertage.ts';
import type { Dokument, FristSchluessel } from './schemas.ts';
import * as store from './store.ts';

export type Frist = Dokument['fristen'][number];

const VORHER: ReadonlySet<FristSchluessel> = new Set(['gate_vorbereiten', 'sitzung_vorbereiten', 'versand']);

/** Frist aus der Version in Kraft (oder der genannten Version, z. B. `projekt.phasenmodell_id`, A-13). */
export async function frist(tx: Tx, schluessel: FristSchluessel, o: { phasenmodellId?: string } = {}): Promise<Frist | null> {
  const id = o.phasenmodellId ?? (await store.byStand(tx, 'in_kraft'))?.id;
  if (!id) return null;
  return store.frist(tx, id, schluessel);
}

/** n Arbeitstage nach `d` (n < 0: davor) mit den Feiertagen der Organisation. */
export async function plusArbeitstage(tx: Tx, d: Datum, n: number): Promise<Datum> {
  // Feiertage einer grosszügigen Spanne laden; liegt das Ergebnis ausserhalb, mit doppelter Spanne wiederholen
  for (let weite = Math.abs(n) * 2 + 30; ; weite *= 2) {
    const von = n >= 0 ? d : plusTage(d, -weite), bis = n >= 0 ? plusTage(d, weite) : d;
    const r = addiereArbeitstage(d, n, await feiertage(tx, von, bis));
    if (r >= von && r <= bis) return r;
  }
}

/** Arbeitstage von `von` (ausschliesslich) bis `bis` (einschliesslich), z. B. «Versand in 4 Arbeitstagen». */
export async function arbeitstageBis(tx: Tx, von: Datum, bis: Datum): Promise<number> {
  const [a, b] = von <= bis ? [von, bis] : [bis, von];
  return arbeitstageZwischen(von, bis, await feiertage(tx, a, b));
}

/** Datum einer Frist zum Bezugsdatum (Sitzung bzw. ein Tag der Periode); null ohne Phasenmodell in Kraft. */
export async function fristDatum(tx: Tx, schluessel: FristSchluessel, bezug: Datum, o: { phasenmodellId?: string } = {}): Promise<{ datum: Datum; frist: Frist } | null> {
  const f = await frist(tx, schluessel, o);
  if (!f) return null;
  return { datum: await datumZu(tx, f, bezug), frist: f };
}

async function datumZu(tx: Tx, f: Frist, bezug: Datum): Promise<Datum> {
  tagesZahl(bezug);
  if (f.einheit === 'tag_im_monat') {
    const [j, m] = bezug.split('-').map(Number) as [number, number];
    const letzter = new Date(Date.UTC(j, m, 0)).getUTCDate();
    return ausTagesZahl(Date.UTC(j, m - 1, Math.min(f.wert, letzter)) / 86_400_000);
  }
  const n = VORHER.has(f.schluessel) ? -f.wert : f.wert;
  return f.einheit === 'arbeitstage' ? plusArbeitstage(tx, bezug, n) : plusTage(bezug, n);
}

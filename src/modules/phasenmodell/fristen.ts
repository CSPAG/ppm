/**
 * Fristen für andere Module (docs/fachmodell.md 2.14): Wert aus der Version in Kraft, Datum über die Arbeitstage mit den
 * Feiertagen der Organisation aus `stammdaten` (A-43). Fristen stehen nie als Konstante im Code der Module (A-26, A-27,
 * Q8 Kap. 8.1, 8.4).
 *
 * Bezug je Schlüssel: `gate_vorbereiten`, `sitzung_vorbereiten`, `versand` liegen vor dem Sitzungsdatum, `protokoll`
 * danach; `bericht_aufgabe` und `bericht_stichtag` sind Tage im Monat der Periode (Monatsende, wenn der Monat kürzer ist).
 */
import type { Tx } from '@vollholz/platform';
import { plusArbeitstageDb } from '../stammdaten/index.ts';
import type { Dokument, FristSchluessel } from './schemas.ts';
import * as store from './store.ts';

export type Frist = Dokument['fristen'][number];
/** Kalenderdatum `YYYY-MM-DD` (ohne Zeitzone). */
export type Datum = string;

const VORHER: ReadonlySet<FristSchluessel> = new Set(['gate_vorbereiten', 'sitzung_vorbereiten', 'versand']);
const TAG = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Prüft ein Kalenderdatum; liefert [Jahr, Monat] oder wirft. */
function teile(d: Datum): [number, number] {
  const m = ISO.exec(d);
  if (!m || new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) !== d) throw new RangeError(`Kein Datum: ${d}`);
  return [+m[1]!, +m[2]!];
}

/** Frist aus der Version in Kraft (oder der genannten Version, z. B. `projekt.phasenmodell_id`, A-13). */
export async function frist(tx: Tx, schluessel: FristSchluessel, o: { phasenmodellId?: string } = {}): Promise<Frist | null> {
  const id = o.phasenmodellId ?? (await store.byStand(tx, 'in_kraft'))?.id;
  if (!id) return null;
  return store.frist(tx, id, schluessel);
}

/** Datum einer Frist zum Bezugsdatum (Sitzung bzw. ein Tag der Periode); null ohne Phasenmodell in Kraft. */
export async function fristDatum(tx: Tx, schluessel: FristSchluessel, bezug: Datum, o: { phasenmodellId?: string } = {}): Promise<{ datum: Datum; frist: Frist } | null> {
  const [j, m] = teile(bezug);
  const f = await frist(tx, schluessel, o);
  if (!f) return null;
  if (f.einheit === 'tag_im_monat') {
    const letzter = new Date(Date.UTC(j, m, 0)).getUTCDate();
    return { datum: new Date(Date.UTC(j, m - 1, Math.min(f.wert, letzter))).toISOString().slice(0, 10), frist: f };
  }
  const n = VORHER.has(f.schluessel) ? -f.wert : f.wert;
  const datum = f.einheit === 'arbeitstage'
    ? await plusArbeitstageDb(tx, bezug, n)
    : new Date(Date.parse(`${bezug}T00:00:00Z`) + n * TAG).toISOString().slice(0, 10);
  return { datum, frist: f };
}

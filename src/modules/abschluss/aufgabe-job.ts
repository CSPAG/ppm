/**
 * Aufgabe «Abschlussbericht erstellen» für Projekte in P4 (fachmodell.md 4.1, 4.2 `abschluss.erstellen`; UC-015
 * Ausgangslage): Der Gate-Entscheid P3–P4 öffnet sie sofort (`folge.ts`); der Lauf deckt Projekte ab, die ohne Gate in
 * P4 stehen (Übernahme aus dem Excel-Dashboard, A-14). Idempotent je Projekt und Person; erledigt durch Einreichen.
 */
import type { PeriodicTask, Tx } from '@vollholz/platform';
import { fullTx } from '../../platform.ts';
import { erstellenOeffnen } from './folge.ts';
import * as store from './store.ts';

/** Aufgaben eines Mandanten prüfen (volle Sicht ohne Person); liefert die Zahl geöffneter bzw. nachgeführter Aufgaben. */
export async function abschlussPruefen(tx: Tx): Promise<number> {
  let n = 0;
  for (const p of await store.inP4OhneBericht(tx)) {
    const kopf = await store.projekt(tx, p.id);
    if (kopf) n += await erstellenOeffnen(tx, kopf, 'abschluss');
  }
  return n;
}

/** Stündlich über alle aktiven Mandanten (idempotent). */
export const abschlussTask: PeriodicTask = {
  name: 'abschluss.erstellen',
  intervalMs: () => 60 * 60_000,
  async run({ db, log }) {
    const ids = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows.map(r => r.id);
    for (const tenantId of ids) {
      try {
        const n = await fullTx(db, tenantId, tx => abschlussPruefen(tx));
        if (n) log.info({ tenant: tenantId, aufgaben: n }, 'Abschluss: Aufgaben geprüft');
      } catch (e) {
        log.warn({ tenant: tenantId, err: (e as Error).message }, 'Abschluss: Aufgaben nicht geprüft');
      }
    }
  },
};

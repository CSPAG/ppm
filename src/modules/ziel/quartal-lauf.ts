/**
 * Lauf nach Quartalsende (fachmodell.md 4.2; AP-E6-4): Nach dem Ende eines Quartals öffnet er die Aufgabe «Quartalsreporting
 * erstellen» an `quartalsbericht:write` (UC-012 Schritt 1), solange das Reporting des Quartals nicht traktandiert ist.
 * Idempotent: Die Aufgabe ist je Quartal höchstens einmal offen; das Traktandieren erledigt sie.
 */
import type { PeriodicTask, Tx } from '@vollholz/platform';
import { fullTx } from '../../platform.ts';
import { aufgabeOeffnen, letztesQuartal } from './quartal.ts';
import * as store from './quartal-store.ts';

/** Ein Mandant (volle Sicht ohne Person); liefert das Quartal, wenn die Aufgabe offen ist bzw. geöffnet wurde. */
export async function quartalPruefen(tx: Tx, jetzt?: string): Promise<string | null> {
  const quartal = letztesQuartal(jetzt ?? await store.heute(tx));
  const b = await store.bericht(tx, quartal);
  // Traktandiert oder verabschiedet ist das Reporting erstellt (das Traktandieren hat die Aufgabe erledigt)
  if (b && b.stand !== 'in_arbeit') return null;
  await aufgabeOeffnen(tx, quartal);
  return quartal;
}

/** Stündlich über alle aktiven Mandanten. */
export const quartalTask: PeriodicTask = {
  name: 'ziel.quartalsreporting',
  intervalMs: () => 60 * 60_000,
  async run({ db, log }) {
    const ids = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows.map(r => r.id);
    for (const tenantId of ids) {
      try {
        await fullTx(db, tenantId, tx => quartalPruefen(tx));
      } catch (e) {
        log.warn({ tenant: tenantId, err: (e as Error).message }, 'Quartalsreporting: Lauf nach Quartalsende nicht geprüft');
      }
    }
  },
};

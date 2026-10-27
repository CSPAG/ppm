/**
 * Sammelaufgaben der Ressourcenplanung (fachmodell.md 4.2, AP-E7-2): «Bedarf decken» und «Überbuchungen auflösen» an
 * alle mit `ressource:write`. Jede Zuteilung führt sie in ihrer Transaktion nach; diese feste Aufgabe des Workers holt
 * nach, was ohne Zuteilung entsteht (neu gemeldeter Bedarf, neuer Monat, geändertes Angebot).
 */
import type { PeriodicTask } from '@vollholz/platform';
import { fullTx } from '../../platform.ts';
import { aufgabenNachfuehren } from './zuteilung.ts';

/** Stündlich je aktiver Organisation, mit voller Sicht (idempotent). */
export const aufgabenTask: PeriodicTask = {
  name: 'ressource.zuteilungsaufgaben',
  intervalMs: () => 60 * 60_000,
  async run({ db, log }) {
    const orgs = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows;
    for (const o of orgs) {
      try {
        const n = await fullTx(db, o.id, tx => aufgabenNachfuehren(tx));
        log.info({ tenantId: o.id, ...n }, 'Zuteilungsaufgaben nachgeführt');
      } catch (e) {
        log.error({ tenantId: o.id, err: e }, 'Zuteilungsaufgaben: Fehler in der Organisation');
      }
    }
  },
};

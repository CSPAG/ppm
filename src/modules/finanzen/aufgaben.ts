/**
 * Aufgaben der Finanzen im Eingang (fachmodell.md 4.2): `abweichung.klaeren` an alle mit `finanzen:write`, solange die
 * Prognose eines aktiven, nicht vertraulichen Projekts das Budget wesentlich überschreitet (A-10, UC-010 A2) und für die laufende Periode
 * keine Begründung vorliegt; erledigt mit der Begründung (Schritt 4). `budget.uebergeben` mit dem Entwurf einer
 * Übergabe, erledigt mit der Übergabe (Schritt 6). Geprüft täglich je Organisation und nach jeder
 * Begründung.
 */
import type { Db, PeriodicTask, Tx } from '@vollholz/platform';
import { fullTx } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { finanzen } from './lesen.ts';
import { periode } from './rechnen.ts';
import * as store from './store.ts';

export const LINK = '/portfolio/finanzen';
const EMPF = { recht: 'finanzen:write' } as const;
const fmt = (n: number) => new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(n);

/** Aufgaben `abweichung.klaeren` der Projekte öffnen bzw. erledigen (in der Transaktion des Aufrufers). */
export async function abweichungenPruefen(tx: Tx, projekte: readonly store.ProjektRow[], jetzt = new Date()): Promise<number> {
  const p = periode(jetzt);
  let offen = 0;
  // Nicht aktive Projekte werden nicht mehr überwacht; vertrauliche sieht FI nicht (projekt:vertraulich fehlt), die
  // Aufgabe an alle mit finanzen:write zeigte Nummer, Name und Betrag (Annahme AP-E7-4: keine Aufgabe)
  for (const r of projekte.filter(x => x.lebenszyklus !== 'aktiv' || x.vertraulich)) await aufgabe.entfallen(tx, { art: 'abweichung.klaeren', bezug: { typ: 'projekt', id: r.id } });
  for (const f of await finanzen(tx, projekte.filter(x => x.lebenszyklus === 'aktiv' && !x.vertraulich))) {
    const bezug = { typ: 'projekt', id: f.id };
    if (f.abweichung.wesentlich && f.begruendung?.periode !== p) {
      offen++;
      await aufgabe.oeffnen(tx, {
        art: 'abweichung.klaeren', bezug, empfaenger: EMPF,
        titel: `Abweichung klären: Prognose ${fmt(f.abweichung.betrag ?? 0)} CHF über Budget`,
        kontext: `${f.nummer} ${f.name}`, link: `${LINK}/abweichungen?o=${encodeURIComponent(f.nummer)}`,
      });
    } else {
      await aufgabe.erledigen(tx, { art: 'abweichung.klaeren', bezug });
    }
  }
  return offen;
}

/** Aufgabe `budget.uebergeben` zum Jahr öffnen bzw. erledigen. */
export async function uebergabeAufgabe(tx: Tx, jahr: number, stand: 'entwurf' | 'uebergeben'): Promise<void> {
  const bezug = { typ: 'budgetuebergabe', id: String(jahr) };
  if (stand === 'uebergeben') await aufgabe.erledigen(tx, { art: 'budget.uebergeben', bezug });
  else await aufgabe.oeffnen(tx, { art: 'budget.uebergeben', bezug, empfaenger: EMPF, titel: `Jahresbedarf ${jahr} an den Budgetprozess übergeben`, link: `${LINK}/budgetprozess?jahr=${jahr}` });
}

export async function alleAbweichungenPruefen(db: Db, tenantId: string): Promise<number> {
  return fullTx(db, tenantId, async tx => abweichungenPruefen(tx, await store.projekte(tx, { alle: true })));
}

/** Täglich je aktiver Organisation (Prognosen ändern sich auch ohne Lauf des ERP). */
export const abweichungTask: PeriodicTask = {
  name: 'finanzen.abweichungen',
  intervalMs: () => 24 * 60 * 60_000,
  async run({ db, log }) {
    const orgs = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows;
    for (const org of orgs) {
      try {
        const n = await alleAbweichungenPruefen(db, org.id);
        if (n) log.info({ tenantId: org.id, offen: n }, 'Finanzen: Abweichungen zu klären');
      } catch (e) {
        log.error({ tenantId: org.id, err: e }, 'Finanzen: Fehler in der Organisation');
      }
    }
  },
};

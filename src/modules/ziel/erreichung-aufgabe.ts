/**
 * Aufgabe «Zielerreichung erfassen» (docs/fachmodell.md 4.2: `zielerreichung.erfassen`, Empfänger Recht
 * `zielerreichung:write`, Job nach Quartalsende, erledigt durch «erfasst»; BC ZM.03.01, UC-012 Schritte 1–2, K6 Schritt
 * 10). Eine Sammelaufgabe je Quartal für GL und UE (I-B3) mit dem Fortschritt im Kontext («5 von 12 Zielen
 * nachgeführt»); erledigt, sobald jedes Ziel des Quartals einen Stand hat. Keine Frist (Fachmodell 4.2: –; der Termin
 * des Quartalsreportings ist offen, 2.14). Ohne Ziele keine Aufgabe.
 */
import type { PeriodicTask, Tx } from '@vollholz/platform';
import { aufgabe } from '../eingang/index.ts';
import { fullTx } from '../../platform.ts';
import * as store from './erreichung-store.ts';

export const ART = 'zielerreichung.erfassen';

const bezug = (quartal: string) => ({ typ: 'quartal', id: quartal });

/** Zuletzt abgeschlossenes Quartal nach Schweizer Zeit («2026-Q3» am 27.10.2026, im Januar Q4 des Vorjahres). */
export async function abgeschlossenesQuartal(tx: Tx): Promise<string> {
  return (await tx.query<{ q: string }>(
    `SELECT to_char(d, 'YYYY') || '-Q' || to_char(d, 'Q') AS q
       FROM (SELECT (date_trunc('quarter', now() AT TIME ZONE 'Europe/Zurich') - interval '1 day') AS d) x`)).rows[0]!.q;
}

/** Stand des Quartals: Ziele (strategische und Jahresziele des Jahres) und davon nachgeführte. */
async function fortschritt(tx: Tx, quartal: string): Promise<{ gesamt: number; nachgefuehrt: number }> {
  const ziele = await store.ziele(tx, Number(quartal.slice(0, 4)));
  const erfasst = new Set((await store.eintraege(tx, quartal)).map(e => `${e.ziel_typ}:${e.ziel_id}`));
  return { gesamt: ziele.length, nachgefuehrt: ziele.filter(z => erfasst.has(`${z.typ}:${z.id}`)).length };
}

/**
 * Aufgabe des Quartals nachführen: alles nachgeführt → erledigt; sonst offen mit Fortschritt, aber nur für das zuletzt
 * abgeschlossene Quartal (ältere öffnet niemand neu, offene bleiben). Liefert, ob die Aufgabe offen ist.
 */
export async function nachfuehren(tx: Tx, quartal: string): Promise<boolean> {
  const f = await fortschritt(tx, quartal);
  if (f.gesamt > 0 && f.nachgefuehrt >= f.gesamt) {
    await aufgabe.erledigen(tx, { art: ART, bezug: bezug(quartal) });
    return false;
  }
  if (f.gesamt === 0 || quartal !== (await abgeschlossenesQuartal(tx))) return false;
  const [jahr, q] = quartal.split('-') as [string, string];
  await aufgabe.oeffnen(tx, {
    art: ART, bezug: bezug(quartal), empfaenger: { recht: 'zielerreichung:write' },
    titel: `Zielerreichung ${q} ${jahr} erfassen`,
    kontext: `${f.nachgefuehrt} von ${f.gesamt} Zielen nachgeführt`,
    link: `/ziele/${jahr}/zielerreichung?quartal=${q.toLowerCase()}`,
    frist: null,
  });
  return true;
}

/** Feste Aufgabe des Workers: stündlich je aktiver Organisation für das zuletzt abgeschlossene Quartal (idempotent). */
export const zielerreichungTask: PeriodicTask = {
  name: 'ziel.zielerreichung_aufgaben',
  intervalMs: () => 60 * 60_000,
  async run({ db, log }) {
    const orgs = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows;
    let offen = 0;
    for (const o of orgs) {
      try {
        if (await fullTx(db, o.id, async tx => nachfuehren(tx, await abgeschlossenesQuartal(tx)))) offen++;
      } catch (e) {
        log.error({ tenantId: o.id, err: e }, 'Zielerreichung: Fehler in der Organisation');
      }
    }
    log.info({ organisationen: orgs.length, offen }, 'Aufgaben Zielerreichung nachgeführt');
  },
};

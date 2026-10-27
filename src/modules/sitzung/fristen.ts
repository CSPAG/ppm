/**
 * Täglicher Lauf der Fristen (fachmodell.md 4.1, 4.2; A-27): Ab 15 Arbeitstagen vor einem Sitzungstermin (Frist
 * `sitzung_vorbereiten` im Phasenmodell) entsteht die Sitzung und die Aufgabe «Sitzung vorbereiten» an `sitzung:write`
 * am Portfolio, mit Frist Versand (5 Arbeitstage vorher, Q8 Kap. 8.1). Idempotent: Die Aufgabe ist je Sitzung höchstens
 * einmal offen; der Versand erledigt sie (UC-006 Schritt 1, 5).
 */
import { systemActor, type PeriodicTask, type Tx } from '@vollholz/platform';
import { fullTx, record } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { fristDatum } from '../phasenmodell/index.ts';
import { sitzungAnlegen, sitzungLink } from './aktionen.ts';
import { heute, kurzDatum } from './format.ts';
import * as store from './store.ts';

/** So weit voraus werden Termine betrachtet (Kalendertage); deckt 15 Arbeitstage mit Feiertagen reichlich ab. */
const HORIZONT_TAGE = 90;

const plusTage = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Fristen eines Mandanten prüfen (volle Sicht ohne Person); liefert die Zahl geöffneter bzw. nachgeführter Aufgaben. */
export async function fristenPruefen(tx: Tx, jetzt = heute()): Promise<number> {
  let n = 0;
  for (const { gremium, datum } of await store.termineAlle(tx, jetzt, plusTage(jetzt, HORIZONT_TAGE))) {
    const ab = await fristDatum(tx, 'sitzung_vorbereiten', datum);
    if (!ab || jetzt < ab.datum) continue;
    let s = await store.sitzungAm(tx, gremium.id, datum);
    if (!s) {
      s = await sitzungAnlegen(tx, gremium, datum);
      await record(tx, systemActor('worker'), { action: 'sitzung.created', resourceType: 'sitzung', resourceId: s.id, data: { gremiumId: gremium.id, datum }, event: { id: s.id, gremiumId: gremium.id, portfolioId: s.portfolio_id, datum } });
    }
    if (s.stand !== 'geplant' && s.stand !== 'in_vorbereitung') continue;
    const versand = (await fristDatum(tx, 'versand', datum))?.datum ?? datum;
    await aufgabe.oeffnen(tx, {
      art: 'sitzung.vorbereiten', bezug: { typ: 'sitzung', id: s.id },
      empfaenger: { recht: 'sitzung:write', ort: { typ: 'portfolio', id: s.portfolio_id } },
      titel: `${gremium.kuerzel.toUpperCase()}-Sitzung ${kurzDatum(datum)} vorbereiten`,
      kontext: `Versand bis ${kurzDatum(versand)}`,
      link: sitzungLink(gremium.kuerzel, datum),
      frist: { datum: versand, art: 'arbeitstage' },
    });
    n += 1;
  }
  return n;
}

/** Stündlich über alle aktiven Mandanten (idempotent; die Aufgabe entsteht am ersten Lauf des Tages). */
export const fristenTask: PeriodicTask = {
  name: 'sitzung.fristen',
  intervalMs: () => 60 * 60_000,
  async run({ db, log }) {
    // Der Worker sieht ohne Kontext keine Mandanten; app.platform_tenants() liefert sie (Baukasten)
    const ids = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows.map(r => r.id);
    for (const tenantId of ids) {
      try {
        const n = await fullTx(db, tenantId, tx => fristenPruefen(tx));
        if (n) log.info({ tenant: tenantId, aufgaben: n }, 'Sitzungen: Fristen geprüft');
      } catch (e) {
        log.warn({ tenant: tenantId, err: (e as Error).message }, 'Sitzungen: Fristen nicht geprüft');
      }
    }
  },
};

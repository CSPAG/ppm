/**
 * Beitrag zur Übernahme aus dem Excel-Dashboard (AP-E0-7; K16, A-14): je übernommenem Projekt mit Status ein Bericht der
 * Übernahmeperiode mit Status, Trend, Phase, «Abschluss per» und nächstem Meilenstein, als geprüft gespeichert (die UE
 * hat das Dashboard konsolidiert, Q8 Kap. 8.3). Er ist die Vorperiode des ersten Berichts im System: Vorbelegung,
 * «Status Vorperiode» und Monatsabschluss lesen ihn wie jeden anderen (UC-004 Schritt 1, UC-005).
 */
import { conflict } from '@vollholz/platform';
import { record, SCHEMA } from '../../platform.ts';
import { uebernahme, type UebernahmeTeil } from '../projekt/index.ts';
import * as store from './store.ts';

export const uebernahmeBericht: UebernahmeTeil = {
  name: 'statusbericht',
  rechte: ['statusbericht:write'],
  async uebernehmen(tx, who, { projektId, periode, zeile }) {
    // Ohne Status gibt es nichts zu berichten (z. B. Projekt noch ohne Meldung im Dashboard)
    if (!zeile.status) return;
    if ((await store.periodeSichern(tx, periode)) === 'abgeschlossen') {
      throw conflict(`Die Periode ${periode} ist abgeschlossen. Wählen Sie für die Übernahme eine offene Periode.`);
    }
    const r = await store.create(tx, projektId, periode, zeile.phase, {
      status: zeile.status, trend: zeile.trend, abschlussPer: zeile.abschlussPer, naechsterMeilenstein: zeile.meilenstein,
      begruendung: zeile.begruendung, massnahme: zeile.massnahme,
    });
    await tx.query(
      `UPDATE ${SCHEMA}.statusbericht SET stand = 'geprueft', eingereicht_at = now(), eingereicht_by = app.principal_id(),
              geprueft_at = now(), geprueft_by = app.principal_id() WHERE id = $1`, [r.id]);
    const daten = { projektId, periode, status: zeile.status, trend: zeile.trend, quelle: 'excel' };
    await record(tx, who, { action: 'statusbericht.imported', resourceType: 'statusbericht', resourceId: r.id, data: daten, event: { id: r.id, ...daten } });
  },
};

uebernahme.registriere(uebernahmeBericht);

/**
 * Beitrag zur Übernahme aus dem Excel-Dashboard (AP-E0-7; K16, A-14): der nächste Meilenstein einer Zeile mit Termin
 * als Eintrag im Meilensteinplan der aktuellen Phase (PS.02.04). Ohne Termin bleibt er nur Text im Bericht der
 * Vorperiode (Beitrag des Moduls statusbericht). Die Baseline setzt erst der Vertrag (AP-E3-1).
 */
import { record } from '../../platform.ts';
import { uebernahme, type UebernahmeTeil } from '../projekt/index.ts';
import * as store from './store.ts';

export const uebernahmeMeilenstein: UebernahmeTeil = {
  name: 'projektdaten',
  rechte: [],
  async uebernehmen(tx, who, { projektId, zeile }) {
    if (!zeile.meilensteinTermin || !zeile.meilenstein) return;
    const r = store.REGISTER.meilenstein;
    const werte = { phase: zeile.phase, art: 'meilenstein', text: zeile.meilenstein, terminAktuell: zeile.meilensteinTermin };
    const id = await store.create(tx, r, { projektId }, werte);
    await record(tx, who, { action: 'meilenstein.created', resourceType: 'meilenstein', resourceId: id, data: { quelle: 'excel', ...werte }, event: { id, projektId, quelle: 'excel' } });
  },
};

uebernahme.registriere(uebernahmeMeilenstein);

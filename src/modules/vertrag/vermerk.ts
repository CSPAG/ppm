/**
 * Vermerke des Projektvertrags (AP-E8-4; Master G1, A-74, UX-E12; UC-002 A7, UC-003 A7): Der Vertrag geht ohne
 * Quality-Check oder Unterschriften ans Gremium, die Phase beginnt ohne Gate-Entscheid. Die Vermerke werden aus Stand,
 * Quality-Check, Unterschriften und Phase abgeleitet und verschwinden, sobald sie nachgetragen sind.
 */
import type { Tx } from '@vollholz/platform';
import { durchgang, FUNKTIONEN, NACHTRAG, unterschriften } from './pruefung.ts';
import * as store from './store.ts';

export interface Vermerk { art: string; text: string }

const QC_OFFEN: Vermerk = { art: 'quality_check_offen', text: 'Quality-Check offen' };
const UNTERSCHRIFT_OFFEN: Vermerk = { art: 'unterschrift_offen', text: 'Unterschrift offen' };
const UNTERSCHRIFT_VERWEIGERT: Vermerk = { art: 'unterschrift_verweigert', text: 'Unterschrift verweigert' };
const OHNE_GATE: Vermerk = { art: 'ohne_gate_entscheid', text: 'ohne Gate-Entscheid' };

/** Vermerke einer Version, die dem Gremium vorliegt oder freigegeben ist (Erstvertrag und Gate; Änderungen ohne QC). */
export async function versionVermerke(tx: Tx, v: store.VersionRow): Promise<Vermerk[]> {
  if (!NACHTRAG.includes(v.stand) || v.anlass === 'aenderung') return [];
  const dg = await durchgang(tx, v.id);
  if (!dg) return [QC_OFFEN];
  const us = await unterschriften(tx, dg.id);
  if (us.some(u => u.ergebnis === 'verweigert')) return [UNTERSCHRIFT_VERWEIGERT];
  return FUNKTIONEN.every(f => us.some(u => u.funktion === f && u.ergebnis === 'unterzeichnet')) ? [] : [UNTERSCHRIFT_OFFEN];
}

/**
 * Vermerk am Projekt: die laufende Phase hat einen Vertrag (Erstvertrag oder Gate) mit dieser Zielphase, der noch nicht
 * freigegeben ist (UC-003 A7.2 «ohne Gate-Entscheid»). Projekte ohne Vertrag zur Phase (z. B. übernommen) tragen keinen.
 */
export async function phaseVermerke(tx: Tx, projekt: Pick<store.ProjektKopf, 'id' | 'phase'>): Promise<Vermerk[]> {
  const vs = (await store.versionen(tx, projekt.id)).filter(v => v.anlass !== 'aenderung' && v.zielphase === projekt.phase && v.stand !== 'verworfen');
  if (!vs.length || vs.some(v => v.stand === 'abgenommen')) return [];
  return [OHNE_GATE];
}

/**
 * Zuordnung Projekt ↔ Ziel für obere Module (PP.02.05; UC-002, Vertrag Kap. 2 bei der Baseline, AP-E3-1): schreibt
 * die Zuordnung in der Transaktion des Aufrufers, mit Audit und Ereignis. Rechte prüft der Aufrufer; die Lesesicht
 * lässt das Schreiben mit `ziel:write` oder `projekt:write` am Projekt zu (Muster KIND, Migration 301), damit PL und UE
 * den Vertrag ohne `ziel:write` abschliessen können.
 */
import { notFound, type Actor, type Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import * as store from './zyklus-store.ts';

export interface ZielAngabe { strategischesZielId: string; jahreszielId?: string | null }

/**
 * Projekt einem strategischen Ziel (und optional einem Jahresziel darunter) zuordnen. Idempotent: Besteht die
 * Zuordnung schon, bleibt sie (`neu: false`, ohne Audit). Unbekanntes oder unsichtbares Projekt, unbekanntes Ziel oder
 * ein Jahresziel unter einem anderen strategischen Ziel: 404.
 */
export async function projektZuordnen(tx: Tx, who: Actor, projektId: string, ziel: ZielAngabe): Promise<{ id: string; neu: boolean }> {
  if (!(await store.projektSichtbar(tx, projektId))) throw notFound('Projekt');
  const jahreszielId = ziel.jahreszielId ?? null;
  const vorhanden = await store.zuordnungSuchen(tx, projektId, ziel.strategischesZielId, jahreszielId);
  if (vorhanden) return { id: vorhanden, neu: false };
  let id: string;
  try {
    await tx.query('SAVEPOINT ziel_projekt_zuordnen');
    id = await store.zuordnen(tx, projektId, ziel.strategischesZielId, jahreszielId);
    await tx.query('RELEASE SAVEPOINT ziel_projekt_zuordnen');
  } catch (e) {
    // Fremdschlüssel: Ziel unbekannt (auch in anderen Organisationen) bzw. Jahresziel gehört nicht zum strategischen Ziel
    if ((e as { code?: string }).code !== '23503') throw e;
    await tx.query('ROLLBACK TO SAVEPOINT ziel_projekt_zuordnen');
    throw notFound(jahreszielId ? 'Jahresziel' : 'Strategisches Ziel');
  }
  const snap = { id, projektId, strategischesZielId: ziel.strategischesZielId, jahreszielId };
  await record(tx, who, { action: 'ziel_projekt.created', resourceType: 'ziel_projekt', resourceId: id, data: snap, event: snap });
  return { id, neu: true };
}

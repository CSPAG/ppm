/**
 * Datenzugriff der Freigabe (UC-011 Schritte 6–7, A2): Zusammenfassung je Handlungsfeld mit Vorjahr, Prüfung der
 * Metriken, Übergänge des Zieljahrs. Läuft in der Transaktion der Route; die Lesesicht (RLS) gilt.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import { ZJ_COLS, type Stand, type ZieljahrRow } from './zyklus-store.ts';

const JZ = `${SCHEMA}.jahresziel`;

export interface FeldRow { handlungsfeld_id: string; label: string | null; anzahl: number; anzahl_vorjahr: number }

/** Jahresziele je Handlungsfeld im Jahr und im Vorjahr (über das strategische Ziel). */
export async function jeHandlungsfeld(tx: Tx, jahr: number): Promise<FeldRow[]> {
  return (await tx.query<FeldRow>(
    `SELECT s.handlungsfeld_id, h.label,
            count(*) FILTER (WHERE j.jahr = $1)::int AS anzahl, count(*) FILTER (WHERE j.jahr = $1 - 1)::int AS anzahl_vorjahr
       FROM ${JZ} j JOIN ${SCHEMA}.strategisches_ziel s ON s.id = j.strategisches_ziel_id
       LEFT JOIN ${SCHEMA}.handlungsfeld h ON h.id = s.handlungsfeld_id
      WHERE j.jahr IN ($1, $1 - 1)
      GROUP BY s.handlungsfeld_id, h.label, h.position
      ORDER BY h.position NULLS LAST, h.label`, [jahr])).rows;
}

export interface ZielKurz { id: string; nummer: string }

/** Jahresziele ohne Metrik oder Zielwert (Sperre der Vorlage). */
export async function ohneMetrik(tx: Tx, jahr: number): Promise<ZielKurz[]> {
  return (await tx.query<ZielKurz>(
    `SELECT id, nummer FROM ${JZ} WHERE jahr = $1 AND (btrim(metrik) = '' OR btrim(zielwert) = '') ORDER BY nummer_sort, id`, [jahr])).rows;
}

/** Jahresziele ohne Hauptaktivität und ohne (sichtbares) Projekt (Hinweis). */
export async function ohneUmsetzung(tx: Tx, jahr: number): Promise<ZielKurz[]> {
  return (await tx.query<ZielKurz>(
    `SELECT j.id, j.nummer FROM ${JZ} j
      WHERE j.jahr = $1
        AND NOT EXISTS (SELECT 1 FROM ${SCHEMA}.hauptaktivitaet h WHERE h.jahresziel_id = j.id)
        AND NOT EXISTS (SELECT 1 FROM ${SCHEMA}.ziel_projekt z WHERE z.jahresziel_id = j.id)
      ORDER BY j.nummer_sort, j.id`, [jahr])).rows;
}

export async function anzahl(tx: Tx, jahr: number): Promise<number> {
  return (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${JZ} WHERE jahr = $1`, [jahr])).rows[0]!.n;
}

export async function vorjahrVorhanden(tx: Tx, jahr: number): Promise<boolean> {
  return (await tx.query(`SELECT 1 FROM ${SCHEMA}.zieljahr WHERE jahr = $1`, [jahr - 1])).rowCount === 1;
}

/** Übergang des Zieljahrs bei passender Version; null, wenn die Version abweicht. */
export async function setzen(tx: Tx, jahr: number, version: number, o: { stand: Stand; vorgelegt?: boolean; freigabeAt?: string | null; freigabeText?: string }): Promise<ZieljahrRow | null> {
  const sets = ['stand = $3'];
  const args: unknown[] = [jahr, version, o.stand];
  if (o.vorgelegt) sets.push('vorgelegt_at = now()');
  if (o.freigabeAt !== undefined) { args.push(o.freigabeAt); sets.push(`freigabe_at = $${args.length}::date`); }
  if (o.freigabeText !== undefined) { args.push(o.freigabeText); sets.push(`freigabe_text = $${args.length}`); }
  return (await tx.query<ZieljahrRow>(
    `UPDATE ${SCHEMA}.zieljahr SET ${sets.join(', ')} WHERE jahr = $1 AND version = $2 RETURNING ${ZJ_COLS}`, args)).rows[0] ?? null;
}

/**
 * Datenzugriff der Zielerreichung je Quartal (BC ZM.03.01; UC-012 Schritte 1–2). Läuft immer in einer Transaktion mit
 * Mandantenkontext; die Lesesicht (RLS) filtert. Ziele liest das Modul aus den Tabellen des Zielzyklus (080, 300).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { ZielerreichungCreateIn, ZielerreichungPatchIn, ZielTypOut } from './erreichung-schemas.ts';

const ZE = `${SCHEMA}.zielerreichung`;

export interface EintragRow {
  id: string; ziel_typ: ZielTypOut; ziel_id: string; quartal: string; stand: string; beurteilung: string;
  erfasst_at: Date; erfasst_by: string | null; erfasst_name: string | null; version: number;
}
const E_SELECT = `SELECT e.id, e.ziel_typ, e.ziel_id, e.quartal, e.stand, e.beurteilung, e.erfasst_at, e.erfasst_by,
       p.display_name AS erfasst_name, e.version
  FROM ${ZE} e LEFT JOIN ${SCHEMA}.principal p ON p.id = e.erfasst_by`;

/** Stände des Quartals. */
export async function eintraege(tx: Tx, quartal: string): Promise<EintragRow[]> {
  return (await tx.query<EintragRow>(`${E_SELECT} WHERE e.quartal = $1`, [quartal])).rows;
}

/** Je Ziel der letzte Stand vor dem Quartal («letzter Stand», K6 Schritt 10). */
export async function letzteEintraege(tx: Tx, quartal: string): Promise<EintragRow[]> {
  return (await tx.query<EintragRow>(
    `SELECT DISTINCT ON (x.ziel_typ, x.ziel_id) x.* FROM (${E_SELECT} WHERE e.quartal < $1) x
      ORDER BY x.ziel_typ, x.ziel_id, x.quartal DESC`, [quartal])).rows;
}

export async function getEintrag(tx: Tx, quartal: string, id: string): Promise<EintragRow | null> {
  return (await tx.query<EintragRow>(`${E_SELECT} WHERE e.quartal = $1 AND e.id = $2`, [quartal, id])).rows[0] ?? null;
}

export async function findEintrag(tx: Tx, quartal: string, zielTyp: ZielTypOut, zielId: string): Promise<EintragRow | null> {
  return (await tx.query<EintragRow>(`${E_SELECT} WHERE e.quartal = $1 AND e.ziel_typ = $2 AND e.ziel_id = $3`, [quartal, zielTyp, zielId])).rows[0] ?? null;
}

export async function createEintrag(tx: Tx, quartal: string, input: ZielerreichungCreateIn): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${ZE} (tenant_id, ziel_typ, ziel_id, quartal, stand, beurteilung)
     VALUES (app.tenant_id(), $1, $2, $3, btrim($4), btrim($5)) RETURNING id`,
    [input.zielTyp, input.zielId, quartal, input.stand, input.beurteilung ?? ''])).rows[0]!.id;
}

export async function updateEintrag(tx: Tx, id: string, version: number, patch: ZielerreichungPatchIn): Promise<boolean> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  if (patch.stand !== undefined) { args.push(patch.stand); sets.push(`stand = btrim($${args.length})`); }
  if (patch.beurteilung !== undefined) { args.push(patch.beurteilung); sets.push(`beurteilung = btrim($${args.length})`); }
  return ((await tx.query(`UPDATE ${ZE} SET ${sets.join(', ')} WHERE id = $1 AND version = $2`, args)).rowCount ?? 0) > 0;
}

export async function removeEintrag(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${ZE} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Ziele

export interface ZielRow {
  typ: ZielTypOut; id: string; strategisches_ziel_id: string; nummer: string; text: string; metrik: string; zielwert: string; jahr: number | null;
}

/**
 * Ziele der Tabelle: alle sichtbaren strategischen Ziele, je gefolgt von seinen Jahreszielen des Jahres (nach Nummer).
 */
export async function ziele(tx: Tx, jahr: number): Promise<ZielRow[]> {
  return (await tx.query<ZielRow>(
    `SELECT typ, id, strategisches_ziel_id, nummer, text, metrik, zielwert, jahr FROM (
       SELECT 'strategisch' AS typ, s.id, s.id AS strategisches_ziel_id, s.nummer, s.text, s.metrik, s.zielwert, NULL::int AS jahr,
              s.nummer_sort AS s_sort, 0 AS ebene, '{}'::int[] AS j_sort
         FROM ${SCHEMA}.strategisches_ziel s
       UNION ALL
       SELECT 'jahresziel', j.id, j.strategisches_ziel_id, j.nummer, j.text, j.metrik, j.zielwert, j.jahr, s.nummer_sort, 1, j.nummer_sort
         FROM ${SCHEMA}.jahresziel j JOIN ${SCHEMA}.strategisches_ziel s ON s.id = j.strategisches_ziel_id
        WHERE j.jahr = $1) z
      ORDER BY s_sort, strategisches_ziel_id, ebene, j_sort, id`, [jahr])).rows;
}

/** Ein Ziel (für die Prüfung beim Erfassen); null, wenn es nicht sichtbar ist. */
export async function ziel(tx: Tx, typ: ZielTypOut, id: string): Promise<{ jahr: number | null } | null> {
  const sql = typ === 'strategisch'
    ? `SELECT NULL::int AS jahr FROM ${SCHEMA}.strategisches_ziel WHERE id = $1`
    : `SELECT jahr FROM ${SCHEMA}.jahresziel WHERE id = $1`;
  return (await tx.query<{ jahr: number | null }>(sql, [id])).rows[0] ?? null;
}

/**
 * Datenzugriff der strategischen Ziele. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht
 * sehen darf, filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte. Das Handlungsfeld prüft der
 * Fremdschlüssel (nur im eigenen Mandanten), ohne die Tabelle des Moduls `handlungsfeld` zu lesen.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { StrategischesZielCreateIn, StrategischesZielPatchIn } from './schemas.ts';

export interface Row {
  id: string; handlungsfeld_id: string; nummer: string; nummer_sort: number[]; text: string; horizont: number; metrik: string; zielwert: string;
  version: number; created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null;
}

const T = `${SCHEMA}.strategisches_ziel`;
const COLS = 'id, handlungsfeld_id, nummer, nummer_sort, text, horizont, metrik, zielwert, version, created_at, created_by, updated_at, updated_by';

/** Sortierung nach den Zahlen der Nummer («2.10» nach «2.9»), dann ID. */
export interface After { sort: number[]; id: string }

export async function list(tx: Tx, o: { handlungsfeld?: string; q?: string; after?: After | null; limit: number }): Promise<Row[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (o.handlungsfeld) { args.push(o.handlungsfeld); where.push(`handlungsfeld_id = $${args.length}::uuid`); }
  if (o.q) { args.push(`%${o.q.replace(/[\\%_]/g, m => `\\${m}`)}%`); where.push(`(nummer ILIKE $${args.length} OR text ILIKE $${args.length})`); }
  if (o.after) { args.push(o.after.sort, o.after.id); where.push(`(nummer_sort, id) > ($${args.length - 1}::int[], $${args.length}::uuid)`); }
  args.push(o.limit + 1);
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY nummer_sort, id LIMIT $${args.length}`, args)).rows;
}

export async function get(tx: Tx, id: string): Promise<Row | null> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function create(tx: Tx, input: StrategischesZielCreateIn): Promise<Row> {
  return (await tx.query<Row>(
    `INSERT INTO ${T} (tenant_id, handlungsfeld_id, nummer, text, horizont, metrik, zielwert)
     VALUES (app.tenant_id(), $1, $2, btrim($3), $4, $5, $6) RETURNING ${COLS}`,
    [input.handlungsfeldId, input.nummer, input.text, input.horizont ?? 2030, (input.metrik ?? '').trim(), (input.zielwert ?? '').trim()])).rows[0]!;
}

const COLUMN = { handlungsfeldId: 'handlungsfeld_id', nummer: 'nummer', text: 'text', horizont: 'horizont', metrik: 'metrik', zielwert: 'zielwert' } as const;

/** Ändert nur bei passender Version; null, wenn nicht (mehr) vorhanden oder Version abweicht. */
export async function update(tx: Tx, id: string, version: number, patch: StrategischesZielPatchIn): Promise<Row | null> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  for (const k of Object.keys(COLUMN) as (keyof typeof COLUMN)[]) {
    const v = patch[k];
    if (v === undefined) continue;
    args.push(typeof v === 'string' ? v.trim() : v);
    sets.push(`${COLUMN[k]} = $${args.length}`);
  }
  return (await tx.query<Row>(`UPDATE ${T} SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING ${COLS}`, args)).rows[0] ?? null;
}

export async function remove(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${T} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

export interface VersionRow {
  version: number; action: 'created' | 'updated' | 'deleted'; handlungsfeld_id: string; nummer: string; text: string; horizont: number; metrik: string; zielwert: string;
  changed_at: Date; changed_by: string | null;
}

export async function history(tx: Tx, id: string): Promise<VersionRow[]> {
  return (await tx.query<VersionRow>(
    `SELECT version, action, handlungsfeld_id, nummer, text, horizont, metrik, zielwert, changed_at, changed_by
       FROM ${SCHEMA}.strategisches_ziel_version WHERE strategisches_ziel_id = $1 ORDER BY version DESC`, [id])).rows;
}

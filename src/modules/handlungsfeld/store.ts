/**
 * Datenzugriff der Handlungsfelder. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen
 * darf, filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { HandlungsfeldCreateIn, HandlungsfeldPatchIn } from './schemas.ts';

export interface Row {
  id: string; label: string; leitsatz: string; stossrichtungen: string[]; position: number; version: number;
  created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null;
}

const T = `${SCHEMA}.handlungsfeld`;
const COLS = 'id, label, leitsatz, stossrichtungen, position, version, created_at, created_by, updated_at, updated_by';

/** Stossrichtungen ohne Leerraum am Rand. */
const clean = (s: string[] | undefined) => (s ?? []).map(x => x.trim());

export async function list(tx: Tx, o: { q?: string; after?: { position: number; label: string; id: string } | null; limit: number }): Promise<Row[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (o.q) { args.push(`%${o.q.replace(/[\\%_]/g, m => `\\${m}`)}%`); where.push(`label ILIKE $${args.length}`); }
  if (o.after) { args.push(o.after.position, o.after.label, o.after.id); where.push(`(position, label, id) > ($${args.length - 2}, $${args.length - 1}, $${args.length}::uuid)`); }
  args.push(o.limit + 1);
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY position, label, id LIMIT $${args.length}`, args)).rows;
}

export async function get(tx: Tx, id: string): Promise<Row | null> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function create(tx: Tx, input: HandlungsfeldCreateIn): Promise<Row> {
  return (await tx.query<Row>(
    `INSERT INTO ${T} (tenant_id, label, leitsatz, stossrichtungen, position) VALUES (app.tenant_id(), btrim($1), $2, $3, $4) RETURNING ${COLS}`,
    [input.label, (input.leitsatz ?? '').trim(), clean(input.stossrichtungen), input.position ?? 0])).rows[0]!;
}

/** Ändert nur bei passender Version; null, wenn nicht (mehr) vorhanden oder Version abweicht. */
export async function update(tx: Tx, id: string, version: number, patch: HandlungsfeldPatchIn): Promise<Row | null> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  for (const k of ['label', 'leitsatz', 'stossrichtungen', 'position'] as const) {
    const v = patch[k];
    if (v === undefined) continue;
    args.push(Array.isArray(v) ? clean(v) : typeof v === 'string' ? v.trim() : v);
    sets.push(`${k} = $${args.length}`);
  }
  return (await tx.query<Row>(`UPDATE ${T} SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING ${COLS}`, args)).rows[0] ?? null;
}

export async function remove(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${T} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

export interface VersionRow {
  version: number; action: 'created' | 'updated' | 'deleted'; label: string; leitsatz: string; stossrichtungen: string[]; position: number;
  changed_at: Date; changed_by: string | null;
}

export async function history(tx: Tx, id: string): Promise<VersionRow[]> {
  return (await tx.query<VersionRow>(
    `SELECT version, action, label, leitsatz, stossrichtungen, position, changed_at, changed_by
       FROM ${SCHEMA}.handlungsfeld_version WHERE handlungsfeld_id = $1 ORDER BY version DESC`, [id])).rows;
}

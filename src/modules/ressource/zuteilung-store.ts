/**
 * Datenzugriff der Zuteilung (AP-E7-2): Zuteilungen je Bedarf, Person und Monat, Lücken (ungedeckter Bedarf) und die
 * Summen für Konflikte. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen darf, filtert
 * die Lesesicht (RLS). Personen und Projektleitung kommen aus Tabellen des Baukastens bzw. der Kerntabelle des Projekts
 * (nur lesend, wie `store.projekte`).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

export interface ZuteilungRow {
  id: string; ressourcenbedarf_id: string; projekt_id: string; person_id: string; person_name: string | null; monat: string; fte: number;
  version: number; updated_at: Date;
}

const Z = `${SCHEMA}.zuteilung`;
const SPALTEN = `z.id, z.ressourcenbedarf_id, z.projekt_id, z.person_id, p.display_name AS person_name, z.monat, z.fte::float8 AS fte, z.version, z.updated_at`;
const VON = `FROM ${Z} z LEFT JOIN ${SCHEMA}.principal p ON p.tenant_id = z.tenant_id AND p.id = z.person_id`;

export interface ZuteilungFilter { bedarfIds?: readonly string[]; personId?: string; projektId?: string; von?: string; bis?: string }

export async function list(tx: Tx, f: ZuteilungFilter): Promise<ZuteilungRow[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };
  if (f.bedarfIds) where.push(`z.ressourcenbedarf_id = ANY (${arg(f.bedarfIds)}::uuid[])`);
  if (f.personId) where.push(`z.person_id = ${arg(f.personId)}`);
  if (f.projektId) where.push(`z.projekt_id = ${arg(f.projektId)}`);
  if (f.von) where.push(`z.monat >= ${arg(f.von)}`);
  if (f.bis) where.push(`z.monat <= ${arg(f.bis)}`);
  return (await tx.query<ZuteilungRow>(
    `SELECT ${SPALTEN} ${VON} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.display_name NULLS LAST, z.person_id, z.monat`, args)).rows;
}

export async function get(tx: Tx, id: string): Promise<ZuteilungRow | null> {
  return (await tx.query<ZuteilungRow>(`SELECT ${SPALTEN} ${VON} WHERE z.id = $1`, [id])).rows[0] ?? null;
}

/** Legt je Monat eine Zuteilung an; false, wenn es für Person und Monat schon eine gibt (nichts angelegt). */
export async function anlegen(tx: Tx, bedarfId: string, projektId: string, personId: string, monate: readonly string[], fte: number): Promise<boolean> {
  const r = await tx.query(
    `INSERT INTO ${Z} (tenant_id, ressourcenbedarf_id, projekt_id, person_id, monat, fte)
     SELECT app.tenant_id(), $1, $2, $3, m, $5 FROM unnest($4::text[]) AS m
     ON CONFLICT (tenant_id, ressourcenbedarf_id, person_id, monat) DO NOTHING`, [bedarfId, projektId, personId, monate, fte]);
  if ((r.rowCount ?? 0) !== monate.length) throw new Doppelt();
  return true;
}

/** Zuteilung für Person und Monat gibt es schon (Transaktion zurücksetzen). */
export class Doppelt extends Error {}

export async function aendern(tx: Tx, id: string, version: number, fte: number): Promise<boolean> {
  return ((await tx.query(`UPDATE ${Z} SET fte = $3 WHERE id = $1 AND version = $2`, [id, version, fte])).rowCount ?? 0) > 0;
}

export async function entfernen(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${Z} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

/** Summe der Zuteilungen je Monat eines Bedarfs (FTE). */
export async function summeJeMonat(tx: Tx, bedarfId: string): Promise<Map<string, number>> {
  const rows = (await tx.query<{ monat: string; fte: number }>(
    `SELECT monat, sum(fte)::float8 AS fte FROM ${Z} WHERE ressourcenbedarf_id = $1 GROUP BY monat`, [bedarfId])).rows;
  return new Map(rows.map(r => [r.monat, r.fte]));
}

// ---------------------------------------------------------------- Konflikte (UC-009 A1)

export interface Belegung { person_id: string; person_name: string | null; monat: string; fte: number }

/** Personen mit ihrer Summe je Monat im Zeitraum (alle Bedarfe), nur sichtbare Zuteilungen. */
export async function belegungJePerson(tx: Tx, von: string, bis: string, personIds?: readonly string[]): Promise<Belegung[]> {
  const args: unknown[] = [von, bis];
  let w = '';
  if (personIds) { args.push(personIds); w = ' AND z.person_id = ANY ($3::uuid[])'; }
  return (await tx.query<Belegung>(
    `SELECT z.person_id, max(p.display_name) AS person_name, z.monat, sum(z.fte)::float8 AS fte ${VON}
      WHERE z.monat BETWEEN $1 AND $2${w} GROUP BY z.person_id, z.monat ORDER BY z.person_id, z.monat`, args)).rows;
}

/** Zugeteilte FTE je Rolle und Monat im Zeitraum (Rolle aus dem Bedarf). */
export async function belegungJeRolle(tx: Tx, von: string, bis: string): Promise<{ rolle: string; monat: string; fte: number }[]> {
  return (await tx.query<{ rolle: string; monat: string; fte: number }>(
    `SELECT b.rolle, z.monat, sum(z.fte)::float8 AS fte FROM ${Z} z
       JOIN ${SCHEMA}.ressourcenbedarf b ON b.tenant_id = z.tenant_id AND b.id = z.ressourcenbedarf_id
      WHERE z.monat BETWEEN $1 AND $2 GROUP BY b.rolle, z.monat ORDER BY b.rolle, z.monat`, [von, bis])).rows;
}

/** Zuteilungen einer Rolle bzw. einer Person in einem Monat, mit Projekt (Beteiligte eines Konflikts). */
export async function beteiligte(tx: Tx, monat: string, o: { personId?: string; rolle?: string }): Promise<(ZuteilungRow & { rolle: string })[]> {
  const args: unknown[] = [monat];
  let w = '';
  if (o.personId) { args.push(o.personId); w += ` AND z.person_id = $${args.length}`; }
  if (o.rolle) { args.push(o.rolle); w += ` AND b.rolle = $${args.length}`; }
  return (await tx.query<ZuteilungRow & { rolle: string }>(
    `SELECT ${SPALTEN}, b.rolle ${VON}
       JOIN ${SCHEMA}.ressourcenbedarf b ON b.tenant_id = z.tenant_id AND b.id = z.ressourcenbedarf_id
      WHERE z.monat = $1${w} ORDER BY z.projekt_id, z.person_id`, args)).rows;
}

// ---------------------------------------------------------------- Lücken (UC-009 A2)

export interface LueckeRow { ressourcenbedarf_id: string; text: string; gemeldet_at: Date; gemeldet_by: string | null }

export async function luecken(tx: Tx, bedarfIds: readonly string[]): Promise<Map<string, LueckeRow>> {
  if (!bedarfIds.length) return new Map();
  const rows = (await tx.query<LueckeRow>(
    `SELECT ressourcenbedarf_id, text, gemeldet_at, gemeldet_by FROM ${SCHEMA}.zuteilung_luecke WHERE ressourcenbedarf_id = ANY ($1::uuid[])`, [bedarfIds])).rows;
  return new Map(rows.map(r => [r.ressourcenbedarf_id, r]));
}

/** Lücke melden bzw. ersetzen. */
export async function lueckeMelden(tx: Tx, bedarfId: string, projektId: string, text: string): Promise<LueckeRow> {
  await tx.query(`DELETE FROM ${SCHEMA}.zuteilung_luecke WHERE ressourcenbedarf_id = $1`, [bedarfId]);
  return (await tx.query<LueckeRow>(
    `INSERT INTO ${SCHEMA}.zuteilung_luecke (tenant_id, ressourcenbedarf_id, projekt_id, text) VALUES (app.tenant_id(), $1, $2, btrim($3))
     RETURNING ressourcenbedarf_id, text, gemeldet_at, gemeldet_by`, [bedarfId, projektId, text])).rows[0]!;
}

export async function lueckeEntfernen(tx: Tx, bedarfId: string): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${SCHEMA}.zuteilung_luecke WHERE ressourcenbedarf_id = $1`, [bedarfId])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Personen und Projektleitung

/** Personen der Organisation (Benutzer, nicht entfernt), optional nach Name gesucht. */
export async function personen(tx: Tx, q: string | undefined, ids: readonly string[] | undefined, limit: number): Promise<{ id: string; name: string }[]> {
  const args: unknown[] = [];
  const where = ["kind = 'user'", 'removed_at IS NULL'];
  if (ids) { args.push(ids); where.push(`id = ANY ($${args.length}::uuid[])`); }
  if (q) { args.push(`%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`); where.push(`(display_name ILIKE $${args.length} OR email ILIKE $${args.length})`); }
  args.push(limit);
  return (await tx.query<{ id: string; name: string }>(
    `SELECT id, coalesce(display_name, '') AS name FROM ${SCHEMA}.principal WHERE ${where.join(' AND ')} ORDER BY display_name NULLS LAST, id LIMIT $${args.length}`, args)).rows;
}

/** Projektleitung der Projekte (Projektorganisation aus 040, nur lesend), für Mitteilungen (UC-009 Schritt 4). */
export async function projektleitung(tx: Tx, projektIds: readonly string[]): Promise<{ projekt_id: string; person_id: string }[]> {
  if (!projektIds.length) return [];
  return (await tx.query<{ projekt_id: string; person_id: string }>(
    `SELECT projekt_id, person_id FROM ${SCHEMA}.projekt_person WHERE funktion = 'pl' AND projekt_id = ANY ($1::uuid[])`, [projektIds])).rows;
}

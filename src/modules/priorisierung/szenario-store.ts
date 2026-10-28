/** Datenzugriff der Szenarien (PP.03.01) unter der Lesesicht; die Abfragen kennen keine Rechte. */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

const S = SCHEMA;

export type SzenarioStand = 'entwurf' | 'beantragt' | 'entschieden' | 'verworfen';
export interface SzenarioRow {
  id: string; portfolio_id: string; name: string; stand: SzenarioStand; vorlage: unknown; beantragt_at: Date | null;
  version: number; created_at: Date; updated_at: Date;
}
export interface PositionRow { projekt_id: string; rang: number; start_monat: string | null; aktiv: boolean }

const COLS = 'id, portfolio_id, name, stand, vorlage, beantragt_at, version, created_at, updated_at';

export async function liste(tx: Tx, portfolioId: string): Promise<SzenarioRow[]> {
  return (await tx.query<SzenarioRow>(
    `SELECT ${COLS} FROM ${S}.szenario WHERE portfolio_id = $1 AND stand <> 'verworfen' ORDER BY created_at, id`, [portfolioId])).rows;
}

export async function lesen(tx: Tx, id: string): Promise<SzenarioRow | null> {
  return (await tx.query<SzenarioRow>(`SELECT ${COLS} FROM ${S}.szenario WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function positionen(tx: Tx, id: string): Promise<PositionRow[]> {
  return (await tx.query<PositionRow>(
    `SELECT projekt_id, rang, start_monat, aktiv FROM ${S}.szenario_position WHERE szenario_id = $1 ORDER BY rang`, [id])).rows;
}

export async function anlegen(tx: Tx, portfolioId: string, name: string): Promise<SzenarioRow> {
  return (await tx.query<SzenarioRow>(
    `INSERT INTO ${S}.szenario (tenant_id, portfolio_id, name) VALUES (app.tenant_id(), $1, btrim($2)) RETURNING ${COLS}`, [portfolioId, name])).rows[0]!;
}

export async function positionenSetzen(tx: Tx, id: string, liste: readonly { projektId: string; aktiv: boolean; startMonat: string | null }[]): Promise<void> {
  await tx.query(`DELETE FROM ${S}.szenario_position WHERE szenario_id = $1`, [id]);
  if (!liste.length) return;
  await tx.query(
    `INSERT INTO ${S}.szenario_position (tenant_id, szenario_id, projekt_id, rang, start_monat, aktiv)
     SELECT app.tenant_id(), $1, x.projekt_id, x.rang, x.start_monat, x.aktiv
     FROM unnest($2::uuid[], $3::int[], $4::text[], $5::boolean[]) AS x (projekt_id, rang, start_monat, aktiv)`,
    [id, liste.map(p => p.projektId), liste.map((_, i) => i + 1), liste.map(p => p.startMonat), liste.map(p => p.aktiv)]);
}

/** Änderung mit Prüfung der Version; null = Version veraltet (oder nicht sichtbar). */
export async function aendern(tx: Tx, id: string, version: number, werte: { name?: string; stand?: SzenarioStand; vorlage?: unknown | null }): Promise<SzenarioRow | null> {
  const sets: string[] = ['name = name'];
  const args: unknown[] = [id, version];
  if (werte.name !== undefined) { args.push(werte.name); sets.push(`name = btrim($${args.length})`); }
  if (werte.stand !== undefined) { args.push(werte.stand); sets.push(`stand = $${args.length}`); }
  if (werte.vorlage !== undefined) {
    args.push(werte.vorlage === null ? null : JSON.stringify(werte.vorlage));
    sets.push(`vorlage = $${args.length}::jsonb`, `beantragt_at = CASE WHEN $${args.length}::jsonb IS NULL THEN NULL ELSE now() END`);
  }
  return (await tx.query<SzenarioRow>(
    `UPDATE ${S}.szenario SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING ${COLS}`, args)).rows[0] ?? null;
}

/** Bisheriger Antrag des Portfolios (ausser `ausser`), gesperrt bis zum Ende der Transaktion. */
export async function beantragtes(tx: Tx, portfolioId: string, ausser: string): Promise<SzenarioRow | null> {
  return (await tx.query<SzenarioRow>(
    `SELECT ${COLS} FROM ${S}.szenario WHERE portfolio_id = $1 AND stand = 'beantragt' AND id <> $2 FOR UPDATE`, [portfolioId, ausser])).rows[0] ?? null;
}

/** Projekte mit mindestens einer Bewertung nach dem Modell. */
export async function bewertet(tx: Tx, modellId: string, projektIds: readonly string[]): Promise<Set<string>> {
  if (!projektIds.length) return new Set();
  return new Set((await tx.query<{ projekt_id: string }>(
    `SELECT DISTINCT projekt_id FROM ${S}.bewertung WHERE bewertungsmodell_id = $1 AND projekt_id = ANY ($2::uuid[])`, [modellId, projektIds])).rows.map(r => r.projekt_id));
}

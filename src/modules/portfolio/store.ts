/**
 * Datenzugriff von Portfolios, Gremien, Gremienweg und Sitzungsterminen (BC AM.02.04). Läuft immer in einer Transaktion
 * mit Mandantenkontext; was die Person nicht sehen darf, filtert die Lesesicht (RLS).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

/** Gates des Phasenmodells (docs/fachmodell.md 2.3), Reihenfolge des Ablaufs. */
export const GATES = ['EINTRITT_P0', 'P0_P1', 'P1_P2', 'P2_P3', 'P3_P4', 'EXIT_P4'] as const;
export type GateCode = (typeof GATES)[number];
export type Kategorie = 'A' | 'B' | 'C';
export type GremiumArt = 'entscheidend' | 'extern';

/** Pflichten je Kategorie: A und B ja (A-07), C nein (A-08, UC-017 A1). */
export const pflichtenVon = (k: Kategorie) => k !== 'C';

const P = `${SCHEMA}.portfolio`;
const G = `${SCHEMA}.gremium`;
const W = `${SCHEMA}.gremienweg`;
const S = `${SCHEMA}.sitzungstermin`;

export interface PortfolioRow {
  id: string; kategorie: Kategorie; schluessel: string; name: string; pflichten: boolean; org_einheit_id: string | null; version: number;
  created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null;
}
const PCOLS = 'id, kategorie, schluessel, name, pflichten, org_einheit_id, version, created_at, created_by, updated_at, updated_by';

/** Nach Kategorie und Name; mit `limit` eine Zeile mehr (für den Cursor). */
export async function listPortfolios(tx: Tx, o: { after?: { kategorie: string; name: string; id: string } | null; limit: number }): Promise<PortfolioRow[]> {
  const args: unknown[] = [];
  let where = '';
  if (o.after) { args.push(o.after.kategorie, o.after.name, o.after.id); where = 'WHERE (kategorie, name, id) > ($1, $2, $3::uuid)'; }
  args.push(o.limit + 1);
  return (await tx.query<PortfolioRow>(`SELECT ${PCOLS} FROM ${P} ${where} ORDER BY kategorie, name, id LIMIT $${args.length}`, args)).rows;
}

export async function getPortfolio(tx: Tx, id: string): Promise<PortfolioRow | null> {
  return (await tx.query<PortfolioRow>(`SELECT ${PCOLS} FROM ${P} WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function createPortfolio(tx: Tx, i: { kategorie: Kategorie; schluessel: string; name: string; orgEinheitId?: string | null }): Promise<PortfolioRow> {
  return (await tx.query<PortfolioRow>(
    `INSERT INTO ${P} (tenant_id, kategorie, schluessel, name, pflichten, org_einheit_id) VALUES (app.tenant_id(), $1, $2, btrim($3), $4, $5) RETURNING ${PCOLS}`,
    [i.kategorie, i.schluessel, i.name, pflichtenVon(i.kategorie), i.kategorie === 'C' ? (i.orgEinheitId ?? null) : null])).rows[0]!;
}

/** Ändert Name und Direktion bei passender Version; Kategorie und Schlüssel sind fest (Ort im Rechtemodell). */
export async function updatePortfolio(tx: Tx, id: string, version: number, p: { name?: string; orgEinheitId?: string | null }): Promise<PortfolioRow | null> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  if (p.name !== undefined) { args.push(p.name.trim()); sets.push(`name = $${args.length}`); }
  if (p.orgEinheitId !== undefined) { args.push(p.orgEinheitId); sets.push(`org_einheit_id = CASE WHEN kategorie = 'C' THEN $${args.length}::uuid END`); }
  return (await tx.query<PortfolioRow>(`UPDATE ${P} SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING ${PCOLS}`, args)).rows[0] ?? null;
}

/** Neue Version des Portfolios ohne Änderung der Felder (Gremienweg geändert). */
export async function touchPortfolio(tx: Tx, id: string, version: number): Promise<PortfolioRow | null> {
  return (await tx.query<PortfolioRow>(`UPDATE ${P} SET name = name WHERE id = $1 AND version = $2 RETURNING ${PCOLS}`, [id, version])).rows[0] ?? null;
}

export async function removePortfolio(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${P} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

export interface GremiumRow {
  id: string; portfolio_id: string; kuerzel: string; name: string; art: GremiumArt; rhythmus: string; version: number;
  created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null;
}
const GCOLS = 'id, portfolio_id, kuerzel, name, art, rhythmus, version, created_at, created_by, updated_at, updated_by';

/** Nach Name; mit `limit` eine Zeile mehr (für den Cursor). */
export async function listGremien(tx: Tx, o: { portfolioId?: string; after?: { name: string; id: string } | null; limit?: number } = {}): Promise<GremiumRow[]> {
  const args: unknown[] = [];
  const where: string[] = [];
  if (o.portfolioId) { args.push(o.portfolioId); where.push(`portfolio_id = $${args.length}`); }
  if (o.after) { args.push(o.after.name, o.after.id); where.push(`(name, id) > ($${args.length - 1}, $${args.length}::uuid)`); }
  let limit = '';
  if (o.limit !== undefined) { args.push(o.limit + 1); limit = `LIMIT $${args.length}`; }
  return (await tx.query<GremiumRow>(`SELECT ${GCOLS} FROM ${G} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name, id ${limit}`, args)).rows;
}

export async function hatGremien(tx: Tx, portfolioId: string): Promise<boolean> {
  return ((await tx.query(`SELECT 1 FROM ${G} WHERE portfolio_id = $1 LIMIT 1`, [portfolioId])).rowCount ?? 0) > 0;
}

export async function getGremium(tx: Tx, id: string): Promise<GremiumRow | null> {
  return (await tx.query<GremiumRow>(`SELECT ${GCOLS} FROM ${G} WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function gremiumByKuerzel(tx: Tx, kuerzel: string): Promise<GremiumRow | null> {
  return (await tx.query<GremiumRow>(`SELECT ${GCOLS} FROM ${G} WHERE kuerzel = $1`, [kuerzel])).rows[0] ?? null;
}

export async function createGremium(tx: Tx, i: { portfolioId: string; kuerzel: string; name: string; art: GremiumArt; rhythmus?: string }): Promise<GremiumRow> {
  return (await tx.query<GremiumRow>(
    `INSERT INTO ${G} (tenant_id, portfolio_id, kuerzel, name, art, rhythmus) VALUES (app.tenant_id(), $1, $2, btrim($3), $4, $5) RETURNING ${GCOLS}`,
    [i.portfolioId, i.kuerzel, i.name, i.art, (i.rhythmus ?? '').trim()])).rows[0]!;
}

export async function updateGremium(tx: Tx, id: string, version: number, p: { name?: string; art?: GremiumArt; rhythmus?: string }): Promise<GremiumRow | null> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  for (const k of ['name', 'art', 'rhythmus'] as const) {
    const v = p[k];
    if (v === undefined) continue;
    args.push(v.trim());
    sets.push(`${k} = $${args.length}`);
  }
  return (await tx.query<GremiumRow>(`UPDATE ${G} SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING ${GCOLS}`, args)).rows[0] ?? null;
}

export async function removeGremium(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${G} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

export interface GremienwegRow { gate_code: GateCode; gremium_id: string; zusaetzlich_gremium_id: string | null }

export async function gremienweg(tx: Tx, portfolioId: string): Promise<GremienwegRow[]> {
  return (await tx.query<GremienwegRow>(
    `SELECT gate_code, gremium_id, zusaetzlich_gremium_id FROM ${W} WHERE portfolio_id = $1
      ORDER BY array_position($2::text[], gate_code)`, [portfolioId, GATES])).rows;
}

/** Ersetzt den Gremienweg des Portfolios vollständig. */
export async function replaceGremienweg(tx: Tx, portfolioId: string, schritte: { gateCode: GateCode; gremiumId: string; zusaetzlichGremiumId?: string | null }[]): Promise<void> {
  await tx.query(`DELETE FROM ${W} WHERE portfolio_id = $1`, [portfolioId]);
  for (const s of schritte) {
    await tx.query(
      `INSERT INTO ${W} (tenant_id, portfolio_id, gate_code, gremium_id, zusaetzlich_gremium_id) VALUES (app.tenant_id(), $1, $2, $3, $4)`,
      [portfolioId, s.gateCode, s.gremiumId, s.zusaetzlichGremiumId ?? null]);
  }
}

export interface TerminRow { id: string; gremium_id: string; datum: string; created_at: Date; created_by: string | null }
const TCOLS = "id, gremium_id, to_char(datum, 'YYYY-MM-DD') AS datum, created_at, created_by";

export async function termine(tx: Tx, gremiumId: string, o: { von?: string; bis?: string } = {}): Promise<TerminRow[]> {
  const args: unknown[] = [gremiumId];
  const where = ['gremium_id = $1'];
  if (o.von) { args.push(o.von); where.push(`datum >= $${args.length}::date`); }
  if (o.bis) { args.push(o.bis); where.push(`datum <= $${args.length}::date`); }
  return (await tx.query<TerminRow>(`SELECT ${TCOLS} FROM ${S} WHERE ${where.join(' AND ')} ORDER BY datum`, args)).rows;
}

export async function createTermin(tx: Tx, g: GremiumRow, datum: string): Promise<TerminRow> {
  return (await tx.query<TerminRow>(
    `INSERT INTO ${S} (tenant_id, portfolio_id, gremium_id, datum) VALUES (app.tenant_id(), $1, $2, $3::date) RETURNING ${TCOLS}`,
    [g.portfolio_id, g.id, datum])).rows[0]!;
}

export async function removeTermin(tx: Tx, gremiumId: string, datum: string): Promise<TerminRow | null> {
  return (await tx.query<TerminRow>(`DELETE FROM ${S} WHERE gremium_id = $1 AND datum = $2::date RETURNING ${TCOLS}`, [gremiumId, datum])).rows[0] ?? null;
}

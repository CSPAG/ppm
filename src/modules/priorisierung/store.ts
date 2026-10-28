/**
 * Datenzugriff von Bewertungsmodell, Kriterien, Budgetrahmen und Bewertung. Läuft immer in einer Transaktion mit
 * Mandantenkontext; was die Person nicht sehen darf, filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { EinschaetzungT } from './schemas.ts';

const S = SCHEMA;

export interface ModellRow {
  id: string; nummer: number; stand: 'entwurf' | 'in_kraft'; beschreibung: string; beschluss: string;
  in_kraft_at: Date | null; in_kraft_by: string | null; version: number; created_at: Date; updated_at: Date;
}
export interface KriteriumRow { schluessel: string; text: string; beschreibung: string; dimension: 'nutzen' | 'risiko' | null; position: number }
export interface BudgetRow { portfolio_id: string; kategorie: string; betrag: number }

const MODELL = 'id, nummer, stand, beschreibung, beschluss, in_kraft_at, in_kraft_by, version, created_at, updated_at';

export async function modelle(tx: Tx): Promise<ModellRow[]> {
  return (await tx.query<ModellRow>(`SELECT ${MODELL} FROM ${S}.bewertungsmodell ORDER BY nummer DESC`)).rows;
}

/** Ohne FOR UPDATE: die Lesesicht für Änderungen liesse Modelle in Kraft nicht sehen; die Version schützt vor Überschreiben. */
export async function modell(tx: Tx, id: string): Promise<ModellRow | null> {
  return (await tx.query<ModellRow>(`SELECT ${MODELL} FROM ${S}.bewertungsmodell WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Das zuletzt in Kraft gesetzte Modell (nach ihm wird bewertet). */
export async function aktuell(tx: Tx): Promise<ModellRow | null> {
  return (await tx.query<ModellRow>(`SELECT ${MODELL} FROM ${S}.bewertungsmodell WHERE stand = 'in_kraft' ORDER BY in_kraft_at DESC, nummer DESC LIMIT 1`)).rows[0] ?? null;
}

export async function entwurfAnlegen(tx: Tx, beschreibung: string): Promise<ModellRow> {
  return (await tx.query<ModellRow>(
    `INSERT INTO ${S}.bewertungsmodell (tenant_id, nummer, beschreibung)
     VALUES (app.tenant_id(), (SELECT coalesce(max(nummer), 0) + 1 FROM ${S}.bewertungsmodell), $1) RETURNING ${MODELL}`, [beschreibung])).rows[0]!;
}

export async function kriterien(tx: Tx, modellId: string): Promise<KriteriumRow[]> {
  return (await tx.query<KriteriumRow>(`SELECT schluessel, text, beschreibung, dimension, position FROM ${S}.kriterium WHERE bewertungsmodell_id = $1 ORDER BY position, schluessel`, [modellId])).rows;
}

export async function budgetrahmen(tx: Tx, modellId: string): Promise<BudgetRow[]> {
  return (await tx.query<BudgetRow>(
    `SELECT b.portfolio_id, b.kategorie, b.betrag::float8 AS betrag FROM ${S}.budgetrahmen b
     LEFT JOIN ${S}.portfolio p ON p.id = b.portfolio_id WHERE b.bewertungsmodell_id = $1 ORDER BY b.kategorie, p.name, b.portfolio_id`, [modellId])).rows;
}

export async function kriterienSetzen(tx: Tx, modellId: string, liste: readonly Omit<KriteriumRow, 'position'>[]): Promise<void> {
  await tx.query(`DELETE FROM ${S}.kriterium WHERE bewertungsmodell_id = $1`, [modellId]);
  for (const [i, k] of liste.entries()) {
    await tx.query(`INSERT INTO ${S}.kriterium (tenant_id, bewertungsmodell_id, schluessel, text, beschreibung, dimension, position) VALUES (app.tenant_id(), $1, $2, btrim($3), $4, $5, $6)`,
      [modellId, k.schluessel, k.text, k.beschreibung, k.dimension, i]);
  }
}

/** Budgetrahmen ersetzen; die Kategorie kommt aus dem Portfolio. Liefert die Portfolio-IDs, die es (sichtbar) nicht gibt. */
export async function budgetrahmenSetzen(tx: Tx, modellId: string, liste: readonly { portfolioId: string; betrag: number }[]): Promise<string[]> {
  await tx.query(`DELETE FROM ${S}.budgetrahmen WHERE bewertungsmodell_id = $1`, [modellId]);
  const fehlt: string[] = [];
  for (const b of liste) {
    const r = await tx.query(
      `INSERT INTO ${S}.budgetrahmen (tenant_id, bewertungsmodell_id, portfolio_id, kategorie, betrag)
       SELECT app.tenant_id(), $1, p.id, p.kategorie, $3 FROM ${S}.portfolio p WHERE p.id = $2`, [modellId, b.portfolioId, b.betrag]);
    if (!r.rowCount) fehlt.push(b.portfolioId);
  }
  return fehlt;
}

export async function beschreibungSetzen(tx: Tx, id: string, version: number, beschreibung: string): Promise<boolean> {
  return ((await tx.query(`UPDATE ${S}.bewertungsmodell SET beschreibung = $3 WHERE id = $1 AND version = $2`, [id, version, beschreibung])).rowCount ?? 0) > 0;
}

/** Version des Modells erhöhen, wenn sich nur Kriterien oder Budgetrahmen geändert haben (ETag des ganzen Modells). */
export async function beruehren(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`UPDATE ${S}.bewertungsmodell SET beschreibung = beschreibung WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

export async function inKraftSetzen(tx: Tx, id: string, version: number, beschluss: string): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${S}.bewertungsmodell SET stand = 'in_kraft', beschluss = btrim($3), in_kraft_at = now(), in_kraft_by = app.principal_id()
     WHERE id = $1 AND version = $2 AND stand = 'entwurf'`, [id, version, beschluss])).rowCount ?? 0) > 0;
}

export async function entwurfLoeschen(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${S}.bewertungsmodell WHERE id = $1 AND version = $2 AND stand = 'entwurf'`, [id, version])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Portfolio, Projekte, Bewertung

export interface PortfolioKopf { id: string; schluessel: string; name: string; kategorie: string }

/** Portfolio unter der Lesesicht (null = unbekannt oder nicht sichtbar); Kerntabelle aus 010. */
export async function portfolio(tx: Tx, id: string): Promise<PortfolioKopf | null> {
  return (await tx.query<PortfolioKopf>(`SELECT id, schluessel, name, kategorie FROM ${S}.portfolio WHERE id = $1`, [id])).rows[0] ?? null;
}

export interface ProjektKopf { id: string; nummer: string; name: string; phase: string; lebenszyklus: string }

/**
 * Projekte des Portfolios unter der Lesesicht: aktive, dazu die mit Bewertungen nach `modellId` (frühere Fassung). Nur
 * Spalten der Kerntabelle aus 010; das Modul projekt bietet dafür (noch) keine Abfrage über `index.ts`.
 */
export async function projekte(tx: Tx, portfolioId: string, modellId: string | null): Promise<ProjektKopf[]> {
  return (await tx.query<ProjektKopf>(
    `SELECT id, nummer, name, phase, lebenszyklus FROM ${S}.projekt p
     WHERE p.portfolio_id = $1 AND (p.lebenszyklus = 'aktiv'
       OR EXISTS (SELECT 1 FROM ${S}.bewertung b WHERE b.projekt_id = p.id AND b.bewertungsmodell_id = $2))
     ORDER BY nummer`, [portfolioId, modellId])).rows;
}

export interface BewertungRow { id: string; projekt_id: string; kriterium: string; einschaetzung: EinschaetzungT; kommentar: string; version: number }

export async function bewertungen(tx: Tx, modellId: string, projektIds: readonly string[]): Promise<BewertungRow[]> {
  if (!projektIds.length) return [];
  return (await tx.query<BewertungRow>(
    `SELECT id, projekt_id, kriterium, einschaetzung, kommentar, version FROM ${S}.bewertung
     WHERE bewertungsmodell_id = $1 AND projekt_id = ANY ($2::uuid[]) ORDER BY projekt_id, kriterium`, [modellId, projektIds])).rows;
}

export async function bewertung(tx: Tx, modellId: string, projektId: string, kriterium: string): Promise<BewertungRow | null> {
  return (await tx.query<BewertungRow>(
    `SELECT id, projekt_id, kriterium, einschaetzung, kommentar, version FROM ${S}.bewertung
     WHERE bewertungsmodell_id = $1 AND projekt_id = $2 AND kriterium = $3 FOR UPDATE`, [modellId, projektId, kriterium])).rows[0] ?? null;
}

const BEW = 'id, projekt_id, kriterium, einschaetzung, kommentar, version';

export async function bewertungAnlegen(tx: Tx, modellId: string, projektId: string, kriterium: string, einschaetzung: EinschaetzungT, kommentar: string): Promise<BewertungRow> {
  return (await tx.query<BewertungRow>(
    `INSERT INTO ${S}.bewertung (tenant_id, projekt_id, bewertungsmodell_id, kriterium, einschaetzung, kommentar)
     VALUES (app.tenant_id(), $1, $2, $3, $4, $5) RETURNING ${BEW}`, [projektId, modellId, kriterium, einschaetzung, kommentar])).rows[0]!;
}

export async function bewertungAendern(tx: Tx, id: string, version: number, einschaetzung: EinschaetzungT, kommentar: string): Promise<BewertungRow | null> {
  return (await tx.query<BewertungRow>(`UPDATE ${S}.bewertung SET einschaetzung = $3, kommentar = $4 WHERE id = $1 AND version = $2 RETURNING ${BEW}`,
    [id, version, einschaetzung, kommentar])).rows[0] ?? null;
}

export async function bewertungLoeschen(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${S}.bewertung WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

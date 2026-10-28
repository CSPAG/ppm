/**
 * Datenzugriff des Portfolioberichts (BC PC.04.02, UC-014 Schritt 3; AP-E2-3): Tabelle `portfoliobericht` (150) und für
 * die Traktandenart die Sitzung mit Portfolio und Datum. Läuft immer in einer Transaktion mit Mandantenkontext.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

const S = SCHEMA;

export interface BerichtRow {
  id: string; portfolio_id: string; schluessel: string; portfolio_name: string; periode: string; stand: 'entwurf' | 'bereitgestellt';
  inhalt: Record<string, unknown>; erzeugt_at: Date; kommentar: string; bereitgestellt_at: Date | null; version: number;
}

const SPALTEN = `b.id, b.portfolio_id, pf.schluessel, pf.name AS portfolio_name, b.periode, b.stand, b.inhalt, b.erzeugt_at, b.kommentar,
  b.bereitgestellt_at, b.version`;

export async function liste(tx: Tx, portfolioId: string | null): Promise<Omit<BerichtRow, 'inhalt' | 'kommentar'>[]> {
  return (await tx.query<BerichtRow>(
    `SELECT b.id, b.portfolio_id, pf.schluessel, pf.name AS portfolio_name, b.periode, b.stand, b.erzeugt_at, b.bereitgestellt_at, b.version
       FROM ${S}.portfoliobericht b JOIN ${S}.portfolio pf ON pf.id = b.portfolio_id
      WHERE ($1::uuid IS NULL OR b.portfolio_id = $1) ORDER BY b.periode DESC, pf.kategorie, pf.name LIMIT 200`, [portfolioId])).rows;
}

export async function lesen(tx: Tx, id: string): Promise<BerichtRow | null> {
  return (await tx.query<BerichtRow>(
    `SELECT ${SPALTEN} FROM ${S}.portfoliobericht b JOIN ${S}.portfolio pf ON pf.id = b.portfolio_id WHERE b.id = $1`, [id])).rows[0] ?? null;
}

export async function von(tx: Tx, portfolioId: string, periode: string): Promise<BerichtRow | null> {
  return (await tx.query<BerichtRow>(
    `SELECT ${SPALTEN} FROM ${S}.portfoliobericht b JOIN ${S}.portfolio pf ON pf.id = b.portfolio_id
      WHERE b.portfolio_id = $1 AND b.periode = $2`, [portfolioId, periode])).rows[0] ?? null;
}

export async function anlegen(tx: Tx, portfolioId: string, periode: string, inhalt: unknown): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${S}.portfoliobericht (tenant_id, portfolio_id, periode, inhalt) VALUES (app.tenant_id(), $1, $2, $3) RETURNING id`,
    [portfolioId, periode, JSON.stringify(inhalt)])).rows[0]!.id;
}

/** Neu erzeugen (nur im Entwurf); der Kommentar bleibt. */
export async function erneuern(tx: Tx, id: string, inhalt: unknown): Promise<void> {
  await tx.query(`UPDATE ${S}.portfoliobericht SET inhalt = $2, erzeugt_at = now(), version = version + 1 WHERE id = $1`, [id, JSON.stringify(inhalt)]);
}

export async function kommentieren(tx: Tx, id: string, version: number, kommentar: string): Promise<boolean> {
  return ((await tx.query(`UPDATE ${S}.portfoliobericht SET kommentar = $3, version = version + 1 WHERE id = $1 AND version = $2 AND stand = 'entwurf'`,
    [id, version, kommentar])).rowCount ?? 0) > 0;
}

export async function bereitstellen(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${S}.portfoliobericht SET stand = 'bereitgestellt', bereitgestellt_at = now(), bereitgestellt_by = app.principal_id(), version = version + 1
      WHERE id = $1 AND version = $2 AND stand = 'entwurf'`, [id, version])).rowCount ?? 0) > 0;
}

export interface PeriodeStandRow { periode: string; stand: 'offen' | 'abgeschlossen'; abgeschlossen_at: Date | null }

export async function periode(tx: Tx, p: string): Promise<PeriodeStandRow | null> {
  return (await tx.query<PeriodeStandRow>(`SELECT periode, stand, abgeschlossen_at FROM ${S}.periode WHERE periode = $1`, [p])).rows[0] ?? null;
}

/**
 * Bericht zur Sitzung (K3 Schritt 4): Portfolio der Sitzung und die letzte vor dem Sitzungsmonat abgeschlossene Periode;
 * `bericht` ist null, solange für diese Periode keiner erzeugt (bzw. für die Person sichtbar) ist.
 */
export async function zurSitzung(tx: Tx, sitzungId: string): Promise<{ portfolioId: string; periode: string | null; bericht: BerichtRow | null } | null> {
  const s = (await tx.query<{ portfolio_id: string; periode: string | null }>(
    `SELECT s.portfolio_id, (SELECT max(p.periode) FROM ${S}.periode p WHERE p.stand = 'abgeschlossen' AND p.periode < to_char(s.datum, 'YYYY-MM')) AS periode
       FROM ${S}.sitzung s WHERE s.id = $1`, [sitzungId])).rows[0];
  if (!s) return null;
  return { portfolioId: s.portfolio_id, periode: s.periode, bericht: s.periode ? await von(tx, s.portfolio_id, s.periode) : null };
}

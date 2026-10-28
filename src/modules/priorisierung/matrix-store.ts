/** Datenzugriff der Rangfolge (PP.02.02) unter der Lesesicht; die Abfragen kennen keine Rechte. */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

export interface RangRow { projekt_id: string; rang: number; stand: 'entwurf' | 'entschieden'; begruendung: string; version: number; updated_at: Date }

export async function rangfolge(tx: Tx, portfolioId: string): Promise<RangRow[]> {
  return (await tx.query<RangRow>(
    `SELECT projekt_id, rang, stand, begruendung, version, updated_at FROM ${SCHEMA}.rangfolge WHERE portfolio_id = $1 ORDER BY stand, rang`, [portfolioId])).rows;
}

/** Fassung des Entwurfs (0 ohne Entwurf), gesperrt bis zum Ende der Transaktion. */
export async function entwurfVersion(tx: Tx, portfolioId: string): Promise<number> {
  await tx.query(`SELECT pg_advisory_xact_lock(hashtext('rangfolge:' || $1))`, [portfolioId]);
  return (await tx.query<{ v: number | null }>(`SELECT max(version) AS v FROM ${SCHEMA}.rangfolge WHERE portfolio_id = $1 AND stand = 'entwurf'`, [portfolioId])).rows[0]?.v ?? 0;
}

export async function entwurfSetzen(tx: Tx, portfolioId: string, version: number, liste: readonly { projektId: string; begruendung: string }[]): Promise<void> {
  await tx.query(`DELETE FROM ${SCHEMA}.rangfolge WHERE portfolio_id = $1 AND stand = 'entwurf'`, [portfolioId]);
  for (const [i, x] of liste.entries()) {
    await tx.query(
      `INSERT INTO ${SCHEMA}.rangfolge (tenant_id, portfolio_id, projekt_id, rang, stand, begruendung, version) VALUES (app.tenant_id(), $1, $2, $3, 'entwurf', btrim($4), $5)`,
      [portfolioId, x.projektId, i + 1, x.begruendung, version]);
  }
}

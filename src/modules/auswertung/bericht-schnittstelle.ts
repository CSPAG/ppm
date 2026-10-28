/**
 * Lese-Schnittstelle des Portfolioberichts für obere Module (BC PC.04.02; AP-E2-3): Das Quartalsreporting (`ziel`,
 * ZM.03.02, UC-012 Schritt 3) übernimmt Zahlen, Risiken und Eskalationen aus den Berichten des letzten Quartalsmonats
 * und hält ihren Stand bei Erzeugung fest. Läuft in der Transaktion und Lesesicht des Aufrufers (RLS: Entwürfe nur mit
 * `auswertung:write`, bereitgestellte auch mit `auswertung:read`).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { BerichtInhalt } from './bericht.ts';

export interface PortfolioberichtDaten {
  id: string;
  portfolioId: string;
  periode: string;
  stand: 'entwurf' | 'bereitgestellt';
  /** Stand bei Erzeugung: abgeschlossenes Dashboard und Risikolage */
  inhalt: BerichtInhalt;
}

/** Portfolioberichte einer Periode («JJJJ-MM»), je Portfolio höchstens einer. */
async function derPeriode(tx: Tx, periode: string): Promise<PortfolioberichtDaten[]> {
  return (await tx.query<{ id: string; portfolio_id: string; periode: string; stand: 'entwurf' | 'bereitgestellt'; inhalt: BerichtInhalt }>(
    `SELECT id, portfolio_id, periode, stand, inhalt FROM ${SCHEMA}.portfoliobericht WHERE periode = $1`, [periode])).rows
    .map(r => ({ id: r.id, portfolioId: r.portfolio_id, periode: r.periode, stand: r.stand, inhalt: r.inhalt }));
}

export const portfoliobericht = { derPeriode };

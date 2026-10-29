/**
 * Datenzugriff des Dashboards (BC PC.04.01, UC-014 Schritt 1; AP-E1-3). Nur lesend über die Tabellen der unteren
 * Module (Projekt, Portfolio, Projektorganisation, Register, Statusbericht, Stand der Periode); was die Person nicht
 * sehen darf, filtert die Lesesicht (RLS). Läuft immer in einer Transaktion mit Mandantenkontext.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

const S = SCHEMA;

export interface PortfolioRow { id: string; schluessel: string; name: string; kategorie: string; pflichten: boolean }

/** Portfolios, die die Person sieht (Lesesicht `portfolio:read`), nach Kategorie und Name. */
export async function portfolios(tx: Tx): Promise<PortfolioRow[]> {
  return (await tx.query<PortfolioRow>(`SELECT id, schluessel, name, kategorie, pflichten FROM ${S}.portfolio ORDER BY kategorie, name, id`)).rows;
}

export interface PeriodeRow { periode: string; stand: 'offen' | 'abgeschlossen'; abgeschlossen_at: Date | null }

/** Perioden mit Stand, neueste zuerst (höchstens zwei Jahre). */
export async function perioden(tx: Tx): Promise<PeriodeRow[]> {
  return (await tx.query<PeriodeRow>(`SELECT periode, stand, abgeschlossen_at FROM ${S}.periode ORDER BY periode DESC LIMIT 24`)).rows;
}

export async function laufendePeriode(tx: Tx): Promise<string> {
  return (await tx.query<{ p: string }>("SELECT to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYY-MM') AS p")).rows[0]!.p;
}

/** Werte einer Zeile, gleich für abgeschlossene (Stand bei Abschluss) und offene Perioden (live). */
export interface ZeileRow {
  projekt_id: string; nummer: string; name: string; portfolio_id: string; lebenszyklus: string; projekt_phase: string;
  handlungsfeld: string | null; projektleitung: string | null; pflichtig: boolean;
  /** Herkunft der Werte: Bericht der Periode, Stand bei Abschluss oder letzte frühere Meldung. */
  gemeldet: boolean; abgeschlossen: boolean;
  status: 'im_plan' | 'kritisch' | null; trend: string | null; phase: string | null; abschluss_per: string | null;
  naechster_meilenstein: string | null; werte_aus: string | null; status_vorperiode: 'im_plan' | 'kritisch' | null;
  /** Bericht der Zeile (Stand bei Abschluss bzw. eingereicht in der offenen Periode), für den Badge «Eskalation». */
  statusbericht_id: string | null;
  /** Mit dem eingereichten, ungeprüften Bericht abgeschlossen (Vermerk «nicht geprüft», A-74). */
  ungeprueft: boolean;
  ms_termin: string | null; ms_text: string | null;
}

/** Projektleitung, Handlungsfeld und nächster offener Meilenstein aus dem Register (Lesesicht der Person). */
const KOPF = `
  (SELECT h.label FROM ${S}.handlungsfeld h WHERE h.id = p.handlungsfeld_id) AS handlungsfeld,
  (SELECT pr.display_name FROM ${S}.projekt_person pp JOIN ${S}.principal pr ON pr.tenant_id = pp.tenant_id AND pr.id = pp.person_id
    WHERE pp.projekt_id = p.id AND pp.funktion = 'pl' LIMIT 1) AS projektleitung,
  ms.termin AS ms_termin, ms.text AS ms_text`;
const MEILENSTEIN = `LEFT JOIN LATERAL (
    SELECT to_char(coalesce(m.termin_aktuell, m.termin_baseline), 'YYYY-MM-DD') AS termin, m.text FROM ${S}.meilenstein m
     WHERE m.projekt_id = p.id AND m.art IN ('meilenstein', 'lieferergebnis') AND m.erreicht_am IS NULL
       AND coalesce(m.termin_aktuell, m.termin_baseline) IS NOT NULL
     ORDER BY coalesce(m.termin_aktuell, m.termin_baseline), m.id LIMIT 1) ms ON true`;

/** Abgeschlossene Periode: Stand bei Abschluss (`dashboard_zeile`, A-11). */
export async function zeilenAbgeschlossen(tx: Tx, periode: string, portfolioIds: string[]): Promise<ZeileRow[]> {
  return (await tx.query<ZeileRow>(
    `SELECT p.id AS projekt_id, p.nummer, p.name, p.portfolio_id, p.lebenszyklus, p.phase AS projekt_phase, ${KOPF},
            true AS pflichtig, d.gemeldet, true AS abgeschlossen, d.status, d.trend, d.phase,
            to_char(d.abschluss_per, 'YYYY-MM-DD') AS abschluss_per, d.naechster_meilenstein, d.werte_aus, d.status_vorperiode,
            d.statusbericht_id,
            EXISTS (SELECT 1 FROM ${S}.statusbericht r WHERE r.id = d.statusbericht_id AND r.stand = 'eingereicht') AS ungeprueft
       FROM ${S}.dashboard_zeile d
       JOIN ${S}.projekt p ON p.id = d.projekt_id
       ${MEILENSTEIN}
      WHERE d.periode = $1 AND p.portfolio_id = ANY ($2::uuid[])`, [periode, portfolioIds])).rows;
}

/**
 * Offene Periode (live, K1 «Das Dashboard zeigt ihn sofort»): aktive Projekte; eingereichter Bericht der Periode, sonst
 * die letzte frühere Meldung (Stand bei Abschluss bzw. letzter eingereichter Bericht) als «ausstehend».
 */
export async function zeilenOffen(tx: Tx, periode: string, portfolioIds: string[]): Promise<ZeileRow[]> {
  return (await tx.query<ZeileRow>(
    `SELECT p.id AS projekt_id, p.nummer, p.name, p.portfolio_id, p.lebenszyklus, p.phase AS projekt_phase, ${KOPF},
            (pf.pflichten AND p.phase IN ('P0', 'P1', 'P2', 'P3')) AS pflichtig,
            (b.id IS NOT NULL) AS gemeldet, false AS abgeschlossen,
            coalesce(b.status, v.status) AS status, coalesce(b.trend, v.trend) AS trend, coalesce(b.phase, p.phase) AS phase,
            to_char(coalesce(b.abschluss_per, v.abschluss_per), 'YYYY-MM-DD') AS abschluss_per,
            CASE WHEN b.id IS NOT NULL THEN b.naechster_meilenstein ELSE v.naechster_meilenstein END AS naechster_meilenstein,
            CASE WHEN b.id IS NOT NULL THEN $1 ELSE v.periode END AS werte_aus,
            v.status AS status_vorperiode, b.id AS statusbericht_id, false AS ungeprueft
       FROM ${S}.projekt p
       JOIN ${S}.portfolio pf ON pf.id = p.portfolio_id
       LEFT JOIN ${S}.statusbericht b ON b.projekt_id = p.id AND b.periode = $1 AND b.stand <> 'entwurf'
       LEFT JOIN LATERAL (
         SELECT x.periode, x.status, x.trend, x.abschluss_per, x.naechster_meilenstein FROM (
           SELECT 0 AS rang, d.periode, d.status, d.trend, d.abschluss_per, d.naechster_meilenstein FROM ${S}.dashboard_zeile d
            WHERE d.projekt_id = p.id AND d.periode < $1
           UNION ALL
           SELECT 1 AS rang, r.periode, r.status, r.trend, r.abschluss_per, r.naechster_meilenstein FROM ${S}.statusbericht r
            WHERE r.projekt_id = p.id AND r.periode < $1 AND r.stand <> 'entwurf'
         ) x ORDER BY x.periode DESC, x.rang LIMIT 1) v ON true
       ${MEILENSTEIN}
      WHERE p.lebenszyklus = 'aktiv' AND p.portfolio_id = ANY ($2::uuid[])`, [periode, portfolioIds])).rows;
}

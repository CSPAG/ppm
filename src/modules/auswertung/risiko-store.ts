/**
 * Datenzugriff der Risikolage (BC PC.02.02, UC-014 Schritt 2; AP-E2-3). Nur lesend über die Register (`projektdaten`:
 * Risiken, Abhängigkeiten) und die Eskalationen (`statusbericht`); was die Person nicht sehen darf, filtert die Lesesicht.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

const S = SCHEMA;

export interface RisikoRow {
  id: string; projekt_id: string | null; nummer: string | null; name: string | null; portfolio_id: string; text: string;
  wahrscheinlichkeit: 'hoch' | 'mittel' | 'tief'; auswirkung: 'hoch' | 'mittel' | 'tief'; massnahme: string;
  massnahme_stand: 'offen' | 'umgesetzt'; verantwortlich: string;
}

/** Risiken der aktiven Projekte und der Portfolios selbst. */
export async function risiken(tx: Tx, portfolioIds: string[]): Promise<RisikoRow[]> {
  return (await tx.query<RisikoRow>(
    `SELECT r.id, r.projekt_id, p.nummer, p.name, coalesce(p.portfolio_id, r.portfolio_id) AS portfolio_id, r.text,
            r.wahrscheinlichkeit, r.auswirkung, r.massnahme, r.massnahme_stand, r.verantwortlich
       FROM ${S}.risiko r
       LEFT JOIN ${S}.projekt p ON p.id = r.projekt_id
      WHERE (r.portfolio_id = ANY ($1::uuid[]))
         OR (p.lebenszyklus = 'aktiv' AND p.portfolio_id = ANY ($1::uuid[]))`, [portfolioIds])).rows;
}

export interface AbhaengigkeitRow { id: string; von_id: string; von_nummer: string; von_name: string; zu_id: string; zu_nummer: string; zu_name: string; text: string }

/** Abhängigkeiten, deren abhängiges Projekt aktiv in einem der Portfolios liegt (das andere sieht die Person). */
export async function abhaengigkeiten(tx: Tx, portfolioIds: string[]): Promise<AbhaengigkeitRow[]> {
  return (await tx.query<AbhaengigkeitRow>(
    `SELECT a.id, v.id AS von_id, v.nummer AS von_nummer, v.name AS von_name, z.id AS zu_id, z.nummer AS zu_nummer, z.name AS zu_name, a.text
       FROM ${S}.abhaengigkeit a
       JOIN ${S}.projekt v ON v.id = a.projekt_id
       JOIN ${S}.projekt z ON z.id = a.zu_projekt_id
      WHERE v.lebenszyklus = 'aktiv' AND v.portfolio_id = ANY ($1::uuid[])
      ORDER BY v.nummer, z.nummer`, [portfolioIds])).rows;
}

export interface EskalationRow { id: string; projekt_id: string; nummer: string; name: string; periode: string; grund: string; massnahme: string; stand: 'offen' | 'traktandiert' }

/** Offene bzw. zur Folgesitzung traktandierte Eskalationen der Projekte. */
export async function eskalationen(tx: Tx, portfolioIds: string[]): Promise<EskalationRow[]> {
  return (await tx.query<EskalationRow>(
    `SELECT e.id, p.id AS projekt_id, p.nummer, p.name, b.periode, e.grund, e.massnahme, e.stand
       FROM ${S}.eskalation e
       JOIN ${S}.projekt p ON p.id = e.projekt_id
       JOIN ${S}.statusbericht b ON b.id = e.statusbericht_id
      WHERE e.stand IN ('offen', 'traktandiert') AND p.portfolio_id = ANY ($1::uuid[])
      ORDER BY b.periode DESC, p.nummer`, [portfolioIds])).rows;
}

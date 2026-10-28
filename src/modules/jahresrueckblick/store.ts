/**
 * Datenzugriff des Jahresrückblicks (BC ZM.03.03, UC-013; AP-E7-5): Tabelle `jahresrueckblick` (380) und lesend die
 * Vorhaben des Jahres aus Projekt und Projektverlauf (Lesesicht der Person). Läuft immer in einer Transaktion.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

const S = SCHEMA;

export interface RueckblickRow {
  id: string; jahr: number; stand: 'in_arbeit' | 'traktandiert' | 'ausgewertet'; inhalt: Record<string, unknown> | null;
  erkenntnisse: string; massnahmen: string; rueckmeldung: string; traktandiert_at: Date | null; ausgewertet_at: Date | null; version: number;
}

const SPALTEN = 'id, jahr, stand, inhalt, erkenntnisse, massnahmen, rueckmeldung, traktandiert_at, ausgewertet_at, version';

export async function lesen(tx: Tx, jahr: number): Promise<RueckblickRow | null> {
  return (await tx.query<RueckblickRow>(`SELECT ${SPALTEN} FROM ${S}.jahresrueckblick WHERE jahr = $1`, [jahr])).rows[0] ?? null;
}

export async function vonId(tx: Tx, id: string): Promise<RueckblickRow | null> {
  return (await tx.query<RueckblickRow>(`SELECT ${SPALTEN} FROM ${S}.jahresrueckblick WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Anlegen; null, wenn gleichzeitig schon ein Rückblick des Jahres entstand. */
export async function anlegen(tx: Tx, jahr: number, t: { erkenntnisse: string; massnahmen: string }): Promise<string | null> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${S}.jahresrueckblick (tenant_id, jahr, erkenntnisse, massnahmen) VALUES (app.tenant_id(), $1, $2, $3)
     ON CONFLICT (tenant_id, jahr) DO NOTHING RETURNING id`,
    [jahr, t.erkenntnisse, t.massnahmen])).rows[0]?.id ?? null;
}

export async function erfassen(tx: Tx, id: string, version: number, t: { erkenntnisse: string; massnahmen: string }): Promise<boolean> {
  return ((await tx.query(`UPDATE ${S}.jahresrueckblick SET erkenntnisse = $3, massnahmen = $4 WHERE id = $1 AND version = $2`,
    [id, version, t.erkenntnisse, t.massnahmen])).rowCount ?? 0) > 0;
}

/** Traktandieren; false, wenn der Rückblick gleichzeitig nicht mehr in Arbeit ist. */
export async function traktandieren(tx: Tx, id: string, inhalt: unknown): Promise<boolean> {
  return ((await tx.query(`UPDATE ${S}.jahresrueckblick SET stand = 'traktandiert', inhalt = $2, traktandiert_at = now(), rueckmeldung = ''
     WHERE id = $1 AND stand = 'in_arbeit'`, [id, JSON.stringify(inhalt)])).rowCount ?? 0) > 0;
}

/**
 * Folge des Entscheids: «Verabschiedet» → ausgewertet; «Anpassungen verlangt» → in Arbeit mit Rückmeldung. Der Stand bei
 * Traktandierung bleibt (Korrektur zu «Verabschiedet» in der Sitzung, A-30); in Arbeit gilt die Auswertung live.
 */
export async function standSetzen(tx: Tx, id: string, stand: 'in_arbeit' | 'ausgewertet', rueckmeldung = ''): Promise<void> {
  await tx.query(
    `UPDATE ${S}.jahresrueckblick SET stand = $2::text, ausgewertet_at = CASE WHEN $2::text = 'ausgewertet' THEN now() END,
            rueckmeldung = CASE WHEN $2::text = 'in_arbeit' THEN $3::text ELSE rueckmeldung END
      WHERE id = $1`, [id, stand, rueckmeldung]);
}

export interface VorhabenRow { id: string; nummer: string; name: string; portfolio: string; phase: string; lebenszyklus: string; seit: string | null }

/**
 * Vorhaben des Jahres (UC-013 Schritt 1): abgeschlossen bzw. abgebrochen, wenn der Lebenszyklus im Jahr (Europe/Zurich)
 * auf diesen Stand wechselte (Verlauf `projekt_version`); laufend sind aktive und sistierte.
 */
export async function vorhaben(tx: Tx, jahr: number): Promise<VorhabenRow[]> {
  return (await tx.query<VorhabenRow>(
    `SELECT p.id, p.nummer, p.name, pf.name AS portfolio, p.phase, p.lebenszyklus, to_char(w.seit, 'YYYY-MM-DD') AS seit
       FROM ${S}.projekt p
       JOIN ${S}.portfolio pf ON pf.id = p.portfolio_id
       LEFT JOIN LATERAL (
         SELECT (min(v.changed_at) AT TIME ZONE 'Europe/Zurich')::date AS seit FROM ${S}.projekt_version v
          WHERE v.projekt_id = p.id AND v.lebenszyklus = p.lebenszyklus
            AND v.version > coalesce((SELECT max(x.version) FROM ${S}.projekt_version x WHERE x.projekt_id = p.id AND x.lebenszyklus <> p.lebenszyklus), -1)
       ) w ON p.lebenszyklus IN ('abgeschlossen', 'abgebrochen')
      WHERE p.lebenszyklus IN ('aktiv', 'sistiert')
         OR (p.lebenszyklus IN ('abgeschlossen', 'abgebrochen') AND extract(year FROM w.seit) = $1)
      ORDER BY p.nummer`, [jahr])).rows;
}

/** PRAT: entscheidendes Gremium des Portfolios der Kategorie A (Annahme wie beim Quartalsreporting). */
export async function portfolioA(tx: Tx): Promise<string | null> {
  return (await tx.query<{ id: string }>(`SELECT id FROM ${S}.portfolio WHERE kategorie = 'A' ORDER BY name, id LIMIT 1`)).rows[0]?.id ?? null;
}

/** Ids der Projekte, die die Person sieht (Lesesicht, für den gespeicherten Stand). */
export async function sichtbar(tx: Tx, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  return new Set((await tx.query<{ id: string }>(`SELECT id FROM ${S}.projekt WHERE id = ANY($1::uuid[])`, [ids])).rows.map(r => r.id));
}

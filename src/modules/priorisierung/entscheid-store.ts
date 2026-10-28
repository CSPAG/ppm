/** Datenzugriff des Priorisierungsentscheids (UC-008 Schritte 7–8, A2) unter der Lesesicht; die Abfragen kennen keine Rechte. */
import { conflict, type Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import { traktandum } from '../sitzung/index.ts';

const S = SCHEMA;

export type Folge = 'zurueckstellen' | 'sistieren' | 'abbrechen';
export interface FolgeRow { projekt_id: string; folge: Folge; begruendung: string }

export async function folgen(tx: Tx, szenarioId: string): Promise<FolgeRow[]> {
  return (await tx.query<FolgeRow>(`SELECT projekt_id, folge, begruendung FROM ${S}.szenario_folge WHERE szenario_id = $1 ORDER BY projekt_id`, [szenarioId])).rows;
}

export async function folgenSetzen(tx: Tx, szenarioId: string, liste: readonly { projektId: string; folge: Folge; begruendung: string }[]): Promise<void> {
  await tx.query(`DELETE FROM ${S}.szenario_folge WHERE szenario_id = $1`, [szenarioId]);
  for (const f of liste) {
    await tx.query(`INSERT INTO ${S}.szenario_folge (tenant_id, szenario_id, projekt_id, folge, begruendung) VALUES (app.tenant_id(), $1, $2, $3, btrim($4))`,
      [szenarioId, f.projektId, f.folge, f.begruendung]);
  }
}

/** Entschiedene Rangfolge ersetzen (Ist-Stand, UC-008 Schritt 8); liefert die bisherige (Rang und Start je Projekt). */
export async function rangfolgeEntscheiden(tx: Tx, portfolioId: string, liste: readonly { projektId: string; startMonat: string | null }[]): Promise<Map<string, { rang: number; start: string | null }>> {
  const bisher = new Map((await tx.query<{ projekt_id: string; rang: number; start_monat: string | null }>(
    `SELECT projekt_id, rang, start_monat FROM ${S}.rangfolge WHERE portfolio_id = $1 AND stand = 'entschieden'`, [portfolioId])).rows
    .map(r => [r.projekt_id, { rang: r.rang, start: r.start_monat }]));
  await tx.query(`SELECT pg_advisory_xact_lock(hashtext('rangfolge:' || $1))`, [portfolioId]);
  await tx.query(`DELETE FROM ${S}.rangfolge WHERE portfolio_id = $1 AND stand = 'entschieden'`, [portfolioId]);
  for (const [i, x] of liste.entries()) {
    await tx.query(
      `INSERT INTO ${S}.rangfolge (tenant_id, portfolio_id, projekt_id, rang, stand, start_monat) VALUES (app.tenant_id(), $1, $2, $3, 'entschieden', $4)`,
      [portfolioId, x.projektId, i + 1, x.startMonat]);
  }
  return bisher;
}

export async function szenarioEntscheiden(tx: Tx, id: string): Promise<boolean> {
  return ((await tx.query(`UPDATE ${S}.szenario SET stand = 'entschieden', entschieden_at = now() WHERE id = $1 AND stand IN ('beantragt', 'entschieden')`, [id])).rowCount ?? 0) > 0;
}

/** Sponsor und Projektleitung je Projekt (Kerntabelle `projekt_person` aus 010). */
export async function verantwortliche(tx: Tx, projektIds: readonly string[]): Promise<{ projekt_id: string; person_id: string; funktion: 'sp' | 'pl' }[]> {
  if (!projektIds.length) return [];
  return (await tx.query<{ projekt_id: string; person_id: string; funktion: 'sp' | 'pl' }>(
    `SELECT DISTINCT projekt_id, person_id, funktion FROM ${S}.projekt_person WHERE projekt_id = ANY ($1::uuid[]) AND funktion IN ('sp', 'pl') ORDER BY projekt_id, funktion, person_id`,
    [projektIds])).rows;
}

/** Beträge sichtbar (A-33) für die Person, die den Entscheid erfasst. */
export async function kostenSichtbar(tx: Tx, portfolioId: string): Promise<boolean> {
  return (await tx.query<{ k: boolean }>(`SELECT (app.has_permission('finanzen:read') OR app.has_permission('finanzen:read', 'portfolio', $1)) AS k`, [portfolioId])).rows[0]!.k;
}

/** Start der Projekte im Ist-Stand (Rangfolge «entschieden»); für die Kopie beim Anlegen eines Szenarios. */
export async function istStart(tx: Tx, portfolioId: string): Promise<Map<string, string>> {
  return new Map((await tx.query<{ projekt_id: string; start_monat: string }>(
    `SELECT projekt_id, start_monat FROM ${S}.rangfolge WHERE portfolio_id = $1 AND stand = 'entschieden' AND start_monat IS NOT NULL`, [portfolioId])).rows
    .map(r => [r.projekt_id, r.start_monat]));
}

export async function traktandiertSetzen(tx: Tx, id: string, ja: boolean): Promise<void> {
  await tx.query(`UPDATE ${S}.szenario SET traktandiert_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1`, [id, ja]);
}

export async function traktandiert(tx: Tx, id: string): Promise<boolean> {
  return (await tx.query<{ t: Date | null }>(`SELECT traktandiert_at AS t FROM ${S}.szenario WHERE id = $1`, [id])).rows[0]?.t != null;
}

/**
 * Traktandum eines Antrags zurücknehmen, bevor der Antrag sich ändert (neue Folgeentscheide, neuer Antrag, Verwerfen):
 * solange nicht versendet, entfällt das Traktandum (erneut traktandieren); versendet ist der Antrag fest bis zum
 * Entscheid (409).
 */
export async function antragZuruecknehmen(tx: Tx, s: { id: string; name: string }): Promise<void> {
  if (!(await traktandiert(tx, s.id))) return;
  if (!(await traktandum.zuruecknehmen(tx, { art: 'priorisierung', bezug: { typ: 'szenario', id: s.id } }))) {
    throw conflict(`Der Antrag «${s.name}» ist dem Gremium mit den Unterlagen versendet und bis zum Entscheid fest.`, { reason: 'versendet' });
  }
  await traktandiertSetzen(tx, s.id, false);
}

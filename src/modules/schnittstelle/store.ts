/** Daten der Schnittstellen und Läufe (360_schnittstelle); Lesesicht über die Policies (schnittstelle:admin). */
import type { Tx } from '@vollholz/platform';
import type { Rhythmus, Richtung } from './katalog.ts';

export interface Row {
  id: string; umsystem: string; daten: string; richtung: Richtung; rhythmus: Rhythmus; adresse: string; aktiv: boolean;
  version: number; created_at: Date; updated_at: Date;
}
export type LaufArt = 'test' | 'geplant' | 'manuell';
export type LaufStand = 'laeuft' | 'erfolgreich' | 'fehlgeschlagen';
export interface LaufRow {
  id: string; schnittstelle_id: string; art: LaufArt; stand: LaufStand; start: Date; ende: Date | null; umfang: number | null;
  fehler: string | null; gestartet_by: string | null; gestartet_name: string | null;
}

const COLS = 'id, umsystem, daten, richtung, rhythmus, adresse, aktiv, version, created_at, updated_at';
const LAUF = `l.id, l.schnittstelle_id, l.art, l.stand, l.start, l.ende, l.umfang, l.fehler, l.gestartet_by, p.display_name AS gestartet_name
  FROM ppm.schnittstelle_lauf l LEFT JOIN ppm.principal p ON p.tenant_id = l.tenant_id AND p.id = l.gestartet_by`;

export async function list(tx: Tx): Promise<Row[]> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ppm.schnittstelle ORDER BY umsystem, daten`)).rows;
}

export async function get(tx: Tx, id: string): Promise<Row | null> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ppm.schnittstelle WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Legt an; `null`, wenn es für Umsystem und Daten schon eine Schnittstelle gibt. */
export async function create(tx: Tx, s: { umsystem: string; daten: string; richtung: Richtung; rhythmus: Rhythmus; adresse: string; aktiv: boolean }): Promise<Row | null> {
  return (await tx.query<Row>(
    `INSERT INTO ppm.schnittstelle (tenant_id, umsystem, daten, richtung, rhythmus, adresse, aktiv) VALUES (app.tenant_id(), $1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id, umsystem, daten) DO NOTHING RETURNING ${COLS}`,
    [s.umsystem, s.daten, s.richtung, s.rhythmus, s.adresse, s.aktiv])).rows[0] ?? null;
}

export async function update(tx: Tx, id: string, version: number, p: { rhythmus?: Rhythmus; adresse?: string; aktiv?: boolean }): Promise<Row | null> {
  return (await tx.query<Row>(
    `UPDATE ppm.schnittstelle SET rhythmus = coalesce($3, rhythmus), adresse = coalesce($4, adresse), aktiv = coalesce($5, aktiv)
     WHERE id = $1 AND version = $2 RETURNING ${COLS}`,
    [id, version, p.rhythmus ?? null, p.adresse ?? null, p.aktiv ?? null])).rows[0] ?? null;
}

/** Letzter Lauf je Schnittstelle (für die Liste). */
export async function letzteLaeufe(tx: Tx): Promise<Map<string, LaufRow>> {
  const rows = (await tx.query<LaufRow>(`SELECT DISTINCT ON (l.schnittstelle_id) ${LAUF} ORDER BY l.schnittstelle_id, l.start DESC, l.id`)).rows;
  return new Map(rows.map(r => [r.schnittstelle_id, r]));
}

export async function laeufe(tx: Tx, schnittstelleId: string, o: { after?: { start: string; id: string }; limit: number }): Promise<LaufRow[]> {
  return (await tx.query<LaufRow>(
    `SELECT ${LAUF} WHERE l.schnittstelle_id = $1 AND ($2::timestamptz IS NULL OR (l.start, l.id) < ($2, $3::uuid))
     ORDER BY l.start DESC, l.id DESC LIMIT $4`,
    [schnittstelleId, o.after?.start ?? null, o.after?.id ?? null, o.limit + 1])).rows;
}

export async function lauf(tx: Tx, id: string): Promise<LaufRow | null> {
  return (await tx.query<LaufRow>(`SELECT ${LAUF} WHERE l.id = $1`, [id])).rows[0] ?? null;
}

/** Lauf beginnen; `null`, wenn für die Schnittstelle schon einer läuft. */
export async function laufBeginnen(tx: Tx, schnittstelleId: string, art: LaufArt): Promise<string | null> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ppm.schnittstelle_lauf (tenant_id, schnittstelle_id, art) VALUES (app.tenant_id(), $1, $2)
     ON CONFLICT (tenant_id, schnittstelle_id) WHERE stand = 'laeuft' DO NOTHING RETURNING id`,
    [schnittstelleId, art])).rows[0]?.id ?? null;
}

export async function laufAbschliessen(tx: Tx, id: string, e: { umfang: number | null; fehler: string | null }): Promise<void> {
  await tx.query(
    `UPDATE ppm.schnittstelle_lauf SET stand = CASE WHEN $3::text IS NULL THEN 'erfolgreich' ELSE 'fehlgeschlagen' END, ende = now(),
       umfang = $2, fehler = $3 WHERE id = $1 AND stand = 'laeuft'`,
    [id, e.umfang, e.fehler]);
}

/** Läufe ohne Rückmeldung (Absturz des Prozesses) abbrechen; liefert die betroffenen Schnittstellen. */
export async function haengendeAbbrechen(tx: Tx): Promise<string[]> {
  return (await tx.query<{ schnittstelle_id: string }>(
    `UPDATE ppm.schnittstelle_lauf SET stand = 'fehlgeschlagen', ende = now(), fehler = 'Lauf abgebrochen: keine Rückmeldung innert einer Stunde.'
     WHERE stand = 'laeuft' AND start < now() - interval '1 hour' RETURNING schnittstelle_id`)).rows.map(r => r.schnittstelle_id);
}

/**
 * Fällige Schnittstellen: aktiv, mit Rhythmus, und im laufenden Tag, in der Woche bzw. im Monat (Europe/Zurich) noch
 * ohne geplanten oder von Hand gestarteten Lauf (der Testlauf zählt nicht).
 */
export async function faellige(tx: Tx): Promise<string[]> {
  return (await tx.query<{ id: string }>(
    `SELECT s.id FROM ppm.schnittstelle s
     WHERE s.aktiv AND s.rhythmus <> 'manuell' AND NOT EXISTS (
       SELECT 1 FROM ppm.schnittstelle_lauf l WHERE l.tenant_id = s.tenant_id AND l.schnittstelle_id = s.id AND l.art <> 'test'
         AND l.start >= date_trunc(CASE s.rhythmus WHEN 'taeglich' THEN 'day' WHEN 'woechentlich' THEN 'week' ELSE 'month' END,
                                   now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich')
     ORDER BY s.umsystem, s.daten`)).rows.map(r => r.id);
}

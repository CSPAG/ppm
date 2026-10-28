/**
 * Datenzugriff des Quartalsreportings (BC ZM.03.02; AP-E6-4). Läuft immer in einer Transaktion mit Mandantenkontext; die
 * Lesesicht (RLS) filtert. Für den Entwurf liest das Modul Daten anderer Module nur lesend und hält ihren Stand bei
 * Erzeugung im Bericht fest (docs/fachmodell.md 1.1): die zur Weiterleitung an den VR markierten Entscheide (`sitzung`,
 * UC-006 A4). Die Portfolioberichte kommen über die Schnittstelle von `auswertung`.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { KommentareOut } from './quartal-schemas.ts';

const Q = `${SCHEMA}.quartalsbericht`;
const A = `${SCHEMA}.quartalsbericht_auftrag`;
const W = `${SCHEMA}.vr_weiterleitung`;

export type Stand = 'in_arbeit' | 'traktandiert' | 'verabschiedet';

export interface BerichtRow {
  id: string; quartal: string; stand: Stand; inhalt: Record<string, unknown>; erzeugt_at: Date; kommentare: Partial<KommentareOut>;
  rueckmeldung_prat: string; traktandiert_at: Date | null; verabschiedet_at: Date | null; vr_rueckmeldung: string;
  vr_rueckmeldung_at: Date | null; version: number;
}
const COLS = `id, quartal, stand, inhalt, erzeugt_at, kommentare, rueckmeldung_prat, traktandiert_at, verabschiedet_at, vr_rueckmeldung,
  vr_rueckmeldung_at, version`;

export async function bericht(tx: Tx, quartal: string): Promise<BerichtRow | null> {
  return (await tx.query<BerichtRow>(`SELECT ${COLS} FROM ${Q} WHERE quartal = $1`, [quartal])).rows[0] ?? null;
}

export async function berichtVonId(tx: Tx, id: string): Promise<BerichtRow | null> {
  return (await tx.query<BerichtRow>(`SELECT ${COLS} FROM ${Q} WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Sperrt den Bericht bis zum Ende der Transaktion (Handlungen nacheinander). */
export async function sperren(tx: Tx, quartal: string): Promise<void> {
  await tx.query(`SELECT 1 FROM ${Q} WHERE quartal = $1 FOR UPDATE`, [quartal]);
}

export async function liste(tx: Tx): Promise<Pick<BerichtRow, 'id' | 'quartal' | 'stand' | 'erzeugt_at' | 'verabschiedet_at'>[]> {
  return (await tx.query<Pick<BerichtRow, 'id' | 'quartal' | 'stand' | 'erzeugt_at' | 'verabschiedet_at'>>(
    `SELECT id, quartal, stand, erzeugt_at, verabschiedet_at FROM ${Q} ORDER BY quartal DESC LIMIT 40`)).rows;
}

export async function anlegen(tx: Tx, quartal: string, inhalt: unknown): Promise<string> {
  return (await tx.query<{ id: string }>(`INSERT INTO ${Q} (tenant_id, quartal, inhalt) VALUES (app.tenant_id(), $1, $2) RETURNING id`, [quartal, inhalt])).rows[0]!.id;
}

/** Neu erzeugen im Stand «in Arbeit»; Kommentare bleiben. */
export async function erneuern(tx: Tx, id: string, inhalt: unknown): Promise<void> {
  await tx.query(`UPDATE ${Q} SET inhalt = $2, erzeugt_at = now() WHERE id = $1`, [id, inhalt]);
}

export async function kommentareSetzen(tx: Tx, id: string, version: number, kommentare: Partial<KommentareOut>): Promise<boolean> {
  return ((await tx.query(`UPDATE ${Q} SET kommentare = kommentare || $3::jsonb WHERE id = $1 AND version = $2`, [id, version, kommentare])).rowCount ?? 0) > 0;
}

/** Stand setzen (mit Zeitpunkten); `version` nur bei Handlungen mit If-Match. */
export async function standSetzen(tx: Tx, id: string, stand: Stand, o: { version?: number; rueckmeldungPrat?: string } = {}): Promise<boolean> {
  const args: unknown[] = [id, stand];
  let extra = '';
  if (o.rueckmeldungPrat !== undefined) { args.push(o.rueckmeldungPrat); extra += `, rueckmeldung_prat = btrim($${args.length})`; }
  let where = 'id = $1';
  if (o.version !== undefined) { args.push(o.version); where += ` AND version = $${args.length}`; }
  return ((await tx.query(
    `UPDATE ${Q} SET stand = $2,
       traktandiert_at = CASE WHEN $2 = 'traktandiert' THEN now() WHEN $2 = 'in_arbeit' THEN NULL ELSE traktandiert_at END,
       verabschiedet_at = CASE WHEN $2 = 'verabschiedet' THEN coalesce(verabschiedet_at, now()) ELSE NULL END${extra}
     WHERE ${where}`, args)).rowCount ?? 0) > 0;
}

export async function vrRueckmeldungSetzen(tx: Tx, id: string, version: number, text: string): Promise<boolean> {
  return ((await tx.query(`UPDATE ${Q} SET vr_rueckmeldung = btrim($3), vr_rueckmeldung_at = now() WHERE id = $1 AND version = $2`, [id, version, text])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Aufträge des VR

export interface AuftragRow { id: string; quartalsbericht_id: string; text: string; verantwortlich: string; termin: string | null; erledigt_at: Date | null }
const A_COLS = `id, quartalsbericht_id, text, verantwortlich, to_char(termin, 'YYYY-MM-DD') AS termin, erledigt_at`;

export async function auftraege(tx: Tx, berichtId: string): Promise<AuftragRow[]> {
  return (await tx.query<AuftragRow>(`SELECT ${A_COLS} FROM ${A} WHERE quartalsbericht_id = $1 ORDER BY created_at, id`, [berichtId])).rows;
}

export async function auftrag(tx: Tx, id: string): Promise<AuftragRow | null> {
  return (await tx.query<AuftragRow>(`SELECT ${A_COLS} FROM ${A} WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function auftragAnlegen(tx: Tx, berichtId: string, a: { text: string; verantwortlich: string; termin: string | null }): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${A} (tenant_id, quartalsbericht_id, text, verantwortlich, termin) VALUES (app.tenant_id(), $1, btrim($2), $3, $4) RETURNING id`,
    [berichtId, a.text, a.verantwortlich, a.termin])).rows[0]!.id;
}

export async function auftragErledigen(tx: Tx, id: string): Promise<boolean> {
  return ((await tx.query(`UPDATE ${A} SET erledigt_at = now(), erledigt_by = app.principal_id() WHERE id = $1 AND erledigt_at IS NULL`, [id])).rowCount ?? 0) > 0;
}

export async function personVorhanden(tx: Tx, id: string): Promise<boolean> {
  return (await tx.query(`SELECT 1 FROM ${SCHEMA}.principal WHERE id = $1 AND kind = 'user' AND removed_at IS NULL`, [id])).rowCount === 1;
}

// ---------------------------------------------------------------- Quellen des Entwurfs (nur lesen)

/** Portfolios mit Berichtspflicht (A und B; A-07), in der Reihenfolge der Kategorie. */
export async function portfolios(tx: Tx): Promise<{ id: string; name: string; kategorie: string }[]> {
  return (await tx.query<{ id: string; name: string; kategorie: string }>(
    `SELECT id, name, kategorie FROM ${SCHEMA}.portfolio WHERE pflichten ORDER BY kategorie, name, id`)).rows;
}

/** Portfolio des PRAT: das erste der Kategorie A (Transformation, Q8 Kap. 8.7). */
export async function portfolioA(tx: Tx): Promise<string | null> {
  return (await tx.query<{ id: string }>(`SELECT id FROM ${SCHEMA}.portfolio WHERE kategorie = 'A' ORDER BY name, id LIMIT 1`)).rows[0]?.id ?? null;
}

export interface WeiterleitungRow {
  entscheid_id: string; datum: string; gremium: string; titel: string; ergebnis: string; begruendung: string;
  weitergeleitet_am: string | null; bemerkung: string;
}

/** Im Gremium zur Weiterleitung an den VR markierte Entscheide mit Sitzung im Zeitraum (UC-006 A4), mit ausserordentlicher Weiterleitung (A-03). */
export async function weiterleitungen(tx: Tx, von: string, bis: string): Promise<WeiterleitungRow[]> {
  return (await tx.query<WeiterleitungRow>(
    `SELECT e.id AS entscheid_id, to_char(s.datum, 'YYYY-MM-DD') AS datum, upper(g.kuerzel) AS gremium, t.titel, e.ergebnis, e.begruendung,
            to_char(w.weitergeleitet_am, 'YYYY-MM-DD') AS weitergeleitet_am, coalesce(w.bemerkung, '') AS bemerkung
       FROM ${SCHEMA}.entscheid e
       JOIN ${SCHEMA}.traktandum t ON t.id = e.traktandum_id
       JOIN ${SCHEMA}.sitzung s ON s.id = e.sitzung_id
       JOIN ${SCHEMA}.gremium g ON g.id = s.gremium_id
       LEFT JOIN ${W} w ON w.entscheid_id = e.id
      WHERE e.an_vr AND s.datum BETWEEN $1::date AND $2::date
      ORDER BY s.datum, t.position NULLS LAST, e.id`, [von, bis])).rows;
}

export async function entscheidAnVr(tx: Tx, id: string): Promise<{ an_vr: boolean } | null> {
  return (await tx.query<{ an_vr: boolean }>(`SELECT an_vr FROM ${SCHEMA}.entscheid WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function weiterleitungAnlegen(tx: Tx, entscheidId: string, am: string, bemerkung: string): Promise<boolean> {
  return ((await tx.query(
    `INSERT INTO ${W} (tenant_id, entscheid_id, weitergeleitet_am, bemerkung) VALUES (app.tenant_id(), $1, $2, btrim($3)) ON CONFLICT DO NOTHING`,
    [entscheidId, am, bemerkung])).rowCount ?? 0) > 0;
}

export async function weiterleitungEntfernen(tx: Tx, entscheidId: string): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${W} WHERE entscheid_id = $1`, [entscheidId])).rowCount ?? 0) > 0;
}

/** Heute in der Schweiz (YYYY-MM-DD). */
export async function heute(tx: Tx): Promise<string> {
  return (await tx.query<{ d: string }>("SELECT to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYY-MM-DD') AS d")).rows[0]!.d;
}

/**
 * Datenzugriff der Sitzungen (BC PP.04.01, PP.04.05). Läuft immer in einer Transaktion mit Mandantenkontext; was die
 * Person nicht sehen darf, filtert die Lesesicht (RLS). Gremium, Sitzungstermin, Projekt und Projektorganisation werden
 * nur gelesen (unter der Lesesicht der Person); ihre Module bieten dafür noch keine Funktion an (Folgearbeit).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Art } from './arten.ts';

const S = `${SCHEMA}.sitzung`;
const T = `${SCHEMA}.traktandum`;
const E = `${SCHEMA}.einladung`;
const U = `${SCHEMA}.unterlage`;

export type SitzungStand = 'geplant' | 'in_vorbereitung' | 'versendet' | 'laufend' | 'geschlossen' | 'protokoll_versendet';
export type TraktandumStand = 'vorgeschlagen' | 'traktandiert' | 'verschoben' | 'entschieden';

// --- Gremium, Termin, Projekt (gelesen) ---------------------------------------------------------------------------

export interface GremiumRow { id: string; portfolio_id: string; kuerzel: string; name: string; art: 'entscheidend' | 'extern' }

export async function gremiumNachKuerzel(tx: Tx, kuerzel: string): Promise<GremiumRow | null> {
  return (await tx.query<GremiumRow>(`SELECT id, portfolio_id, kuerzel, name, art FROM ${SCHEMA}.gremium WHERE kuerzel = $1`, [kuerzel])).rows[0] ?? null;
}

export async function gremium(tx: Tx, id: string): Promise<GremiumRow | null> {
  return (await tx.query<GremiumRow>(`SELECT id, portfolio_id, kuerzel, name, art FROM ${SCHEMA}.gremium WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Geplante Termine des Gremiums ('YYYY-MM-DD'), aufsteigend. */
export async function termine(tx: Tx, gremiumId: string, o: { von?: string; bis?: string; nach?: string } = {}): Promise<string[]> {
  const args: unknown[] = [gremiumId];
  const where = ['gremium_id = $1'];
  if (o.von) { args.push(o.von); where.push(`datum >= $${args.length}::date`); }
  if (o.bis) { args.push(o.bis); where.push(`datum <= $${args.length}::date`); }
  if (o.nach) { args.push(o.nach); where.push(`datum > $${args.length}::date`); }
  return (await tx.query<{ d: string }>(`SELECT to_char(datum, 'YYYY-MM-DD') AS d FROM ${SCHEMA}.sitzungstermin WHERE ${where.join(' AND ')} ORDER BY datum`, args)).rows.map(r => r.d);
}

/** Termine entscheidender Gremien im Zeitraum (Lauf der Fristen; volle Sicht). */
export async function termineAlle(tx: Tx, von: string, bis: string): Promise<{ gremium: GremiumRow; datum: string }[]> {
  return (await tx.query<GremiumRow & { datum: string }>(
    `SELECT g.id, g.portfolio_id, g.kuerzel, g.name, g.art, to_char(t.datum, 'YYYY-MM-DD') AS datum
       FROM ${SCHEMA}.sitzungstermin t JOIN ${SCHEMA}.gremium g ON g.tenant_id = t.tenant_id AND g.id = t.gremium_id
      WHERE g.art = 'entscheidend' AND t.datum BETWEEN $1::date AND $2::date ORDER BY t.datum, g.kuerzel`, [von, bis])).rows
    .map(({ datum, ...g }) => ({ gremium: g, datum }));
}

export interface ProjektKurz { id: string; nummer: string; name: string; phase: string; portfolio_id: string; vertraulich: boolean }

export async function projekt(tx: Tx, id: string): Promise<ProjektKurz | null> {
  return (await tx.query<ProjektKurz>(`SELECT id, nummer, name, phase, portfolio_id, vertraulich FROM ${SCHEMA}.projekt WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Projektleitung und Projektauftraggeber:in des Projekts (Einladung je Geschäft, UC-006 Schritt 2). */
export async function projektleitung(tx: Tx, projektId: string): Promise<{ person_id: string; funktion: 'sp' | 'pl' }[]> {
  return (await tx.query<{ person_id: string; funktion: 'sp' | 'pl' }>(
    `SELECT person_id, funktion FROM ${SCHEMA}.projekt_person WHERE projekt_id = $1 AND funktion IN ('pl', 'sp')
      ORDER BY array_position(ARRAY['pl', 'sp'], funktion)`, [projektId])).rows;
}

/**
 * Arbeitstage von `von` (ausschliesslich) bis `bis` (einschliesslich), negativ wenn `bis` davor liegt: Montag bis
 * Freitag ohne die Feiertage der Organisation (A-43). Das Phasenmodell exportiert nur das Datum einer Frist
 * (`fristDatum`); die Zahl der Arbeitstage («Versand in 4 Arbeitstagen», Vorlauf K3-1) rechnet die Datenbank hier.
 */
export async function arbeitstageBis(tx: Tx, von: string, bis: string): Promise<number> {
  const [a, b, vz] = von <= bis ? [von, bis, 1] : [bis, von, -1];
  return vz * (await tx.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM generate_series($1::date + 1, $2::date, interval '1 day') AS d(t)
      WHERE extract(isodow FROM d.t) < 6 AND NOT EXISTS (SELECT 1 FROM ${SCHEMA}.feiertag f WHERE f.datum = d.t::date)`, [a, b])).rows[0]!.n;
}

/** Person der Organisation (nicht entfernt)? */
export async function personBekannt(tx: Tx, id: string): Promise<boolean> {
  return (await tx.query(`SELECT 1 FROM ${SCHEMA}.principal WHERE id = $1 AND kind = 'user' AND removed_at IS NULL`, [id])).rowCount === 1;
}

// --- Sitzung ------------------------------------------------------------------------------------------------------

export interface SitzungRow {
  id: string; portfolio_id: string; gremium_id: string; datum: string; beginn: string | null; dauer_min: number | null; ort: string;
  stand: SitzungStand; versendet_at: Date | null; versendet_by: string | null; versand_vorlauf: number | null;
  geschlossen_at: Date | null; protokoll_versendet_at: Date | null; version: number; created_at: Date; updated_at: Date;
  gremium_kuerzel: string; gremium_name: string;
  /** Zuletzt nach dem Versand geändert (A-75). */
  geaendert_nach_versand_at: Date | null;
}

const SCOLS = `s.id, s.geaendert_nach_versand_at, s.portfolio_id, s.gremium_id, to_char(s.datum, 'YYYY-MM-DD') AS datum, to_char(s.beginn, 'HH24:MI') AS beginn,
  s.dauer_min, s.ort, s.stand, s.versendet_at, s.versendet_by, s.versand_vorlauf, s.geschlossen_at, s.protokoll_versendet_at,
  s.version, s.created_at, s.updated_at, g.kuerzel AS gremium_kuerzel, g.name AS gremium_name`;
const SFROM = `${S} s JOIN ${SCHEMA}.gremium g ON g.tenant_id = s.tenant_id AND g.id = s.gremium_id`;

export async function getSitzung(tx: Tx, id: string): Promise<SitzungRow | null> {
  return (await tx.query<SitzungRow>(`SELECT ${SCOLS} FROM ${SFROM} WHERE s.id = $1`, [id])).rows[0] ?? null;
}

export async function sitzungAm(tx: Tx, gremiumId: string, datum: string): Promise<SitzungRow | null> {
  return (await tx.query<SitzungRow>(`SELECT ${SCOLS} FROM ${SFROM} WHERE s.gremium_id = $1 AND s.datum = $2::date`, [gremiumId, datum])).rows[0] ?? null;
}

/** Sitzungen des Gremiums im Zeitraum, aufsteigend (mit Zahl der Traktanden). */
export async function sitzungenVon(tx: Tx, gremiumId: string, o: { von?: string; bis?: string }): Promise<(SitzungRow & { traktanden: number })[]> {
  const args: unknown[] = [gremiumId];
  const where = ['s.gremium_id = $1'];
  if (o.von) { args.push(o.von); where.push(`s.datum >= $${args.length}::date`); }
  if (o.bis) { args.push(o.bis); where.push(`s.datum <= $${args.length}::date`); }
  return (await tx.query<SitzungRow & { traktanden: number }>(
    `SELECT ${SCOLS}, (SELECT count(*)::int FROM ${T} t WHERE t.sitzung_id = s.id AND t.stand IN ('traktandiert', 'entschieden')) AS traktanden
       FROM ${SFROM} WHERE ${where.join(' AND ')} ORDER BY s.datum`, args)).rows;
}

/** Sitzung anlegen; ohne RETURNING der Join-Spalten (danach lesen). */
export async function createSitzung(tx: Tx, g: GremiumRow, datum: string): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${S} (tenant_id, portfolio_id, gremium_id, datum) VALUES (app.tenant_id(), $1, $2, $3::date) RETURNING id`,
    [g.portfolio_id, g.id, datum])).rows[0]!.id;
}

export async function updateSitzung(tx: Tx, id: string, version: number, p: { beginn?: string | null; dauerMin?: number | null; ort?: string }): Promise<boolean> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  if (p.beginn !== undefined) { args.push(p.beginn); sets.push(`beginn = $${args.length}::time`); }
  if (p.dauerMin !== undefined) { args.push(p.dauerMin); sets.push(`dauer_min = $${args.length}`); }
  if (p.ort !== undefined) { args.push(p.ort.trim()); sets.push(`ort = $${args.length}`); }
  return ((await tx.query(`UPDATE ${S} SET ${sets.join(', ')} WHERE id = $1 AND version = $2`, args)).rowCount ?? 0) > 0;
}

/** Neue Version der Sitzung (Traktandenliste geändert) und «in Vorbereitung», solange nicht versendet. */
export async function touchSitzung(tx: Tx, id: string, version?: number): Promise<number | null> {
  const r = await tx.query<{ version: number }>(
    `UPDATE ${S} SET stand = CASE WHEN stand = 'geplant' THEN 'in_vorbereitung' ELSE stand END
      WHERE id = $1 ${version === undefined ? '' : 'AND version = $2'} RETURNING version`, version === undefined ? [id] : [id, version]);
  return r.rows[0]?.version ?? null;
}

export async function markVersendet(tx: Tx, id: string, version: number, vorlauf: number): Promise<boolean> {
  const n = (await tx.query(
    `UPDATE ${S} SET stand = 'versendet', versendet_at = now(), versendet_by = app.principal_id(), versand_vorlauf = $3
      WHERE id = $1 AND version = $2 AND stand IN ('geplant', 'in_vorbereitung')`, [id, version, vorlauf])).rowCount ?? 0;
  if (!n) return false;
  await tx.query(`UPDATE ${T} SET versendet_at = now() WHERE sitzung_id = $1 AND stand = 'traktandiert'`, [id]);
  await tx.query(`UPDATE ${E} e SET versendet_at = now() WHERE e.sitzung_id = $1`, [id]);
  return true;
}

// --- Traktandum ---------------------------------------------------------------------------------------------------

export interface TraktandumRow {
  id: string; portfolio_id: string; gremium_id: string; sitzung_id: string | null; art: Art; bezug_typ: string; bezug_id: string;
  projekt_id: string | null; titel: string; antrag: string; position: number | null; dauer_min: number | null; stand: TraktandumStand;
  via_sns: boolean; vertraulich: boolean; verschoben_von: string | null; versendet_at: Date | null; version: number;
  created_at: Date; updated_at: Date;
  /** Zuletzt nach dem Versand geändert (A-75). */
  geaendert_nach_versand_at: Date | null;
  projekt_nummer: string | null; projekt_name: string | null; projekt_phase: string | null; verschoben_von_datum: string | null;
}

const TCOLS = `t.id, t.geaendert_nach_versand_at, t.portfolio_id, t.gremium_id, t.sitzung_id, t.art, t.bezug_typ, t.bezug_id, t.projekt_id, t.titel, t.antrag,
  t.position, t.dauer_min, t.stand, t.via_sns, t.vertraulich, t.verschoben_von, t.versendet_at, t.version, t.created_at, t.updated_at,
  p.nummer AS projekt_nummer, p.name AS projekt_name, p.phase AS projekt_phase,
  (SELECT to_char(v.datum, 'YYYY-MM-DD') FROM ${S} v WHERE v.id = t.verschoben_von) AS verschoben_von_datum`;
const TFROM = `${T} t LEFT JOIN ${SCHEMA}.projekt p ON p.tenant_id = t.tenant_id AND p.id = t.projekt_id`;

export async function getTraktandum(tx: Tx, id: string): Promise<TraktandumRow | null> {
  return (await tx.query<TraktandumRow>(`SELECT ${TCOLS} FROM ${TFROM} WHERE t.id = $1`, [id])).rows[0] ?? null;
}

/** Traktandenliste der Sitzung in ihrer Reihenfolge. */
export async function traktanden(tx: Tx, sitzungId: string): Promise<TraktandumRow[]> {
  return (await tx.query<TraktandumRow>(
    `SELECT ${TCOLS} FROM ${TFROM} WHERE t.sitzung_id = $1 AND t.stand IN ('traktandiert', 'entschieden') ORDER BY t.position, t.created_at`, [sitzungId])).rows;
}

/** Vorschläge einer Sitzung: ohne Sitzung für das Gremium und auf diese Sitzung verschobene (UC-006 Schritt 1, A2). */
export async function vorschlaege(tx: Tx, s: { id: string; gremium_id: string }): Promise<TraktandumRow[]> {
  return (await tx.query<TraktandumRow>(
    `SELECT ${TCOLS} FROM ${TFROM}
      WHERE (t.sitzung_id IS NULL AND t.gremium_id = $2 AND t.stand = 'vorgeschlagen')
         OR (t.sitzung_id = $1 AND t.stand IN ('vorgeschlagen', 'verschoben'))
      ORDER BY t.created_at, t.id`, [s.id, s.gremium_id])).rows;
}

export interface TraktandumNeu {
  portfolioId: string; gremiumId: string; sitzungId: string | null; art: Art; bezugTyp: string; bezugId: string; projektId: string | null;
  titel: string; antrag: string; dauerMin: number | null; stand: TraktandumStand; position: number | null; viaSns: boolean; vertraulich: boolean;
}

export async function createTraktandum(tx: Tx, n: TraktandumNeu): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${T} (tenant_id, portfolio_id, gremium_id, sitzung_id, art, bezug_typ, bezug_id, projekt_id, titel, antrag, dauer_min,
                       stand, position, via_sns, vertraulich)
     VALUES (app.tenant_id(), $1, $2, $3, $4, $5, $6, $7, btrim($8), btrim($9), $10, $11, $12, $13, $14) RETURNING id`,
    [n.portfolioId, n.gremiumId, n.sitzungId, n.art, n.bezugTyp, n.bezugId, n.projektId, n.titel, n.antrag, n.dauerMin, n.stand,
      n.position, n.viaSns, n.vertraulich])).rows[0]!.id;
}

/** Offenes Traktandum zum Geschäft (Vorschlagen ist idempotent). */
export async function offenesTraktandum(tx: Tx, art: Art, bezugTyp: string, bezugId: string): Promise<{ id: string; sitzung_id: string | null; stand: TraktandumStand } | null> {
  return (await tx.query<{ id: string; sitzung_id: string | null; stand: TraktandumStand }>(
    `SELECT id, sitzung_id, stand FROM ${T} WHERE art = $1 AND bezug_typ = $2 AND bezug_id = $3 AND stand <> 'entschieden'`,
    [art, bezugTyp, bezugId])).rows[0] ?? null;
}

export async function updateTraktandum(tx: Tx, id: string, version: number, p: { titel?: string; antrag?: string; dauerMin?: number | null }): Promise<boolean> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  if (p.titel !== undefined) { args.push(p.titel.trim()); sets.push(`titel = $${args.length}`); }
  if (p.antrag !== undefined) { args.push(p.antrag.trim()); sets.push(`antrag = $${args.length}`); }
  if (p.dauerMin !== undefined) { args.push(p.dauerMin); sets.push(`dauer_min = $${args.length}`); }
  // ohne Feld nur neue Version (Einladungen geändert)
  if (!sets.length) sets.push('titel = titel');
  return ((await tx.query(`UPDATE ${T} SET ${sets.join(', ')} WHERE id = $1 AND version = $2`, args)).rowCount ?? 0) > 0;
}

/** In die Sitzung aufnehmen: zuunterst (Position = höchste + 1). */
export async function aufnehmen(tx: Tx, id: string, sitzungId: string, o: { dauerMin: number | null; viaSns: boolean }): Promise<void> {
  await tx.query(
    `UPDATE ${T} SET sitzung_id = $2, stand = 'traktandiert', verschoben_von = NULL, dauer_min = coalesce(dauer_min, $3), via_sns = $4,
            position = coalesce((SELECT max(position) FROM ${T} WHERE sitzung_id = $2 AND stand = 'traktandiert'), 0) + 1
      WHERE id = $1`, [id, sitzungId, o.dauerMin, o.viaSns]);
}

/** Traktandum löschen (Platzhalter des festen Traktandums, wenn der Bericht es ersetzt). */
export async function loeschen(tx: Tx, id: string): Promise<void> {
  await tx.query(`DELETE FROM ${E} WHERE traktandum_id = $1`, [id]);
  await tx.query(`DELETE FROM ${T} WHERE id = $1`, [id]);
}

/** Nächste Sitzung des Gremiums in Vorbereitung mit dem Platzhalter der Art (Bezug die Sitzung selbst). */
export async function sitzungMitPlatzhalter(tx: Tx, gremiumId: string, art: Art): Promise<SitzungRow | null> {
  return (await tx.query<SitzungRow>(
    `SELECT ${SCOLS} FROM ${SFROM}
      WHERE s.gremium_id = $1 AND s.stand IN ('geplant', 'in_vorbereitung')
        AND EXISTS (SELECT 1 FROM ${T} t WHERE t.sitzung_id = s.id AND t.art = $2 AND t.bezug_typ = 'sitzung' AND t.stand = 'traktandiert')
      ORDER BY s.datum LIMIT 1`, [gremiumId, art])).rows[0] ?? null;
}

/** Darf die Person die Traktandenliste des Portfolios bearbeiten (wie die Lesesicht: sitzung:write)? */
export async function darfTraktandenliste(tx: Tx, portfolioId: string): Promise<boolean> {
  return (await tx.query<{ ok: boolean }>('SELECT ppm.gremium_recht($1, $2) AS ok', ['sitzung:write', portfolioId])).rows[0]!.ok;
}

/** Aus der Traktandenliste nehmen: wieder Vorschlag ohne Sitzung; Einladungen entfallen. */
export async function entfernen(tx: Tx, id: string): Promise<void> {
  await tx.query(`DELETE FROM ${E} WHERE traktandum_id = $1`, [id]);
  await tx.query(`UPDATE ${T} SET sitzung_id = NULL, stand = 'vorgeschlagen', position = NULL, verschoben_von = NULL WHERE id = $1`, [id]);
}

/** Auf eine andere Sitzung verschieben (UC-006 A2): dort Vorschlag mit Herkunft; Einladungen entfallen. */
export async function verschieben(tx: Tx, id: string, von: string, nach: string): Promise<void> {
  await tx.query(`DELETE FROM ${E} WHERE traktandum_id = $1`, [id]);
  await tx.query(`UPDATE ${T} SET sitzung_id = $3, stand = 'verschoben', position = NULL, verschoben_von = $2 WHERE id = $1`, [id, von, nach]);
}

/** Positionen 1…n in der angegebenen Reihenfolge. */
export async function ordnen(tx: Tx, sitzungId: string, ids: readonly string[]): Promise<void> {
  await tx.query(
    `UPDATE ${T} t SET position = x.pos::int FROM unnest($2::uuid[]) WITH ORDINALITY AS x(id, pos)
      WHERE t.id = x.id AND t.sitzung_id = $1`, [sitzungId, ids]);
}

/** Lücken in den Positionen schliessen (nach Entfernen und Verschieben). */
export async function positionenSchliessen(tx: Tx, sitzungId: string): Promise<void> {
  await tx.query(
    `UPDATE ${T} t SET position = x.pos FROM (
       SELECT id, row_number() OVER (ORDER BY position, created_at)::int AS pos FROM ${T} WHERE sitzung_id = $1 AND stand = 'traktandiert') x
      WHERE t.id = x.id AND t.position IS DISTINCT FROM x.pos`, [sitzungId]);
}

/** Auf die Sitzung verschobene Traktanden (Information an PL und SP mit dem Versand der Herkunftssitzung). */
export async function verschobeneVon(tx: Tx, sitzungId: string): Promise<TraktandumRow[]> {
  return (await tx.query<TraktandumRow>(`SELECT ${TCOLS} FROM ${TFROM} WHERE t.verschoben_von = $1 AND t.stand = 'verschoben' ORDER BY t.created_at`, [sitzungId])).rows;
}

// --- Einladung, Unterlage -----------------------------------------------------------------------------------------

export interface EinladungRow { id: string; traktandum_id: string; person_id: string; funktion: 'sp' | 'pl' | 'weitere'; name: string | null }

export async function einladungen(tx: Tx, o: { traktandumId?: string; sitzungId?: string }): Promise<EinladungRow[]> {
  const [col, v] = o.traktandumId ? ['e.traktandum_id', o.traktandumId] : ['e.sitzung_id', o.sitzungId];
  return (await tx.query<EinladungRow>(
    `SELECT e.id, e.traktandum_id, e.person_id, e.funktion, p.display_name AS name
       FROM ${E} e LEFT JOIN ${SCHEMA}.principal p ON p.tenant_id = e.tenant_id AND p.id = e.person_id
      WHERE ${col} = $1 ORDER BY array_position(ARRAY['pl', 'sp', 'weitere'], e.funktion), p.display_name, e.id`, [v])).rows;
}

/** Einladungen eines Traktandums ersetzen. */
export async function einladungenSetzen(tx: Tx, t: { id: string; sitzung_id: string; portfolio_id: string }, personen: readonly { personId: string; funktion: EinladungRow['funktion'] }[]): Promise<void> {
  await tx.query(`DELETE FROM ${E} WHERE traktandum_id = $1`, [t.id]);
  for (const p of personen) {
    await tx.query(
      `INSERT INTO ${E} (tenant_id, traktandum_id, sitzung_id, portfolio_id, person_id, funktion) VALUES (app.tenant_id(), $1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, traktandum_id, person_id) DO NOTHING`, [t.id, t.sitzung_id, t.portfolio_id, p.personId, p.funktion]);
  }
}

export interface UnterlageRow { id: string; traktandum_id: string; art: 'packet' | 'bericht' | 'beilage'; titel: string; stand_ok: boolean; quality_check_offen: boolean; hinweis: string; inhalt: Record<string, unknown> }

export async function unterlagenGespeichert(tx: Tx, sitzungId: string): Promise<UnterlageRow[]> {
  return (await tx.query<UnterlageRow>(
    `SELECT u.id, u.traktandum_id, u.art, u.titel, u.stand_ok, u.quality_check_offen, u.hinweis, u.inhalt FROM ${U} u JOIN ${T} t ON t.tenant_id = u.tenant_id AND t.id = u.traktandum_id
      WHERE t.sitzung_id = $1 ORDER BY t.position, u.created_at, u.id`, [sitzungId])).rows;
}

export async function unterlageAnlegen(tx: Tx, traktandumId: string, u: { art: UnterlageRow['art']; titel: string; standOk: boolean; qualityCheckOffen: boolean; hinweis: string; inhalt: Record<string, unknown> }): Promise<void> {
  await tx.query(
    `INSERT INTO ${U} (tenant_id, traktandum_id, art, titel, stand_ok, quality_check_offen, hinweis, inhalt) VALUES (app.tenant_id(), $1, $2, btrim($3), $4, $5, $6, $7)`,
    [traktandumId, u.art, u.titel, u.standOk, u.qualityCheckOffen, u.hinweis, JSON.stringify(u.inhalt)]);
}

/** Je Gremium die nächste Sitzung, die die Person sieht, nach Datum (Kopf im Eingang). */
/** Je Projekt das nächste traktandierte Geschäft in einer Sitzung ab `ab`, die die Person sieht (Kopf im Eingang). */
export async function naechsteTraktanden(tx: Tx, projektIds: readonly string[], ab: string): Promise<{
  projekt_id: string; id: string; art: Art; titel: string; sitzung_id: string; datum: string; gremium_id: string; gremium_kuerzel: string; gremium_name: string;
  eingeladen: boolean;
}[]> {
  return (await tx.query(
    `SELECT DISTINCT ON (t.projekt_id) t.projekt_id, t.id, t.art, t.titel, s.id AS sitzung_id, to_char(s.datum, 'YYYY-MM-DD') AS datum,
            g.id AS gremium_id, g.kuerzel AS gremium_kuerzel, g.name AS gremium_name,
            EXISTS (SELECT 1 FROM ${E} e WHERE e.tenant_id = t.tenant_id AND e.traktandum_id = t.id AND e.person_id = app.principal_id()) AS eingeladen
       FROM ${T} t JOIN ${S} s ON s.tenant_id = t.tenant_id AND s.id = t.sitzung_id
       JOIN ${SCHEMA}.gremium g ON g.tenant_id = s.tenant_id AND g.id = s.gremium_id
      WHERE t.projekt_id = ANY ($1::uuid[]) AND t.stand = 'traktandiert' AND s.datum >= $2::date
      ORDER BY t.projekt_id, s.datum, t.position`, [projektIds, ab])).rows;
}

export async function naechsteSitzungen(tx: Tx, ab: string, limit: number): Promise<(SitzungRow & { traktanden: number })[]> {
  return (await tx.query<SitzungRow & { traktanden: number }>(
    `SELECT * FROM (
       SELECT DISTINCT ON (s.gremium_id) ${SCOLS}, g.kuerzel AS sort_kuerzel,
              (SELECT count(*)::int FROM ${T} t WHERE t.sitzung_id = s.id AND t.stand IN ('traktandiert', 'entschieden')) AS traktanden
         FROM ${SFROM} WHERE s.datum >= $1::date ORDER BY s.gremium_id, s.datum
     ) n ORDER BY n.datum, n.sort_kuerzel LIMIT $2`, [ab, limit])).rows;
}

/** Nach dem Versand geändert (A-75): Zeitpunkt an der Sitzung und, falls genannt, am Traktandum. */
export async function nachVersandMarkieren(tx: Tx, sitzungId: string, traktandumId: string | null): Promise<void> {
  await tx.query(`UPDATE ${SCHEMA}.sitzung SET geaendert_nach_versand_at = now() WHERE id = $1`, [sitzungId]);
  if (traktandumId) await tx.query(`UPDATE ${SCHEMA}.traktandum SET geaendert_nach_versand_at = now() WHERE id = $1`, [traktandumId]);
}

/** Festgehaltene Unterlagen eines Traktandums entfernen (vor einer neuen Fassung, A-75). */
export async function unterlagenLoeschen(tx: Tx, traktandumId: string): Promise<void> {
  await tx.query(`DELETE FROM ${U} WHERE traktandum_id = $1`, [traktandumId]);
}

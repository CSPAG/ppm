/**
 * Datenzugriff für Entscheide, Auflagen und Protokoll (BC PP.04.02, PS.02.02; UC-006 Schritte 6–9, A1, A3, A4; AP-E2-2).
 * Läuft in der Transaktion der Route; was die Person nicht sehen darf, filtert die Lesesicht (140_entscheid_protokoll.sql).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Art } from './arten.ts';

const S = `${SCHEMA}.sitzung`;
const T = `${SCHEMA}.traktandum`;
const EN = `${SCHEMA}.entscheid`;
const AU = `${SCHEMA}.auflage`;
const PR = `${SCHEMA}.protokoll`;

// --- Entscheid ----------------------------------------------------------------------------------------------------

export interface EntscheidRow {
  id: string; traktandum_id: string; sitzung_id: string; ergebnis: string; begruendung: string; stellungnahme: boolean; an_vr: boolean;
  sns_ergebnis: string | null; sns_begruendung: string | null; sns_erfasst_at: Date | null; erfasst_at: Date; erfasst_by: string | null;
  erfasst_von: string | null; version: number;
}

const ECOLS = `e.id, e.traktandum_id, e.sitzung_id, e.ergebnis, e.begruendung, e.stellungnahme, e.an_vr, e.sns_ergebnis, e.sns_begruendung,
  e.sns_erfasst_at, e.erfasst_at, e.erfasst_by, (SELECT p.display_name FROM ${SCHEMA}.principal p WHERE p.tenant_id = e.tenant_id AND p.id = e.erfasst_by) AS erfasst_von, e.version`;

export async function entscheidVon(tx: Tx, traktandumId: string): Promise<EntscheidRow | null> {
  return (await tx.query<EntscheidRow>(`SELECT ${ECOLS} FROM ${EN} e WHERE e.traktandum_id = $1`, [traktandumId])).rows[0] ?? null;
}

export async function getEntscheid(tx: Tx, id: string): Promise<EntscheidRow | null> {
  return (await tx.query<EntscheidRow>(`SELECT ${ECOLS} FROM ${EN} e WHERE e.id = $1`, [id])).rows[0] ?? null;
}

/** Entscheide einer Sitzung, je Traktandum. */
export async function entscheideDerSitzung(tx: Tx, sitzungId: string): Promise<Map<string, EntscheidRow>> {
  const rows = (await tx.query<EntscheidRow>(`SELECT ${ECOLS} FROM ${EN} e WHERE e.sitzung_id = $1`, [sitzungId])).rows;
  return new Map(rows.map(r => [r.traktandum_id, r]));
}

export interface EntscheidDaten { ergebnis: string; begruendung: string; stellungnahme: boolean; anVr: boolean }

export async function entscheidAnlegen(tx: Tx, t: { id: string; sitzung_id: string }, d: EntscheidDaten): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${EN} (tenant_id, traktandum_id, sitzung_id, ergebnis, begruendung, stellungnahme, an_vr)
     VALUES (app.tenant_id(), $1, $2, $3, btrim($4), $5, $6) RETURNING id`,
    [t.id, t.sitzung_id, d.ergebnis, d.begruendung, d.stellungnahme, d.anVr])).rows[0]!.id;
}

/** Entscheid korrigieren (A-30); nur mit passender Version. */
export async function entscheidKorrigieren(tx: Tx, id: string, version: number, d: EntscheidDaten): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${EN} SET ergebnis = $3, begruendung = btrim($4), stellungnahme = $5, an_vr = $6, erfasst_at = now(), erfasst_by = app.principal_id()
      WHERE id = $1 AND version = $2`, [id, version, d.ergebnis, d.begruendung, d.stellungnahme, d.anVr])).rowCount ?? 0) > 0;
}

/** Entscheid des SNS-VR nachtragen (UC-006 A1, A-02); einmal. */
export async function snsEintragen(tx: Tx, id: string, version: number, d: { ergebnis: string; begruendung: string }): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${EN} SET sns_ergebnis = $3, sns_begruendung = btrim($4), sns_erfasst_at = now(), sns_erfasst_by = app.principal_id()
      WHERE id = $1 AND version = $2 AND stellungnahme AND sns_ergebnis IS NULL`, [id, version, d.ergebnis, d.begruendung])).rowCount ?? 0) > 0;
}

export interface EntscheidVersionRow { version: number; ergebnis: string; begruendung: string; stellungnahme: boolean; an_vr: boolean; sns_ergebnis: string | null; changed_at: Date; changed_von: string | null }

export async function verlauf(tx: Tx, entscheidId: string): Promise<EntscheidVersionRow[]> {
  return (await tx.query<EntscheidVersionRow>(
    `SELECT v.version, v.ergebnis, v.begruendung, v.stellungnahme, v.an_vr, v.sns_ergebnis, v.changed_at,
            (SELECT p.display_name FROM ${SCHEMA}.principal p WHERE p.tenant_id = v.tenant_id AND p.id = v.changed_by) AS changed_von
       FROM ${SCHEMA}.entscheid_version v WHERE v.entscheid_id = $1 ORDER BY v.version`, [entscheidId])).rows;
}

/** Traktandum als entschieden markieren (bzw. zurück auf traktandiert ist nicht vorgesehen: Korrektur ändert den Entscheid). */
export async function traktandumEntschieden(tx: Tx, id: string): Promise<void> {
  await tx.query(`UPDATE ${T} SET stand = 'entschieden' WHERE id = $1 AND stand <> 'entschieden'`, [id]);
}

// --- Auflage ------------------------------------------------------------------------------------------------------

export interface AuflageRow {
  id: string; entscheid_id: string; position: number; text: string; verantwortlich: string; verantwortlich_name: string | null;
  termin: string; stand: 'offen' | 'erfuellt'; erfuellt_at: Date | null;
  /** Portfolio des Traktandums, sofern die Person den Entscheid sieht */
  portfolio_id: string | null;
}

const ACOLS = `a.id, a.entscheid_id, a.position, a.text, a.verantwortlich,
  (SELECT p.display_name FROM ${SCHEMA}.principal p WHERE p.tenant_id = a.tenant_id AND p.id = a.verantwortlich) AS verantwortlich_name,
  to_char(a.termin, 'YYYY-MM-DD') AS termin, a.stand, a.erfuellt_at,
  (SELECT t.portfolio_id FROM ${EN} e JOIN ${T} t ON t.tenant_id = e.tenant_id AND t.id = e.traktandum_id WHERE e.id = a.entscheid_id) AS portfolio_id`;

export async function auflagen(tx: Tx, entscheidIds: readonly string[]): Promise<AuflageRow[]> {
  if (!entscheidIds.length) return [];
  return (await tx.query<AuflageRow>(`SELECT ${ACOLS} FROM ${AU} a WHERE a.entscheid_id = ANY($1::uuid[]) ORDER BY a.entscheid_id, a.position`, [entscheidIds])).rows;
}

export async function getAuflage(tx: Tx, id: string): Promise<AuflageRow | null> {
  return (await tx.query<AuflageRow>(`SELECT ${ACOLS} FROM ${AU} a WHERE a.id = $1`, [id])).rows[0] ?? null;
}

export interface AuflageNeu { text: string; verantwortlich: string; termin: string }

/** Auflagen eines Entscheids ersetzen (bis zum Schliessen; Aufgaben entstehen erst beim Schliessen). */
export async function auflagenSetzen(tx: Tx, entscheidId: string, liste: readonly AuflageNeu[]): Promise<void> {
  await tx.query(`DELETE FROM ${AU} WHERE entscheid_id = $1`, [entscheidId]);
  for (const [i, a] of liste.entries()) {
    await tx.query(
      `INSERT INTO ${AU} (tenant_id, entscheid_id, position, text, verantwortlich, termin) VALUES (app.tenant_id(), $1, $2, btrim($3), $4, $5::date)`,
      [entscheidId, i + 1, a.text, a.verantwortlich, a.termin]);
  }
}

export async function auflageErfuellen(tx: Tx, id: string): Promise<boolean> {
  return ((await tx.query(`UPDATE ${AU} SET stand = 'erfuellt', erfuellt_at = now(), erfuellt_by = app.principal_id() WHERE id = $1 AND stand = 'offen'`, [id])).rowCount ?? 0) > 0;
}

// --- Liste der Entscheide (UI-36) ---------------------------------------------------------------------------------

export interface EntscheidListeRow extends EntscheidRow {
  art: Art; titel: string; antrag: string; via_sns: boolean; vertraulich: boolean; projekt_id: string | null; projekt_nummer: string | null; projekt_name: string | null;
  sitzung_datum: string; sitzung_stand: string; gremium_kuerzel: string; gremium_name: string; position: number | null;
}

export interface EntscheidFilter { projektId?: string; gremium?: string; anVr?: boolean; auflagenOffen?: boolean; nach?: { d: string; p: number; id: string }; limit: number }

/** Entscheide, neueste Sitzung zuerst, darin nach Position (Cursor über Datum, Position, ID). */
export async function entscheidListe(tx: Tx, f: EntscheidFilter): Promise<EntscheidListeRow[]> {
  const args: unknown[] = [];
  const where: string[] = [];
  const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };
  if (f.projektId) where.push(`t.projekt_id = ${arg(f.projektId)}`);
  if (f.gremium) where.push(`g.kuerzel = ${arg(f.gremium)}`);
  if (f.anVr !== undefined) where.push(`e.an_vr = ${arg(f.anVr)}`);
  if (f.auflagenOffen) where.push(`EXISTS (SELECT 1 FROM ${AU} a WHERE a.entscheid_id = e.id AND a.stand = 'offen')`);
  if (f.nach) where.push(`(s.datum, -coalesce(t.position, 0), e.id) < (${arg(f.nach.d)}::date, ${arg(-f.nach.p)}::int, ${arg(f.nach.id)}::uuid)`);
  return (await tx.query<EntscheidListeRow>(
    `SELECT ${ECOLS}, t.art, t.titel, t.antrag, t.via_sns, t.vertraulich, t.projekt_id, p.nummer AS projekt_nummer, p.name AS projekt_name,
            to_char(s.datum, 'YYYY-MM-DD') AS sitzung_datum, s.stand AS sitzung_stand, g.kuerzel AS gremium_kuerzel, g.name AS gremium_name, t.position
       FROM ${EN} e
       JOIN ${T} t ON t.tenant_id = e.tenant_id AND t.id = e.traktandum_id
       JOIN ${S} s ON s.tenant_id = e.tenant_id AND s.id = e.sitzung_id
       JOIN ${SCHEMA}.gremium g ON g.tenant_id = s.tenant_id AND g.id = s.gremium_id
       LEFT JOIN ${SCHEMA}.projekt p ON p.tenant_id = t.tenant_id AND p.id = t.projekt_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY s.datum DESC, -coalesce(t.position, 0) DESC, e.id DESC LIMIT ${arg(f.limit + 1)}`, args)).rows;
}

// --- Sitzung durchführen und schliessen -----------------------------------------------------------------------------

/** Sitzung starten (UC-006 Schritt 6): versendet → laufend. */
export async function sitzungStarten(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`UPDATE ${S} SET stand = 'laufend' WHERE id = $1 AND version = $2 AND stand = 'versendet'`, [id, version])).rowCount ?? 0) > 0;
}

export async function sitzungSchliessen(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`UPDATE ${S} SET stand = 'geschlossen', geschlossen_at = now() WHERE id = $1 AND version = $2 AND stand = 'laufend'`, [id, version])).rowCount ?? 0) > 0;
}

export async function protokollVersendetMarkieren(tx: Tx, sitzungId: string): Promise<void> {
  await tx.query(`UPDATE ${S} SET stand = 'protokoll_versendet', protokoll_versendet_at = now() WHERE id = $1 AND stand = 'geschlossen'`, [sitzungId]);
}

/**
 * Nicht behandeltes Traktandum (UC-006 Schritt 9) für die nächste Sitzung vorschlagen: wieder Vorschlag des Gremiums ohne
 * Sitzung, mit Herkunft; Einladungen und festgehaltene Unterlagen entfallen (der nächste Versand hält sie neu fest).
 */
export async function nichtBehandeltVorschlagen(tx: Tx, traktandumId: string, sitzungId: string): Promise<void> {
  await tx.query(`DELETE FROM ${SCHEMA}.einladung WHERE traktandum_id = $1`, [traktandumId]);
  await tx.query(`DELETE FROM ${SCHEMA}.unterlage WHERE traktandum_id = $1`, [traktandumId]);
  await tx.query(
    `UPDATE ${T} SET sitzung_id = NULL, stand = 'vorgeschlagen', position = NULL, verschoben_von = $2, versendet_at = NULL WHERE id = $1`,
    [traktandumId, sitzungId]);
}

/** Zurückgestelltes Geschäft (UC-006 A3) als neuen Vorschlag für eine Folgesitzung anlegen (gleiche Art und Bezug). */
export async function folgeVorschlagen(tx: Tx, t: { id: string }, sitzungId: string): Promise<string | null> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${T} (tenant_id, portfolio_id, gremium_id, sitzung_id, art, bezug_typ, bezug_id, projekt_id, titel, antrag, stand, vertraulich, verschoben_von)
     SELECT tenant_id, portfolio_id, gremium_id, NULL, art, bezug_typ, bezug_id, projekt_id, titel, antrag, 'vorgeschlagen', vertraulich, $2
       FROM ${T} WHERE id = $1
     ON CONFLICT DO NOTHING RETURNING id`, [t.id, sitzungId])).rows[0]?.id ?? null;
}

// --- Protokoll ----------------------------------------------------------------------------------------------------

export interface ProtokollRow { id: string; sitzung_id: string; inhalt: unknown; stand: 'entwurf' | 'versendet'; versendet_at: Date | null; version: number; updated_at: Date }

export async function protokollVon(tx: Tx, sitzungId: string): Promise<ProtokollRow | null> {
  return (await tx.query<ProtokollRow>(`SELECT id, sitzung_id, inhalt, stand, versendet_at, version, updated_at FROM ${PR} WHERE sitzung_id = $1`, [sitzungId])).rows[0] ?? null;
}

export async function protokollAnlegen(tx: Tx, sitzungId: string, inhalt: unknown): Promise<void> {
  await tx.query(`INSERT INTO ${PR} (tenant_id, sitzung_id, inhalt) VALUES (app.tenant_id(), $1, $2)`, [sitzungId, JSON.stringify(inhalt)]);
}

export async function protokollSpeichern(tx: Tx, sitzungId: string, version: number, inhalt: unknown): Promise<boolean> {
  return ((await tx.query(`UPDATE ${PR} SET inhalt = $3 WHERE sitzung_id = $1 AND version = $2 AND stand = 'entwurf'`, [sitzungId, version, JSON.stringify(inhalt)])).rowCount ?? 0) > 0;
}

export async function protokollVersenden(tx: Tx, sitzungId: string, version: number): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${PR} SET stand = 'versendet', versendet_at = now(), versendet_by = app.principal_id() WHERE sitzung_id = $1 AND version = $2 AND stand = 'entwurf'`,
    [sitzungId, version])).rowCount ?? 0) > 0;
}

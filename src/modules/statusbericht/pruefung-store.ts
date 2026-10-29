/**
 * Datenzugriff des Monatsabschlusses (BC PS.01.02–04, UC-005; AP-E1-2): Projekte und Berichte der Periode, Prüfung,
 * Rückfragen, Einforderungen und Stand der Periode bei Abschluss. Läuft immer in einer Transaktion mit Mandantenkontext;
 * was die Person nicht sehen darf, filtert die Lesesicht (RLS).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

const S = SCHEMA;

/** Projekt der Periode mit Bericht (falls vorhanden), Vorperiode, Rückfrage und Einforderung. */
export interface ZeileRow {
  projekt_id: string; nummer: string; name: string; portfolio_id: string; portfolio_name: string; projekt_phase: string;
  pflichtig: boolean;
  bericht_id: string | null; stand: 'entwurf' | 'eingereicht' | 'zurueckgegeben' | 'geprueft' | null;
  status: 'im_plan' | 'kritisch' | null; trend: string | null; phase: string | null; abschluss_per: string | null;
  naechster_meilenstein: string | null; eingereicht_at: Date | null; geprueft_at: Date | null; version: number | null;
  vor_periode: string | null; vor_status: 'im_plan' | 'kritisch' | null; vor_trend: string | null; vor_abschluss_per: string | null;
  vor_phase: string | null; vor_naechster_meilenstein: string | null;
  rueckfrage_text: string | null; rueckfrage_at: Date | null; beantwortet: boolean;
  eingefordert_at: Date | null;
}

/**
 * Berichtspflichtig in der Periode (UC-004 Vorbedingung, A-07, A-08): aktives Projekt in P0–P3 eines Portfolios mit
 * Pflichten, angelegt bis Ende der Periode. Projekte ohne Pflicht erscheinen, sobald sie einen Bericht eingereicht haben.
 */
const PFLICHTIG = `p.lebenszyklus = 'aktiv' AND p.phase IN ('P0', 'P1', 'P2', 'P3') AND pf.pflichten
  AND p.created_at < (to_date($1 || '-01', 'YYYY-MM-DD') + interval '1 month') AT TIME ZONE 'Europe/Zurich'`;

/** Alle sichtbaren Projekte der (offenen) Periode; optional nur ein Projekt. */
export async function zeilen(tx: Tx, periode: string, o: { projektId?: string } = {}): Promise<ZeileRow[]> {
  const args: unknown[] = [periode];
  let nur = '';
  if (o.projektId) { args.push(o.projektId); nur = ` AND p.id = $${args.length}`; }
  return (await tx.query<ZeileRow>(
    `SELECT p.id AS projekt_id, p.nummer, p.name, p.portfolio_id, pf.name AS portfolio_name, p.phase AS projekt_phase,
            (${PFLICHTIG}) AS pflichtig,
            b.id AS bericht_id, b.stand, b.status, b.trend, b.phase, to_char(b.abschluss_per, 'YYYY-MM-DD') AS abschluss_per,
            b.naechster_meilenstein, b.eingereicht_at, b.geprueft_at, b.version,
            v.periode AS vor_periode, v.status AS vor_status, v.trend AS vor_trend, to_char(v.abschluss_per, 'YYYY-MM-DD') AS vor_abschluss_per,
            v.phase AS vor_phase, v.naechster_meilenstein AS vor_naechster_meilenstein,
            r.text AS rueckfrage_text, r.gestellt_at AS rueckfrage_at,
            EXISTS (SELECT 1 FROM ${S}.rueckfrage x WHERE x.statusbericht_id = b.id AND x.beantwortet_at IS NOT NULL) AS beantwortet,
            e.eingefordert_at
       FROM ${S}.projekt p
       JOIN ${S}.portfolio pf ON pf.id = p.portfolio_id
       LEFT JOIN ${S}.statusbericht b ON b.projekt_id = p.id AND b.periode = $1
       LEFT JOIN LATERAL (SELECT periode, status, trend, abschluss_per, phase, naechster_meilenstein FROM ${S}.statusbericht
                           WHERE projekt_id = p.id AND periode < $1 AND stand <> 'entwurf' ORDER BY periode DESC LIMIT 1) v ON true
       LEFT JOIN ${S}.rueckfrage r ON r.statusbericht_id = b.id AND r.beantwortet_at IS NULL
       LEFT JOIN ${S}.einforderung e ON e.projekt_id = p.id AND e.periode = $1
      WHERE ((${PFLICHTIG}) OR (b.id IS NOT NULL AND b.stand <> 'entwurf'))${nur}
      ORDER BY p.nummer`, args)).rows;
}

/** Zeilen einer abgeschlossenen Periode aus dem Stand bei Abschluss. */
export interface StandRow {
  projekt_id: string; nummer: string; name: string; portfolio_id: string; portfolio_name: string;
  statusbericht_id: string | null; gemeldet: boolean; status: 'im_plan' | 'kritisch' | null; trend: string | null; phase: string;
  abschluss_per: string | null; naechster_meilenstein: string; werte_aus: string | null; status_vorperiode: 'im_plan' | 'kritisch' | null;
  eingereicht_at: Date | null; geprueft_at: Date | null; version: number | null; vor_trend: string | null; beantwortet: boolean;
  /** Stand des Berichts der Zeile (eingereicht = mit Vermerk «nicht geprüft» abgeschlossen, A-74). */
  bericht_stand: string | null;
}

export async function standZeilen(tx: Tx, periode: string): Promise<StandRow[]> {
  return (await tx.query<StandRow>(
    `SELECT d.projekt_id, p.nummer, p.name, p.portfolio_id, pf.name AS portfolio_name, d.statusbericht_id, d.gemeldet, d.status, d.trend,
            d.phase, to_char(d.abschluss_per, 'YYYY-MM-DD') AS abschluss_per, d.naechster_meilenstein, d.werte_aus, d.status_vorperiode,
            b.eingereicht_at, b.geprueft_at, b.version, b.stand AS bericht_stand,
            (SELECT v.trend FROM ${S}.dashboard_zeile v WHERE v.projekt_id = d.projekt_id AND v.periode < $1 ORDER BY v.periode DESC LIMIT 1) AS vor_trend,
            EXISTS (SELECT 1 FROM ${S}.rueckfrage x WHERE x.statusbericht_id = d.statusbericht_id) AS beantwortet
       FROM ${S}.dashboard_zeile d
       JOIN ${S}.projekt p ON p.id = d.projekt_id
       JOIN ${S}.portfolio pf ON pf.id = p.portfolio_id
       LEFT JOIN ${S}.statusbericht b ON b.id = d.statusbericht_id
      WHERE d.periode = $1
      ORDER BY p.nummer`, [periode])).rows;
}

export interface PeriodeRow { periode: string; stand: 'offen' | 'abgeschlossen'; abgeschlossen_at: Date | null; abgeschlossen_by: string | null; abgeschlossen_name: string | null; version: number }

export async function periode(tx: Tx, periode: string, o: { sperren?: boolean } = {}): Promise<PeriodeRow | null> {
  return (await tx.query<PeriodeRow>(
    `SELECT x.periode, x.stand, x.abgeschlossen_at, x.abgeschlossen_by, pr.display_name AS abgeschlossen_name, x.version
       FROM ${S}.periode x LEFT JOIN ${S}.principal pr ON pr.tenant_id = x.tenant_id AND pr.id = x.abgeschlossen_by
      WHERE x.periode = $1${o.sperren ? ' FOR UPDATE OF x' : ''}`, [periode])).rows[0] ?? null;
}

/** Bericht prüfen bzw. Prüfung zurücknehmen bzw. zurückgeben; null bei abweichender Version oder abweichendem Stand. */
export async function pruefstand(tx: Tx, id: string, version: number, von: readonly string[], nach: 'geprueft' | 'eingereicht' | 'zurueckgegeben'): Promise<{ id: string; version: number } | null> {
  const geprueft = nach === 'geprueft';
  return (await tx.query<{ id: string; version: number }>(
    `UPDATE ${S}.statusbericht SET stand = $3,
            geprueft_at = CASE WHEN $4 THEN now() END, geprueft_by = CASE WHEN $4 THEN app.principal_id() END
      WHERE id = $1 AND version = $2 AND stand = ANY ($5::text[]) RETURNING id, version`,
    [id, version, nach, geprueft, von])).rows[0] ?? null;
}

const RF = `r.id, r.text, r.antwort, r.gestellt_by, pr.display_name AS gestellt_name, r.gestellt_at, r.beantwortet_at`;
export interface RueckfrageRow { id: string; text: string; antwort: string | null; gestellt_by: string | null; gestellt_name: string | null; gestellt_at: Date; beantwortet_at: Date | null }

export async function rueckfragen(tx: Tx, berichtId: string): Promise<RueckfrageRow[]> {
  return (await tx.query<RueckfrageRow>(
    `SELECT ${RF} FROM ${S}.rueckfrage r LEFT JOIN ${S}.principal pr ON pr.tenant_id = r.tenant_id AND pr.id = r.gestellt_by
      WHERE r.statusbericht_id = $1 ORDER BY r.gestellt_at DESC, r.id`, [berichtId])).rows;
}

export async function rueckfrageStellen(tx: Tx, berichtId: string, text: string): Promise<{ id: string }> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${S}.rueckfrage (tenant_id, statusbericht_id, projekt_id, text) VALUES (app.tenant_id(), $1, NULL, btrim($2)) RETURNING id`,
    [berichtId, text])).rows[0]!;
}

/** Offene Rückfragen des Berichts als beantwortet markieren (erneutes Einreichen, UC-005 A2.2); liefert die Anzahl. */
export async function rueckfragenBeantworten(tx: Tx, berichtId: string): Promise<number> {
  return (await tx.query(`UPDATE ${S}.rueckfrage SET beantwortet_at = now() WHERE statusbericht_id = $1 AND beantwortet_at IS NULL`, [berichtId])).rowCount ?? 0;
}

/** Einforderung festhalten (letzte zählt); liefert den Zeitpunkt. */
export async function einfordern(tx: Tx, periode: string, projektId: string): Promise<Date> {
  return (await tx.query<{ eingefordert_at: Date }>(
    `INSERT INTO ${S}.einforderung (tenant_id, periode, projekt_id) VALUES (app.tenant_id(), $1, $2)
     ON CONFLICT (tenant_id, periode, projekt_id)
     DO UPDATE SET anzahl = ${S}.einforderung.anzahl + 1, eingefordert_at = now(), eingefordert_by = app.principal_id()
     RETURNING eingefordert_at`, [periode, projektId])).rows[0]!.eingefordert_at;
}

/** Letzter Stand vor der Periode aus dem Abschluss (Werte für «nicht gemeldet», A-11). */
export interface VorstandRow { periode: string; status: 'im_plan' | 'kritisch' | null; trend: string | null; phase: string; abschluss_per: string | null; naechster_meilenstein: string; werte_aus: string | null }

export async function vorstand(tx: Tx, projektId: string, periode: string): Promise<VorstandRow | null> {
  return (await tx.query<VorstandRow>(
    `SELECT periode, status, trend, phase, to_char(abschluss_per, 'YYYY-MM-DD') AS abschluss_per, naechster_meilenstein, werte_aus
       FROM ${S}.dashboard_zeile WHERE projekt_id = $1 AND periode < $2 ORDER BY periode DESC LIMIT 1`, [projektId, periode])).rows[0] ?? null;
}

export interface DashboardZeileIn {
  projektId: string; statusberichtId: string | null; status: string | null; trend: string | null; phase: string;
  abschlussPer: string | null; naechsterMeilenstein: string; werteAus: string | null; statusVorperiode: string | null;
}

export async function dashboardZeile(tx: Tx, periode: string, z: DashboardZeileIn): Promise<void> {
  await tx.query(
    `INSERT INTO ${S}.dashboard_zeile (tenant_id, periode, projekt_id, statusbericht_id, gemeldet, status, trend, phase, abschluss_per,
                                       naechster_meilenstein, werte_aus, status_vorperiode)
     VALUES (app.tenant_id(), $1, $2, $3::uuid, $3::uuid IS NOT NULL, $4, $5, $6, $7, $8, $9, $10)`,
    [periode, z.projektId, z.statusberichtId, z.status, z.trend, z.phase, z.abschlussPer, z.naechsterMeilenstein, z.werteAus, z.statusVorperiode]);
}

/** Periode abschliessen; null bei abweichender Version. */
export async function abschliessen(tx: Tx, periode: string, version: number): Promise<{ version: number } | null> {
  return (await tx.query<{ version: number }>(
    `UPDATE ${S}.periode SET stand = 'abgeschlossen', abgeschlossen_at = now(), abgeschlossen_by = app.principal_id()
      WHERE periode = $1 AND version = $2 AND stand = 'offen' RETURNING version`, [periode, version])).rows[0] ?? null;
}

/** Hat die Periode eingereichte Berichte (auch geprüfte oder zurückgegebene)? */
export async function hatBerichte(tx: Tx, periode: string): Promise<boolean> {
  return (await tx.query(`SELECT 1 FROM ${S}.statusbericht WHERE periode = $1 AND stand <> 'entwurf' LIMIT 1`, [periode])).rowCount! > 0;
}

/** Datum in Europe/Zurich und Beginn eines Kalendertags als Zeitpunkt (für `runAt`). */
export async function tagesbeginn(tx: Tx, datum: string): Promise<Date> {
  return (await tx.query<{ t: Date }>(`SELECT ($1::date)::timestamp AT TIME ZONE 'Europe/Zurich' AS t`, [datum])).rows[0]!.t;
}

export async function heute(tx: Tx): Promise<string> {
  return (await tx.query<{ d: string }>("SELECT to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYY-MM-DD') AS d")).rows[0]!.d;
}

/** Eingereichte, nicht geprüfte Berichte der Periode (Vermerk «nicht geprüft» nach dem Abschluss, A-74). */
export async function ungeprueft(tx: Tx, periode: string): Promise<number> {
  return (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${S}.statusbericht WHERE periode = $1 AND stand = 'eingereicht'`, [periode])).rows[0]!.n;
}

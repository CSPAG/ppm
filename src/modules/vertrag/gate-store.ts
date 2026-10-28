/**
 * Abfragen des Gate-Modus (AP-E3-3; fachmodell.md 2.10): Gate-Antrag je Version, Leitfragen des Gates aus dem
 * Phasenmodell mit den Antworten (UC-003 Schritte 1, 4), Nutzenprüfung (UC-003 A2) und die Planung der Gate-Sitzungen
 * für die Aufgabe «Gate vorbereiten». Nur Spalten der Kerntabellen anderer Module, lesend.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Phase } from './kapitel.ts';

const A = `${SCHEMA}.gate_antrag`;
const L = `${SCHEMA}.leitfrage_antwort`;
const N = `${SCHEMA}.nutzenpruefung`;

export const GATE_CODES = ['P0_P1', 'P1_P2', 'P2_P3', 'P3_P4'] as const;
export type GateCode = (typeof GATE_CODES)[number];
export type Ergebnis = 'freigegeben' | 'mit_auflagen' | 'zurueckgestellt' | 'abgelehnt';

export interface AntragRow {
  id: string; projekt_id: string; version_id: string; gate_code: GateCode; phasenmodell_id: string | null;
  stand: 'in_arbeit' | 'traktandiert' | 'entschieden'; traktandum_id: string | null; sitzung_id: string | null;
  ergebnis: Ergebnis | null; begruendung: string; entschieden_at: Date | null;
  vorher_baseline_id: string | null; vorher_phase: Phase | null; vorher_phasenmodell_id: string | null; version: number;
}
const COLS = `id, projekt_id, version_id, gate_code, phasenmodell_id, stand, traktandum_id, sitzung_id, ergebnis, begruendung,
  entschieden_at, vorher_baseline_id, vorher_phase, vorher_phasenmodell_id, version`;

export async function antrag(tx: Tx, versionId: string): Promise<AntragRow | null> {
  return (await tx.query<AntragRow>(`SELECT ${COLS} FROM ${A} WHERE version_id = $1`, [versionId])).rows[0] ?? null;
}

/** Antrag des Traktandums (Entscheid und Korrektur) bzw. der zuletzt traktandierte des Projekts. */
export async function antragZumTraktandum(tx: Tx, projektId: string, traktandumId: string): Promise<AntragRow | null> {
  return (await tx.query<AntragRow>(
    `SELECT ${COLS} FROM ${A} WHERE projekt_id = $1 AND (traktandum_id = $2 OR stand = 'traktandiert')
      ORDER BY (traktandum_id = $2) DESC NULLS LAST, updated_at DESC LIMIT 1`, [projektId, traktandumId])).rows[0] ?? null;
}

export async function antragAnlegen(tx: Tx, a: { projektId: string; versionId: string; gateCode: GateCode; phasenmodellId: string | null }): Promise<AntragRow> {
  await tx.query(
    `INSERT INTO ${A} (tenant_id, projekt_id, version_id, gate_code, phasenmodell_id) VALUES (app.tenant_id(), $1, $2, $3, $4)
      ON CONFLICT (tenant_id, version_id) DO NOTHING`, [a.projektId, a.versionId, a.gateCode, a.phasenmodellId]);
  return (await antrag(tx, a.versionId))!;
}

export async function traktandiert(tx: Tx, id: string, traktandumId: string): Promise<void> {
  await tx.query(`UPDATE ${A} SET stand = 'traktandiert', traktandum_id = $2 WHERE id = $1`, [id, traktandumId]);
}

/** Entscheid mit dem Stand davor festhalten (A-30: eine Korrektur nimmt die Folge mit diesen Werten zurück). */
export async function entschieden(tx: Tx, id: string, e: {
  ergebnis: Ergebnis; begruendung: string; sitzungId: string | null;
  vorherBaselineId: string | null; vorherPhase: Phase | null; vorherPhasenmodellId: string | null;
}): Promise<void> {
  await tx.query(
    `UPDATE ${A} SET stand = 'entschieden', ergebnis = $2, begruendung = btrim($3), entschieden_at = now(), sitzung_id = coalesce($4, sitzung_id),
      vorher_baseline_id = $5, vorher_phase = $6, vorher_phasenmodell_id = $7 WHERE id = $1`,
    [id, e.ergebnis, e.begruendung, e.sitzungId, e.vorherBaselineId, e.vorherPhase, e.vorherPhasenmodellId]);
}

/** Entscheid zurücknehmen (Korrektur): wieder traktandiert, ohne Ergebnis. */
export async function entscheidZuruecknehmen(tx: Tx, id: string): Promise<void> {
  await tx.query(
    `UPDATE ${A} SET stand = 'traktandiert', ergebnis = NULL, begruendung = '', entschieden_at = NULL, vorher_baseline_id = NULL,
      vorher_phase = NULL, vorher_phasenmodell_id = NULL WHERE id = $1`, [id]);
}

/** Zurück in Arbeit (Auflagen, zurückgestellt, Rückmeldung, Verweigerung): das Traktandum gilt als behandelt. */
export async function inArbeit(tx: Tx, id: string): Promise<void> {
  await tx.query(`UPDATE ${A} SET stand = 'in_arbeit', traktandum_id = NULL WHERE id = $1 AND stand <> 'in_arbeit'`, [id]);
}

// ---------------------------------------------------------------- Leitfragen (UC-003 Schritte 1, 4)

export interface LeitfrageRow { id: string; wertestrom: string; text: string; position: number }
export interface AntwortRow { leitfrage_id: string; antwort: string; zutreffend: boolean; version: number; updated_at: Date; updated_by: string | null }

/** Leitfragen des Gates in der Version des Phasenmodells (Reihenfolge des Modells). */
export async function leitfragen(tx: Tx, phasenmodellId: string | null, gate: GateCode): Promise<LeitfrageRow[]> {
  if (!phasenmodellId) return [];
  return (await tx.query<LeitfrageRow>(
    `SELECT id, wertestrom, text, position FROM ${SCHEMA}.leitfrage WHERE phasenmodell_id = $1 AND gate_code = $2 ORDER BY position, id`,
    [phasenmodellId, gate])).rows;
}

export async function antworten(tx: Tx, antragId: string): Promise<AntwortRow[]> {
  return (await tx.query<AntwortRow>(`SELECT leitfrage_id, antwort, zutreffend, version, updated_at, updated_by FROM ${L} WHERE gate_antrag_id = $1`, [antragId])).rows;
}

/** Antwort speichern (anlegen oder ändern; `version` null = ohne Prüfung); liefert false bei veraltetem Stand. */
export async function antwortSetzen(tx: Tx, a: AntragRow, leitfrageId: string, version: number | null, w: { antwort: string; zutreffend: boolean }): Promise<boolean> {
  const r = await tx.query(
    `INSERT INTO ${L} (tenant_id, projekt_id, gate_antrag_id, leitfrage_id, antwort, zutreffend) VALUES (app.tenant_id(), $1, $2, $3, btrim($4), $5)
      ON CONFLICT (tenant_id, gate_antrag_id, leitfrage_id) DO UPDATE SET antwort = EXCLUDED.antwort, zutreffend = EXCLUDED.zutreffend
      WHERE $6::int IS NULL OR ${L}.version = $6`,
    [a.projekt_id, a.id, leitfrageId, w.antwort, w.zutreffend, version]);
  return (r.rowCount ?? 0) > 0;
}

export async function antwortLoeschen(tx: Tx, antragId: string, leitfrageId: string): Promise<void> {
  await tx.query(`DELETE FROM ${L} WHERE gate_antrag_id = $1 AND leitfrage_id = $2`, [antragId, leitfrageId]);
}

// ---------------------------------------------------------------- Nutzenprüfung (UC-003 A2)

export interface NutzenWert { kpiId: string; wert: string; bemerkung: string }
export interface NutzenRow { beurteilung: string; werte: NutzenWert[]; version: number; updated_at: Date; updated_by: string | null }

export async function nutzen(tx: Tx, versionId: string): Promise<NutzenRow | null> {
  return (await tx.query<NutzenRow>(`SELECT beurteilung, werte, version, updated_at, updated_by FROM ${N} WHERE version_id = $1`, [versionId])).rows[0] ?? null;
}

export async function nutzenSetzen(tx: Tx, projektId: string, versionId: string, version: number | null, w: { beurteilung: string; werte: NutzenWert[] }): Promise<boolean> {
  const r = await tx.query(
    `INSERT INTO ${N} (tenant_id, projekt_id, version_id, beurteilung, werte) VALUES (app.tenant_id(), $1, $2, btrim($3), $4::jsonb)
      ON CONFLICT (tenant_id, version_id) DO UPDATE SET beurteilung = EXCLUDED.beurteilung, werte = EXCLUDED.werte
      WHERE $5::int IS NULL OR ${N}.version = $5`,
    [projektId, versionId, w.beurteilung, JSON.stringify(w.werte), version]);
  return (r.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Projekt und Planung

export interface ProjektGate { portfolio_id: string; phasenmodell_id: string | null; phase: Phase }

/** Portfolio, Phase und Version des Phasenmodells des Projekts (Kerntabelle aus 010/041, Lesesicht). */
export async function projektGate(tx: Tx, projektId: string): Promise<ProjektGate | null> {
  return (await tx.query<ProjektGate>(`SELECT portfolio_id, phasenmodell_id, phase FROM ${SCHEMA}.projekt WHERE id = $1`, [projektId])).rows[0] ?? null;
}

/** Projektleitung (Projektorganisation, PP.04.04): Empfängerin der Aufgabe «Gate vorbereiten». */
export async function projektleitung(tx: Tx, projektId: string): Promise<string[]> {
  return (await tx.query<{ person_id: string }>(
    `SELECT person_id FROM ${SCHEMA}.projekt_person WHERE projekt_id = $1 AND funktion = 'pl' ORDER BY person_id`, [projektId])).rows.map(r => r.person_id);
}

/** Version als Baseline wiederherstellen (Korrektur eines Gate-Entscheids, A-30). */
export async function baselineWiederherstellen(tx: Tx, versionId: string): Promise<void> {
  await tx.query(`UPDATE ${SCHEMA}.vertrag_version SET baseline = true WHERE id = $1 AND stand = 'abgenommen'`, [versionId]);
}

/** Abgenommene Version wieder zum Entscheid stellen (Korrektur, A-30): Baseline weg, Stand «traktandiert». */
export async function abnahmeZuruecknehmen(tx: Tx, versionId: string): Promise<void> {
  await tx.query(`UPDATE ${SCHEMA}.vertrag_version SET baseline = false, baseline_at = NULL, stand = 'traktandiert' WHERE id = $1 AND stand = 'abgenommen'`, [versionId]);
}

export interface GeplantesGate { projekt_id: string; nummer: string; name: string; portfolio_id: string; phase: Phase; gremium: string; datum: string; geplant: 'sitzung' | 'termin' }

/**
 * Geplante Gate-Sitzungen (fachmodell.md 4.2 `gate.vorbereiten`, UC-003 Ausgangslage): ein in eine Sitzung eingeplantes
 * Gate-Review (PP.04.05) oder, ohne Einplanung, der erste Sitzungstermin des zuständigen Gremiums ab dem Phasenexit, den
 * die Baseline in Kap. 7.2 nennt. Nur aktive Projekte in P0 bis P3 mit Gremienweg für das nächste Gate (A-08).
 */
export async function geplanteGates(tx: Tx, von: string, bis: string): Promise<GeplantesGate[]> {
  return (await tx.query<GeplantesGate>(`
    WITH naechstes AS (
      SELECT p.id, p.nummer, p.name, p.portfolio_id, p.phase,
        CASE p.phase WHEN 'P0' THEN 'P0_P1' WHEN 'P1' THEN 'P1_P2' WHEN 'P2' THEN 'P2_P3' WHEN 'P3' THEN 'P3_P4' END AS gate_code
      FROM ${SCHEMA}.projekt p WHERE p.lebenszyklus = 'aktiv' AND p.phase IN ('P0', 'P1', 'P2', 'P3')
    ), eingeplant AS (
      SELECT DISTINCT ON (t.projekt_id) t.projekt_id, g.kuerzel AS gremium, s.datum::text AS datum
      FROM ${SCHEMA}.traktandum t JOIN ${SCHEMA}.sitzung s ON s.tenant_id = t.tenant_id AND s.id = t.sitzung_id
        JOIN ${SCHEMA}.gremium g ON g.tenant_id = s.tenant_id AND g.id = s.gremium_id
      WHERE t.art = 'gate' AND t.stand IN ('vorgeschlagen', 'traktandiert', 'verschoben') AND s.stand IN ('geplant', 'in_vorbereitung', 'versendet')
        AND s.datum BETWEEN $1::date AND $2::date
      ORDER BY t.projekt_id, s.datum
    ), aus_vertrag AS (
      SELECT DISTINCT ON (n.id) n.id AS projekt_id, g.kuerzel AS gremium, st.datum::text AS datum
      FROM naechstes n
        JOIN ${SCHEMA}.vertrag_version v ON v.tenant_id = app.tenant_id() AND v.projekt_id = n.id AND v.baseline
        JOIN ${SCHEMA}.vertrag_kapitel k ON k.tenant_id = v.tenant_id AND k.version_id = v.id AND k.kapitel = 7
        JOIN ${SCHEMA}.gremienweg w ON w.tenant_id = v.tenant_id AND w.portfolio_id = n.portfolio_id AND w.gate_code = n.gate_code
        JOIN ${SCHEMA}.gremium g ON g.tenant_id = w.tenant_id AND g.id = w.gremium_id
        JOIN ${SCHEMA}.sitzungstermin st ON st.tenant_id = g.tenant_id AND st.gremium_id = g.id
      WHERE k.inhalt #>> '{termine,phasenExit}' ~ '^\\d{4}-\\d{2}-\\d{2}$'
        AND st.datum >= (k.inhalt #>> '{termine,phasenExit}')::date AND st.datum BETWEEN $1::date AND $2::date
      ORDER BY n.id, st.datum
    )
    SELECT n.id AS projekt_id, n.nummer, n.name, n.portfolio_id, n.phase, coalesce(e.gremium, a.gremium) AS gremium,
      coalesce(e.datum, a.datum) AS datum, CASE WHEN e.datum IS NOT NULL THEN 'sitzung' ELSE 'termin' END AS geplant
    FROM naechstes n
      JOIN ${SCHEMA}.gremienweg w ON w.portfolio_id = n.portfolio_id AND w.gate_code = n.gate_code
      LEFT JOIN eingeplant e ON e.projekt_id = n.id
      LEFT JOIN aus_vertrag a ON a.projekt_id = n.id
    WHERE coalesce(e.datum, a.datum) IS NOT NULL
    ORDER BY datum, n.nummer`, [von, bis])).rows;
}

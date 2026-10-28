/**
 * Datenzugriff des Abschlusses (340_abschluss): Abschlussbericht, Folge der Entscheide und Lessons Learned. Läuft in der
 * Transaktion mit Mandantenkontext; was die Person nicht sehen darf, filtert die Lesesicht. Projekt, Projektorganisation
 * und KPI-Werte der unteren Module nur lesend und nur die nötigen Spalten.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

export const ARTEN = ['abschluss', 'sistierung', 'abbruch'] as const;
export type Art = (typeof ARTEN)[number];
export const STAENDE = ['entwurf', 'eingereicht', 'traktandiert', 'abgenommen', 'nacharbeit'] as const;
export type Stand = (typeof STAENDE)[number];

export interface KpiWert { kpiId: string; wert: string; bemerkung: string }
export interface OffenerPunkt { text: string; verantwortlich: string; termin: string | null }

export interface BerichtRow {
  id: string; projekt_id: string; art: Art; stand: Stand;
  projektstand: string; zielerreichung: string; kpi_werte: KpiWert[]; business_case: string; uebergabe: string; offene_punkte: OffenerPunkt[];
  nutzen_sp: string; nutzen_sp_at: Date | null; nutzen_sp_by: string | null;
  nutzen_ue: string; nutzen_ue_at: Date | null; nutzen_ue_by: string | null;
  traktandum_id: string | null; eingereicht_at: Date | null; eingereicht_by: string | null; abgenommen_at: Date | null;
  version: number; created_at: Date; updated_at: Date; updated_by: string | null;
}

const B = `${SCHEMA}.abschlussbericht`;
/** Offen = noch in Arbeit oder beim Gremium; Sistierungs- und Abbruchberichte enden mit «eingereicht». */
export const OFFEN = "(stand IN ('entwurf', 'nacharbeit', 'traktandiert') OR (art = 'abschluss' AND stand = 'eingereicht'))";

/** Offener Bericht des Projekts (höchstens einer). */
export async function offenerBericht(tx: Tx, projektId: string): Promise<BerichtRow | null> {
  return (await tx.query<BerichtRow>(`SELECT * FROM ${B} WHERE projekt_id = $1 AND ${OFFEN}`, [projektId])).rows[0] ?? null;
}

/** Alle Berichte des Projekts, neueste zuerst. */
export async function berichte(tx: Tx, projektId: string): Promise<BerichtRow[]> {
  return (await tx.query<BerichtRow>(`SELECT * FROM ${B} WHERE projekt_id = $1 ORDER BY created_at DESC, id`, [projektId])).rows;
}

export async function bericht(tx: Tx, id: string): Promise<BerichtRow | null> {
  return (await tx.query<BerichtRow>(`SELECT * FROM ${B} WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function berichtAnlegen(tx: Tx, projektId: string, art: Art): Promise<BerichtRow> {
  return (await tx.query<BerichtRow>(`INSERT INTO ${B} (tenant_id, projekt_id, art) VALUES (app.tenant_id(), $1, $2) RETURNING *`, [projektId, art])).rows[0]!;
}

export interface Inhalt {
  projektstand: string; zielerreichung: string; kpiWerte: KpiWert[]; businessCase: string; uebergabe: string; offenePunkte: OffenerPunkt[];
}

/** Inhalt setzen; null bei fremder Änderung (412). */
export async function inhaltSetzen(tx: Tx, id: string, version: number, i: Inhalt): Promise<BerichtRow | null> {
  return (await tx.query<BerichtRow>(
    `UPDATE ${B} SET projektstand = $3, zielerreichung = $4, kpi_werte = $5::jsonb, business_case = $6, uebergabe = $7, offene_punkte = $8::jsonb
      WHERE id = $1 AND version = $2 AND stand IN ('entwurf', 'nacharbeit') RETURNING *`,
    [id, version, i.projektstand, i.zielerreichung, JSON.stringify(i.kpiWerte), i.businessCase, i.uebergabe, JSON.stringify(i.offenePunkte)])).rows[0] ?? null;
}

/** Beurteilung der Nutzenrealisierung durch Sponsor bzw. UE (UC-015 Schritt 3). */
export async function nutzenSetzen(tx: Tx, id: string, version: number, rolle: 'sp' | 'ue', text: string): Promise<BerichtRow | null> {
  const s = rolle === 'sp' ? 'nutzen_sp' : 'nutzen_ue';
  return (await tx.query<BerichtRow>(
    `UPDATE ${B} SET ${s} = btrim($3), ${s}_at = CASE WHEN btrim($3) = '' THEN NULL ELSE now() END,
        ${s}_by = CASE WHEN btrim($3) = '' THEN NULL ELSE app.principal_id() END
      WHERE id = $1 AND version = $2 AND art = 'abschluss' AND stand IN ('entwurf', 'nacharbeit', 'eingereicht', 'traktandiert') RETURNING *`,
    [id, version, text])).rows[0] ?? null;
}

/** Eingereicht (Sistierung, Abbruch: Ende; Abschluss: zum Exit-Gate, mit Traktandum). */
export async function eingereicht(tx: Tx, id: string, version: number, nach: 'eingereicht' | 'traktandiert', traktandumId: string | null): Promise<BerichtRow | null> {
  return (await tx.query<BerichtRow>(
    `UPDATE ${B} SET stand = $3, traktandum_id = coalesce($4, traktandum_id), eingereicht_at = now(), eingereicht_by = app.principal_id()
      WHERE id = $1 AND version = $2 AND stand IN ('entwurf', 'nacharbeit') RETURNING *`, [id, version, nach, traktandumId])).rows[0] ?? null;
}

/** Stand aus der Folge eines Entscheids (in voller Sicht des Moduls, `app.abschluss_intern`). */
export async function standSetzen(tx: Tx, id: string, von: readonly Stand[], nach: Stand): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${B} SET stand = $3, abgenommen_at = CASE WHEN $3 = 'abgenommen' THEN now() ELSE NULL END WHERE id = $1 AND stand = ANY ($2::text[])`,
    [id, von, nach])).rowCount ?? 0) > 0;
}

export async function artSetzen(tx: Tx, id: string, art: Art): Promise<void> {
  await tx.query(`UPDATE ${B} SET art = $2 WHERE id = $1 AND stand IN ('entwurf', 'nacharbeit')`, [id, art]);
}

/** Unbearbeiteten Entwurf entfernen (Rücknahme einer Sistierung oder eines Abbruchs in der Sitzung, A-30). */
export async function entwurfEntfernen(tx: Tx, id: string): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${B} WHERE id = $1 AND stand = 'entwurf' AND version = 1`, [id])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Folge der Entscheide

export type Kontext = 'exit' | 'aktiv' | 'sistiert';
export type Ergebnis = 'abgeschlossen' | 'nacharbeiten' | 'sistiert' | 'abgebrochen' | 'weiterfuehren';
export interface EntscheidRow {
  id: string; projekt_id: string; quelle: 'traktandum' | 'gate'; quelle_id: string; kontext: Kontext; ergebnis: Ergebnis;
  vorher_lebenszyklus: 'aktiv' | 'sistiert'; bericht_id: string | null; bericht_art_vorher: Art | null; entschieden_at: Date;
}
const E = `${SCHEMA}.abschluss_entscheid`;

export async function entscheid(tx: Tx, quelle: EntscheidRow['quelle'], quelleId: string): Promise<EntscheidRow | null> {
  return (await tx.query<EntscheidRow>(`SELECT * FROM ${E} WHERE quelle = $1 AND quelle_id = $2`, [quelle, quelleId])).rows[0] ?? null;
}

/** Letzter Entscheid zum Projekt (Anzeige in der Projektakte). */
export async function letzterEntscheid(tx: Tx, projektId: string): Promise<EntscheidRow | null> {
  return (await tx.query<EntscheidRow>(`SELECT * FROM ${E} WHERE projekt_id = $1 ORDER BY entschieden_at DESC, id LIMIT 1`, [projektId])).rows[0] ?? null;
}

export async function entscheidSetzen(tx: Tx, e: Omit<EntscheidRow, 'id' | 'entschieden_at'>): Promise<void> {
  await tx.query(
    `INSERT INTO ${E} (tenant_id, projekt_id, quelle, quelle_id, kontext, ergebnis, vorher_lebenszyklus, bericht_id, bericht_art_vorher)
     VALUES (app.tenant_id(), $1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, quelle, quelle_id) DO UPDATE SET ergebnis = EXCLUDED.ergebnis, vorher_lebenszyklus = EXCLUDED.vorher_lebenszyklus,
       bericht_id = EXCLUDED.bericht_id, bericht_art_vorher = EXCLUDED.bericht_art_vorher, entschieden_at = now()`,
    [e.projekt_id, e.quelle, e.quelle_id, e.kontext, e.ergebnis, e.vorher_lebenszyklus, e.bericht_id, e.bericht_art_vorher]);
}

/** Führt `fn` mit `app.abschluss_intern` aus (Folge eines Gremiumsentscheids, 340_abschluss) und stellt den Wert wieder her. */
export async function intern<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  const prev = (await tx.query<{ v: string | null }>("SELECT current_setting('app.abschluss_intern', true) AS v")).rows[0]?.v ?? '';
  await tx.query("SELECT set_config('app.abschluss_intern', 'on', true)");
  let ok = false;
  try {
    const r = await fn();
    ok = true;
    return r;
  } finally {
    // nach einem Fehler ist die Transaktion abgebrochen; dann bleibt nichts zurückzusetzen
    if (ok) await tx.query("SELECT set_config('app.abschluss_intern', $1, true)", [prev ?? '']);
  }
}

// ---------------------------------------------------------------- Projekt (nur lesend)

export interface ProjektKopf { id: string; nummer: string; name: string; phase: string; lebenszyklus: string; portfolio_id: string; vertraulich: boolean }

/** Projekt unter der Lesesicht (null = unbekannt oder nicht sichtbar). */
export async function projekt(tx: Tx, id: string): Promise<ProjektKopf | null> {
  return (await tx.query<ProjektKopf>(
    `SELECT id, nummer, name, phase, lebenszyklus, portfolio_id, vertraulich FROM ${SCHEMA}.projekt WHERE id = $1`, [id])).rows[0] ?? null;
}

/** ID des sichtbaren Projekts mit dieser Nummer (Filter der Lessons Learned); null = unbekannt oder nicht sichtbar. */
export async function projektNachNummer(tx: Tx, nummer: string): Promise<string | null> {
  return (await tx.query<{ id: string }>(`SELECT id FROM ${SCHEMA}.projekt WHERE nummer = $1`, [nummer])).rows[0]?.id ?? null;
}

/** Personen der Projektleitung (Empfänger von «Abschlussbericht erstellen»). */
export async function projektleitung(tx: Tx, projektId: string): Promise<string[]> {
  return (await tx.query<{ person_id: string }>(
    `SELECT person_id FROM ${SCHEMA}.projekt_person WHERE projekt_id = $1 AND funktion = 'pl' ORDER BY person_id`, [projektId])).rows.map(r => r.person_id);
}

/** Sponsor und Projektleitung (Mitteilung zur Wiederaufnahme). */
export async function spUndPl(tx: Tx, projektId: string): Promise<string[]> {
  return (await tx.query<{ person_id: string }>(
    `SELECT DISTINCT person_id FROM ${SCHEMA}.projekt_person WHERE projekt_id = $1 AND funktion IN ('sp', 'pl') ORDER BY person_id`, [projektId])).rows.map(r => r.person_id);
}

/** Aktive Projekte in P4 ohne eingereichten Abschlussbericht (Aufgabe «Abschlussbericht erstellen», volle Sicht). */
export async function inP4OhneBericht(tx: Tx): Promise<{ id: string; nummer: string; name: string }[]> {
  return (await tx.query<{ id: string; nummer: string; name: string }>(
    `SELECT p.id, p.nummer, p.name FROM ${SCHEMA}.projekt p
      WHERE p.lebenszyklus = 'aktiv' AND p.phase = 'P4'
        AND NOT EXISTS (SELECT 1 FROM ${B} b WHERE b.tenant_id = p.tenant_id AND b.projekt_id = p.id AND b.art = 'abschluss'
                          AND b.stand IN ('eingereicht', 'traktandiert', 'abgenommen', 'nacharbeit'))
      ORDER BY p.nummer`)).rows;
}

/** Letzter Ist-Wert je KPI (PC.03.03), unter der Lesesicht. */
export async function letzteKpiWerte(tx: Tx, projektId: string): Promise<Map<string, { periode: string; wert: number }>> {
  const rows = (await tx.query<{ kpi_id: string; periode: string; wert: string }>(
    `SELECT DISTINCT ON (kpi_id) kpi_id, periode, wert::text FROM ${SCHEMA}.kpi_wert WHERE projekt_id = $1 ORDER BY kpi_id, periode DESC`, [projektId])).rows;
  return new Map(rows.map(r => [r.kpi_id, { periode: r.periode, wert: Number(r.wert) }]));
}

/**
 * Letzte Nutzenprüfung aus dem Gate-Modus (UC-003 A2, Gate P2–P3 bzw. P3–P4; Tabelle des Moduls vertrag, nur lesend):
 * Grundlage der Beurteilung am Abschluss (UC-015 Schritt 3).
 */
export async function letzteNutzenpruefung(tx: Tx, projektId: string): Promise<{ version: string; beurteilung: string; werte: KpiWert[] } | null> {
  return (await tx.query<{ version: string; beurteilung: string; werte: KpiWert[] }>(
    `SELECT v.nummer AS version, n.beurteilung, n.werte FROM ${SCHEMA}.nutzenpruefung n
       JOIN ${SCHEMA}.vertrag_version v ON v.tenant_id = n.tenant_id AND v.id = n.version_id
      WHERE n.projekt_id = $1 ORDER BY v.created_at DESC LIMIT 1`, [projektId])).rows[0] ?? null;
}

/** Anzeigenamen der Personen (Lesesicht). */
export async function personen(tx: Tx, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  return new Map((await tx.query<{ id: string; name: string | null }>(
    `SELECT id, display_name AS name FROM ${SCHEMA}.principal WHERE id = ANY ($1::uuid[])`, [ids])).rows.map(r => [r.id, r.name ?? '']));
}

// ---------------------------------------------------------------- Lessons Learned

export interface LessonRow {
  id: string; projekt_id: string; nummer: string; name: string; text: string; kategorie: string; jahr: number;
  version: number; created_at: Date; created_by: string | null; updated_at: Date;
}
const L = `${SCHEMA}.lessons_learned`;
const L_COLS = 'l.id, l.projekt_id, p.nummer, p.name, l.text, l.kategorie, l.jahr, l.version, l.created_at, l.created_by, l.updated_at';
const L_FROM = `${L} l JOIN ${SCHEMA}.projekt p ON p.tenant_id = l.tenant_id AND p.id = l.projekt_id`;

export interface LessonFilter {
  jahr?: number; projektId?: string; kategorie?: string; q?: string;
  after?: { c: string; i: string } | null; limit: number;
}

/** Lessons Learned, neueste zuerst (limit + 1 Zeilen für den Cursor). */
export async function lessons(tx: Tx, f: LessonFilter): Promise<LessonRow[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };
  if (f.jahr !== undefined) where.push(`l.jahr = ${arg(f.jahr)}`);
  if (f.projektId) where.push(`l.projekt_id = ${arg(f.projektId)}`);
  if (f.kategorie !== undefined) where.push(`l.kategorie = ${arg(f.kategorie)}`);
  if (f.q) where.push(`(l.text ILIKE ${arg(`%${f.q.replace(/[\\%_]/g, m => `\\${m}`)}%`)} OR p.name ILIKE $${args.length} OR p.nummer ILIKE $${args.length})`);
  if (f.after) where.push(`(l.created_at, l.id) < (${arg(f.after.c)}::timestamptz, ${arg(f.after.i)}::uuid)`);
  return (await tx.query<LessonRow>(
    `SELECT ${L_COLS} FROM ${L_FROM} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY l.created_at DESC, l.id DESC LIMIT ${arg(f.limit + 1)}`, args)).rows;
}

/** Kategorien in Gebrauch (Filter, Vorschläge). */
export async function kategorien(tx: Tx): Promise<string[]> {
  return (await tx.query<{ k: string }>(`SELECT DISTINCT kategorie AS k FROM ${L} WHERE kategorie <> '' ORDER BY 1`)).rows.map(r => r.k);
}

export async function lesson(tx: Tx, id: string): Promise<LessonRow | null> {
  return (await tx.query<LessonRow>(`SELECT ${L_COLS} FROM ${L_FROM} WHERE l.id = $1`, [id])).rows[0] ?? null;
}

export async function lessonAnlegen(tx: Tx, projektId: string, text: string, kategorie: string): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${L} (tenant_id, projekt_id, text, kategorie) VALUES (app.tenant_id(), $1, btrim($2), btrim($3)) RETURNING id`, [projektId, text, kategorie])).rows[0]!.id;
}

export async function lessonAendern(tx: Tx, id: string, version: number, text: string, kategorie: string): Promise<boolean> {
  return ((await tx.query(`UPDATE ${L} SET text = btrim($3), kategorie = btrim($4) WHERE id = $1 AND version = $2`, [id, version, text, kategorie])).rowCount ?? 0) > 0;
}

export async function lessonLoeschen(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${L} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

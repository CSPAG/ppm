/**
 * Datenzugriff des Zielzyklus (UC-011 Schritte 1–5). Läuft immer in einer Transaktion mit Mandantenkontext; die
 * Lesesicht (RLS) filtert, was die Person nicht sehen darf – auch die Projekte im Baum (Policy von ppm.projekt wirkt
 * mit). Projekte liest das Modul nur lesend über die Spalten aus 010 (Nummer, Name, Phase, Lebenszyklus).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { HauptaktivitaetCreateIn, HauptaktivitaetPatchIn, JahreszielCreateIn, JahreszielPatchIn } from './zyklus-schemas.ts';

const ZJ = `${SCHEMA}.zieljahr`;
const JZ = `${SCHEMA}.jahresziel`;
const HA = `${SCHEMA}.hauptaktivitaet`;
const ZP = `${SCHEMA}.ziel_projekt`;

export type Stand = 'in_arbeit' | 'zur_freigabe' | 'in_kraft';

// ---------------------------------------------------------------- Zieljahr

export interface ZieljahrRow {
  id: string; jahr: number; stand: Stand; vorlage_bis: string | null; vorgelegt_at: Date | null; freigabe_at: Date | null; freigabe_text: string;
  version: number; created_at: Date; updated_at: Date;
}
export const ZJ_COLS = "id, jahr, stand, to_char(vorlage_bis, 'YYYY-MM-DD') AS vorlage_bis, vorgelegt_at, freigabe_at, freigabe_text, version, created_at, updated_at";

export async function getJahr(tx: Tx, jahr: number, sperren = false): Promise<ZieljahrRow | null> {
  // FOR SHARE: Vorlegen (AP-E6-2) wartet, bis laufende Änderungen an Jahreszielen abgeschlossen sind
  return (await tx.query<ZieljahrRow>(`SELECT ${ZJ_COLS} FROM ${ZJ} WHERE jahr = $1${sperren ? ' FOR SHARE' : ''}`, [jahr])).rows[0] ?? null;
}

export async function createJahr(tx: Tx, jahr: number, vorlageBis: string | null): Promise<ZieljahrRow> {
  return (await tx.query<ZieljahrRow>(
    `INSERT INTO ${ZJ} (tenant_id, jahr, vorlage_bis) VALUES (app.tenant_id(), $1, $2) RETURNING ${ZJ_COLS}`, [jahr, vorlageBis])).rows[0]!;
}

export async function updateJahr(tx: Tx, jahr: number, version: number, vorlageBis: string | null): Promise<ZieljahrRow | null> {
  return (await tx.query<ZieljahrRow>(
    `UPDATE ${ZJ} SET vorlage_bis = $3 WHERE jahr = $1 AND version = $2 RETURNING ${ZJ_COLS}`, [jahr, version, vorlageBis])).rows[0] ?? null;
}

// ---------------------------------------------------------------- Jahresziele

export interface JahreszielRow {
  id: string; jahr: number; strategisches_ziel_id: string; nummer: string; nummer_sort: number[]; text: string; metrik: string; zielwert: string;
  version: number; created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null;
}
const JZ_COLS = 'id, jahr, strategisches_ziel_id, nummer, nummer_sort, text, metrik, zielwert, version, created_at, created_by, updated_at, updated_by';

export interface JzAfter { jahr: number; sort: number[]; id: string }

export async function listJahresziele(tx: Tx, o: { jahr?: number; strategischesZiel?: string; after?: JzAfter | null; limit: number }): Promise<JahreszielRow[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (o.jahr) { args.push(o.jahr); where.push(`jahr = $${args.length}`); }
  if (o.strategischesZiel) { args.push(o.strategischesZiel); where.push(`strategisches_ziel_id = $${args.length}::uuid`); }
  if (o.after) { args.push(o.after.jahr, o.after.sort, o.after.id); where.push(`(jahr, nummer_sort, id) > ($${args.length - 2}::int, $${args.length - 1}::int[], $${args.length}::uuid)`); }
  args.push(o.limit + 1);
  return (await tx.query<JahreszielRow>(
    `SELECT ${JZ_COLS} FROM ${JZ} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY jahr, nummer_sort, id LIMIT $${args.length}`, args)).rows;
}

export async function getJahresziel(tx: Tx, id: string): Promise<JahreszielRow | null> {
  return (await tx.query<JahreszielRow>(`SELECT ${JZ_COLS} FROM ${JZ} WHERE id = $1`, [id])).rows[0] ?? null;
}

/**
 * Nächste Nummer unter dem strategischen Ziel im Jahr: Nummer des strategischen Ziels und laufende Nummer («2.1» →
 * «2.1.3»). null, wenn das strategische Ziel nicht sichtbar ist.
 */
export async function naechsteNummer(tx: Tx, jahr: number, strategischesZielId: string): Promise<string | null> {
  const r = (await tx.query<{ nummer: string; n: number }>(
    `SELECT s.nummer, coalesce((SELECT max(j.nummer_sort[array_length(s.nummer_sort, 1) + 1]) FROM ${JZ} j
                                 WHERE j.jahr = $1 AND j.strategisches_ziel_id = s.id
                                   AND array_length(j.nummer_sort, 1) = array_length(s.nummer_sort, 1) + 1
                                   AND j.nummer_sort[1:array_length(s.nummer_sort, 1)] = s.nummer_sort), 0)::int AS n
       FROM ${SCHEMA}.strategisches_ziel s WHERE s.id = $2`, [jahr, strategischesZielId])).rows[0];
  return r ? `${r.nummer}.${r.n + 1}` : null;
}

export async function createJahresziel(tx: Tx, input: JahreszielCreateIn & { nummer: string }): Promise<JahreszielRow> {
  return (await tx.query<JahreszielRow>(
    `INSERT INTO ${JZ} (tenant_id, jahr, strategisches_ziel_id, nummer, text, metrik, zielwert)
     VALUES (app.tenant_id(), $1, $2, $3, btrim($4), $5, $6) RETURNING ${JZ_COLS}`,
    [input.jahr, input.strategischesZielId, input.nummer, input.text, (input.metrik ?? '').trim(), (input.zielwert ?? '').trim()])).rows[0]!;
}

const JZ_COLUMN = { nummer: 'nummer', text: 'text', metrik: 'metrik', zielwert: 'zielwert' } as const;

export async function updateJahresziel(tx: Tx, id: string, version: number, patch: JahreszielPatchIn): Promise<JahreszielRow | null> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  for (const k of Object.keys(JZ_COLUMN) as (keyof typeof JZ_COLUMN)[]) {
    const v = patch[k];
    if (v === undefined) continue;
    args.push(v.trim());
    sets.push(`${JZ_COLUMN[k]} = $${args.length}`);
  }
  return (await tx.query<JahreszielRow>(`UPDATE ${JZ} SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING ${JZ_COLS}`, args)).rows[0] ?? null;
}

export async function removeJahresziel(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${JZ} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Hauptaktivitäten

export interface HauptaktivitaetRow {
  id: string; jahresziel_id: string; text: string; verantwortlich: string | null; verantwortlich_name: string | null; position: number;
  version: number; created_at: Date; updated_at: Date;
}
const HA_SELECT = `SELECT h.id, h.jahresziel_id, h.text, h.verantwortlich, p.display_name AS verantwortlich_name, h.position, h.version, h.created_at, h.updated_at
  FROM ${HA} h LEFT JOIN ${SCHEMA}.principal p ON p.id = h.verantwortlich`;

export async function listHauptaktivitaeten(tx: Tx, jahreszielIds: string[]): Promise<HauptaktivitaetRow[]> {
  if (!jahreszielIds.length) return [];
  return (await tx.query<HauptaktivitaetRow>(`${HA_SELECT} WHERE h.jahresziel_id = ANY ($1::uuid[]) ORDER BY h.position, h.created_at, h.id`, [jahreszielIds])).rows;
}

export async function getHauptaktivitaet(tx: Tx, id: string): Promise<HauptaktivitaetRow | null> {
  return (await tx.query<HauptaktivitaetRow>(`${HA_SELECT} WHERE h.id = $1`, [id])).rows[0] ?? null;
}

/** Personen der Organisation (keine Clients, nicht entfernt) – wie die Projektorganisation (AP-E0-4). */
export async function personVorhanden(tx: Tx, id: string): Promise<boolean> {
  return (await tx.query(`SELECT 1 FROM ${SCHEMA}.principal WHERE id = $1 AND kind = 'user' AND removed_at IS NULL`, [id])).rowCount === 1;
}

export async function createHauptaktivitaet(tx: Tx, input: HauptaktivitaetCreateIn): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${HA} (tenant_id, jahresziel_id, text, verantwortlich, position)
     VALUES (app.tenant_id(), $1, btrim($2), $3, coalesce($4, (SELECT coalesce(max(position) + 1, 0) FROM ${HA} WHERE jahresziel_id = $1))) RETURNING id`,
    [input.jahreszielId, input.text, input.verantwortlich ?? null, input.position ?? null])).rows[0]!.id;
}

export async function updateHauptaktivitaet(tx: Tx, id: string, version: number, patch: HauptaktivitaetPatchIn): Promise<boolean> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  if (patch.text !== undefined) { args.push(patch.text.trim()); sets.push(`text = $${args.length}`); }
  if (patch.verantwortlich !== undefined) { args.push(patch.verantwortlich); sets.push(`verantwortlich = $${args.length}`); }
  if (patch.position !== undefined) { args.push(patch.position); sets.push(`position = $${args.length}`); }
  return ((await tx.query(`UPDATE ${HA} SET ${sets.join(', ')} WHERE id = $1 AND version = $2`, args)).rowCount ?? 0) > 0;
}

export async function removeHauptaktivitaet(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${HA} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Baum

export interface StrategischRow { id: string; handlungsfeld_id: string; nummer: string; text: string; metrik: string; zielwert: string }

export async function strategischeZiele(tx: Tx): Promise<StrategischRow[]> {
  return (await tx.query<StrategischRow>(
    `SELECT id, handlungsfeld_id, nummer, text, metrik, zielwert FROM ${SCHEMA}.strategisches_ziel ORDER BY nummer_sort, id`)).rows;
}

export async function alleJahresziele(tx: Tx, jahr: number): Promise<JahreszielRow[]> {
  return (await tx.query<JahreszielRow>(`SELECT ${JZ_COLS} FROM ${JZ} WHERE jahr = $1 ORDER BY nummer_sort, id`, [jahr])).rows;
}

export interface BaumProjektRow {
  zuordnung_id: string; projekt_id: string; strategisches_ziel_id: string; jahresziel_id: string | null;
  nummer: string; name: string; phase: string; lebenszyklus: string;
}

/** Zuordnungen mit sichtbaren Projekten: ohne Jahresziel und mit Jahreszielen des Jahres. */
export async function baumProjekte(tx: Tx, jahr: number): Promise<BaumProjektRow[]> {
  return (await tx.query<BaumProjektRow>(
    `SELECT z.id AS zuordnung_id, z.projekt_id, z.strategisches_ziel_id, z.jahresziel_id, p.nummer, p.name, p.phase, p.lebenszyklus
       FROM ${ZP} z JOIN ${SCHEMA}.projekt p ON p.id = z.projekt_id
       LEFT JOIN ${JZ} j ON j.id = z.jahresziel_id
      WHERE z.jahresziel_id IS NULL OR j.jahr = $1
      ORDER BY p.nummer, z.id`, [jahr])).rows;
}

// ---------------------------------------------------------------- Zuordnung Projekt ↔ Ziel (PP.02.05)

export async function projektSichtbar(tx: Tx, projektId: string): Promise<{ nummer: string } | null> {
  return (await tx.query<{ nummer: string }>(`SELECT nummer FROM ${SCHEMA}.projekt WHERE id = $1`, [projektId])).rows[0] ?? null;
}

export interface ProjektZielRow {
  id: string; projekt_id: string; created_at: Date;
  sz_id: string; sz_nummer: string; sz_text: string;
  jz_id: string | null; jz_jahr: number | null; jz_nummer: string | null; jz_text: string | null;
}
const PZ_SELECT = `SELECT z.id, z.projekt_id, z.created_at, s.id AS sz_id, s.nummer AS sz_nummer, s.text AS sz_text,
       j.id AS jz_id, j.jahr AS jz_jahr, j.nummer AS jz_nummer, j.text AS jz_text
  FROM ${ZP} z JOIN ${SCHEMA}.strategisches_ziel s ON s.id = z.strategisches_ziel_id
  LEFT JOIN ${JZ} j ON j.id = z.jahresziel_id`;

export async function projektZiele(tx: Tx, projektId: string): Promise<ProjektZielRow[]> {
  return (await tx.query<ProjektZielRow>(`${PZ_SELECT} WHERE z.projekt_id = $1 ORDER BY s.nummer_sort, j.jahr NULLS FIRST, j.nummer_sort, z.id`, [projektId])).rows;
}

export async function getProjektZiel(tx: Tx, projektId: string, id: string): Promise<ProjektZielRow | null> {
  return (await tx.query<ProjektZielRow>(`${PZ_SELECT} WHERE z.projekt_id = $1 AND z.id = $2`, [projektId, id])).rows[0] ?? null;
}

/** Bestehende Zuordnung (gleiches Projekt, strategisches Ziel und Jahresziel), sonst null. */
export async function zuordnungSuchen(tx: Tx, projektId: string, strategischesZielId: string, jahreszielId: string | null): Promise<string | null> {
  return (await tx.query<{ id: string }>(
    `SELECT id FROM ${ZP} WHERE projekt_id = $1 AND strategisches_ziel_id = $2 AND jahresziel_id IS NOT DISTINCT FROM $3::uuid`,
    [projektId, strategischesZielId, jahreszielId])).rows[0]?.id ?? null;
}

export async function zuordnen(tx: Tx, projektId: string, strategischesZielId: string, jahreszielId: string | null): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${ZP} (tenant_id, projekt_id, strategisches_ziel_id, jahresziel_id) VALUES (app.tenant_id(), $1, $2, $3) RETURNING id`,
    [projektId, strategischesZielId, jahreszielId])).rows[0]!.id;
}

export async function zuordnungLoesen(tx: Tx, projektId: string, id: string): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${ZP} WHERE projekt_id = $1 AND id = $2`, [projektId, id])).rowCount ?? 0) > 0;
}

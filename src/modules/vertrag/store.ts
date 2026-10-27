/**
 * Datenzugriff des Projektvertrags. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen
 * darf, filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Phase } from './kapitel.ts';

export const STAENDE = ['in_arbeit', 'in_pruefung', 'zur_unterzeichnung', 'unterzeichnet', 'traktandiert', 'abgenommen', 'abgelehnt', 'verworfen', 'zurueckgezogen'] as const;
export type Stand = (typeof STAENDE)[number];
/** Stände eines Entwurfs (noch nicht entschieden); höchstens einer je Projekt (UX-E5, A-29). */
export const ENTWURF: readonly Stand[] = ['in_arbeit', 'in_pruefung', 'zur_unterzeichnung', 'unterzeichnet', 'traktandiert'];
export const ANLAESSE = ['initial', 'gate', 'aenderung'] as const;
export type Anlass = (typeof ANLAESSE)[number];

export interface VersionRow {
  id: string; projekt_id: string; nummer: string; anlass: Anlass; zielphase: Phase; stand: Stand; baseline: boolean; baseline_at: Date | null;
  basis_version_id: string | null; hauptaenderungen: Record<string, unknown>; andere: string; begruendung: string;
  eingereicht_at: Date | null; eingereicht_by: string | null; version: number; created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null;
}

export interface KapitelRow { version_id: string; kapitel: number; inhalt: Record<string, unknown>; geaendert: boolean; version: number; updated_at: Date; updated_by: string | null }

const V = `${SCHEMA}.vertrag_version`;
const K = `${SCHEMA}.vertrag_kapitel`;
const SPALTEN = `id, projekt_id, nummer, anlass, zielphase, stand, baseline, baseline_at, basis_version_id, hauptaenderungen, andere, begruendung,
  eingereicht_at, eingereicht_by, version, created_at, created_by, updated_at, updated_by`;

/** Versionen eines Projekts, neueste zuerst (nach Nummer «2.10» vor «2.9»). */
export async function versionen(tx: Tx, projektId: string): Promise<VersionRow[]> {
  return (await tx.query<VersionRow>(
    `SELECT ${SPALTEN} FROM ${V} WHERE projekt_id = $1
      ORDER BY split_part(nummer, '.', 1)::int DESC, split_part(nummer, '.', 2)::int DESC`, [projektId])).rows;
}

export async function version(tx: Tx, id: string): Promise<VersionRow | null> {
  return (await tx.query<VersionRow>(`SELECT ${SPALTEN} FROM ${V} WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Legt eine Version an und liefert die ID (ohne RETURNING: Lesen danach unter der Lesesicht). */
export async function versionAnlegen(tx: Tx, v: { projektId: string; nummer: string; anlass: Anlass; zielphase: Phase; basisVersionId: string | null; begruendung: string }): Promise<string> {
  const id = (await tx.query<{ id: string }>('SELECT gen_random_uuid() AS id')).rows[0]!.id;
  await tx.query(
    `INSERT INTO ${V} (tenant_id, id, projekt_id, nummer, anlass, zielphase, basis_version_id, begruendung) VALUES (app.tenant_id(), $1, $2, $3, $4, $5, $6, $7)`,
    [id, v.projektId, v.nummer, v.anlass, v.zielphase, v.basisVersionId, v.begruendung]);
  return id;
}

/** Stand ändern, nur bei passender Version (If-Match) und erwartetem bisherigem Stand; false, wenn nicht. */
export async function standSetzen(tx: Tx, id: string, version: number | null, von: readonly Stand[], nach: Stand, extra: { eingereicht?: boolean; baseline?: boolean } = {}): Promise<boolean> {
  const sets = ['stand = $3'];
  if (extra.eingereicht) sets.push('eingereicht_at = now()', 'eingereicht_by = app.principal_id()');
  if (extra.baseline) sets.push('baseline = true', 'baseline_at = now()');
  return ((await tx.query(
    `UPDATE ${V} SET ${sets.join(', ')} WHERE id = $1 AND ($2::int IS NULL OR version = $2) AND stand = ANY ($4::text[])`,
    [id, version, nach, von])).rowCount ?? 0) > 0;
}

/** Bisherige Baseline des Projekts aufheben (vor dem Setzen der neuen; höchstens eine). */
export async function baselineAufheben(tx: Tx, projektId: string): Promise<void> {
  await tx.query(`UPDATE ${V} SET baseline = false WHERE projekt_id = $1 AND baseline`, [projektId]);
}

export async function kapitel(tx: Tx, versionId: string): Promise<KapitelRow[]> {
  return (await tx.query<KapitelRow>(`SELECT version_id, kapitel, inhalt, geaendert, version, updated_at, updated_by FROM ${K} WHERE version_id = $1 ORDER BY kapitel`, [versionId])).rows;
}

export async function einKapitel(tx: Tx, versionId: string, nr: number): Promise<KapitelRow | null> {
  return (await tx.query<KapitelRow>(
    `SELECT version_id, kapitel, inhalt, geaendert, version, updated_at, updated_by FROM ${K} WHERE version_id = $1 AND kapitel = $2`, [versionId, nr])).rows[0] ?? null;
}

export async function kapitelAnlegen(tx: Tx, projektId: string, versionId: string, nr: number, inhalt: Record<string, unknown>, geaendert: boolean): Promise<void> {
  await tx.query(`INSERT INTO ${K} (tenant_id, projekt_id, version_id, kapitel, inhalt, geaendert) VALUES (app.tenant_id(), $1, $2, $3, $4, $5)`,
    [projektId, versionId, nr, JSON.stringify(inhalt), geaendert]);
}

/** Inhalt ersetzen bei passender Version (If-Match; `null` = ohne Prüfung, nur für das System); false, wenn nicht. */
export async function kapitelSetzen(tx: Tx, versionId: string, nr: number, version: number | null, inhalt: Record<string, unknown>, geaendert: boolean): Promise<boolean> {
  return ((await tx.query(`UPDATE ${K} SET inhalt = $4, geaendert = $5 WHERE version_id = $1 AND kapitel = $2 AND ($3::int IS NULL OR version = $3)`,
    [versionId, nr, version, JSON.stringify(inhalt), geaendert])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Bezüge aus anderen Modulen (nur lesend)

export interface ProjektKopf { id: string; nummer: string; name: string; phase: Phase; lebenszyklus: string; herkunft: Record<string, unknown> }

/**
 * Kopf des Projekts unter der Lesesicht (null = unbekannt oder nicht sichtbar). Nur lesend und nur Spalten der
 * Kerntabelle aus 010 (fachmodell.md 2.5); das Modul projekt bietet dafür (noch) keine Abfrage über `index.ts`.
 */
export async function projekt(tx: Tx, id: string): Promise<ProjektKopf | null> {
  return (await tx.query<ProjektKopf>(
    `SELECT id, nummer, name, phase, lebenszyklus, herkunft FROM ${SCHEMA}.projekt WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Sichtbare Projekte unter den IDs (Abhängigkeiten in Kap. 6). */
export async function projekteSichtbar(tx: Tx, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  return new Set((await tx.query<{ id: string }>(`SELECT id FROM ${SCHEMA}.projekt WHERE id = ANY ($1::uuid[])`, [ids])).rows.map(r => r.id));
}

/** Bestehende Personen der Organisation unter den IDs (Projektorganisation in Kap. 8). */
export async function personenVorhanden(tx: Tx, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  return new Set((await tx.query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.principal WHERE id = ANY ($1::uuid[]) AND kind = 'user' AND removed_at IS NULL`, [ids])).rows.map(r => r.id));
}

/**
 * Strategisches Ziel mit seinem Handlungsfeld (Kap. 2, PP.02.05); null = unbekannt. Nur lesend aus
 * der Tabelle von AP-E0-9 (080); das Modul ziel bietet dafür (noch) keine Abfrage über `index.ts`.
 */
export async function strategischesZiel(tx: Tx, id: string): Promise<{ id: string; handlungsfeld_id: string } | null> {
  return (await tx.query<{ id: string; handlungsfeld_id: string }>(`SELECT id, handlungsfeld_id FROM ${SCHEMA}.strategisches_ziel WHERE id = $1`, [id])).rows[0] ?? null;
}

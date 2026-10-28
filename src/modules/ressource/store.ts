/**
 * Datenzugriff des Kapazitätsangebots. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen
 * darf, filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Lebenszyklus } from '../projekt/index.ts';

export interface ZelleRow { id: string; rolle: string; monat: string; fte: number; version: number }

const T = `${SCHEMA}.kapazitaet`;
const SPALTEN = 'id, rolle, monat, fte::float8 AS fte, version';

/** Angebot im Zeitraum «JJJJ-MM» von–bis, nach Rolle und Monat. */
export async function list(tx: Tx, von: string, bis: string): Promise<ZelleRow[]> {
  return (await tx.query<ZelleRow>(`SELECT ${SPALTEN} FROM ${T} WHERE monat BETWEEN $1 AND $2 ORDER BY rolle, monat`, [von, bis])).rows;
}

export async function get(tx: Tx, rolle: string, monat: string): Promise<ZelleRow | null> {
  return (await tx.query<ZelleRow>(`SELECT ${SPALTEN} FROM ${T} WHERE rolle = $1 AND monat = $2 FOR UPDATE`, [rolle, monat])).rows[0] ?? null;
}

export async function create(tx: Tx, rolle: string, monat: string, fte: number): Promise<ZelleRow> {
  return (await tx.query<ZelleRow>(`INSERT INTO ${T} (tenant_id, rolle, monat, fte) VALUES (app.tenant_id(), $1, $2, $3) RETURNING ${SPALTEN}`, [rolle, monat, fte])).rows[0]!;
}

export async function update(tx: Tx, id: string, version: number, fte: number): Promise<ZelleRow | null> {
  return (await tx.query<ZelleRow>(`UPDATE ${T} SET fte = $3 WHERE id = $1 AND version = $2 RETURNING ${SPALTEN}`, [id, version, fte])).rows[0] ?? null;
}

export async function remove(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${T} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

/**
 * Nummer und Name der Projekte unter der Lesesicht. Nur lesend und nur Spalten der Kerntabelle aus 010 (fachmodell.md
 * 2.5); das Modul projekt bietet dafür (noch) keine Abfrage über `index.ts` (wie projektdaten).
 */
export async function projekte(tx: Tx, ids: readonly string[]): Promise<{ id: string; nummer: string; name: string }[]> {
  if (!ids.length) return [];
  return (await tx.query<{ id: string; nummer: string; name: string }>(`SELECT id, nummer, name FROM ${SCHEMA}.projekt WHERE id = ANY ($1::uuid[]) ORDER BY nummer`, [ids])).rows;
}

/**
 * Zählt ein Projekt für Auslastung, Bedarf und Zuteilung (UC-015 Schritt 6, A1.2: «gibt Ressourcen frei»)? Nur im
 * Lebenszyklus `aktiv`; sistierte, abgebrochene, abgeschlossene und zurückgezogene Projekte zählen nicht. Entschieden
 * beim Lesen, nichts wird gelöscht: Bei einer Wiederaufnahme (`sistiert` → `aktiv`) zählen Bedarf und Zuteilungen wieder.
 */
export const AKTIV: Lebenszyklus = 'aktiv';

/** Sichtbare Projekte unter `ids`, die nicht mehr aktiv sind (Spalte der Kerntabelle aus 010, wie `projekte`). */
export async function inaktiv(tx: Tx, ids: readonly string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  return new Set((await tx.query<{ id: string }>(`SELECT id FROM ${SCHEMA}.projekt WHERE id = ANY ($1::uuid[]) AND lebenszyklus <> $2`, [ids, AKTIV])).rows.map(r => r.id));
}

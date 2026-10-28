/**
 * Datenzugriff der Vorlagen (AM.03.01; UC-018 Schritte 1–2; Migration 400). Läuft in einer Transaktion mit
 * Mandantenkontext; die Lesesicht (RLS) lässt nur Personen mit `vorlage:write` zu. Die Dokumentausgabe liest die aktive
 * Version in voller Sicht (`aktiveDatei`).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Art } from './arten.ts';

const V = `${SCHEMA}.vorlage`;

export type Stand = 'entwurf' | 'aktiv' | 'abgeloest';

export interface VersionRow {
  id: string; art: Art; version: number; stand: Stand; dateiname: string; groesse: number; sha256: string; platzhalter: string[];
  zuordnung: Record<string, string | null>; personendaten: boolean; bemerkung: string; aktiv_at: Date | null; rev: number;
  created_at: Date; created_by: string | null; created_name: string | null; updated_at: Date;
}
const SELECT = `SELECT v.id, v.art, v.version, v.stand, v.dateiname, octet_length(v.datei) AS groesse, v.sha256, v.platzhalter, v.zuordnung, v.personendaten, v.bemerkung,
       v.aktiv_at, v.rev, v.created_at, v.created_by, p.display_name AS created_name, v.updated_at
  FROM ${V} v LEFT JOIN ${SCHEMA}.principal p ON p.id = v.created_by`;

/** Alle Versionen, je Art neueste zuerst. */
export async function alle(tx: Tx, art?: Art): Promise<VersionRow[]> {
  return (await tx.query<VersionRow>(`${SELECT} ${art ? 'WHERE v.art = $1' : ''} ORDER BY v.art, v.version DESC`, art ? [art] : [])).rows;
}

export async function eine(tx: Tx, art: Art, version: number): Promise<VersionRow | null> {
  return (await tx.query<VersionRow>(`${SELECT} WHERE v.art = $1 AND v.version = $2`, [art, version])).rows[0] ?? null;
}

export async function datei(tx: Tx, art: Art, version: number): Promise<{ dateiname: string; datei: Buffer } | null> {
  return (await tx.query<{ dateiname: string; datei: Buffer }>(`SELECT dateiname, datei FROM ${V} WHERE art = $1 AND version = $2`, [art, version])).rows[0] ?? null;
}

/** Neue Version (fortlaufend je Art); liefert die Nummer. Die Sperre auf die Art reiht gleichzeitiges Hochladen. */
export async function anlegen(tx: Tx, art: Art, v: { dateiname: string; datei: Buffer; sha256: string; platzhalter: string[]; zuordnung: Record<string, string | null>; personendaten: boolean; bemerkung: string }): Promise<number> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`vorlage:${art}`]);
  return (await tx.query<{ version: number }>(
    `INSERT INTO ${V} (tenant_id, art, version, dateiname, datei, sha256, platzhalter, zuordnung, personendaten, bemerkung)
     VALUES (app.tenant_id(), $1, (SELECT coalesce(max(version), 0) + 1 FROM ${V} WHERE art = $1), btrim($2), $3, $4, $5, $6, $7, btrim($8)) RETURNING version`,
    [art, v.dateiname, v.datei, v.sha256, JSON.stringify(v.platzhalter), JSON.stringify(v.zuordnung), v.personendaten, v.bemerkung])).rows[0]!.version;
}

export async function zuordnen(tx: Tx, art: Art, version: number, rev: number, zuordnung: Record<string, string | null>, bemerkung: string | undefined): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${V} SET zuordnung = $4, bemerkung = coalesce(btrim($5), bemerkung) WHERE art = $1 AND version = $2 AND rev = $3 AND stand = 'entwurf'`,
    [art, version, rev, JSON.stringify(zuordnung), bemerkung ?? null])).rowCount ?? 0) > 0;
}

/** Version aktiv setzen; die bisher aktive der Art wird abgelöst (höchstens eine aktiv, Index `vorlage_aktiv`). */
export async function aktivieren(tx: Tx, art: Art, version: number, rev: number): Promise<boolean> {
  await tx.query(`UPDATE ${V} SET stand = 'abgeloest' WHERE art = $1 AND stand = 'aktiv'`, [art]);
  return ((await tx.query(
    `UPDATE ${V} SET stand = 'aktiv', aktiv_at = now(), aktiv_by = app.principal_id() WHERE art = $1 AND version = $2 AND rev = $3 AND stand = 'entwurf'`,
    [art, version, rev])).rowCount ?? 0) > 0;
}

export async function entfernen(tx: Tx, art: Art, version: number, rev: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${V} WHERE art = $1 AND version = $2 AND rev = $3 AND stand = 'entwurf'`, [art, version, rev])).rowCount ?? 0) > 0;
}

/** Aktive Version einer Art mit Datei und Zuordnung (volle Sicht, für die Dokumentausgabe); null = Grundbestand. */
export async function aktiveDatei(tx: Tx, art: Art): Promise<{ version: number; datei: Buffer; zuordnung: Record<string, string | null> } | null> {
  return (await tx.query<{ version: number; datei: Buffer; zuordnung: Record<string, string | null> }>(
    `SELECT version, datei, zuordnung FROM ${V} WHERE art = $1 AND stand = 'aktiv'`, [art])).rows[0] ?? null;
}

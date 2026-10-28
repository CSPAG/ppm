/**
 * Datenzugriff für die Freigabe der Initialisierung (AP-E4-3). Läuft in der Transaktion des Aufrufers (Lesesicht der
 * Anfrage, im Entscheid die der Sitzung, bei der Direktion volle Sicht nach geprüftem Recht).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

const T = `${SCHEMA}.idee`;

export interface FreigabeRow {
  kategorie: 'A' | 'B' | 'C' | null; portfolio_id: string | null; vorgesehener_sponsor: string | null; sponsor: string | null;
  projektleitung: string | null; freigegeben_at: Date | null; projekt_id: string | null;
}

export async function angaben(tx: Tx, id: string): Promise<FreigabeRow | null> {
  return (await tx.query<FreigabeRow>(
    `SELECT kategorie, portfolio_id, vorgesehener_sponsor, sponsor, projektleitung, freigegeben_at, projekt_id FROM ${T} WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Portfolio der Idee mit Name und Direktion (Organisationseinheit, nur Kategorie C, A-23). */
export async function portfolio(tx: Tx, id: string): Promise<{ id: string; name: string; kategorie: 'A' | 'B' | 'C'; org_einheit_id: string | null } | null> {
  return (await tx.query<{ id: string; name: string; kategorie: 'A' | 'B' | 'C'; org_einheit_id: string | null }>(
    `SELECT id, name, kategorie, org_einheit_id FROM ${SCHEMA}.portfolio WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Projekt kurz (Lesesicht): wer es nicht sieht, erhält `null`. */
export async function projekt(tx: Tx, id: string): Promise<{ id: string; nummer: string; name: string; lebenszyklus: string } | null> {
  return (await tx.query<{ id: string; nummer: string; name: string; lebenszyklus: string }>(
    `SELECT id, nummer, name, lebenszyklus FROM ${SCHEMA}.projekt WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Personen der Organisation (für Sponsor und Projektleitung); liefert die vorhandenen IDs. */
export async function personenVorhanden(tx: Tx, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  return new Set((await tx.query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.principal WHERE id = ANY ($1::uuid[]) AND kind = 'user' AND removed_at IS NULL`, [ids])).rows.map(r => r.id));
}

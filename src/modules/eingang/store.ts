/**
 * Datenzugriff des Eingangs (Lesen). Läuft in der Transaktion der Anfrage; welche Aufgaben und Mitteilungen die Person
 * sieht, entscheidet die Lesesicht (Migration 070) – die Abfragen hier kennen keine Rechte.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import { intern } from './aufgabe.ts';

const HEUTE = "(now() AT TIME ZONE 'Europe/Zurich')::date";

export interface AufgabeRow {
  id: string; art: string; titel: string; kontext: string | null; link: string; frist: string | null; frist_art: 'kalendertage' | 'arbeitstage' | null;
  bezug_typ: string; bezug_id: string; empfaenger_person: string | null; manuell: boolean; created_at: Date; created_key: string;
  vertretung_person: string | null; vertretung_name: string | null; vertretung_bis: string | null;
}

/** Sortierschlüssel: Frist aufsteigend (ohne Frist zuletzt), dann Eingang. */
const KEY = "coalesce(a.frist, DATE '9999-12-31')";

/** Offene Aufgaben, die die Person sieht; mit der vertretenen Person, wenn die Aufgabe ihr gehört. */
export async function aufgaben(tx: Tx, me: string, o: { id?: string; nurFrist?: boolean; after?: { f: string; c: string; i: string } | null; limit: number }): Promise<AufgabeRow[]> {
  const args: unknown[] = [me];
  const where = ["a.stand = 'offen'"];
  if (o.id) { args.push(o.id); where.push(`a.id = $${args.length}::uuid`); }
  if (o.nurFrist) where.push('a.frist IS NOT NULL');
  if (o.after) {
    args.push(o.after.f, o.after.c, o.after.i);
    where.push(`(${KEY}, a.created_at, a.id) > ($${args.length - 2}::date, $${args.length - 1}::timestamptz, $${args.length}::uuid)`);
  }
  args.push(o.limit + 1);
  return (await tx.query<AufgabeRow>(
    `SELECT a.id, a.art, a.titel, a.kontext, a.link, to_char(a.frist, 'YYYY-MM-DD') AS frist, a.frist_art, a.bezug_typ, a.bezug_id,
            a.empfaenger_person, a.manuell, a.created_at, a.created_at::text AS created_key,
            v.person AS vertretung_person, v.name AS vertretung_name, v.bis AS vertretung_bis
       FROM ${SCHEMA}.aufgabe a
       LEFT JOIN LATERAL (
         SELECT s.vertretene_person AS person, p.display_name AS name, to_char(max(s.bis), 'YYYY-MM-DD') AS bis
           FROM ${SCHEMA}.stellvertretung s JOIN ${SCHEMA}.principal p ON p.tenant_id = s.tenant_id AND p.id = s.vertretene_person
          WHERE a.empfaenger_person IS NOT NULL AND a.empfaenger_person <> $1 AND s.vertretene_person = a.empfaenger_person
            AND s.vertreter_person = $1 AND ${HEUTE} BETWEEN s.von AND s.bis
          GROUP BY s.vertretene_person, p.display_name) v ON true
      WHERE ${where.join(' AND ')}
      ORDER BY ${KEY}, a.created_at, a.id LIMIT $${args.length}`, args)).rows;
}

/** Sortierschlüssel einer Zeile für den Cursor (Zeit als Text: Mikrosekunden bleiben erhalten). */
export const aufgabeKey = (r: AufgabeRow) => ({ f: r.frist ?? '9999-12-31', c: r.created_key, i: r.id });

/** Eine offene Aufgabe, die die Person sieht. */
export async function aufgabe(tx: Tx, me: string, id: string): Promise<AufgabeRow | null> {
  return (await aufgaben(tx, me, { id, limit: 1 }))[0] ?? null;
}

export async function anzahl(tx: Tx): Promise<{ offen: number; ueberfaellig: number; naechste_frist: string | null }> {
  return (await tx.query<{ offen: number; ueberfaellig: number; naechste_frist: string | null }>(
    `SELECT count(*)::int AS offen, count(*) FILTER (WHERE frist < ${HEUTE})::int AS ueberfaellig,
            to_char(min(frist) FILTER (WHERE frist >= ${HEUTE}), 'YYYY-MM-DD') AS naechste_frist
       FROM ${SCHEMA}.aufgabe WHERE stand = 'offen'`)).rows[0]!;
}

/** Von Hand erledigen (nur `manuell`); die Sichtbarkeit hat die Route vorher geprüft. */
export async function erledigen(tx: Tx, id: string): Promise<boolean> {
  return intern(tx, async () => ((await tx.query(
    `UPDATE ${SCHEMA}.aufgabe SET stand = 'erledigt', erledigt_von = app.principal_id(), erledigt_at = now()
      WHERE id = $1 AND stand = 'offen' AND manuell`, [id])).rowCount ?? 0) > 0);
}

export interface MitteilungRow { id: string; text: string; link: string | null; bezug_typ: string; bezug_id: string; gelesen_at: Date | null; created_at: Date; created_key: string }

export async function mitteilungen(tx: Tx, o: { ungelesen: boolean; after: { c: string; i: string } | null; limit: number }): Promise<MitteilungRow[]> {
  const args: unknown[] = [];
  const where = ['empfaenger_person = app.principal_id()'];
  if (o.ungelesen) where.push('gelesen_at IS NULL');
  if (o.after) { args.push(o.after.c, o.after.i); where.push('(created_at, id) < ($1::timestamptz, $2::uuid)'); }
  args.push(o.limit + 1);
  return (await tx.query<MitteilungRow>(
    `SELECT id, text, link, bezug_typ, bezug_id, gelesen_at, created_at, created_at::text AS created_key FROM ${SCHEMA}.mitteilung
      WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT $${args.length}`, args)).rows;
}

export async function ungelesen(tx: Tx): Promise<number> {
  return (await tx.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${SCHEMA}.mitteilung WHERE empfaenger_person = app.principal_id() AND gelesen_at IS NULL`)).rows[0]!.n;
}

/** Als gelesen markieren (idempotent); false, wenn die Mitteilung der Person nicht gehört oder nicht existiert. */
export async function gelesen(tx: Tx, id: string): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${SCHEMA}.mitteilung SET gelesen_at = coalesce(gelesen_at, now()) WHERE id = $1 AND empfaenger_person = app.principal_id()`, [id])).rowCount ?? 0) > 0;
}

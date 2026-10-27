/**
 * Datenzugriff der Projekte. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen darf,
 * filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte. Ausnahme ist die Projektnummer (A-47): Sie zählt
 * alle Projekte der Organisation und wird darum mit voller Sicht ermittelt (`naechsteNummer`).
 */
import { randomUUID } from 'node:crypto';
import type { Db, Tx } from '@vollholz/platform';
import { fullTx, SCHEMA } from '../../platform.ts';
import type { Funktion, Lebenszyklus, Phase, ProjektCreateIn, ProjektPatchIn } from './schemas.ts';

export interface Row {
  id: string; nummer: string; name: string; portfolio_id: string; org_einheit_id: string | null; handlungsfeld_id: string | null;
  phase: Phase; phasenmodell_id: string | null; lebenszyklus: Lebenszyklus; vertraulich: boolean; herkunft: Record<string, unknown>;
  version: number; created_at: Date; updated_at: Date;
  pf_schluessel: string | null; pf_name: string | null; pf_kategorie: 'A' | 'B' | 'C' | null; hf_label: string | null;
  sponsor: string | null; projektleitung: string | null; controlling: string | null; rollen: Funktion[];
}

const T = `${SCHEMA}.projekt`;
const P = `${SCHEMA}.projekt_person`;
const COLS = 'id, nummer, name, portfolio_id, org_einheit_id, handlungsfeld_id, phase, phasenmodell_id, lebenszyklus, vertraulich, herkunft, version, created_at, updated_at';

/** Projekt mit Portfolio, Handlungsfeld (falls sichtbar), Sponsor, Projektleitung, CTL und eigenen Funktionen. */
const SELECT = `
  SELECT ${COLS.split(', ').map(c => `p.${c}`).join(', ')},
         pf.schluessel AS pf_schluessel, pf.name AS pf_name, pf.kategorie AS pf_kategorie, hf.label AS hf_label,
         (SELECT x.person_id FROM ${P} x WHERE x.projekt_id = p.id AND x.funktion = 'sp') AS sponsor,
         (SELECT x.person_id FROM ${P} x WHERE x.projekt_id = p.id AND x.funktion = 'pl') AS projektleitung,
         (SELECT x.person_id FROM ${P} x WHERE x.projekt_id = p.id AND x.funktion = 'ctl') AS controlling,
         ARRAY(SELECT x.funktion FROM ${P} x WHERE x.projekt_id = p.id AND x.person_id = app.principal_id() ORDER BY x.funktion) AS rollen
    FROM ${T} p
    LEFT JOIN ${SCHEMA}.portfolio pf ON pf.tenant_id = p.tenant_id AND pf.id = p.portfolio_id
    LEFT JOIN ${SCHEMA}.handlungsfeld hf ON hf.tenant_id = p.tenant_id AND hf.id = p.handlungsfeld_id`;

export interface ListFilter {
  rolle?: Funktion; portfolio?: string; phase?: Phase; lebenszyklus?: Lebenszyklus[]; nummer?: string; q?: string;
  after?: { nummer: string } | null; limit: number;
}

export async function list(tx: Tx, f: ListFilter): Promise<Row[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };
  if (f.rolle) where.push(`EXISTS (SELECT 1 FROM ${P} x WHERE x.projekt_id = p.id AND x.person_id = app.principal_id() AND x.funktion = ${arg(f.rolle)})`);
  if (f.portfolio) where.push(`pf.schluessel = ${arg(f.portfolio)}`);
  if (f.phase) where.push(`p.phase = ${arg(f.phase)}`);
  if (f.lebenszyklus?.length) where.push(`p.lebenszyklus = ANY (${arg(f.lebenszyklus)}::text[])`);
  if (f.nummer) where.push(`p.nummer = ${arg(f.nummer)}`);
  if (f.q) { const like = arg(`%${f.q.replace(/[\\%_]/g, m => `\\${m}`)}%`); where.push(`(p.name ILIKE ${like} OR p.nummer ILIKE ${like})`); }
  if (f.after) where.push(`p.nummer > ${arg(f.after.nummer)}`);
  return (await tx.query<Row>(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.nummer LIMIT ${arg(f.limit + 1)}`, args)).rows;
}

export async function get(tx: Tx, id: string): Promise<Row | null> {
  return (await tx.query<Row>(`${SELECT} WHERE p.id = $1`, [id])).rows[0] ?? null;
}

/**
 * Nächste Nummer «JJJJ-NNN» im Jahr der Anlage (Zeitzone der Organisation, A-47). Die Sperre in der fachlichen
 * Transaktion reiht Anlagen derselben Organisation und desselben Jahres; die Zählung mit voller Sicht (eigene
 * Transaktion) sieht auch Projekte, die die Person nicht lesen darf, und liefert nur die Nummer zurück.
 */
export async function naechsteNummer(tx: Tx, ctx: { db: Db; tenantId: string }): Promise<string> {
  const jahr = (await tx.query<{ j: number }>("SELECT extract(year FROM now() AT TIME ZONE 'Europe/Zurich')::int AS j")).rows[0]!.j;
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`ppm:projekt-nummer:${ctx.tenantId}:${jahr}`]);
  const letzte = await fullTx(ctx.db, ctx.tenantId, async full => (await full.query<{ n: number | null }>(
    `SELECT max(split_part(nummer, '-', 2)::int) AS n FROM ${T} WHERE nummer LIKE $1`, [`${jahr}-%`])).rows[0]!.n ?? 0);
  return `${jahr}-${String(letzte + 1).padStart(3, '0')}`;
}

/** Legt an und liefert die ID; ohne RETURNING, damit ein Projekt, das die Person danach nicht lesen darf, kein RLS-Fehler ist. */
export async function create(tx: Tx, nummer: string, input: ProjektCreateIn & { herkunft?: Record<string, unknown> }): Promise<string> {
  const id = randomUUID();
  await tx.query(
    `INSERT INTO ${T} (tenant_id, id, nummer, name, portfolio_id, phase, org_einheit_id, handlungsfeld_id, vertraulich, herkunft)
     VALUES (app.tenant_id(), $1, $2, btrim($3), $4, $5, $6, $7, $8, $9)`,
    [id, nummer, input.name, input.portfolioId, input.phase ?? 'P0', input.orgEinheitId ?? null, input.handlungsfeldId ?? null,
      input.vertraulich ?? false, input.herkunft ?? {}]);
  return id;
}

const SPALTEN = { name: 'name', orgEinheitId: 'org_einheit_id', handlungsfeldId: 'handlungsfeld_id', vertraulich: 'vertraulich' } as const;

/** Ändert nur bei passender Version; false, wenn nicht (mehr) vorhanden, nicht änderbar oder Version abweicht. */
export async function update(tx: Tx, id: string, version: number, patch: ProjektPatchIn): Promise<boolean> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  for (const [k, col] of Object.entries(SPALTEN) as [keyof ProjektPatchIn, string][]) {
    const v = patch[k];
    if (v === undefined) continue;
    args.push(typeof v === 'string' ? v.trim() : v);
    sets.push(`${col} = $${args.length}`);
  }
  return ((await tx.query(`UPDATE ${T} SET ${sets.join(', ')} WHERE id = $1 AND version = $2`, args)).rowCount ?? 0) > 0;
}

/** Phase bzw. Lebenszyklus setzen (Fachaktionen der oberen Module); false, wenn nicht änderbar. */
export async function setzen(tx: Tx, id: string, werte: { phase?: Phase; phasenmodell_id?: string | null; lebenszyklus?: Lebenszyklus }): Promise<boolean> {
  const sets: string[] = [];
  const args: unknown[] = [id];
  for (const [col, v] of Object.entries(werte)) { if (v === undefined) continue; args.push(v); sets.push(`${col} = $${args.length}`); }
  return ((await tx.query(`UPDATE ${T} SET ${sets.join(', ')} WHERE id = $1`, args)).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Projektorganisation

export interface MitgliedRow { person_id: string; funktion: Funktion; akv: string; stand: number }

/** Reihenfolge der Darstellung: Sponsor, Koalition, Projektleitung, CTL, Kernteam (Q7 Kap. 8). */
const ORDNUNG = "array_position(ARRAY['sp', 'koalition', 'pl', 'ctl', 'kt'], funktion)";

export async function mitglieder(tx: Tx, projektId: string): Promise<MitgliedRow[]> {
  return (await tx.query<MitgliedRow>(
    `SELECT person_id, funktion, akv, stand FROM ${P} WHERE projekt_id = $1 ORDER BY ${ORDNUNG}, position, created_at`, [projektId])).rows;
}

/** Ersetzt die Projektorganisation; alle Zeilen erhalten den Stand `stand`. */
export async function ersetzen(tx: Tx, projektId: string, stand: number, liste: { personId: string; funktion: Funktion; akv: string }[]): Promise<void> {
  await tx.query(`DELETE FROM ${P} WHERE projekt_id = $1`, [projektId]);
  if (!liste.length) return;
  await tx.query(
    `INSERT INTO ${P} (tenant_id, projekt_id, person_id, funktion, akv, position, stand)
     SELECT app.tenant_id(), $1, x.person_id, x.funktion, x.akv, x.pos - 1, $2
       FROM unnest($3::uuid[], $4::text[], $5::text[]) WITH ORDINALITY AS x (person_id, funktion, akv, pos)`,
    [projektId, stand, liste.map(m => m.personId), liste.map(m => m.funktion), liste.map(m => m.akv)]);
}

/** Personen, die es in der Organisation gibt und die nicht entfernt sind (Benutzer, keine Maschinen-Clients). */
export async function personenVorhanden(tx: Tx, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  return new Set((await tx.query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.principal WHERE id = ANY ($1::uuid[]) AND kind = 'user' AND removed_at IS NULL`, [ids])).rows.map(r => r.id));
}

/** Kopf: laufende Projekte, in denen die Person eine Funktion hat. */
export async function kopf(tx: Tx, limit: number): Promise<{ rows: Row[]; anzahl: number }> {
  const eigene = `EXISTS (SELECT 1 FROM ${P} x WHERE x.projekt_id = p.id AND x.person_id = app.principal_id()) AND p.lebenszyklus IN ('aktiv', 'sistiert')`;
  const rows = (await tx.query<Row>(`${SELECT} WHERE ${eigene} ORDER BY p.nummer LIMIT $1`, [limit])).rows;
  const anzahl = (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${T} p WHERE ${eigene}`)).rows[0]!.n;
  return { rows, anzahl };
}

/**
 * Datenzugriff der Stammdaten. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen
 * darf, filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import { CODETABELLEN } from './codetabellen.ts';
import type { CodewertCreateIn, CodewertPatchIn, FeiertagCreateIn, FeiertagPatchIn, OrgEinheitCreateIn, OrgEinheitPatchIn } from './schemas.ts';

interface Meta { version: number; created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null }
const META = 'version, created_at, created_by, updated_at, updated_by';

const like = (q: string) => `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;

/** SET-Teil eines UPDATE aus den angegebenen Feldern (Texte ohne Leerraum am Rand). */
function sets<T extends object>(patch: T, cols: Record<string, string>, args: unknown[]): string[] {
  const out: string[] = [];
  for (const [k, col] of Object.entries(cols)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v === undefined) continue;
    args.push(typeof v === 'string' ? v.trim() : v);
    out.push(`${col} = $${args.length}`);
  }
  return out;
}

// --- Organisationseinheiten

export interface OrgRow extends Meta { id: string; parent_id: string | null; kuerzel: string; name: string; art: 'direktion' | 'bereich'; aktiv: boolean; kinder: number }

const ORG = `${SCHEMA}.org_einheit`;
const ORG_COLS = `o.id, o.parent_id, o.kuerzel, o.name, o.art, o.aktiv, o.${META.split(', ').join(', o.')},
  (SELECT count(*)::int FROM ${ORG} k WHERE k.parent_id = o.id) AS kinder`;

export async function listOrg(tx: Tx, o: { q?: string; art?: string; aktiv?: boolean; after?: { kuerzel: string; id: string } | null; limit: number }): Promise<OrgRow[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (o.q) { args.push(like(o.q)); where.push(`(o.kuerzel ILIKE $${args.length} OR o.name ILIKE $${args.length})`); }
  if (o.art) { args.push(o.art); where.push(`o.art = $${args.length}`); }
  if (o.aktiv !== undefined) { args.push(o.aktiv); where.push(`o.aktiv = $${args.length}`); }
  if (o.after) { args.push(o.after.kuerzel.toLowerCase(), o.after.id); where.push(`(lower(o.kuerzel), o.id) > ($${args.length - 1}, $${args.length}::uuid)`); }
  args.push(o.limit + 1);
  return (await tx.query<OrgRow>(`SELECT ${ORG_COLS} FROM ${ORG} o ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY lower(o.kuerzel), o.id LIMIT $${args.length}`, args)).rows;
}

export async function getOrg(tx: Tx, id: string): Promise<OrgRow | null> {
  return (await tx.query<OrgRow>(`SELECT ${ORG_COLS} FROM ${ORG} o WHERE o.id = $1`, [id])).rows[0] ?? null;
}

/** Wäre `parentId` als Elternteil von `id` ein Kreis (Elternteil ist die Einheit selbst oder eine ihrer Nachfahren)? */
export async function wouldCycle(tx: Tx, id: string, parentId: string): Promise<boolean> {
  return (await tx.query<{ ok: boolean }>(
    `WITH RECURSIVE up AS (SELECT id, parent_id FROM ${ORG} WHERE id = $1
       UNION SELECT o.id, o.parent_id FROM ${ORG} o JOIN up ON o.id = up.parent_id)
     SELECT EXISTS (SELECT 1 FROM up WHERE id = $2) AS ok`, [parentId, id])).rows[0]!.ok;
}

export async function createOrg(tx: Tx, input: OrgEinheitCreateIn): Promise<OrgRow> {
  const { id } = (await tx.query<{ id: string }>(
    `INSERT INTO ${ORG} (tenant_id, kuerzel, name, art, parent_id, aktiv) VALUES (app.tenant_id(), btrim($1), btrim($2), $3, $4, $5) RETURNING id`,
    [input.kuerzel, input.name, input.art ?? 'bereich', input.parentId ?? null, input.aktiv ?? true])).rows[0]!;
  return (await getOrg(tx, id))!;
}

/** Ändert nur bei passender Version; null, wenn nicht (mehr) vorhanden oder Version abweicht. */
export async function updateOrg(tx: Tx, id: string, version: number, patch: OrgEinheitPatchIn): Promise<OrgRow | null> {
  const args: unknown[] = [id, version];
  const s = sets(patch, { kuerzel: 'kuerzel', name: 'name', art: 'art', parentId: 'parent_id', aktiv: 'aktiv' }, args);
  const n = (await tx.query(`UPDATE ${ORG} SET ${s.join(', ')} WHERE id = $1 AND version = $2`, args)).rowCount ?? 0;
  return n ? getOrg(tx, id) : null;
}

export async function removeOrg(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${ORG} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

// --- Codetabellen und Codewerte

export interface WertRow extends Meta { id: string; codetabelle: string; schluessel: string; label: string; position: number; aktiv: boolean }

const WERT = `${SCHEMA}.codewert`;
const WERT_COLS = `id, codetabelle, schluessel, label, position, aktiv, ${META}`;

export async function zaehlen(tx: Tx): Promise<Map<string, { anzahl: number; aktiv: number }>> {
  const rows = (await tx.query<{ codetabelle: string; anzahl: number; aktiv: number }>(
    `SELECT codetabelle, count(*)::int AS anzahl, count(*) FILTER (WHERE aktiv)::int AS aktiv FROM ${WERT} GROUP BY codetabelle`)).rows;
  return new Map(rows.map(r => [r.codetabelle, { anzahl: r.anzahl, aktiv: r.aktiv }]));
}

export async function listWerte(tx: Tx, tabelle: string, o: { aktiv?: boolean; after?: { position: number; schluessel: string; id: string } | null; limit: number }): Promise<WertRow[]> {
  const where = ['codetabelle = $1'];
  const args: unknown[] = [tabelle];
  if (o.aktiv !== undefined) { args.push(o.aktiv); where.push(`aktiv = $${args.length}`); }
  if (o.after) { args.push(o.after.position, o.after.schluessel, o.after.id); where.push(`(position, schluessel, id) > ($${args.length - 2}, $${args.length - 1}, $${args.length}::uuid)`); }
  args.push(o.limit + 1);
  return (await tx.query<WertRow>(`SELECT ${WERT_COLS} FROM ${WERT} WHERE ${where.join(' AND ')} ORDER BY position, schluessel, id LIMIT $${args.length}`, args)).rows;
}

export async function getWert(tx: Tx, tabelle: string, id: string): Promise<WertRow | null> {
  return (await tx.query<WertRow>(`SELECT ${WERT_COLS} FROM ${WERT} WHERE codetabelle = $1 AND id = $2`, [tabelle, id])).rows[0] ?? null;
}

export async function createWert(tx: Tx, tabelle: string, input: CodewertCreateIn): Promise<WertRow> {
  return (await tx.query<WertRow>(
    `INSERT INTO ${WERT} (tenant_id, codetabelle, schluessel, label, position) VALUES (app.tenant_id(), $1, $2, btrim($3), $4) RETURNING ${WERT_COLS}`,
    [tabelle, input.schluessel, input.label, input.position ?? 0])).rows[0]!;
}

export async function updateWert(tx: Tx, tabelle: string, id: string, version: number, patch: CodewertPatchIn & { aktiv?: boolean }): Promise<WertRow | null> {
  const args: unknown[] = [tabelle, id, version];
  const s = sets(patch, { label: 'label', position: 'position', aktiv: 'aktiv' }, args);
  return (await tx.query<WertRow>(`UPDATE ${WERT} SET ${s.join(', ')} WHERE codetabelle = $1 AND id = $2 AND version = $3 RETURNING ${WERT_COLS}`, args)).rows[0] ?? null;
}

/** Vorgabe laden: legt fehlende Schlüssel aller Codetabellen an, vorhandene (auch deaktivierte) bleiben unverändert. */
export async function vorgabeLaden(tx: Tx): Promise<WertRow[]> {
  const rows = CODETABELLEN.flatMap(t => t.vorgabe.map((v, i) => [t.schluessel, v.schluessel, v.label, (i + 1) * 10] as const));
  return (await tx.query<WertRow>(
    `INSERT INTO ${WERT} (tenant_id, codetabelle, schluessel, label, position)
     SELECT app.tenant_id(), * FROM unnest($1::text[], $2::text[], $3::text[], $4::int[])
     ON CONFLICT (tenant_id, codetabelle, schluessel) DO NOTHING RETURNING ${WERT_COLS}`,
    [rows.map(r => r[0]), rows.map(r => r[1]), rows.map(r => r[2]), rows.map(r => r[3])])).rows;
}

// --- Feiertage

export interface FeiertagRow extends Meta { id: string; datum: string; label: string }

const FT = `${SCHEMA}.feiertag`;
const FT_COLS = `id, to_char(datum, 'YYYY-MM-DD') AS datum, label, ${META}`;

export async function listFeiertage(tx: Tx, o: { jahr?: number; after?: { datum: string; id: string } | null; limit: number }): Promise<FeiertagRow[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (o.jahr) { args.push(o.jahr); where.push(`extract(year FROM datum) = $${args.length}`); }
  if (o.after) { args.push(o.after.datum, o.after.id); where.push(`(datum, id) > ($${args.length - 1}::date, $${args.length}::uuid)`); }
  args.push(o.limit + 1);
  return (await tx.query<FeiertagRow>(`SELECT ${FT_COLS} FROM ${FT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY datum, id LIMIT $${args.length}`, args)).rows;
}

export async function getFeiertag(tx: Tx, id: string): Promise<FeiertagRow | null> {
  return (await tx.query<FeiertagRow>(`SELECT ${FT_COLS} FROM ${FT} WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function createFeiertag(tx: Tx, input: FeiertagCreateIn): Promise<FeiertagRow> {
  return (await tx.query<FeiertagRow>(
    `INSERT INTO ${FT} (tenant_id, datum, label) VALUES (app.tenant_id(), $1, btrim($2)) RETURNING ${FT_COLS}`, [input.datum, input.label])).rows[0]!;
}

export async function updateFeiertag(tx: Tx, id: string, version: number, patch: FeiertagPatchIn): Promise<FeiertagRow | null> {
  const args: unknown[] = [id, version];
  const s = sets(patch, { datum: 'datum', label: 'label' }, args);
  return (await tx.query<FeiertagRow>(`UPDATE ${FT} SET ${s.join(', ')} WHERE id = $1 AND version = $2 RETURNING ${FT_COLS}`, args)).rows[0] ?? null;
}

export async function removeFeiertag(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${FT} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

/** Feiertage zwischen `von` und `bis` (je einschliesslich) als 'YYYY-MM-DD'. */
export async function feiertageZwischen(tx: Tx, von: string, bis: string): Promise<string[]> {
  return (await tx.query<{ d: string }>(`SELECT to_char(datum, 'YYYY-MM-DD') AS d FROM ${FT} WHERE datum BETWEEN $1::date AND $2::date ORDER BY datum`, [von, bis])).rows.map(r => r.d);
}

// --- Für andere Module (über index.ts)

/** Ist `schluessel` ein aktiver Wert der Codetabelle? Zum Prüfen von Eingaben (deaktivierte Werte nicht mehr wählbar). */
export async function codewertAktiv(tx: Tx, tabelle: string, schluessel: string): Promise<boolean> {
  return (await tx.query(`SELECT 1 FROM ${WERT} WHERE codetabelle = $1 AND schluessel = $2 AND aktiv`, [tabelle, schluessel])).rowCount === 1;
}

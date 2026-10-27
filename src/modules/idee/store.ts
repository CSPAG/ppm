/**
 * Datenzugriff der Projektideen. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen
 * darf, filtert die Lesesicht (RLS, Muster EIGEN) – die Abfragen hier kennen keine Rechte. Ausnahmen mit voller Sicht:
 * die laufende Nummer (zählt alle Ideen der Organisation) und die Auswahl des Strategiebezugs (Antragstellende haben
 * kein Leserecht auf Handlungsfelder und Ziele, wählen sie aber im Assistenten, K4 Schritt 2).
 */
import type { Db, Tx } from '@vollholz/platform';
import { fullTx, SCHEMA } from '../../platform.ts';
import type { Felder, IdeePatchIn, Stand } from './schemas.ts';

export interface Row {
  id: string; nummer: number; erfasst_von: string; stand: Stand; stand_at: Date; eingereicht_at: Date | null;
  titel: string; ausgangslage: string; zielsetzung: string; handlungsfeld_id: string | null; strategisches_ziel_id: string | null;
  org_einheit_ids: string[]; nutzen: Felder['nutzen']; nutzen_text: string; aufwand: Felder['aufwand']; aufwand_text: string;
  relevanz: Felder['relevanz']; relevanz_text: string; herkunft: string | null; fuehrende_idee_id: string | null; begruendung: string;
  version: number; created_at: Date; updated_at: Date; rueckfragen_offen: number;
}

export interface RueckfrageRow {
  id: string; idee_id: string; feld: string | null; text: string; antwort: string | null; gestellt_at: Date; beantwortet_at: Date | null;
}

const T = `${SCHEMA}.idee`;
const R = `${SCHEMA}.idee_rueckfrage`;
const COLS = `i.id, i.nummer, i.erfasst_von, i.stand, i.stand_at, i.eingereicht_at, i.titel, i.ausgangslage, i.zielsetzung, i.handlungsfeld_id,
  i.strategisches_ziel_id, i.org_einheit_ids, i.nutzen, i.nutzen_text, i.aufwand, i.aufwand_text, i.relevanz, i.relevanz_text, i.herkunft,
  i.fuehrende_idee_id, i.begruendung, i.version, i.created_at, i.updated_at,
  (SELECT count(*)::int FROM ${R} r WHERE r.tenant_id = i.tenant_id AND r.idee_id = i.id AND r.antwort IS NULL) AS rueckfragen_offen`;

/** Spalte je Feld der API. */
const COLUMN = {
  titel: 'titel', ausgangslage: 'ausgangslage', zielsetzung: 'zielsetzung', handlungsfeldId: 'handlungsfeld_id',
  strategischesZielId: 'strategisches_ziel_id', bereiche: 'org_einheit_ids', nutzen: 'nutzen', nutzenText: 'nutzen_text',
  aufwand: 'aufwand', aufwandText: 'aufwand_text', relevanz: 'relevanz', relevanzText: 'relevanz_text', herkunft: 'herkunft',
} as const satisfies Record<keyof Felder, string>;

const wert = (v: unknown) => (typeof v === 'string' ? v.trim() : v);

export async function list(tx: Tx, o: { stand?: Stand[]; eigene?: boolean; nummer?: number; after?: number | null; limit: number }): Promise<Row[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (o.stand?.length) { args.push(o.stand); where.push(`i.stand = ANY ($${args.length}::text[])`); }
  if (o.eigene) where.push('i.erfasst_von = app.principal_id()');
  if (o.nummer) { args.push(o.nummer); where.push(`i.nummer = $${args.length}`); }
  if (o.after) { args.push(o.after); where.push(`i.nummer < $${args.length}`); }
  args.push(o.limit + 1);
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} i ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY i.nummer DESC LIMIT $${args.length}`, args)).rows;
}

export async function get(tx: Tx, id: string): Promise<Row | null> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} i WHERE i.id = $1`, [id])).rows[0] ?? null;
}

/**
 * Nächste laufende Nummer der Organisation. Die Sperre in der fachlichen Transaktion reiht Anlagen derselben
 * Organisation; die Zählung mit voller Sicht (eigene Transaktion) sieht auch Ideen anderer und liefert nur die Zahl.
 */
export async function naechsteNummer(tx: Tx, ctx: { db: Db; tenantId: string }): Promise<number> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`ppm:idee-nummer:${ctx.tenantId}`]);
  const letzte = await fullTx(ctx.db, ctx.tenantId, async full => (await full.query<{ n: number | null }>(`SELECT max(nummer) AS n FROM ${T}`)).rows[0]!.n ?? 0);
  return letzte + 1;
}

export async function create(tx: Tx, nummer: number, input: Partial<Felder>): Promise<Row> {
  const cols = ['tenant_id', 'nummer'];
  const vals = ['app.tenant_id()', '$1'];
  const args: unknown[] = [nummer];
  for (const k of Object.keys(COLUMN) as (keyof Felder)[]) {
    const v = input[k];
    if (v === undefined) continue;
    args.push(wert(v));
    cols.push(COLUMN[k]);
    vals.push(`$${args.length}`);
  }
  const { id } = (await tx.query<{ id: string }>(`INSERT INTO ${T} (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING id`, args)).rows[0]!;
  return (await get(tx, id))!;
}

/** Ändert nur bei passender Version; null, wenn nicht (mehr) änderbar oder die Version abweicht. */
export async function update(tx: Tx, id: string, version: number, patch: IdeePatchIn): Promise<Row | null> {
  const sets: string[] = [];
  const args: unknown[] = [id, version];
  for (const k of Object.keys(COLUMN) as (keyof Felder)[]) {
    const v = patch[k];
    if (v === undefined) continue;
    args.push(wert(v));
    sets.push(`${COLUMN[k]} = $${args.length}`);
  }
  const r = await tx.query(`UPDATE ${T} SET ${sets.join(', ')} WHERE id = $1 AND version = $2`, args);
  return r.rowCount ? get(tx, id) : null;
}

/** Stand setzen (Übergang im Ablauf); null bei abweichender Version. */
export async function setStand(tx: Tx, id: string, version: number, stand: Stand, o: { eingereicht?: boolean } = {}): Promise<Row | null> {
  const r = await tx.query(
    `UPDATE ${T} SET stand = $3${o.eingereicht ? ', eingereicht_at = now()' : ''} WHERE id = $1 AND version = $2`, [id, version, stand]);
  return r.rowCount ? get(tx, id) : null;
}

export async function remove(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${T} WHERE id = $1 AND version = $2 AND stand = 'entwurf'`, [id, version])).rowCount ?? 0) > 0;
}

export async function rueckfragen(tx: Tx, ideeId: string): Promise<RueckfrageRow[]> {
  return (await tx.query<RueckfrageRow>(
    `SELECT id, idee_id, feld, text, antwort, gestellt_at, beantwortet_at FROM ${R} WHERE idee_id = $1 ORDER BY gestellt_at, id`, [ideeId])).rows;
}

/** Rückfrage stellen (UC-001 A2.1); die Route dazu bringt AP-E4-2, Tests nutzen sie direkt. */
export async function rueckfrageStellen(tx: Tx, ideeId: string, text: string, feld: string | null = null): Promise<string> {
  return (await tx.query<{ id: string }>(
    `INSERT INTO ${R} (tenant_id, idee_id, feld, text) VALUES (app.tenant_id(), $1, $2, btrim($3)) RETURNING id`, [ideeId, feld, text])).rows[0]!.id;
}

export async function rueckfrageBeantworten(tx: Tx, ideeId: string, id: string, antwort: string): Promise<RueckfrageRow | null> {
  return (await tx.query<RueckfrageRow>(
    `UPDATE ${R} SET antwort = btrim($3), beantwortet_at = now() WHERE idee_id = $1 AND id = $2
     RETURNING id, idee_id, feld, text, antwort, gestellt_at, beantwortet_at`, [ideeId, id, antwort])).rows[0] ?? null;
}

/** Strategisches Ziel mit seinem Handlungsfeld (volle Sicht, nur IDs); null, wenn unbekannt. */
export async function zielVon(ctx: { db: Db; tenantId: string }, zielId: string): Promise<{ handlungsfeld_id: string } | null> {
  return fullTx(ctx.db, ctx.tenantId, async full => (await full.query<{ handlungsfeld_id: string }>(
    `SELECT handlungsfeld_id FROM ${SCHEMA}.strategisches_ziel WHERE id = $1`, [zielId])).rows[0] ?? null);
}

/** Anzahl der aktiven Organisationseinheiten unter den IDs (Lesesicht `stammdaten:read`, Grundmenge jeder Rolle). */
export async function bereicheAktiv(tx: Tx, ids: string[]): Promise<number> {
  return (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${SCHEMA}.org_einheit WHERE id = ANY ($1::uuid[]) AND aktiv`, [ids])).rows[0]!.n;
}

/**
 * Auswahl des Strategiebezugs für den Assistenten (K4 Schritt 2): Handlungsfelder mit Leitsatz und ihre strategischen
 * Ziele mit voller Sicht (nur Bezeichnung, Leitsatz, Nummer und Text), Bereiche und Herkunft mit der Lesesicht.
 */
export async function auswahl(tx: Tx, ctx: { db: Db; tenantId: string }) {
  const strategie = await fullTx(ctx.db, ctx.tenantId, async full => {
    const felder = (await full.query<{ id: string; label: string; leitsatz: string }>(
      `SELECT id, label, leitsatz FROM ${SCHEMA}.handlungsfeld ORDER BY position, label, id`)).rows;
    const ziele = (await full.query<{ id: string; handlungsfeld_id: string; nummer: string; text: string }>(
      `SELECT id, handlungsfeld_id, nummer, text FROM ${SCHEMA}.strategisches_ziel ORDER BY nummer_sort, id`)).rows;
    return felder.map(f => ({
      id: f.id, label: f.label, leitsatz: f.leitsatz,
      ziele: ziele.filter(z => z.handlungsfeld_id === f.id).map(z => ({ id: z.id, nummer: z.nummer, text: z.text })),
    }));
  });
  const bereiche = (await tx.query<{ id: string; kuerzel: string; name: string; parent_id: string | null }>(
    `SELECT id, kuerzel, name, parent_id FROM ${SCHEMA}.org_einheit WHERE aktiv ORDER BY name, id`)).rows;
  const herkunft = (await tx.query<{ schluessel: string; label: string }>(
    `SELECT schluessel, label FROM ${SCHEMA}.codewert WHERE codetabelle = 'idee_herkunft' AND aktiv ORDER BY position, label`)).rows;
  return { handlungsfelder: strategie, bereiche: bereiche.map(b => ({ id: b.id, kuerzel: b.kuerzel, name: b.name, parentId: b.parent_id })), herkunft };
}

/** Kennzahlen für den Kopf der Startseite (fachmodell.md 4.1). */
export async function kopf(tx: Tx, o: { pool: boolean }) {
  const e = (await tx.query<{ entwurf: number; in_ergaenzung: number; laufend: number }>(
    `SELECT count(*) FILTER (WHERE stand = 'entwurf')::int AS entwurf,
            count(*) FILTER (WHERE stand = 'in_ergaenzung')::int AS in_ergaenzung,
            count(*) FILTER (WHERE stand IN ('eingereicht', 'in_pruefung', 'traktandiert', 'zurueckgestellt'))::int AS laufend
       FROM ${T} WHERE erfasst_von = app.principal_id()`)).rows[0]!;
  const zuPruefen = o.pool ? (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${T} WHERE stand = 'eingereicht'`)).rows[0]!.n : null;
  return { eigene: { entwurf: e.entwurf, inErgaenzung: e.in_ergaenzung, laufend: e.laufend }, zuPruefen };
}

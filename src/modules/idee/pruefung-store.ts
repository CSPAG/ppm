/**
 * Datenzugriff für Ideenpool und Prüfung (AP-E4-2). Läuft in der Transaktion der Anfrage mit Lesesicht; Ausnahme ist die
 * Liste der Gremiumsmitglieder für die Mitteilung bei einer Zurückweisung (A-06), die die Tupel mit voller Sicht liest.
 */
import type { Db, Tx } from '@vollholz/platform';
import { fullTx, SCHEMA } from '../../platform.ts';
import { KRITERIEN, type Kriterium } from './pruefung-schemas.ts';
import type { Stand } from './schemas.ts';

const T = `${SCHEMA}.idee`;
const R = `${SCHEMA}.idee_rueckfrage`;
const L = `${SCHEMA}.idee_leitfrage`;
const RA = `${SCHEMA}.idee_raster`;

export interface PoolRow {
  id: string; nummer: number; titel: string; stand: Stand; stand_at: Date; eingereicht_at: Date | null; erfasst_von: string;
  handlungsfeld_id: string | null; org_einheit_ids: string[]; herkunft: string | null; kategorie: 'A' | 'B' | 'C' | null; rueckfragen_offen: number;
}

const POOL_COLS = `i.id, i.nummer, i.titel, i.stand, i.stand_at, i.eingereicht_at, i.erfasst_von, i.handlungsfeld_id, i.org_einheit_ids, i.herkunft, i.kategorie,
  (SELECT count(*)::int FROM ${R} r WHERE r.tenant_id = i.tenant_id AND r.idee_id = i.id AND r.antwort IS NULL) AS rueckfragen_offen`;

export interface PoolAfter { at: string; id: string }

/** Ideenpool ohne Entwürfe; `wartet`: am längsten im aktuellen Stand zuerst (K4 Prüfen 5), `neu`: zuletzt eingereicht zuerst. */
export async function pool(tx: Tx, o: { stand?: Stand[]; handlungsfeld?: string; herkunft?: string; sort: 'wartet' | 'neu'; after?: PoolAfter | null; limit: number }): Promise<PoolRow[]> {
  const where = ["i.stand <> 'entwurf'"];
  const args: unknown[] = [];
  if (o.stand?.length) { args.push(o.stand); where.push(`i.stand = ANY ($${args.length}::text[])`); }
  if (o.handlungsfeld) { args.push(o.handlungsfeld); where.push(`i.handlungsfeld_id = $${args.length}::uuid`); }
  if (o.herkunft) { args.push(o.herkunft); where.push(`i.herkunft = $${args.length}`); }
  const key = o.sort === 'wartet' ? 'i.stand_at' : "coalesce(i.eingereicht_at, i.created_at)";
  const cmp = o.sort === 'wartet' ? '>' : '<';
  const richtung = o.sort === 'wartet' ? 'ASC' : 'DESC';
  if (o.after) { args.push(o.after.at, o.after.id); where.push(`(${key}, i.id) ${cmp} ($${args.length - 1}::timestamptz, $${args.length}::uuid)`); }
  args.push(o.limit + 1);
  return (await tx.query<PoolRow & { sort_at: Date }>(
    `SELECT ${POOL_COLS}, ${key} AS sort_at FROM ${T} i WHERE ${where.join(' AND ')} ORDER BY ${key} ${richtung}, i.id ${richtung} LIMIT $${args.length}`, args)).rows;
}

export async function funnel(tx: Tx): Promise<{ stufen: { stand: Stand; anzahl: number }[]; letzte: Date | null }> {
  const rows = (await tx.query<{ stand: Stand; n: number }>(`SELECT stand, count(*)::int AS n FROM ${T} WHERE stand <> 'entwurf' GROUP BY stand`)).rows;
  const letzte = (await tx.query<{ t: Date | null }>(`SELECT max(eingereicht_at) AS t FROM ${T} WHERE stand <> 'entwurf'`)).rows[0]!.t;
  return { stufen: rows.map(r => ({ stand: r.stand, anzahl: r.n })), letzte };
}

/** Ähnliche Ideen (UC-001 Schritt 3): gleiches Handlungsfeld oder gemeinsame betroffene Bereiche; offene zuerst. */
export async function aehnliche(tx: Tx, idee: { id: string; handlungsfeld_id: string | null; org_einheit_ids: string[] }) {
  return (await tx.query<PoolRow & { gleiches_feld: boolean; gemeinsam: number }>(
    `SELECT ${POOL_COLS},
            (i.handlungsfeld_id IS NOT DISTINCT FROM $2::uuid AND $2::uuid IS NOT NULL) AS gleiches_feld,
            cardinality(ARRAY(SELECT unnest(i.org_einheit_ids) INTERSECT SELECT unnest($3::uuid[])))::int AS gemeinsam
       FROM ${T} i
      WHERE i.stand <> 'entwurf' AND i.id <> $1
        AND ((i.handlungsfeld_id = $2::uuid) OR (i.org_einheit_ids && $3::uuid[] AND cardinality($3::uuid[]) > 0))
      ORDER BY (i.stand IN ('zurueckgewiesen', 'zusammengefuehrt', 'freigegeben')), i.stand_at DESC, i.id
      LIMIT 20`, [idee.id, idee.handlungsfeld_id, idee.org_einheit_ids])).rows;
}

export interface LeitfrageRow { position: number; wertestrom: string; frage: string; antwort: string }

export async function leitfragen(tx: Tx, ideeId: string): Promise<LeitfrageRow[]> {
  return (await tx.query<LeitfrageRow>(`SELECT position, wertestrom, frage, antwort FROM ${L} WHERE idee_id = $1 ORDER BY position`, [ideeId])).rows;
}

export async function leitfrageSetzen(tx: Tx, ideeId: string, f: { position: number; phasenmodellId: string | null; wertestrom: string; frage: string; antwort: string }): Promise<void> {
  await tx.query(
    `INSERT INTO ${L} (tenant_id, idee_id, position, phasenmodell_id, wertestrom, frage, antwort)
     VALUES (app.tenant_id(), $1, $2, $3, $4, $5, btrim($6))
     ON CONFLICT (tenant_id, idee_id, position) DO UPDATE SET phasenmodell_id = EXCLUDED.phasenmodell_id, wertestrom = EXCLUDED.wertestrom,
       frage = EXCLUDED.frage, antwort = EXCLUDED.antwort, updated_at = now(), updated_by = app.principal_id()`,
    [ideeId, f.position, f.phasenmodellId, f.wertestrom, f.frage, f.antwort]);
}

export async function raster(tx: Tx, ideeId: string): Promise<Map<Kriterium, 'hoch' | 'mittel' | 'tief'>> {
  const rows = (await tx.query<{ kriterium: Kriterium; einschaetzung: 'hoch' | 'mittel' | 'tief' }>(`SELECT kriterium, einschaetzung FROM ${RA} WHERE idee_id = $1`, [ideeId])).rows;
  return new Map(rows.map(r => [r.kriterium, r.einschaetzung]));
}

export async function rasterSetzen(tx: Tx, ideeId: string, kriterium: Kriterium, einschaetzung: 'hoch' | 'mittel' | 'tief' | null): Promise<void> {
  if (!einschaetzung) {
    await tx.query(`DELETE FROM ${RA} WHERE idee_id = $1 AND kriterium = $2`, [ideeId, kriterium]);
    return;
  }
  await tx.query(
    `INSERT INTO ${RA} (tenant_id, idee_id, kriterium, einschaetzung) VALUES (app.tenant_id(), $1, $2, $3)
     ON CONFLICT (tenant_id, idee_id, kriterium) DO UPDATE SET einschaetzung = EXCLUDED.einschaetzung, updated_at = now(), updated_by = app.principal_id()`,
    [ideeId, kriterium, einschaetzung]);
}

/**
 * Vorschlag der Kategorie aus dem Raster (G11, Herleitung sichtbar): erst wenn alle Kriterien eingeschätzt sind;
 * mehrheitlich «hoch» spricht für A (strategisch), mehrheitlich «tief» für C (operativ), sonst B (taktisch-operativ).
 * Keine starre Logik: Die UE entscheidet (Q8 Kap. 6); die Regel ist Annahme bis zur Klärung.
 */
export function vorschlag(r: Map<Kriterium, string>): { kategorie: 'A' | 'B' | 'C'; hoch: number; mittel: number; tief: number } | null {
  if (KRITERIEN.some(k => !r.has(k))) return null;
  const n = (s: string) => KRITERIEN.filter(k => r.get(k) === s).length;
  const hoch = n('hoch'), mittel = n('mittel'), tief = n('tief');
  const mehrheit = Math.floor(KRITERIEN.length / 2) + 1;
  return { kategorie: hoch >= mehrheit ? 'A' : tief >= mehrheit ? 'C' : 'B', hoch, mittel, tief };
}

/** Zusätzliche Angaben der Prüfung an der Idee (220 + 230). */
export async function pruefAngaben(tx: Tx, id: string) {
  return (await tx.query<{ vorgesehener_sponsor: string | null; kategorie: 'A' | 'B' | 'C' | null; kategorie_begruendung: string; portfolio_id: string | null }>(
    `SELECT vorgesehener_sponsor, kategorie, kategorie_begruendung, portfolio_id FROM ${T} WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Setzt Felder der Idee ohne Versionsprüfung der Anfrage (die Route prüft `If-Match` vorher in derselben Transaktion). */
export async function setzen(tx: Tx, id: string, felder: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(felder);
  if (!keys.length) return;
  await tx.query(`UPDATE ${T} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...keys.map(k => felder[k])]);
}

export async function rueckfragenStellen(tx: Tx, ideeId: string, fragen: { feld?: string | null; text: string }[]): Promise<void> {
  for (const f of fragen) {
    await tx.query(`INSERT INTO ${R} (tenant_id, idee_id, feld, text) VALUES (app.tenant_id(), $1, $2, btrim($3))`, [ideeId, f.feld ?? null, f.text]);
  }
}

/** Portfolios einer Kategorie (Lesesicht `portfolio:read`, Grundmenge jeder Rolle). */
export async function portfoliosDerKategorie(tx: Tx, kategorie: 'A' | 'B' | 'C'): Promise<{ id: string }[]> {
  return (await tx.query<{ id: string }>(`SELECT id FROM ${SCHEMA}.portfolio WHERE kategorie = $1 ORDER BY id`, [kategorie])).rows;
}

/** Personen mit der Rolle `gremium` direkt am Portfolio (volle Sicht, nur IDs) – Mitteilung bei Zurückweisung (A-06). */
export async function gremiumsmitglieder(ctx: { db: Db; tenantId: string }, portfolioId: string): Promise<string[]> {
  return fullTx(ctx.db, ctx.tenantId, async full => (await full.query<{ id: string }>(
    `SELECT DISTINCT substring(subject FROM 6)::uuid AS id FROM ${SCHEMA}.authz_tuple
      WHERE object_type = 'portfolio' AND object_id = $1 AND relation = 'gremium' AND subject LIKE 'user:%'
        AND (expires_at IS NULL OR expires_at > now())`, [portfolioId])).rows.map(r => r.id));
}

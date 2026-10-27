/**
 * Stellvertretung (BC AM.01.03, UC-016 Schritt 4, Fachmodell 4.3): Die Vertretung sieht im Zeitraum die Aufgaben der
 * vertretenen Person (Lesesicht AUFGABE) und erhält befristete Tupel mit deren Projekt- und Portfoliorollen, damit sie
 * handeln kann. Tupel haben keinen Beginn: Liegt der Zeitraum in der Zukunft, setzt sie der Job
 * `eingang.stellvertretung_aktivieren` am ersten Tag.
 *
 * Unterschriften (A-31, UX-OF-10): Die Rollen tragen `vertrag:sign` mit; ob die Vertretung unterzeichnen darf,
 * prüft das unterzeichnende Modul mit `stellvertretung.aktiv(…).unterschriften` (siehe README.md).
 */
import { TupleStore } from '@vollholz/iam';
import type { Actor, JobDefinition, Tx } from '@vollholz/platform';
import { platform, SCHEMA } from '../../platform.ts';

const S = `${SCHEMA}.stellvertretung`;

/** Heute in der Schweiz; Zeiträume sind Kalendertage in Europe/Zurich. */
const HEUTE = "(now() AT TIME ZONE 'Europe/Zurich')::date";

export const tuples = new TupleStore({ schema: SCHEMA, model: platform.model, audit: platform.audit });

export const AKTIVIEREN = 'eingang.stellvertretung_aktivieren';

export interface Row {
  id: string; vertretene_person: string; vertreter_person: string; von: string; bis: string; unterschriften: boolean;
  tupel: string[]; aktiviert_at: Date | null; created_at: Date; aktiv: boolean;
  vertretene_name: string | null; vertreter_name: string | null;
}

const COLS = `s.id, s.vertretene_person, s.vertreter_person, to_char(s.von, 'YYYY-MM-DD') AS von, to_char(s.bis, 'YYYY-MM-DD') AS bis,
  s.unterschriften, s.tupel, s.aktiviert_at, s.created_at, ${HEUTE} BETWEEN s.von AND s.bis AS aktiv,
  pv.display_name AS vertretene_name, pr.display_name AS vertreter_name`;
const FROM = `${S} s JOIN ${SCHEMA}.principal pv ON pv.tenant_id = s.tenant_id AND pv.id = s.vertretene_person
  JOIN ${SCHEMA}.principal pr ON pr.tenant_id = s.tenant_id AND pr.id = s.vertreter_person`;

/** Stellvertretungen der Person (vertreten und vertretend), noch nicht abgelaufen; früheste zuerst. */
export async function list(tx: Tx, person: string): Promise<Row[]> {
  return (await tx.query<Row>(
    `SELECT ${COLS} FROM ${FROM} WHERE (s.vertretene_person = $1 OR s.vertreter_person = $1) AND s.bis >= ${HEUTE}
      ORDER BY s.von, s.bis, s.id`, [person])).rows;
}

export async function get(tx: Tx, id: string): Promise<Row | null> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${FROM} WHERE s.id = $1`, [id])).rows[0] ?? null;
}

/** Person der Organisation (angemeldet gewesen, nicht entfernt)? */
export async function personBekannt(tx: Tx, id: string): Promise<boolean> {
  return (await tx.query(`SELECT 1 FROM ${SCHEMA}.principal WHERE id = $1 AND kind = 'user' AND removed_at IS NULL`, [id])).rowCount === 1;
}

export async function create(tx: Tx, o: { vertretene: string; vertreter: string; von: string; bis: string; unterschriften: boolean }): Promise<{ id: string; sofort: boolean }> {
  return (await tx.query<{ id: string; sofort: boolean }>(
    `INSERT INTO ${S} (tenant_id, vertretene_person, vertreter_person, von, bis, unterschriften)
     VALUES (app.tenant_id(), $1, $2, $3, $4, $5) RETURNING id, von <= ${HEUTE} AS sofort`,
    [o.vertretene, o.vertreter, o.von, o.bis, o.unterschriften])).rows[0]!;
}

/** Ende des Zeitraums als Zeitpunkt: Mitternacht nach `bis` in Europe/Zurich. */
async function ende(tx: Tx, bis: string): Promise<Date> {
  return (await tx.query<{ t: Date }>("SELECT (($1::date + 1)::timestamp AT TIME ZONE 'Europe/Zurich') AS t", [bis])).rows[0]!.t;
}

/**
 * Befristete Tupel setzen: alle Rollen der vertretenen Person an Portfolio und Projekt (nicht an der Organisation und
 * nicht die, die sie selbst nur als Vertretung hat), befristet bis zum Ende des Zeitraums. Ein gleiches Tupel der
 * Vertretung bleibt unberührt. Idempotent (bereits aktiviert → nichts).
 */
export async function aktivieren(tx: Tx, id: string, actor: Actor): Promise<void> {
  const r = (await tx.query<{ vertretene_person: string; vertreter_person: string; bis: string; aktiviert_at: Date | null }>(
    `SELECT vertretene_person, vertreter_person, to_char(bis, 'YYYY-MM-DD') AS bis, aktiviert_at FROM ${S} WHERE id = $1 FOR UPDATE`, [id])).rows[0];
  if (!r || r.aktiviert_at) return;
  const bis = await ende(tx, r.bis);
  const geliehen = new Set((await tx.query<{ t: string }>(
    `SELECT unnest(tupel) AS t FROM ${S} WHERE vertreter_person = $1`, [r.vertretene_person])).rows.map(x => x.t));
  const vorhanden = new Set((await tuples.ofSubject(tx, `user:${r.vertreter_person}`)).map(t => `${t.relation}|${t.object_type}|${t.object_id}`));
  const jetzt = Date.now();
  const gesetzt: string[] = [];
  for (const t of await tuples.ofSubject(tx, `user:${r.vertretene_person}`)) {
    if (t.object_type === 'org' || !t.object_id || geliehen.has(t.id)) continue;
    if (t.expires_at && t.expires_at.getTime() <= jetzt) continue;
    if (vorhanden.has(`${t.relation}|${t.object_type}|${t.object_id}`)) continue;
    const expiresAt = t.expires_at && t.expires_at < bis ? t.expires_at : bis;
    const neu = await tuples.grant(tx, { subject: `user:${r.vertreter_person}`, relation: t.relation, place: { type: t.object_type, id: t.object_id }, expiresAt },
      { ...actor, extra: { stellvertretung: id, inVertretungVon: r.vertretene_person } });
    gesetzt.push(neu.id);
  }
  await tx.query(`UPDATE ${S} SET tupel = $2, aktiviert_at = now() WHERE id = $1`, [id, gesetzt]);
}

/** Stellvertretung beenden: gesetzte Tupel entziehen, Zeile löschen. */
export async function remove(tx: Tx, row: Row, actor: Actor): Promise<void> {
  for (const t of row.tupel) await tuples.revoke(tx, t, { ...actor, extra: { stellvertretung: row.id } });
  await tx.query(`DELETE FROM ${S} WHERE id = $1`, [row.id]);
}

/** Job: künftigen Zeitraum am ersten Tag aktivieren (eingereiht beim Erfassen mit `runAt` = Beginn). */
export const aktivierenJob: JobDefinition<{ id: string }> = {
  kind: AKTIVIEREN,
  async run(ctx, p) { await ctx.tx(tx => aktivieren(tx, p.id, ctx.actor)); },
};

/** Beginn des Zeitraums als Zeitpunkt (Mitternacht in Europe/Zurich). */
export async function beginn(tx: Tx, von: string): Promise<Date> {
  return (await tx.query<{ t: Date }>("SELECT ($1::date::timestamp AT TIME ZONE 'Europe/Zurich') AS t", [von])).rows[0]!.t;
}

/** Für andere Module (Fachmodell 4.3): heute gültige Vertretung von `vertretene` durch `vertreter`, sonst null. */
async function aktiv(tx: Tx, o: { vertretene: string; vertreter: string }): Promise<{ id: string; bis: string; unterschriften: boolean } | null> {
  return (await tx.query<{ id: string; bis: string; unterschriften: boolean }>(
    `SELECT id, to_char(bis, 'YYYY-MM-DD') AS bis, unterschriften FROM ${S}
      WHERE vertretene_person = $1 AND vertreter_person = $2 AND ${HEUTE} BETWEEN von AND bis
      ORDER BY unterschriften DESC, bis DESC LIMIT 1`, [o.vertretene, o.vertreter])).rows[0] ?? null;
}

/** Personen, die `vertreter` heute vertritt (Banner «in Vertretung von …», I-Z2). */
async function vertretene(tx: Tx, vertreter: string): Promise<{ person: string; bis: string; unterschriften: boolean }[]> {
  return (await tx.query<{ person: string; bis: string; unterschriften: boolean }>(
    `SELECT vertretene_person AS person, to_char(max(bis), 'YYYY-MM-DD') AS bis, bool_or(unterschriften) AS unterschriften FROM ${S}
      WHERE vertreter_person = $1 AND ${HEUTE} BETWEEN von AND bis GROUP BY vertretene_person`, [vertreter])).rows;
}

/** Schnittstelle der Stellvertretung für die Fachmodule. */
export const stellvertretung = { aktiv, vertretene };

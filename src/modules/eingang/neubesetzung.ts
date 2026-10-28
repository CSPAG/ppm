/**
 * Zugang entziehen mit Neubesetzung (AM.01.01, AM.01.02; UC-016 A1, Fachmodell 4.2): Vor dem Entfernen der Person im
 * Baukasten (Mitgliedschaft und alle Tupel; Haken `member.removing`) hält das Modul ihre Rollen an Projekten, Portfolios
 * und anderen Orten fest, nach dem Entfernen (`member.removed`) schliesst es ab.
 * Danach liegt bei der Administration die Aufgabe «Rollen von ‹Person› neu besetzen»; offene Aufgaben der Person zeigt
 * die Neubesetzung live aus `aufgabe`. Neu besetzt werden die Rollen dort, wo sie vergeben werden (z. B. in der
 * Projektorganisation); ob eine Rolle wieder besetzt ist, ergibt sich aus den Tupeln.
 */
import type { IamEvent, IamEvents } from '@vollholz/iam';
import type { Actor, Tx } from '@vollholz/platform';
import { platform, record, SCHEMA } from '../../platform.ts';
import { aufgabe, intern, mitteilung } from './aufgabe.ts';
import { tuples } from './stellvertretung.ts';

const N = `${SCHEMA}.neubesetzung`;
const R = `${SCHEMA}.neubesetzung_rolle`;

/** Aufgabe der Administration (Fachmodell 4.2). */
export const ART = 'zugang.neu_besetzen';
/** Recht, das Zugänge entzieht und die Aufgabe erhält (Baukasten). */
export const RECHT = 'members:admin';

export interface Rolle { ortTyp: string; ortId: string; rolle: string }

export interface Person { id: string; subject: string; name: string | null; entfernt: boolean }

/** Person der Organisation (Principal einer Person) mit Subjekt im Anmeldedienst; null, wenn unbekannt. */
export async function person(tx: Tx, id: string): Promise<Person | null> {
  const r = (await tx.query<{ id: string; subject: string; display_name: string | null; removed_at: Date | null }>(
    `SELECT id, subject, display_name, removed_at FROM ${SCHEMA}.principal WHERE id = $1 AND kind = 'user'`, [id])).rows[0];
  return r ? { id: r.id, subject: r.subject, name: r.display_name, entfernt: !!r.removed_at } : null;
}

/**
 * Rollen der Person an Orten ausser der Organisation, die neu zu besetzen sind: nur unbefristete. Befristete Rollen
 * (z. B. die einer Stellvertretung, Fachmodell 4.3) entfallen ohnehin mit ihrem Ablauf.
 */
export async function rollen(tx: Tx, personId: string): Promise<Rolle[]> {
  return (await tuples.ofSubject(tx, `user:${personId}`))
    .filter(t => t.object_type !== 'org' && t.object_id && !t.expires_at)
    .map(t => ({ ortTyp: t.object_type, ortId: t.object_id!, rolle: t.relation }))
    .sort((a, b) => a.ortTyp.localeCompare(b.ortTyp) || a.ortId.localeCompare(b.ortId) || a.rolle.localeCompare(b.rolle));
}

/** Rollen der Person an der Organisation (Programmrollen, Administration). */
export const orgRollen = (tx: Tx, personId: string) => tuples.rolesAtOrg(tx, `user:${personId}`);

/** Name einer Rolle aus dem Modell (z. B. «Projektleitung»); sonst ihr Schlüssel. */
export const rolleName = (rolle: string): string => platform.model.roles.get(rolle)?.label ?? rolle;

export interface AufgabeRow {
  id: string; art: string; titel: string; kontext: string | null; link: string; frist: string | null; frist_art: 'kalendertage' | 'arbeitstage' | null; created_at: Date;
}

/** Offene Aufgaben an die Person (nicht die an ein Recht); gelesen als Modul, weil sie der Administration nicht gehören. */
export async function offeneAufgaben(tx: Tx, personId: string): Promise<AufgabeRow[]> {
  return intern(tx, async () => (await tx.query<AufgabeRow>(
    `SELECT id, art, titel, kontext, link, to_char(frist, 'YYYY-MM-DD') AS frist, frist_art, created_at
       FROM ${SCHEMA}.aufgabe WHERE empfaenger_person = $1 AND stand = 'offen'
      ORDER BY frist NULLS LAST, created_at, id`, [personId])).rows);
}

/** Neubesetzung, die für die Person gerade entsteht (Haken `member.removing` bis `member.removed`), sonst null. */
async function laufend(tx: Tx, personId: string): Promise<string | null> {
  return (await tx.query<{ id: string }>(`SELECT id FROM ${N} WHERE person = $1 AND stand = 'vorbereitet' FOR UPDATE`, [personId])).rows[0]?.id ?? null;
}

/**
 * Vor dem Entfernen (Haken `member.removing`): Neubesetzung (`vorbereitet`) mit den unbefristeten Rollen an Orten
 * anlegen, solange die Tupel noch bestehen. Eine liegengebliebene (abgebrochenes Entfernen) wird wieder verwendet.
 */
async function vorbereiten(tx: Tx, personId: string, von: string | null): Promise<string> {
  const id = (await laufend(tx, personId))
    ?? (await tx.query<{ id: string }>(`INSERT INTO ${N} (tenant_id, person, created_by) VALUES (app.tenant_id(), $1, $2) RETURNING id`, [personId, von])).rows[0]!.id;
  for (const r of await rollen(tx, personId)) {
    await tx.query(
      `INSERT INTO ${R} (tenant_id, neubesetzung_id, ort_typ, ort_id, rolle) VALUES (app.tenant_id(), $1, $2, $3, $4)
       ON CONFLICT (tenant_id, neubesetzung_id, ort_typ, ort_id, rolle) DO NOTHING`, [id, r.ortTyp, r.ortId, r.rolle]);
  }
  return id;
}

/**
 * Nach dem Entfernen (Haken `member.removed`, dieselbe Transaktion): Stand `entzogen`; gibt es Rollen oder offene
 * Aufgaben, erhält die Administration die Aufgabe «Rollen von ‹Person› neu besetzen» (von Hand erledigbar, sobald alles
 * neu besetzt ist).
 */
async function abschliessen(tx: Tx, id: string, p: { id: string; name: string | null }, who: Actor): Promise<void> {
  await tx.query(`UPDATE ${N} SET stand = 'entzogen', entzogen_at = now() WHERE id = $1 AND stand = 'vorbereitet'`, [id]);
  const n = (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${R} WHERE neubesetzung_id = $1`, [id])).rows[0]!.n;
  const a = (await offeneAufgaben(tx, p.id)).length;
  if (n || a) {
    await aufgabe.oeffnen(tx, {
      art: ART, bezug: { typ: 'neubesetzung', id }, empfaenger: { recht: RECHT },
      titel: `Rollen von ${p.name ?? 'einer Person'} neu besetzen`,
      kontext: [n ? `${n} ${n === 1 ? 'Rolle' : 'Rollen'}` : null, a ? `${a} offene ${a === 1 ? 'Aufgabe' : 'Aufgaben'}` : null].filter(Boolean).join(' · '),
      link: `/administration/neubesetzungen/${id}`, manuell: true,
    });
  }
  await record(tx, who, { action: 'neubesetzung.created', resourceType: 'neubesetzung', resourceId: id, data: { person: p.id, rollen: n, aufgaben: a }, event: { id, person: p.id, rollen: n, aufgaben: a } });
}

/** Zuletzt entzogener Zugang der Person (Antwort der Route «Zugang entziehen»). */
export async function zuletzt(tx: Tx, personId: string): Promise<{ id: string; rollen: number; aufgaben: number } | null> {
  const r = (await intern(tx, async () => tx.query<{ id: string; rollen: number }>(
    `SELECT n.id, (SELECT count(*)::int FROM ${R} r WHERE r.neubesetzung_id = n.id) AS rollen FROM ${N} n
      WHERE n.person = $1 AND n.stand = 'entzogen' ORDER BY n.entzogen_at DESC, n.id DESC LIMIT 1`, [personId]))).rows[0];
  return r ? { ...r, aufgaben: (await offeneAufgaben(tx, personId)).length } : null;
}

/**
 * Rollenänderung als Mitteilung an die Person (UC-016 Schritt 3, «informiert den Benutzer»; Annahme: im Eingang, E-Mail
 * folgt mit A-44). Nur unbefristete Rollen einer Person, die jemand vergeben oder entzogen hat; nicht beim Ablauf, nicht
 * für die befristeten Rollen der Stellvertretung, nicht für die eigene Person und nicht, solange die Person entfernt wird.
 */
async function rolleMitteilen(tx: Tx, e: IamEvent<'access.granted' | 'access.revoked'>): Promise<void> {
  const d = e.data;
  const pid = d.subject.startsWith('user:') ? d.subject.slice(5) : null;
  const von = e.actor.principal?.principalId ?? null;
  if (!pid || !von || von === pid || d.expiresAt || d.previousExpiresAt) return;
  if (await intern(tx, () => laufend(tx, pid))) return;
  const ort = d.type === 'org' ? 'in der Organisation' : `(${platform.model.types.get(d.type)?.label ?? d.type})`;
  await mitteilung.senden(tx, {
    an: pid, bezug: { typ: 'rolle', id: d.tupleId },
    text: e.type === 'access.granted' ? `Du hast die Rolle «${rolleName(d.relation)}» ${ort} erhalten.` : `Deine Rolle «${rolleName(d.relation)}» ${ort} wurde entzogen.`,
  });
}

/**
 * Haken am Baukasten (`AppSpec.iamEvents`): Neubesetzung beim Entfernen eines Mitglieds – über PPM, die Seite
 * «Benutzer und Rollen» des Baukastens oder die Plattform-Administration – und Mitteilung bei Rollenänderungen. Beide
 * laufen in der Transaktion des Baukastens unter der Sperre der Organisation: kurz, ohne Aufrufe nach aussen.
 */
export const iamHaken: IamEvents = {
  async before(tx, e) {
    if (e.type !== 'member.removing' || !e.data.principalId || e.data.invitation) return;
    const pid = e.data.principalId;
    await intern(tx, () => vorbereiten(tx, pid, e.actor.principal?.principalId ?? null));
  },
  async after(tx, e) {
    if (e.type === 'member.removed' && e.data.principalId && !e.data.invitation) {
      const pid = e.data.principalId;
      await intern(tx, async () => {
        const id = await laufend(tx, pid);
        const p = await person(tx, pid);
        if (id && p) await abschliessen(tx, id, p, e.actor);
      });
    } else if (e.type === 'access.granted' || e.type === 'access.revoked') {
      await rolleMitteilen(tx, e);
    }
  },
};

export interface Row {
  id: string; created_key: string; person: string; person_name: string | null; stand: 'vorbereitet' | 'entzogen'; entzogen_at: Date | null;
  created_at: Date; created_by: string | null; created_by_name: string | null; rollen: number; offen: number; erledigt: boolean;
}

/** Erledigt: keine offene Aufgabe «neu besetzen» (nie geöffnet, weil nichts zu tun war, oder von Hand erledigt). */
const ERLEDIGT = `NOT EXISTS (SELECT 1 FROM ${SCHEMA}.aufgabe a WHERE a.art = '${ART}' AND a.bezug_typ = 'neubesetzung' AND a.bezug_id = n.id::text AND a.stand = 'offen')`;

const COLS = `n.id, n.created_at::text AS created_key, n.person, p.display_name AS person_name, n.stand, n.entzogen_at, n.created_at, n.created_by,
  c.display_name AS created_by_name,
  (SELECT count(*)::int FROM ${R} r WHERE r.neubesetzung_id = n.id) AS rollen,
  (SELECT count(*)::int FROM ${R} r WHERE r.neubesetzung_id = n.id AND NOT EXISTS (
     SELECT 1 FROM ${SCHEMA}.authz_tuple t WHERE t.object_type = r.ort_typ AND t.object_id = r.ort_id AND t.relation = r.rolle
        AND t.expires_at IS NULL)) AS offen,
  ${ERLEDIGT} AS erledigt`;
const FROM = `${N} n JOIN ${SCHEMA}.principal p ON p.tenant_id = n.tenant_id AND p.id = n.person
  LEFT JOIN ${SCHEMA}.principal c ON c.tenant_id = n.tenant_id AND c.id = n.created_by`;

/** Neubesetzungen nach entzogenem Zugang, neueste zuerst; `offen`: nur solche mit offener Aufgabe. */
export async function list(tx: Tx, o: { offen?: boolean; nach?: { t: string; id: string } | null; limit: number }): Promise<Row[]> {
  const args: unknown[] = [];
  const where = [`n.stand = 'entzogen'`];
  if (o.nach) { args.push(o.nach.t, o.nach.id); where.push(`(n.created_at, n.id) < ($${args.length - 1}::timestamptz, $${args.length}::uuid)`); }
  if (o.offen) where.push(`NOT (${ERLEDIGT})`);
  args.push(o.limit + 1);
  return (await intern(tx, async () => tx.query<Row>(
    `SELECT ${COLS} FROM ${FROM} WHERE ${where.join(' AND ')} ORDER BY n.created_at DESC, n.id DESC LIMIT $${args.length}`, args))).rows;
}

export async function get(tx: Tx, id: string): Promise<Row | null> {
  return (await intern(tx, async () => tx.query<Row>(`SELECT ${COLS} FROM ${FROM} WHERE n.id = $1 AND n.stand = 'entzogen'`, [id]))).rows[0] ?? null;
}

export interface RolleRow { ort_typ: string; ort_id: string; rolle: string; besetzt: boolean }

/** Festgehaltene Rollen mit Stand: besetzt, sobald jemand die Rolle am Ort wieder unbefristet hat (Tupel). */
export async function rollenVon(tx: Tx, id: string): Promise<RolleRow[]> {
  return (await tx.query<RolleRow>(
    `SELECT r.ort_typ, r.ort_id, r.rolle, EXISTS (
        SELECT 1 FROM ${SCHEMA}.authz_tuple t WHERE t.object_type = r.ort_typ AND t.object_id = r.ort_id AND t.relation = r.rolle
           AND t.expires_at IS NULL) AS besetzt
       FROM ${R} r WHERE r.neubesetzung_id = $1 ORDER BY r.ort_typ, r.ort_id, r.rolle`, [id])).rows;
}

/**
 * Suche nach Sitzungen für die Befehlspalette (I-N4, docs/ux/informationsarchitektur.md): über alle Gremien, deren
 * Sitzungen die Person sieht, nach Gremium (Kürzel, Name), Datum (`2026-11`, `18.11.`, `18.11.2026`) oder Titel eines
 * Traktandums. Sichtbarkeit wie die Liste: Sitzungen nach `sitzung:read` am Portfolio, Traktanden vor dem Versand nur mit
 * `sitzung:write`, vertrauliche nur mit `projekt:vertraulich` (Lesesicht, A-34) – beides über RLS.
 */
import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { Uuid, type Deps, type Tx } from '@vollholz/platform';
import { heute } from './format.ts';
import { TAG } from './routes.ts';
import { Datum } from './schemas.ts';

const SCHEMA = 'ppm';

export const SitzungSucheQuery = Type.Object({
  q: Type.String({ minLength: 1, maxLength: 100, description: 'Gremium (Kürzel oder Name, Teilstring), Datum (JJJJ-MM-TT, JJJJ-MM, TT.MM. oder TT.MM.JJJJ) oder Titel eines Traktandums.' }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20, description: 'Höchstens so viele Treffer (Standard 5).' })),
}, { additionalProperties: false });

export const SitzungSuche = Type.Object({
  items: Type.Array(Type.Object({
    id: Uuid,
    gremium: Type.Object({ id: Uuid, kuerzel: Type.String(), name: Type.String() }, { additionalProperties: false }),
    datum: Datum,
    stand: Type.String(),
    traktandum: Type.Union([Type.String(), Type.Null()], { description: 'Titel des gefundenen Traktandums, wenn die Suche über den Titel traf.' }),
  }, { additionalProperties: false })),
}, { $id: 'SitzungSuche', additionalProperties: false });
type SitzungSucheOut = Static<typeof SitzungSuche>;

/** Datum aus der Eingabe: ISO (ganz oder Monat) als Präfix, sonst Tag und Monat (Jahr optional, zweistellig = 20JJ). */
export function datumAus(q: string): { praefix: string } | { tag: number; monat: number; jahr: number | null } | null {
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(q)) return { praefix: q };
  const m = /^(\d{1,2})\.(\d{1,2})\.?(\d{2}|\d{4})?$/.exec(q);
  if (!m) return null;
  const [tag, monat] = [Number(m[1]), Number(m[2])];
  if (tag < 1 || tag > 31 || monat < 1 || monat > 12) return null;
  const jahr = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : null;
  return { tag, monat, jahr };
}

interface Zeile { id: string; gremium_id: string; kuerzel: string; name: string; datum: string; stand: string; traktandum: string | null }

async function suchen(tx: Tx, q: string, limit: number): Promise<Zeile[]> {
  const args: unknown[] = [`%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`, heute()];
  const oder = ['g.kuerzel ILIKE $1', 'g.name ILIKE $1', 'tr.titel IS NOT NULL'];
  const d = datumAus(q);
  if (d && 'praefix' in d) { args.push(`${d.praefix}%`); oder.push(`to_char(s.datum, 'YYYY-MM-DD') LIKE $${args.length}`); }
  else if (d) {
    args.push(d.tag, d.monat);
    let bed = `(extract(day FROM s.datum) = $${args.length - 1} AND extract(month FROM s.datum) = $${args.length}`;
    if (d.jahr) { args.push(d.jahr); bed += ` AND extract(year FROM s.datum) = $${args.length}`; }
    oder.push(`${bed})`);
  }
  args.push(limit);
  // Traktanden nur, soweit sichtbar (RLS); der erste Treffer nach Position benennt die Fundstelle
  return (await tx.query<Zeile>(
    `SELECT s.id, s.gremium_id, g.kuerzel, g.name, to_char(s.datum, 'YYYY-MM-DD') AS datum, s.stand, tr.titel AS traktandum
       FROM ${SCHEMA}.sitzung s
       JOIN ${SCHEMA}.gremium g ON g.tenant_id = s.tenant_id AND g.id = s.gremium_id
       LEFT JOIN LATERAL (SELECT t.titel FROM ${SCHEMA}.traktandum t WHERE t.sitzung_id = s.id AND t.stand IN ('traktandiert', 'entschieden') AND t.titel ILIKE $1 ORDER BY t.position NULLS LAST LIMIT 1) tr ON true
      WHERE ${oder.join(' OR ')}
      ORDER BY s.datum < $2::date, CASE WHEN s.datum >= $2::date THEN s.datum END, s.datum DESC, g.kuerzel
      LIMIT $${args.length}`, args)).rows;
}

export function registerSucheRoutes(app: FastifyInstance, _deps: Deps): void {
  app.addSchema(SitzungSuche);

  app.get('/v1/sitzungen', {
    schema: {
      tags: [TAG], summary: 'Sitzungen suchen',
      description: 'Für die Befehlspalette (I-N4): Sitzungen aller Gremien, die die Person sieht, nach Gremium, Datum oder Titel eines sichtbaren Traktandums; kommende zuerst (aufsteigend), danach vergangene (neueste zuerst).',
      querystring: SitzungSucheQuery, response: { 200: Type.Ref('SitzungSuche') },
    },
  }, async (req): Promise<SitzungSucheOut> => {
    const q = req.query as { q: string; limit?: number };
    await req.needSomewhere('sitzung:read');
    const text = q.q.trim();
    if (!text) return { items: [] };
    const rows = await req.tx(tx => suchen(tx, text, q.limit ?? 5));
    return {
      items: rows.map(r => ({
        id: r.id, gremium: { id: r.gremium_id, kuerzel: r.kuerzel, name: r.name }, datum: r.datum, stand: r.stand, traktandum: r.traktandum,
      })),
    };
  });
}

/**
 * Gültige Toleranz je Projekt und Dimension (A-10, K11; fachmodell.md 2.x `toleranz`: «Vertrag kann übersteuern»): die
 * Toleranz in Kap. 7 der Baseline des Projektvertrags, sonst der Standard des Phasenmodells des Projekts (A-13), ohne
 * dieses der Version in Kraft. Ohne Wert gibt es keine Warnung «wesentlich». Nutzer: Statusbericht (Warnung, UC-004 A1)
 * und Finanzen (Abweichung, UC-010 Schritt 3).
 */
import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { IdParams, notFound, Nullable, Uuid, type Deps, type Tx } from '@vollholz/platform';
import { aktuellesPhasenmodell, phasenmodellLesen } from '../phasenmodell/index.ts';
import { fullTx, SCHEMA } from '../../platform.ts';
import { DIMENSIONEN_TOLERANZ, EINHEITEN_TOLERANZ } from './kapitel.ts';

export type Dimension = (typeof DIMENSIONEN_TOLERANZ)[number];
export type Einheit = (typeof EINHEITEN_TOLERANZ)[number];
export interface GueltigeToleranz { dimension: Dimension; wert: number | null; einheit: Einheit | null; quelle: 'vertrag' | 'phasenmodell' | null }

/**
 * Gültige Toleranzen der Projekte (je Projekt alle drei Dimensionen) in der Transaktion des Aufrufers; Projekte, die die
 * Person nicht sieht, fehlen in der Antwort (Lesesicht). Den Standard des Phasenmodells liest `voll` (volle Sicht): er
 * ist eine Vorgabe der Organisation und gilt auch für Personen ohne `phasenmodell:read` (z. B. die Projektleitung).
 */
export async function toleranzen(tx: Tx, projektIds: readonly string[], voll: Tx = tx): Promise<Map<string, GueltigeToleranz[]>> {
  const out = new Map<string, GueltigeToleranz[]>();
  if (!projektIds.length) return out;
  const r = await tx.query<{ id: string; phasenmodell_id: string | null; toleranzen: { dimension: Dimension; wert: number; einheit: Einheit }[] | null }>(
    `SELECT p.id, p.phasenmodell_id, k.inhalt->'toleranzen' AS toleranzen FROM ${SCHEMA}.projekt p
       LEFT JOIN ${SCHEMA}.vertrag_version v ON v.projekt_id = p.id AND v.baseline
       LEFT JOIN ${SCHEMA}.vertrag_kapitel k ON k.version_id = v.id AND k.kapitel = 7
      WHERE p.id = ANY ($1::uuid[])`, [projektIds]);
  const modelle = new Map<string | null, { dimension: string; wert: number | null; einheit: Einheit }[]>();
  for (const pm of new Set(r.rows.map(x => x.phasenmodell_id))) {
    modelle.set(pm, (pm ? await phasenmodellLesen(voll, pm) : await aktuellesPhasenmodell(voll))?.toleranzen ?? []);
  }
  for (const p of r.rows) {
    const standard = modelle.get(p.phasenmodell_id) ?? [];
    out.set(p.id, DIMENSIONEN_TOLERANZ.map(dimension => {
      const v = (p.toleranzen ?? []).find(t => t.dimension === dimension);
      if (v) return { dimension, wert: v.wert, einheit: v.einheit, quelle: 'vertrag' as const };
      const s = standard.find(t => t.dimension === dimension);
      return s && s.wert !== null ? { dimension, wert: s.wert, einheit: s.einheit, quelle: 'phasenmodell' as const } : { dimension, wert: null, einheit: null, quelle: null };
    }));
  }
  return out;
}

export const GueltigeToleranzen = Type.Object({
  projektId: Uuid,
  toleranzen: Type.Array(Type.Object({
    dimension: Type.Union(DIMENSIONEN_TOLERANZ.map(d => Type.Literal(d))),
    wert: Nullable(Type.Number({ description: 'Ab dieser Abweichung gilt sie als wesentlich; null: keine Warnung «wesentlich».' })),
    einheit: Nullable(Type.Union(EINHEITEN_TOLERANZ.map(e => Type.Literal(e)))),
    quelle: Nullable(Type.Union([Type.Literal('vertrag'), Type.Literal('phasenmodell')], { description: 'Baseline des Projektvertrags oder Standard des Phasenmodells.' })),
  }, { additionalProperties: false }), { description: 'Termin, Kosten und Umfang in dieser Reihenfolge.' }),
}, { $id: 'GueltigeToleranzen', additionalProperties: false });
export type GueltigeToleranzenOut = Static<typeof GueltigeToleranzen>;

export function registerToleranzRoutes(app: FastifyInstance, deps: Deps, tag: string): void {
  app.addSchema(GueltigeToleranzen);
  app.get('/v1/projekte/:id/toleranzen', {
    schema: {
      tags: [tag], summary: 'Gültige Toleranzen des Projekts', params: IdParams, response: { 200: Type.Ref('GueltigeToleranzen') },
      description: 'Je Dimension die Toleranz aus Kap. 7 der Baseline des Projektvertrags, sonst der Standard des Phasenmodells (A-10). '
        + 'Ohne Wert keine Warnung «wesentlich». Lesen mit `projekt:read` am Projekt.',
    },
  }, async (req): Promise<GueltigeToleranzenOut> => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', { type: 'projekt', id });
    const tenantId = req.requirePrincipal().tenantId;
    const t = await req.tx(tx => fullTx(deps.db, tenantId, voll => toleranzen(tx, [id], voll)));
    const liste = t.get(id);
    if (!liste) throw notFound('Projekt');
    return { projektId: id, toleranzen: liste };
  });
}

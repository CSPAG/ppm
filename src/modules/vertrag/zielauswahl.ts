/**
 * Auswahlliste für Kapitel 2 «Strategiebezug» (PP.02.05, UC-002 Schritt 3, K2 Schritt 3): strategische Ziele mit
 * Handlungsfeld und Jahresziele zur Wahl im Vertrag. Wer den Vertrag bearbeitet, braucht die Ziele, auch ohne
 * `ziel:read` an der Organisation (Projektleitung mit Rollen nur am Projekt): Recht `projekt:write` am Projekt, Lesen in
 * voller Sicht, nur Nummer, Text und Handlungsfeld (Entscheid Master-Session; fachmodell.md 3.3 unverändert).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { IdParams, notFound, type Deps } from '@vollholz/platform';
import { fullTx } from '../../platform.ts';
import * as store from './store.ts';

const Zielauswahl = Type.Object({
  ziele: Type.Array(Type.Object({
    id: Type.String({ format: 'uuid' }), nummer: Type.String(), text: Type.String(),
    handlungsfeldId: Type.String({ format: 'uuid' }), handlungsfeld: Type.String({ description: 'Bezeichnung des Handlungsfelds.' }),
  }, { additionalProperties: false })),
  jahresziele: Type.Array(Type.Object({
    id: Type.String({ format: 'uuid' }), jahr: Type.Integer(), nummer: Type.String(), text: Type.String(), strategischesZielId: Type.String({ format: 'uuid' }),
  }, { additionalProperties: false }), { description: 'Jahresziele ab dem laufenden Jahr.' }),
}, { $id: 'VertragZielauswahl', additionalProperties: false });

export function registerZielauswahl(app: FastifyInstance, deps: Deps, tag: string): void {
  app.addSchema(Zielauswahl);
  app.get('/v1/projekte/:id/vertrag/ziele', {
    schema: {
      tags: [tag], summary: 'Projektvertrag: Ziele zur Wahl (Kap. 2)', params: IdParams, response: { 200: Type.Ref('VertragZielauswahl') },
      description: 'Strategische Ziele mit Handlungsfeld und Jahresziele ab dem laufenden Jahr für den Strategiebezug (PP.02.05). Recht `projekt:write` am Projekt; die Ziele liest das System in voller Sicht.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:write', { type: 'projekt', id });
    if (!(await req.tx(tx => store.projekt(tx, id)))) throw notFound('Projekt');
    const a = await fullTx(deps.db, req.requirePrincipal().tenantId, tx => store.zielauswahl(tx, new Date().getFullYear()));
    return {
      ziele: a.ziele.map(z => ({ id: z.id, nummer: z.nummer, text: z.text, handlungsfeldId: z.handlungsfeld_id, handlungsfeld: z.handlungsfeld })),
      jahresziele: a.jahresziele.map(j => ({ id: j.id, jahr: j.jahr, nummer: j.nummer, text: j.text, strategischesZielId: j.strategisches_ziel_id })),
    };
  });
}

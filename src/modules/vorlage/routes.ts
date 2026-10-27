/**
 * Routen der Vorlagen (AM.03.01 Grundfunktion; AP-E3-5): Liste der gültigen Vorlagen je Art mit Fassung. Hochladen,
 * Versionen und Feldzuordnung folgen mit AP-E7-7 (UC-018 Schritte 1–2).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '@vollholz/platform';
import { alle } from './grundbestand.ts';

export const TAG = 'Vorlagen';

const Vorlage = Type.Object({
  art: Type.String({ description: 'Art der Vorlage, z. B. `projektvertrag`.' }),
  version: Type.String({ description: 'Fassung; erscheint im erzeugten Dokument.' }),
  name: Type.String(),
  quelle: Type.String({ description: 'Herkunft der Gliederung.' }),
  kopfzeile: Type.String({ description: 'Kopfzeile jeder Seite (G12).' }),
  gliederung: Type.Array(Type.Object({ nr: Type.String(), titel: Type.String() }, { additionalProperties: false })),
  grundbestand: Type.Boolean({ description: 'Mitgelieferte Vorlage (eigene Fassungen ab AP-E7-7).' }),
}, { $id: 'Vorlage', additionalProperties: false });

const VorlageList = Type.Object({ items: Type.Array(Type.Ref('Vorlage')) }, { $id: 'VorlageList', additionalProperties: false });

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  app.addSchema(Vorlage);
  app.addSchema(VorlageList);

  app.get('/v1/vorlagen', {
    schema: {
      tags: [TAG], summary: 'Vorlagen auflisten', response: { 200: Type.Ref('VorlageList') },
      description: 'Gültige Vorlage je Art mit Fassung und Gliederung; heute der Grundbestand (Projektvertrag nach Q7).',
    },
  }, async req => {
    await req.need('vorlage:write');
    return { items: alle().map(({ art, version, name, quelle, kopfzeile, gliederung, grundbestand }) => ({ art, version, name, quelle, kopfzeile, gliederung: [...gliederung], grundbestand })) };
  });
}

/**
 * Schemas für Ideenpool und Prüfung (AP-E4-2; BC DM.01.02–04, PP.02.04; UC-001 Schritte 3–5, A1–A3; Kernablauf K4).
 */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';
import { FELDER, STAENDE } from './schemas.ts';

const StandT = Type.Union(STAENDE.map(s => Type.Literal(s)));
const Stufe = Type.Union([Type.Literal('hoch'), Type.Literal('mittel'), Type.Literal('tief')]);
const KategorieT = Type.Union([Type.Literal('A'), Type.Literal('B'), Type.Literal('C')]);

/** Kriterien des Rasters (K4 Prüfen 8, Q8 Kap. 6) in der Reihenfolge der Anzeige. */
export const KRITERIEN = ['relevanz', 'direktionen', 'abhaengigkeiten', 'priorisierung', 'change'] as const;
export type Kriterium = (typeof KRITERIEN)[number];
const KriteriumT = Type.Union(KRITERIEN.map(k => Type.Literal(k)));

/** Stände, in denen die Idee im Pool offen ist (Funnel «Pre-P0» in dieser Reihenfolge). */
export const OFFEN = ['eingereicht', 'in_pruefung', 'in_ergaenzung', 'zurueckgestellt', 'traktandiert'] as const;

export const PoolZeile = Type.Object({
  id: Uuid,
  nummer: Type.Integer({ minimum: 1 }),
  titel: Type.String(),
  stand: StandT,
  standAt: DateTime,
  eingereichtAt: Nullable(DateTime),
  erfasstVon: Uuid,
  handlungsfeldId: Nullable(Uuid),
  bereiche: Type.Array(Uuid),
  herkunft: Nullable(Type.String()),
  kategorie: Nullable(KategorieT),
  rueckfragenOffen: Type.Integer({ minimum: 0 }),
}, { $id: 'IdeePoolZeile', additionalProperties: false });
export type PoolZeileOut = Static<typeof PoolZeile>;

export const PoolList = Type.Object({ items: Type.Array(Type.Ref('IdeePoolZeile')), nextCursor: NextCursor }, { $id: 'IdeePoolList', additionalProperties: false });

export const PoolQuery = Type.Object({
  stand: Type.Optional(Type.Array(StandT, { description: 'Nur diese Stände (mehrfach); ohne Angabe alle ausser Entwurf.' })),
  handlungsfeld: Type.Optional(Type.String({ format: 'uuid' })),
  herkunft: Type.Optional(Type.String({ maxLength: 100 })),
  sort: Type.Optional(Type.Union([Type.Literal('wartet'), Type.Literal('neu')], { description: '`wartet` (Standard): am längsten im aktuellen Stand zuerst; `neu`: zuletzt eingereicht zuerst.' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const Funnel = Type.Object({
  stufen: Type.Array(Type.Object({ stand: StandT, anzahl: Type.Integer({ minimum: 0 }) }, { additionalProperties: false })),
  letzteEinreichung: Nullable(DateTime),
}, { $id: 'IdeeFunnel', additionalProperties: false });

export const Aehnliche = Type.Object({
  items: Type.Array(Type.Object({
    idee: Type.Ref('IdeePoolZeile'),
    gleichesHandlungsfeld: Type.Boolean(),
    gemeinsameBereiche: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false })),
}, { $id: 'IdeeAehnliche', additionalProperties: false });

export const Pruefung = Type.Object({
  leitfragen: Type.Array(Type.Object({
    position: Type.Integer({ minimum: 0 }), wertestrom: Type.String(), frage: Type.String(), antwort: Type.String(),
  }, { additionalProperties: false }), { description: 'Leitfragen zum Eintritt P0 aus dem Phasenmodell in Kraft mit den Antworten (UC-001 Schritt 4).' }),
  vorgesehenerSponsor: Nullable(Uuid),
  raster: Type.Array(Type.Object({ kriterium: KriteriumT, einschaetzung: Nullable(Stufe) }, { additionalProperties: false })),
  vorschlag: Nullable(Type.Object({
    kategorie: KategorieT,
    hoch: Type.Integer({ minimum: 0 }), mittel: Type.Integer({ minimum: 0 }), tief: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false, description: 'Naheliegende Kategorie mit Herleitung (G11); die UE entscheidet (Q8 Kap. 6).' })),
  kategorie: Nullable(KategorieT),
  kategorieBegruendung: Type.String(),
  portfolioId: Nullable(Uuid),
  zustaendig: Nullable(Type.Object({ kuerzel: Type.String(), name: Type.String() }, { additionalProperties: false, description: 'Entscheidendes Gremium des Portfolios (A-45).' })),
  can: Type.Object({
    pruefen: Type.Boolean({ description: 'Leitfragen, Raster, Kategorie und Rückfragen (`idee:write`, Idee eingereicht oder in Prüfung).' }),
    abschliessen: Type.Boolean({ description: 'Zurückweisen und Zusammenführen (`idee:write`, Idee offen im Pool).' }),
  }, { additionalProperties: false }),
}, { $id: 'IdeePruefung', additionalProperties: false });
export type PruefungOut = Static<typeof Pruefung>;

export const LeitfragenIn = Type.Object({
  antworten: Type.Array(Type.Object({ position: Type.Integer({ minimum: 0, maximum: 999 }), antwort: Type.String({ maxLength: 4000 }) }, { additionalProperties: false }), { maxItems: 100 }),
  vorgesehenerSponsor: Type.Optional(Nullable(Uuid)),
}, { $id: 'IdeeLeitfragenIn', additionalProperties: false });

export const RasterIn = Type.Object({
  raster: Type.Array(Type.Object({ kriterium: KriteriumT, einschaetzung: Nullable(Stufe) }, { additionalProperties: false }), { maxItems: KRITERIEN.length }),
}, { $id: 'IdeeRasterIn', additionalProperties: false });

export const KategorieIn = Type.Object({
  kategorie: KategorieT,
  portfolioId: Type.Optional(Uuid),
  begruendung: Type.Optional(Type.String({ maxLength: 2000 })),
}, { $id: 'IdeeKategorieIn', additionalProperties: false });

export const RueckfragenIn = Type.Object({
  fragen: Type.Array(Type.Object({
    feld: Type.Optional(Nullable(Type.Union(FELDER.map(f => Type.Literal(f))))),
    text: Type.String({ minLength: 1, maxLength: 2000 }),
  }, { additionalProperties: false }), { minItems: 1, maxItems: 20 }),
}, { $id: 'IdeeRueckfragenIn', additionalProperties: false });

export const ZurueckweisenIn = Type.Object({
  begruendung: Type.String({ minLength: 1, maxLength: 4000 }),
}, { $id: 'IdeeZurueckweisenIn', additionalProperties: false });

export const ZusammenfuehrenIn = Type.Object({
  fuehrendeIdeeId: Uuid,
}, { $id: 'IdeeZusammenfuehrenIn', additionalProperties: false });

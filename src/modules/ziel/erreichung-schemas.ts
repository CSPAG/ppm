/**
 * Schemas der Zielerreichung je Quartal (OpenAPI, Prüfung der Eingaben; BC ZM.03.01, UC-012 Schritte 1–2, K6 Schritt 10).
 */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Quartal = Type.String({ pattern: '^[0-9]{4}-Q[1-4]$', description: 'Quartal «JJJJ-Qn» (docs/fachmodell.md 2.14).', examples: ['2026-Q3'] });
const Stand = Type.String({ minLength: 1, maxLength: 200, pattern: '\\S', description: 'Neuer Stand der Metrik, z. B. «−1,4 %».' });
const Beurteilung = Type.String({ maxLength: 2000, description: 'Kommentar und Beurteilung des Stands; leer erlaubt.' });
const ZielTyp = Type.Union([Type.Literal('strategisch'), Type.Literal('jahresziel')], { description: 'Strategisches Ziel oder Jahresziel.' });
export type ZielTypOut = Static<typeof ZielTyp>;

export const QuartalParams = Type.Object({ quartal: Quartal });
export const EintragParams = Type.Object({ quartal: Quartal, id: Uuid });

/** Erfasster Stand eines Ziels in einem Quartal, mit Datum und Person (K6: «jeder Stand mit Datum und Person»). */
export const ZielerreichungEintrag = Type.Object({
  id: Uuid,
  zielTyp: ZielTyp,
  zielId: Uuid,
  quartal: Type.String(),
  stand: Type.String(),
  beurteilung: Type.String(),
  erfasstAt: DateTime,
  erfasstVon: Nullable(Type.Ref('ZielPerson')),
  version: Type.Integer({ minimum: 1 }),
}, { $id: 'ZielerreichungEintrag', additionalProperties: false });
export type ZielerreichungEintragOut = Static<typeof ZielerreichungEintrag>;

export const ZielerreichungZiel = Type.Object({
  typ: ZielTyp,
  id: Uuid,
  strategischesZielId: Uuid,
  nummer: Type.String(),
  text: Type.String(),
  metrik: Type.String(),
  zielwert: Type.String(),
  // Stand dieses Quartals; null = noch nicht nachgeführt
  eintrag: Nullable(Type.Ref('ZielerreichungEintrag')),
  // letzter Stand aus einem früheren Quartal
  letzter: Nullable(Type.Ref('ZielerreichungEintrag')),
}, { $id: 'ZielerreichungZiel', additionalProperties: false });

/** Tabelle der Zielerreichung eines Quartals (UI-40): strategische Ziele, darunter die Jahresziele des Jahres. */
export const ZielerreichungQuartal = Type.Object({
  quartal: Type.String(),
  jahr: Type.Integer(),
  ziele: Type.Array(Type.Ref('ZielerreichungZiel'), { description: 'Nach Nummer: je strategisches Ziel, gefolgt von seinen Jahreszielen.' }),
  fortschritt: Type.Object({
    nachgefuehrt: Type.Integer({ minimum: 0, description: 'Ziele mit Stand in diesem Quartal.' }),
    gesamt: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false, description: 'Kopf «24 von 30 Zielen nachgeführt» (K6 Schritt 10).' }),
  can: Type.Object({ write: Type.Boolean({ description: 'Stände erfassen (zielerreichung:write).' }) }),
}, { $id: 'ZielerreichungQuartal', additionalProperties: false });

export const ZielerreichungCreate = Type.Object({
  zielTyp: ZielTyp,
  zielId: Uuid,
  stand: Stand,
  beurteilung: Type.Optional(Beurteilung),
}, { $id: 'ZielerreichungCreate', additionalProperties: false });
export type ZielerreichungCreateIn = Static<typeof ZielerreichungCreate>;

export const ZielerreichungPatch = Type.Object({
  stand: Type.Optional(Stand),
  beurteilung: Type.Optional(Beurteilung),
}, { $id: 'ZielerreichungPatch', additionalProperties: false, minProperties: 1 });
export type ZielerreichungPatchIn = Static<typeof ZielerreichungPatch>;

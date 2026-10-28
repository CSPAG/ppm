/**
 * Schemas für die Freigabe der Initialisierung (AP-E4-3; UC-001 Schritte 6–7, A4, A5; Kernablauf K4 Schritte 8–10).
 */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

export const Freigabe = Type.Object({
  weg: Nullable(Type.Union([Type.Literal('gremium'), Type.Literal('direktion')], {
    description: '`gremium` (Kategorie A, B: Entscheid in der Sitzung, K3) oder `direktion` (Kategorie C: Freigabe im Eingang, UC-001 A4); ohne Kategorie `null`.',
  })),
  zustaendig: Nullable(Type.String({ description: 'Gremium (Kürzel und Name) bzw. Portfolio der Direktion.' })),
  vorgesehenerSponsor: Nullable(Uuid),
  sponsor: Nullable(Uuid),
  projektleitung: Nullable(Uuid),
  freigegebenAt: Nullable(DateTime),
  projekt: Nullable(Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }, { additionalProperties: false })),
  can: Type.Object({
    traktandieren: Type.Boolean({ description: 'UE: dem Gremium vorlegen bzw. der Direktion übergeben.' }),
    angaben: Type.Boolean({ description: 'UE: Sponsor und Projektleitung für den Entscheid erfassen (A-05).' }),
    entscheiden: Type.Boolean({ description: 'Direktion (Kategorie C): Initialisierung freigeben oder zurückweisen.' }),
  }, { additionalProperties: false }),
}, { $id: 'IdeeFreigabe', additionalProperties: false });
export type FreigabeOut = Static<typeof Freigabe>;

export const AngabenIn = Type.Object({
  sponsor: Nullable(Uuid),
  projektleitung: Nullable(Uuid),
}, { $id: 'IdeeFreigabeAngabenIn', additionalProperties: false });

export const FreigebenIn = Type.Object({
  sponsor: Uuid,
  projektleitung: Uuid,
  begruendung: Type.Optional(Type.String({ maxLength: 4000 })),
}, { $id: 'IdeeFreigebenIn', additionalProperties: false });

export const AblehnenIn = Type.Object({
  begruendung: Type.String({ maxLength: 4000 }),
}, { $id: 'IdeeAblehnenIn', additionalProperties: false });

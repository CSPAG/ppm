/**
 * Schemas der Freigabe der Jahresziele (BC ZM.02.02; UC-011 Schritte 6–7, A2; K6 Schritte 6–7): Zusammenfassung vor der
 * Vorlage an den VR, Vorlage, Entscheid des VR erfassen.
 */
import { Type, type Static } from '@sinclair/typebox';
import { Nullable, Uuid } from '@vollholz/platform';

const Ziel = Type.Object({ id: Uuid, nummer: Type.String() }, { additionalProperties: false });

/** Zusammenfassung und Prüfung vor dem Vorlegen (K6 Schritt 6, Assistent). */
export const Vorlage = Type.Object({
  jahr: Type.Integer(),
  stand: Type.Union([Type.Literal('in_arbeit'), Type.Literal('zur_freigabe'), Type.Literal('in_kraft')]),
  version: Type.Integer({ description: 'Version des Zieljahrs für `If-Match` beim Vorlegen bzw. bei der Freigabe.' }),
  anzahl: Type.Integer({ description: 'Jahresziele des Jahres.' }),
  anzahlVorjahr: Nullable(Type.Integer({ description: 'Jahresziele des Vorjahres; null ohne Zielzyklus im Vorjahr.' })),
  jeHandlungsfeld: Type.Array(Type.Object({
    handlungsfeldId: Uuid,
    label: Nullable(Type.String({ description: 'Bezeichnung, falls die Person das Handlungsfeld sehen darf.' })),
    anzahl: Type.Integer(),
    anzahlVorjahr: Type.Integer(),
  }, { additionalProperties: false })),
  ohneMetrik: Type.Array(Ziel, { description: 'Jahresziele ohne Metrik oder Zielwert: sperren die Vorlage (UC-011 Schritt 5).' }),
  ohneUmsetzung: Type.Array(Ziel, { description: 'Jahresziele ohne Hauptaktivität und ohne Projekt (Hinweis).' }),
  can: Type.Object({
    vorlegen: Type.Boolean({ description: '«Zur Freigabe vorlegen» (ziel:write, Stand «in Arbeit»; Sperren siehe ohneMetrik).' }),
    freigabe: Type.Boolean({ description: '«Freigabe erfassen» (ziel:freigabe, Stand «zur Freigabe»).' }),
  }),
}, { $id: 'ZielVorlage', additionalProperties: false });
export type VorlageOut = Static<typeof Vorlage>;

export const FreigabeErfassen = Type.Object({
  entscheid: Type.Union([Type.Literal('freigegeben'), Type.Literal('anpassungen')], { description: '«freigegeben» setzt die Jahresziele in Kraft; «anpassungen» (UC-011 A2) setzt sie auf «in Arbeit» zurück.' }),
  datum: Type.String({ format: 'date', description: 'Datum des Entscheids des VR.' }),
  text: Type.Optional(Type.String({ maxLength: 4000, description: 'Rückmeldungen des VR; bei «anpassungen» Pflicht.' })),
}, { $id: 'FreigabeErfassen', additionalProperties: false });
export type FreigabeErfassenIn = Static<typeof FreigabeErfassen>;

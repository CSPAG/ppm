/** Schemas des Jahresrückblicks (OpenAPI, Prüfung der Eingaben); BC ZM.03.03, PS.04.03, UC-013 (AP-E7-5). */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Projekt = Type.Object({
  id: Uuid, nummer: Type.String(), name: Type.String(), portfolio: Type.String(), phase: Type.String(),
  lebenszyklus: Type.String({ description: '`aktiv`, `sistiert`, `abgeschlossen` oder `abgebrochen`.' }),
  seit: Nullable(Type.String({ format: 'date', description: 'Abgeschlossen bzw. abgebrochen am (aus dem Verlauf des Projekts).' })),
}, { additionalProperties: false });

export const Jahresauswertung = Type.Object({
  zielerreichung: Type.Object({
    gesamt: Type.Integer(),
    mitStand: Type.Integer({ description: 'Ziele mit einem Stand im Jahr.' }),
    ziele: Type.Array(Type.Object({
      typ: Type.Union([Type.Literal('strategisch'), Type.Literal('jahresziel')]), id: Uuid, nummer: Type.String(), text: Type.String(),
      metrik: Type.String(), zielwert: Type.String(), stand: Nullable(Type.String()), beurteilung: Type.String(), quartal: Nullable(Type.String()),
    }, { additionalProperties: false })),
  }, { additionalProperties: false, description: 'Zielerreichung des Jahres: je Ziel der letzte Stand bis Q4 (UC-012).' }),
  vorhaben: Type.Object({
    abgeschlossen: Type.Array(Projekt, { description: 'Im Jahr abgeschlossen.' }),
    abgebrochen: Type.Array(Projekt, { description: 'Im Jahr abgebrochen.' }),
    laufend: Type.Array(Projekt, { description: 'Aktive und sistierte Vorhaben.' }),
  }, { additionalProperties: false }),
  lessonsLearned: Type.Object({
    eintraege: Type.Array(Type.Object({
      id: Uuid, projekt: Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }, { additionalProperties: false }),
      text: Type.String(), kategorie: Type.String(),
    }, { additionalProperties: false }), { description: 'Im Jahr erfasst (PS.04.03), neueste zuerst.' }),
    ohne: Type.Array(Projekt, { description: 'Im Jahr abgeschlossene Vorhaben ohne Lessons Learned (UC-013 Schritt 2, A1).' }),
  }, { additionalProperties: false, description: 'Lessons Learned des Jahres (UC-013 Schritte 1–2).' }),
}, { $id: 'Jahresauswertung', additionalProperties: false });
export type JahresauswertungOut = Static<typeof Jahresauswertung>;

const Stand = Type.Union([Type.Literal('offen'), Type.Literal('in_arbeit'), Type.Literal('traktandiert'), Type.Literal('ausgewertet')], {
  description: '`offen` (noch nichts erfasst), `in_arbeit` (UE stellt zusammen), `traktandiert` (beim PRAT), `ausgewertet` («Verabschiedet»).',
});

export const Jahresrueckblick = Type.Object({
  jahr: Type.Integer(),
  stand: Stand,
  erkenntnisse: Type.String(),
  massnahmen: Type.String(),
  rueckmeldung: Type.String({ description: 'Rückmeldung des PRAT bei «Anpassungen verlangt».' }),
  traktandiertAt: Nullable(DateTime),
  ausgewertetAt: Nullable(DateTime),
  version: Type.Integer({ description: '0, solange nichts gespeichert ist (If-Match W/"0" beim ersten Speichern).' }),
  auswertung: Type.Ref('Jahresauswertung', { description: 'Live, solange in Arbeit; ab dem Traktandieren der Stand bei Traktandierung.' }),
  can: Type.Object({ bearbeiten: Type.Boolean(), traktandieren: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'Jahresrueckblick', additionalProperties: false });
export type JahresrueckblickOut = Static<typeof Jahresrueckblick>;

export const JahresrueckblickPut = Type.Object({
  erkenntnisse: Type.String({ maxLength: 8000 }),
  massnahmen: Type.String({ maxLength: 8000 }),
}, { $id: 'JahresrueckblickPut', additionalProperties: false });
export type JahresrueckblickPutIn = Static<typeof JahresrueckblickPut>;

export const JahrParams = Type.Object({ jahr: Type.Integer({ minimum: 2000, maximum: 2100 }) }, { additionalProperties: false });

export const DokumentQuery = Type.Object({
  format: Type.Optional(Type.Union([Type.Literal('pdf'), Type.Literal('docx')], { description: 'Standard PDF.' })),
}, { additionalProperties: false });

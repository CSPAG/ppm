/** Schemas des Gate-Modus (AP-E3-3; PS.02.01, PS.02.05, PC.03.02; UC-003 Schritte 1, 4, A2; fachmodell.md 2.10, 5). */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';
import { GATE_CODES } from './gate-store.ts';
import { PHASEN } from './kapitel.ts';
import { STAENDE } from './store.ts';

const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });
const Phase = enumOf(PHASEN, 'Phase P0 bis P4.');

export const GateParams = Type.Object({ id: Uuid, leitfrageId: Uuid }, { additionalProperties: false });

export const LeitfrageAntwortIn = Type.Object({
  antwort: Type.String({ maxLength: 5000, description: 'Antwort als Text; leer = Antwort entfernen. Bei «trifft nicht zu» die Begründung (K2 «Regeln»).' }),
  zutreffend: Type.Optional(Type.Boolean({ description: 'false = «trifft nicht zu» mit Begründung in `antwort`.', default: true })),
}, { $id: 'VertragLeitfrageAntwortIn', additionalProperties: false });
export type LeitfrageAntwortInT = Static<typeof LeitfrageAntwortIn>;

const NutzenWert = Type.Object({
  kpiId: Uuid,
  wert: Type.String({ maxLength: 200, description: 'Erreichter Wert, z. B. «62 %».' }),
  bemerkung: Type.String({ maxLength: 1000 }),
}, { additionalProperties: false });

export const NutzenIn = Type.Object({
  beurteilung: Type.String({ maxLength: 5000, description: 'Beurteilung durch Projektleitung und Sponsor (UC-003 A2.2).' }),
  werte: Type.Array(NutzenWert, { maxItems: 200, description: 'Erreichte Werte je KPI des Registers.' }),
}, { $id: 'VertragNutzenIn', additionalProperties: false });
export type NutzenInT = Static<typeof NutzenIn>;

const Antwort = Type.Object({
  text: Type.String(), zutreffend: Type.Boolean(), version: Type.Integer({ minimum: 1 }), updatedAt: DateTime, updatedBy: Nullable(Uuid),
});
export const Leitfrage = Type.Object({
  id: Uuid,
  wertestrom: Type.String({ description: 'Schlüssel des Werts in der Codetabelle «Werteströme» (Nutzen, Projekt, Klinik, ICT, Infrastruktur).' }),
  text: Type.String(),
  antwort: Nullable(Antwort),
}, { $id: 'VertragLeitfrage' });

const Kpi = Type.Object({ id: Uuid, text: Type.String(), einheit: Type.String(), zielwert: Nullable(Type.String()) });

export const VertragGate = Type.Object({
  versionId: Uuid,
  nummer: Type.String(),
  stand: enumOf(STAENDE, 'Bearbeitungsstand der Version.'),
  gate: Type.Object({
    code: enumOf(GATE_CODES, 'Gate in die Zielphase.'), label: Type.String({ description: '«P1–P2»' }), von: Phase, nach: Phase,
  }),
  gremienweg: Nullable(Type.Object({
    gremium: Type.Object({ kuerzel: Type.String(), name: Type.String() }),
    zusaetzlich: Nullable(Type.Object({ kuerzel: Type.String(), name: Type.String() })),
    viaSns: Type.Boolean({ description: 'Das Gate läuft zusätzlich über den SNS-VR (UC-006 A1).' }),
  }, { description: 'Gremium aus dem Gremienweg des Portfolios; null ohne Pflicht-Gates (Kategorie C, A-08).' })),
  leitfragen: Type.Array(Type.Ref('VertragLeitfrage'), { description: 'Leitfragen des Gates je Wertestrom in der Version des Phasenmodells ab diesem Gate (A-13).' }),
  fortschritt: Type.Object({ beantwortet: Type.Integer(), gesamt: Type.Integer() }, { description: '«18 von 25 beantwortet» (K2 Schritt 2).' }),
  lieferergebnisse: Type.Array(Type.Object({
    phase: Phase, art: enumOf(['lieferergebnis', 'meilenstein'] as const, 'Art.'), text: Type.String(),
    erreichtAm: Nullable(Type.String({ format: 'date' })),
  }), { description: 'Standard-Lieferergebnisse der laufenden Phase mit Stand aus dem Register (UC-003 Schritt 1).' }),
  nutzen: Nullable(Type.Object({
    beurteilung: Type.String(),
    werte: Type.Array(NutzenWert),
    kpis: Type.Array(Kpi),
    version: Type.Integer({ minimum: 0, description: 'Stand für If-Match; 0 = noch nicht erfasst.' }),
  }, { description: 'Nutzenprüfung am Gate ab P3 (UC-003 A2); sonst null.' })),
  entscheid: Nullable(Type.Object({
    ergebnis: enumOf(['freigegeben', 'mit_auflagen', 'zurueckgestellt', 'abgelehnt'] as const, 'Entscheid des Gremiums.'),
    begruendung: Type.String(), at: DateTime,
  })),
  can: Type.Object({
    antworten: Type.Boolean({ description: 'Leitfragen beantworten (PL, Entwurf in Arbeit).' }),
    nutzen: Type.Boolean({ description: 'Nutzenprüfung erfassen (PL oder SP, Entwurf in Arbeit).' }),
  }),
}, { $id: 'VertragGate' });
export type VertragGateOut = Static<typeof VertragGate>;

/** Schemas der Projekte (OpenAPI, Prüfung der Eingaben); BC PP.04.04, UC-002 Schritt 2, UC-014 A1. */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

export const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export type Phase = (typeof PHASEN)[number];

/** Lebenszyklus (fachmodell.md 2.5): Endzustände sind lesend (UC-015 Schritt 6). */
export const LEBENSZYKLUS = ['aktiv', 'sistiert', 'abgebrochen', 'abgeschlossen', 'zurueckgezogen'] as const;
export type Lebenszyklus = (typeof LEBENSZYKLUS)[number];
export const ENDZUSTAENDE: readonly Lebenszyklus[] = ['abgebrochen', 'abgeschlossen', 'zurueckgezogen'];

/** Funktionen der Projektorganisation (Q7 Kap. 8); `koalition` = Sponsoren-Koalition ohne eigene Rolle (A-04). */
export const FUNKTIONEN = ['sp', 'pl', 'ctl', 'kt', 'koalition'] as const;
export type Funktion = (typeof FUNKTIONEN)[number];
/**
 * Rolle am Projekt je Funktion (A-70), bis AP-E8-2 die Projektorganisation vom Zugriff trennt (Master Entscheid 16, A-71):
 * Sponsor steuert, Projektleitung und CTL führen, Kernteam liest mit; die Sponsoren-Koalition erhält keine Rolle.
 */
export const ROLLE_JE_FUNKTION: Partial<Record<Funktion, 'projekt-steuern' | 'projekt-fuehren' | 'projekt-mitlesen'>> = {
  sp: 'projekt-steuern', pl: 'projekt-fuehren', ctl: 'projekt-fuehren', kt: 'projekt-mitlesen',
};

const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });

const PhaseT = enumOf(PHASEN, 'Phase nach Phasenmodell (P0 Initialisierung bis P4 Abschluss).');
const LebenszyklusT = enumOf(LEBENSZYKLUS, '`aktiv`, `sistiert` oder ein Endzustand (`abgebrochen`, `abgeschlossen`, `zurueckgezogen`).');
const FunktionT = enumOf(FUNKTIONEN, '`sp` Sponsor, `pl` Projektleitung, `ctl` Clinical Transformation Lead, `kt` Kernteam, `koalition` Sponsoren-Koalition.');
const Name = Type.String({ minLength: 1, maxLength: 200, description: 'Name des Projekts.', examples: ['Digitale Patientenaufnahme'] });

export const Projekt = Type.Object({
  id: Uuid,
  nummer: Type.String({ description: '«JJJJ-NNN», fortlaufend je Jahr der Anlage (A-47); Schlüssel in Adressen.', examples: ['2026-014'] }),
  name: Type.String(),
  portfolioId: Uuid,
  portfolio: Nullable(Type.Object({
    schluessel: Type.String(), name: Type.String(), kategorie: enumOf(['A', 'B', 'C'] as const, 'Kategorie des Portfolios.'),
  }, { additionalProperties: false })),
  orgEinheitId: Nullable(Uuid),
  handlungsfeldId: Nullable(Uuid),
  handlungsfeld: Nullable(Type.String({ description: 'Bezeichnung des Handlungsfelds, falls die Person es sehen darf.' })),
  phase: PhaseT,
  phasenmodellId: Nullable(Uuid),
  lebenszyklus: LebenszyklusT,
  vertraulich: Type.Boolean({ description: 'Sichtbar nur für Projektrollen, UE und Gremium des Portfolios (A-34).' }),
  sponsor: Nullable(Uuid),
  projektleitung: Nullable(Uuid),
  controlling: Nullable(Uuid),
  rollen: Type.Array(FunktionT, { description: 'Eigene Funktionen der anfragenden Person in der Projektorganisation.' }),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  updatedAt: DateTime,
  can: Type.Object({ write: Type.Boolean(), organisation: Type.Boolean() }, { description: 'Was die anfragende Person damit darf.' }),
}, { $id: 'Projekt', additionalProperties: false });
export type ProjektOut = Static<typeof Projekt>;

export const ProjektList = Type.Object({ items: Type.Array(Type.Ref('Projekt')), nextCursor: NextCursor }, { $id: 'ProjektList', additionalProperties: false });

export const ProjektCreate = Type.Object({
  name: Name,
  portfolioId: Uuid,
  phase: Type.Optional(PhaseT),
  orgEinheitId: Type.Optional(Nullable(Uuid)),
  handlungsfeldId: Type.Optional(Nullable(Uuid)),
  vertraulich: Type.Optional(Type.Boolean()),
}, { $id: 'ProjektCreate', additionalProperties: false });
export type ProjektCreateIn = Static<typeof ProjektCreate>;

export const ProjektPatch = Type.Object({
  name: Type.Optional(Name),
  orgEinheitId: Type.Optional(Nullable(Uuid)),
  handlungsfeldId: Type.Optional(Nullable(Uuid)),
  vertraulich: Type.Optional(Type.Boolean()),
}, { $id: 'ProjektPatch', additionalProperties: false, minProperties: 1 });
export type ProjektPatchIn = Static<typeof ProjektPatch>;

export const ListQuery = Type.Object({
  rolle: Type.Optional(FunktionT),
  portfolio: Type.Optional(Type.String({ maxLength: 40, description: 'Schlüssel des Portfolios (z. B. `transformation`).' })),
  phase: Type.Optional(PhaseT),
  lebenszyklus: Type.Optional(Type.Array(LebenszyklusT, { maxItems: 5, description: 'Nur Projekte in diesen Zuständen.' })),
  nummer: Type.Optional(Type.String({ maxLength: 20, description: 'Genau diese Projektnummer.' })),
  q: Type.Optional(Type.String({ maxLength: 200, description: 'Suche in Name und Nummer (Teilstring).' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const Mitglied = Type.Object({
  personId: Uuid,
  funktion: FunktionT,
  akv: Type.String({ description: 'Aufgaben, Kompetenzen, Verantwortung.' }),
}, { $id: 'Mitglied', additionalProperties: false });

export const Organisation = Type.Object({
  version: Type.Integer({ minimum: 0, description: 'Stand der Projektorganisation (ETag); 0 ohne Mitglieder.' }),
  mitglieder: Type.Array(Type.Ref('Mitglied'), { description: 'In der Reihenfolge Sponsor, Koalition, Projektleitung, CTL, Kernteam.' }),
  can: Type.Object({ write: Type.Boolean() }, { description: 'Was die anfragende Person damit darf.' }),
}, { $id: 'Organisation', additionalProperties: false });
export type OrganisationOut = Static<typeof Organisation>;

export const OrganisationPut = Type.Object({
  mitglieder: Type.Array(Type.Object({
    personId: Uuid,
    funktion: FunktionT,
    akv: Type.Optional(Type.String({ maxLength: 2000 })),
  }, { additionalProperties: false }), { maxItems: 100, description: 'Sponsor, Projektleitung und CTL höchstens je eine Person.' }),
}, { $id: 'OrganisationPut', additionalProperties: false });
export type OrganisationPutIn = Static<typeof OrganisationPut>;

export const KopfProjekt = Type.Object({
  id: Uuid, nummer: Type.String(), name: Type.String(), phase: PhaseT, lebenszyklus: LebenszyklusT, rollen: Type.Array(FunktionT),
}, { $id: 'KopfProjekt', additionalProperties: false });
/** Personensuche der Befehlspalette (I-N4, IA «Navigation»: «Suche nach … Personen, gefiltert nach Recht»). */
export const PersonenQuery = Type.Object({
  q: Type.String({ minLength: 2, maxLength: 100, description: 'Teil des Namens.' }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20, default: 8 })),
}, { additionalProperties: false });
export const ProjektPersonen = Type.Object({
  items: Type.Array(Type.Object({
    id: Uuid, name: Type.String(),
    kontexte: Type.Array(Type.Object({ projektId: Uuid, nummer: Type.String(), name: Type.String(), funktion: FunktionT }, { additionalProperties: false }),
      { maxItems: 3, description: 'Funktionen in sichtbaren laufenden Projekten (höchstens drei, nach Nummer).' }),
  }, { additionalProperties: false })),
}, { $id: 'ProjektPersonen', additionalProperties: false, description: 'Personen mit einer Funktion in einem Projekt, das die anfragende Person sieht; ohne E-Mail.' });

export const Kopf = Type.Object({
  projekte: Type.Array(Type.Ref('KopfProjekt'), { description: 'Laufende Projekte, in denen die Person eine Funktion hat (höchstens 20).' }),
  anzahl: Type.Integer({ minimum: 0, description: 'Anzahl dieser Projekte.' }),
}, { $id: 'ProjektKopf', additionalProperties: false });

/**
 * Schemas der Ad-hoc-Auswertungen (BC PC.04.03; UC-014 A2; AP-E7-6): Filter, Kennzahlen, Gruppierung, Ergebnis mit
 * Einzelwerten (Seitentyp Bericht: jede Zahl führt zu ihren Einzelwerten, docs/ux/rahmen/interaktion.md) und Export.
 */
import { Type, type Static } from '@sinclair/typebox';
import { Nullable, Uuid } from '@vollholz/platform';

export const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export const LEBENSZYKLEN = ['aktiv', 'sistiert', 'abgebrochen', 'abgeschlossen', 'zurueckgezogen'] as const;
export const STATUS = ['im_plan', 'kritisch', 'ohne'] as const;

/**
 * Kennzahlen nur aus vorhandenen Modulen: Projekte (`projekt`), Status des letzten Berichts (`statusbericht`), offene
 * Eskalationen (`statusbericht`, AP-E2-4), offene Meilensteine und Risiken (`projektdaten`), Beträge der Kostenpositionen
 * (`projektdaten`, nur mit `finanzen:read` an der Organisation).
 */
export const KENNZAHLEN = ['projekte', 'kritisch', 'eskalationen', 'meilensteine_offen', 'risiken', 'budget', 'prognose', 'ist'] as const;
export type Kennzahl = (typeof KENNZAHLEN)[number];
export const FINANZ_KENNZAHLEN: readonly Kennzahl[] = ['budget', 'prognose', 'ist'];

export const GRUPPIERUNGEN = ['keine', 'portfolio', 'phase', 'status', 'lebenszyklus', 'handlungsfeld'] as const;
export type Gruppierung = (typeof GRUPPIERUNGEN)[number];

const liste = (werte: readonly string[], beschreibung: string) =>
  Type.Optional(Type.String({ pattern: `^(${werte.join('|')})(,(${werte.join('|')}))*$`, description: `${beschreibung} Mehrere mit Komma: ${werte.map(w => `\`${w}\``).join(', ')}.` }));

export const AuswertungQuery = Type.Object({
  periode: Type.Optional(Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$', description: 'Stichperiode für den Status (letzter eingereichter Bericht bis zu dieser Periode); ohne Angabe die laufende.' })),
  portfolio: Type.Optional(Type.String({ pattern: '^[a-z0-9_-]{1,40}(,[a-z0-9_-]{1,40})*$', description: 'Schlüssel der Portfolios (I-N5), mehrere mit Komma; ohne Angabe alle sichtbaren.' })),
  phase: liste(PHASEN, 'Phasen.'),
  lebenszyklus: liste(LEBENSZYKLEN, 'Lebenszyklus; ohne Angabe `aktiv`.'),
  status: liste(STATUS, 'Status des letzten Berichts; `ohne`: noch kein eingereichter Bericht.'),
  handlungsfeld: Type.Optional(Uuid),
  kennzahlen: liste(KENNZAHLEN, 'Kennzahlen; ohne Angabe `projekte,kritisch`. Beträge nur mit `finanzen:read`.'),
  gruppierung: Type.Optional(Type.Union(GRUPPIERUNGEN.map(g => Type.Literal(g)), { description: 'Gruppierung; ohne Angabe `portfolio`.' })),
  format: Type.Optional(Type.Union([Type.Literal('json'), Type.Literal('csv')], { description: '`csv`: Export (UTF-8 mit BOM, Semikolon) statt JSON.' })),
  ebene: Type.Optional(Type.Union([Type.Literal('gruppen'), Type.Literal('einzelwerte')], { description: 'Nur mit `format=csv`: Gruppen mit Summe (Standard) oder Einzelwerte je Projekt.' })),
}, { additionalProperties: false });
export type AuswertungQueryIn = Static<typeof AuswertungQuery>;

const Werte = Type.Record(Type.String(), Type.Number(), { description: 'Wert je gewählter Kennzahl (Beträge in CHF).' });

export const AuswertungGruppe = Type.Object({
  schluessel: Type.String({ description: 'Schlüssel der Gruppe; `-` für «ohne» (z. B. ohne Handlungsfeld).' }),
  label: Type.String(),
  werte: Werte,
}, { $id: 'AuswertungGruppe', additionalProperties: false });

export const AuswertungEinzelwert = Type.Object({
  projektId: Uuid,
  nummer: Type.String(),
  name: Type.String(),
  portfolio: Type.String(),
  phase: Type.String(),
  lebenszyklus: Type.String(),
  status: Nullable(Type.Union([Type.Literal('im_plan'), Type.Literal('kritisch')])),
  handlungsfeld: Nullable(Type.String()),
  gruppe: Type.String({ description: 'Schlüssel der Gruppe, zu der das Projekt zählt.' }),
  werte: Werte,
}, { $id: 'AuswertungEinzelwert', additionalProperties: false });

export const Auswertung = Type.Object({
  periode: Type.String(),
  gruppierung: Type.Union(GRUPPIERUNGEN.map(g => Type.Literal(g))),
  kennzahlen: Type.Array(Type.Object({
    schluessel: Type.Union(KENNZAHLEN.map(k => Type.Literal(k))),
    label: Type.String(),
    einheit: Type.Union([Type.Literal('anzahl'), Type.Literal('chf')]),
  }, { additionalProperties: false })),
  gruppen: Type.Array(Type.Ref('AuswertungGruppe'), { description: 'In der Ordnung der Gruppierung (Phase P0–P4, Status, sonst nach Name).' }),
  summe: Werte,
  einzelwerte: Type.Array(Type.Ref('AuswertungEinzelwert'), { description: 'Projekte hinter den Zahlen, nach Nummer.' }),
  optionen: Type.Object({
    portfolios: Type.Array(Type.Object({ schluessel: Type.String(), name: Type.String() }, { additionalProperties: false })),
    handlungsfelder: Type.Array(Type.Object({ id: Uuid, label: Type.String() }, { additionalProperties: false })),
    finanzen: Type.Boolean({ description: 'Beträge wählbar (`finanzen:read` an der Organisation).' }),
  }, { additionalProperties: false, description: 'Auswahl für die Filter, nur Sichtbares.' }),
}, { $id: 'Auswertung', additionalProperties: false });
export type AuswertungOut = Static<typeof Auswertung>;
export type AuswertungGruppeOut = Static<typeof AuswertungGruppe>;
export type AuswertungEinzelwertOut = Static<typeof AuswertungEinzelwert>;

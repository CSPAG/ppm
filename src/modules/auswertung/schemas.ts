/** Schemas des Dashboards (OpenAPI, Prüfung der Eingaben); BC PC.04.01, UC-014 Schritt 1 (AP-E1-3). */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Status = Nullable(Type.Union([Type.Literal('im_plan'), Type.Literal('kritisch')]));
const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;

/**
 * Meldung der Periode: `gemeldet` (Bericht eingereicht), `ausstehend` (offene Periode, noch kein Bericht; Werte der
 * letzten Meldung), `nicht_gemeldet` (abgeschlossen ohne geprüften Bericht, Werte der Vorperiode, A-11), `ohne_pflicht`
 * (keine Berichtspflicht: Phase P4 oder Portfolio ohne Pflichten, A-08).
 */
export const MELDUNGEN = ['gemeldet', 'ausstehend', 'nicht_gemeldet', 'ohne_pflicht'] as const;
export type Meldung = (typeof MELDUNGEN)[number];

export const DashboardZeile = Type.Object({
  projektId: Uuid,
  nummer: Type.String(),
  name: Type.String(),
  portfolioId: Uuid,
  portfolio: Type.String({ description: 'Name des Portfolios.' }),
  handlungsfeld: Nullable(Type.String({ description: 'Nur mit `handlungsfeld:read`.' })),
  projektleitung: Nullable(Type.String()),
  phase: Type.Union(PHASEN.map(p => Type.Literal(p))),
  abschlussPer: Nullable(Type.String({ format: 'date' })),
  naechsterMeilenstein: Nullable(Type.Object({
    termin: Nullable(Type.String({ format: 'date' })),
    text: Type.String(),
  }, { additionalProperties: false, description: 'Nächster offener Meilenstein aus dem Register, sonst die Angabe des Berichts (ohne Termin).' })),
  status: Status,
  statusVorperiode: Status,
  trend: Nullable(Type.String()),
  meldung: Type.Union(MELDUNGEN.map(m => Type.Literal(m))),
  werteAus: Nullable(Type.String({ description: 'Periode, aus der Status und Trend stammen (bei «nicht gemeldet» bzw. «ausstehend» eine frühere).' })),
  merkmale: Type.Array(Type.Union([Type.Literal('eskalation')]), { description: '«Eskalation»: Eskalation zum Bericht der Zeile, noch nicht erledigt (offen oder traktandiert; UC-004 A2.2, AP-E2-4).' }),
}, { $id: 'DashboardZeile', additionalProperties: false });
export type DashboardZeileOut = Static<typeof DashboardZeile>;

/** Funnel nach Phase (UC-014 Schritt 1): Anzahl je Phase mit Status. */
export const FunnelStufe = Type.Object({
  phase: Type.Union(PHASEN.map(p => Type.Literal(p))),
  anzahl: Type.Integer(),
  imPlan: Type.Integer(),
  kritisch: Type.Integer(),
  ohneStatus: Type.Integer({ description: 'Ohne Status (nicht gemeldet ohne frühere Werte, ohne Pflicht).' }),
  nichtGemeldet: Type.Integer({ description: '«nicht gemeldet» bzw. «ausstehend».' }),
}, { $id: 'FunnelStufe', additionalProperties: false });

export const Dashboard = Type.Object({
  periode: Type.String(),
  periodeStand: Type.Union([Type.Literal('offen'), Type.Literal('abgeschlossen')]),
  abgeschlossenAt: Nullable(DateTime),
  perioden: Type.Array(Type.Object({ periode: Type.String(), stand: Type.Union([Type.Literal('offen'), Type.Literal('abgeschlossen')]) }, { additionalProperties: false }), { description: 'Perioden zur Auswahl, neueste zuerst.' }),
  portfolios: Type.Array(Type.Object({ id: Uuid, schluessel: Type.String(), name: Type.String(), kategorie: Type.String() }, { additionalProperties: false }), { description: 'Portfolios, deren Dashboard die Person sieht (`auswertung:read`).' }),
  portfolio: Nullable(Type.String({ description: 'Gewähltes Portfolio (Schlüssel) oder null für alle sichtbaren.' })),
  items: Type.Array(Type.Ref('DashboardZeile'), { description: 'Kritische zuerst, dann nicht gemeldete, sonst nach Nummer.' }),
  funnel: Type.Array(Type.Ref('FunnelStufe')),
}, { $id: 'Dashboard', additionalProperties: false });
export type DashboardOut = Static<typeof Dashboard>;

export const DashboardQuery = Type.Object({
  portfolio: Type.Optional(Type.String({ pattern: '^[a-z0-9_-]{1,40}$', description: 'Schlüssel des Portfolios (I-N5), z. B. `transformation`.' })),
  periode: Type.Optional(Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$', description: 'Ohne Angabe die letzte abgeschlossene Periode, sonst die laufende.' })),
  ansicht: Type.Optional(Type.Union([Type.Literal('liste'), Type.Literal('funnel')], { description: 'Darstellung der Oberfläche; die Antwort enthält Liste und Funnel.' })),
}, { additionalProperties: false });
export type DashboardQueryIn = Static<typeof DashboardQuery>;

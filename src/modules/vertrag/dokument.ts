/**
 * Projektvertrag als Dokument (DM.02.07; UC-002 Schritt 12; K2 Schritt 11, UI-11): Deckblatt «Vorliegende Version»,
 * Versionierung, Kapitel 1–13 nach der Gliederung der Vorlage (Q7) und Freigabe mit Stand. Kopfzeile «Intern · enthält
 * Personendaten» (G12); Beträge nur mit Recht auf Beträge (A-33), sonst «nicht verfügbar» (G12). Unterschriften und
 * Quality-Check ergänzt AP-E3-2 in Kapitel 12.
 */
import type { Block, Dokument, Vorlage } from '../vorlage/index.ts';
import { vorlage } from '../vorlage/index.ts';
import type { Bezeichnungen, Kopf } from './dokument-store.ts';
import { STAND_TEXT } from './entwurf.ts';
import type { Static, TSchema } from '@sinclair/typebox';
import type {
  AbhaengigkeitPlan, BeilagePlan, Kapitel1, Kapitel12, Kapitel2, Kapitel3, Kapitel4, Kapitel5, Kapitel6, Kapitel7, KommunikationPlan, KostenPlan, KpiPlan,
  MeilensteinPlan, MitgliedPlan, PersonalPlan, Phase, RisikoPlan, StakeholderPlan, ToleranzPlan,
} from './kapitel.ts';
import type { VersionRow } from './store.ts';

const PHASE_TEXT: Record<Phase, string> = {
  P0: 'P0 – Initialisierung', P1: 'P1 – Konzept & Planung', P2: 'P2 – Implementierung', P3: 'P3 – Stabilisierung & Monitoring', P4: 'P4 – Abschluss',
};
const KATEGORIE_TEXT: Record<string, string> = { A: 'A: Strategisches Projekt', B: 'B: Projekt der Geschäftsleitung', C: 'C: Projekt der Direktion' };
const ANLASS_TEXT = { initial: 'erster Vertrag', gate: 'Gate', aenderung: 'Änderung' } as const;
const FUNKTION_TEXT: Record<string, string> = { sp: 'Haupt-Sponsor/in', koalition: 'Sponsoren-Koalition', pl: 'Projektleiter/in', ctl: 'Clinical Transformation Lead', kt: 'Kernteam' };
const STUFE_TEXT: Record<string, string> = { hoch: 'hoch', mittel: 'mittel', tief: 'tief' };
const KPI_TEXT: Record<string, string> = { klinisch: 'klinisch', nicht_klinisch: 'nicht klinisch', projekt: 'Projekt' };

type S<T extends TSchema> = Static<T>;
/** Inhalt der Kapitel 1–13 mit den Listen als Einträge (die Schemas verweisen per `$ref` auf sie). */
export interface VertragInhalt {
  1: S<typeof Kapitel1>; 2: S<typeof Kapitel2>; 3: Omit<S<typeof Kapitel3>, 'kpis'> & { kpis: S<typeof KpiPlan>[] };
  4: S<typeof Kapitel4>; 5: S<typeof Kapitel5>; 6: Omit<S<typeof Kapitel6>, 'abhaengigkeiten'> & { abhaengigkeiten: S<typeof AbhaengigkeitPlan>[] };
  7: Omit<S<typeof Kapitel7>, 'meilensteine' | 'toleranzen'> & { meilensteine: S<typeof MeilensteinPlan>[]; toleranzen?: S<typeof ToleranzPlan>[] }; 8: { mitglieder: S<typeof MitgliedPlan>[] };
  9: { kosten: S<typeof KostenPlan>[]; personal: S<typeof PersonalPlan>[] }; 10: { risiken: S<typeof RisikoPlan>[] };
  11: { stakeholder: S<typeof StakeholderPlan>[]; kommunikation: S<typeof KommunikationPlan>[] }; 12: S<typeof Kapitel12>;
  13: { beilagen: S<typeof BeilagePlan>[] };
}

export const NICHT_VERFUEGBAR = 'nicht verfügbar';
const LEER = 'Keine Angaben.';

/** Datum «03.06.2026» (Dokumente immer absolut, I-T2). */
export const datum = (d: Date | string | null): string => {
  if (!d) return '–';
  const t = typeof d === 'string' ? new Date(`${d.slice(0, 10)}T12:00:00Z`) : d;
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich' }).format(t);
};
const monat = (m: string | null) => (m ? `${m.slice(5, 7)}.${m.slice(0, 4)}` : '–');
/** Betrag «CHF 12'345.00» (de-CH). */
export const betrag = (n: number) => `CHF ${new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

export interface DokumentDaten {
  version: VersionRow;
  /** Alle Versionen des Projekts, neueste zuerst (Versionierung). */
  versionen: readonly VersionRow[];
  kopf: Kopf;
  inhalt: VertragInhalt;
  personen: Map<string, string>;
  projekte: Map<string, string>;
  bez: Bezeichnungen;
  /** Recht auf Beträge (A-33). */
  betraege: boolean;
  /** Standard des Phasenmodells des Projekts je Dimension (A-10, A-13); gilt, wo Kap. 7 keine Toleranz nennt. */
  standardToleranzen: readonly { dimension: string; wert: number | null; einheit: string }[];
}

const DIMENSION_TOLERANZ: Record<string, string> = { termin: 'Termin', kosten: 'Kosten', umfang: 'Umfang' };
const EINHEIT_TOLERANZ: Record<string, string> = { prozent: '%', kalendertage: 'Kalendertage', arbeitstage: 'Arbeitstage' };
const zahl = (n: number) => new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 }).format(n);
const toleranzText = (t: { wert: number | null; einheit: string } | undefined) => (t && t.wert !== null ? `${zahl(t.wert)} ${EINHEIT_TOLERANZ[t.einheit] ?? t.einheit}` : null);

/**
 * Toleranzen in Kap. 7.2 (A-10, K11; seit #155 im Vertrag): je Dimension der Wert des Vertrags, sonst «Standard des
 * Phasenmodells: …» (ohne Standard «keiner»; dann gibt es keine Warnung «wesentlich»).
 */
export function toleranzZeilen(d: Pick<DokumentDaten, 'inhalt' | 'standardToleranzen'>): [string, string][] {
  return Object.keys(DIMENSION_TOLERANZ).map(dim => {
    const eigen = toleranzText((d.inhalt[7].toleranzen ?? []).find(t => t.dimension === dim));
    return [`Toleranz ${DIMENSION_TOLERANZ[dim]}`, eigen ?? `Standard des Phasenmodells: ${toleranzText(d.standardToleranzen.find(t => t.dimension === dim)) ?? 'keiner'}`];
  });
}

/** Dateiname «Projektvertrag-2026-014-v0.1.pdf». */
export const dateiname = (nummer: string, version: string, endung: string) => `Projektvertrag-${nummer}-v${version}.${endung}`.replace(/[^A-Za-z0-9._-]/g, '_');

export function vertragDokument(d: DokumentDaten, v: Vorlage = vorlage.aktuell('projektvertrag')): Dokument {
  const { version: ver, inhalt: i, kopf } = d;
  const t = (nr: string) => `${nr} ${vorlage.titelVon(v, nr)}`;
  const person = (id: string) => d.personen.get(id) || 'Person nicht verfügbar';
  const funktion = (f: string) => i[8].mitglieder.filter(m => m.funktion === f).map(m => person(m.personId)).join(', ') || '–';
  const absatz = (titel: string | null, text: string, feld?: string): Block[] => [...(titel ? [{ art: 'ueberschrift' as const, text: titel, ebene: 2 as const }] : []), { art: 'absatz', text, leer: LEER, feld }];
  const h1 = (nr: string): Block => ({ art: 'ueberschrift', text: t(nr), ebene: 1 });
  const h2 = (nr: string): Block => ({ art: 'ueberschrift', text: t(nr), ebene: 2 });
  const tab = (kopfzeile: string[], zeilen: string[][], breiten: number[], feld: string): Block => ({ art: 'tabelle', kopf: kopfzeile, zeilen, breiten, leer: LEER, feld });

  const freigabe = ver.baseline ? `Baseline seit ${datum(ver.baseline_at)}` : ver.stand === 'abgenommen' ? 'abgenommen' : 'nicht freigegeben';

  const bloecke: Block[] = [
    { art: 'titel', text: v.titel, untertitel: `${kopf.nummer} ${kopf.name}` },
    { art: 'ueberschrift', text: 'Vorliegende Version', ebene: 2 },
    { art: 'felder', zeilen: [
      ['Version', ver.nummer],
      ['Phase', PHASE_TEXT[ver.zielphase]],
      ['Datum', datum(ver.eingereicht_at ?? ver.updated_at)],
      ['Status', STAND_TEXT[ver.stand]],
      ['Freigabe', freigabe],
      ['Klassifikation', kopf.vertraulich ? 'vertraulich' : 'intern'],
      ['Haupt-Sponsor/in', funktion('sp')],
      ['Sponsoren-Koalition', funktion('koalition')],
      ['Projektleiter/in', funktion('pl')],
      ['Clinical Transformation Lead', funktion('ctl')],
      ['Projektkategorie', d.bez.kategorie ? KATEGORIE_TEXT[d.bez.kategorie] ?? d.bez.kategorie : '–'],
    ], felder: ['version.nummer', 'version.phase', 'version.datum', 'version.status', 'version.freigabe', 'projekt.klassifikation', 'rolle.sponsor',
      'rolle.koalition', 'rolle.projektleitung', 'rolle.ctl', 'projekt.kategorie'] },
    { art: 'ueberschrift', text: 'Versionierung und Änderungstracking', ebene: 2 },
    tab(['Version', 'Datum', 'Anlass', 'Stand'], [...d.versionen].reverse().map(x => [
      x.nummer, datum(x.eingereicht_at ?? x.created_at), ANLASS_TEXT[x.anlass], `${STAND_TEXT[x.stand]}${x.baseline ? ' (Baseline)' : ''}`,
    ]), [1, 2, 2, 3], 'versionierung'),
    ...(ver.begruendung.trim() ? absatz('Begründung der Änderung', ver.begruendung, 'version.begruendung') : []),

    h1('1'),
    ...absatz('Ausgangslage', i[1].ausgangslage, 'kap1.ausgangslage'), ...absatz('Problemstellung', i[1].problemstellung, 'kap1.problemstellung'),
    ...absatz('Was geschieht ohne das Projekt', i[1].ohneProjekt, 'kap1.ohneProjekt'), ...absatz('Vorprojekte und Initiativen', i[1].vorprojekte, 'kap1.vorprojekte'),
    ...absatz('Vorgaben und Rahmenbedingungen', i[1].rahmenbedingungen, 'kap1.rahmenbedingungen'),

    h1('2'),
    { art: 'felder', zeilen: [
      ['Handlungsfeld', d.bez.handlungsfeld ?? '–'],
      ['Strategisches Ziel', d.bez.ziel ?? '–'],
      ['Jahresziel', d.bez.jahresziel ?? '–'],
    ], felder: ['kap2.handlungsfeld', 'kap2.ziel', 'kap2.jahresziel'] },
    ...absatz('Beitrag zum Ziel', i[2].beitrag, 'kap2.beitrag'),

    h1('3'),
    ...absatz('Ziele', i[3].ziele, 'kap3.ziele'), ...absatz('Nutzenbeitrag', i[3].nutzen, 'kap3.nutzen'), ...absatz('Business Case', i[3].businessCase, 'kap3.businessCase'),
    { art: 'ueberschrift', text: 'KPIs', ebene: 2 },
    tab(['Art', 'KPI', 'Einheit', 'Zielwert'], i[3].kpis.map(k => [KPI_TEXT[k.art] ?? k.art, k.text, k.einheit, k.zielwert]), [2, 5, 2, 2], 'kap3.kpis'),

    h1('4'), ...absatz('Lösungsansatz', i[4].loesungsansatz, 'kap4.loesungsansatz'), ...absatz('Annahmen', i[4].annahmen, 'kap4.annahmen'),
    h1('5'), ...absatz('Im Projekt bearbeitet', i[5].bearbeitet, 'kap5.bearbeitet'), ...absatz('Nicht bearbeitet', i[5].nichtBearbeitet, 'kap5.nichtBearbeitet'),

    h1('6'),
    tab(['Projekt', 'Abhängigkeit', 'Ansprechperson'], i[6].abhaengigkeiten.map(a => [d.projekte.get(a.zuProjektId) ?? 'Projekt nicht verfügbar', a.text, a.ansprechperson]), [3, 5, 2], 'kap6.abhaengigkeiten'),
    ...absatz('Weitere Schnittstellen', i[6].schnittstellen, 'kap6.schnittstellen'),

    h1('7'), h2('7.1'),
    ...absatz(null, i[7].vorgehen, 'kap7.vorgehen'),
    tab(['Phase', 'Art', 'Lieferergebnis / Meilenstein', 'Termin'], i[7].meilensteine.map(m => [m.phase, m.art === 'meilenstein' ? 'Meilenstein' : 'Lieferergebnis', m.text, datum(m.termin)]), [1, 2, 6, 2], 'kap7.meilensteine'),
    h2('7.2'),
    { art: 'felder', zeilen: [
      ['Projektstart', datum(i[7].termine.projektStart)], ['Start der Phase', datum(i[7].termine.phasenStart)],
      ['Exit der Phase', datum(i[7].termine.phasenExit)], ['Erwarteter Projektabschluss', datum(i[7].termine.projektabschluss)],
    ], felder: ['kap7.projektStart', 'kap7.phasenStart', 'kap7.phasenExit', 'kap7.projektabschluss'] },
    { art: 'felder', zeilen: toleranzZeilen(d), felder: ['kap7.toleranzTermin', 'kap7.toleranzKosten', 'kap7.toleranzUmfang'] },

    h1('8'),
    tab(['Rolle', 'Person', 'Aufgaben, Kompetenzen, Verantwortung'], i[8].mitglieder.map(m => [FUNKTION_TEXT[m.funktion] ?? m.funktion, person(m.personId), m.akv]), [3, 3, 6], 'kap8.mitglieder'),

    h1('9'), h2('9.1'),
    tab(['Phase', 'Art', 'Position', 'Lieferant', 'Offerte', 'Betrag'], i[9].kosten.map(k => [
      k.phase, k.art.toUpperCase(), k.text, k.lieferant, k.offerte, !d.betraege ? NICHT_VERFUEGBAR : k.betrag === null ? '–' : betrag(k.betrag),
    ]), [1, 1.3, 4, 2, 2, 2.4], 'kap9.kosten'),
    ...(d.betraege && i[9].kosten.length
      ? [{ art: 'felder' as const, zeilen: [['Total', betrag(i[9].kosten.reduce((s, k) => s + (k.betrag ?? 0), 0))] as const], felder: ['kap9.total'] }]
      : []),
    h2('9.2'),
    tab(['Phase', 'Rolle', 'Umfang', 'Zeitraum', 'Bemerkung'], i[9].personal.map(p => [
      p.phase, d.bez.rollen.get(p.rolle) ?? p.rolle, p.fte !== null ? `${p.fte} FTE` : p.groesse ? `Grösse ${p.groesse}` : '–',
      p.vonMonat || p.bisMonat ? `${monat(p.vonMonat)} – ${monat(p.bisMonat)}` : '–', p.bemerkung,
    ]), [1, 2.5, 1.5, 2.5, 4], 'kap9.personal'),

    h1('10'),
    tab(['Risiko', 'EW', 'AW', 'Massnahme', 'Verantwortlich'], i[10].risiken.map(r => [r.text, STUFE_TEXT[r.wahrscheinlichkeit]!, STUFE_TEXT[r.auswirkung]!, r.massnahme, r.verantwortlich]), [4, 1.2, 1.2, 4, 2], 'kap10.risiken'),

    h1('11'), h2('11.1'),
    tab(['Stakeholder', 'Interesse', 'Einfluss', 'Massnahmen'], i[11].stakeholder.map(s => [s.gruppe, s.interesse, s.einfluss, s.massnahmen]), [2, 3, 3, 4], 'kap11.stakeholder'),
    h2('11.2'),
    tab(['Phase', 'Massnahme', 'Adressat', 'Ziel', 'Termin'], i[11].kommunikation.map(k => [k.phase, k.text, k.adressat, k.ziel, datum(k.termin)]), [1, 4, 2, 3, 1.6], 'kap11.kommunikation'),

    h1('12'),
    { art: 'felder', zeilen: [
      ['Version', ver.nummer], ['Status', STAND_TEXT[ver.stand]], ['Eingereicht', datum(ver.eingereicht_at)], ['Freigabe', freigabe],
      ['Unterschriften', 'noch keine'],
    ], felder: [null, null, 'version.eingereicht', null, 'kap12.unterschriften'] },
    ...absatz('Bemerkungen', i[12].bemerkung, 'kap12.bemerkung'),

    h1('13'),
    tab(['Bezeichnung', 'Version / Datum', 'Inhalt'], i[13].beilagen.map(b => [b.bezeichnung, b.version, b.inhalt]), [3, 2, 5], 'kap13.beilagen'),
  ];

  return {
    titel: `${v.titel} ${kopf.nummer} ${kopf.name}, Version ${ver.nummer}`,
    kopfzeile: v.kopfzeile,
    fusszeile: `${v.titel} ${kopf.nummer} · Version ${ver.nummer} · ${STAND_TEXT[ver.stand]} · Vorlage ${v.name}, Fassung ${v.version}`,
    bloecke,
    felder: { 'projekt.nummer': kopf.nummer, 'projekt.name': kopf.name, 'dokument.datum': datum(new Date()) },
  };
}

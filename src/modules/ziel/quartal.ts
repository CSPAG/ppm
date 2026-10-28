/**
 * Quartalsreporting an den VR (BC ZM.03.02, PC.04.02; UC-012 Schritte 3–6, A1; UC-006 A4; Kernablauf K6 Schritte 11–14;
 * AP-E6-4): Der Entwurf entsteht aus der Zielerreichung des Quartals, den Portfolioberichten des letzten Quartalsmonats
 * (Dashboard und Risikolage, AP-E2-3) und den im Gremium zur Weiterleitung an den VR markierten Geschäften. Die UE
 * ergänzt Kommentare und traktandiert den Bericht im PRAT (Art `quartalsreporting`); «Verabschiedet» stellt ihn dem VR
 * bereit, «Anpassungen verlangt» setzt ihn auf «in Arbeit» zurück (A1).
 */
import { type Tx } from '@vollholz/platform';
import { aufgabe } from '../eingang/index.ts';
import { registriereTraktandenart, type EntscheidFolge } from '../sitzung/index.ts';
import * as es from './erreichung-store.ts';
import type { QuartalsInhaltOut } from './quartal-schemas.ts';
import * as store from './quartal-store.ts';

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** «Q3 2026» */
export const quartalLabel = (q: string) => `${q.slice(5)} ${q.slice(0, 4)}`;
const nr = (q: string) => Number(q.slice(6));
/** Erster und letzter Tag des Quartals. */
export function zeitraum(q: string): { von: string; bis: string } {
  const jahr = Number(q.slice(0, 4));
  const ersterMonat = (nr(q) - 1) * 3 + 1;
  const ende = new Date(Date.UTC(jahr, ersterMonat + 2, 0));
  return { von: `${jahr}-${String(ersterMonat).padStart(2, '0')}-01`, bis: ende.toISOString().slice(0, 10) };
}
/** Letzter Monat des Quartals als Periode «JJJJ-MM» (Monatsabschluss, Portfoliobericht). */
export const letztePeriode = (q: string) => `${q.slice(0, 4)}-${String(nr(q) * 3).padStart(2, '0')}`;
/** Quartal, das zuletzt vor `heute` geendet hat. */
export function letztesQuartal(heute: string): string {
  const jahr = Number(heute.slice(0, 4));
  const q = Math.floor((Number(heute.slice(5, 7)) - 1) / 3) + 1;
  return q === 1 ? `${jahr - 1}-Q4` : `${jahr}-Q${q - 1}`;
}
export const istVorbei = (q: string, heute: string) => zeitraum(q).bis < heute;
/** Adresse in der Oberfläche (K6 Arbeitsraum). */
export const link = (q: string) => `/ziele/${q.slice(0, 4)}/quartalsreporting?quartal=${q.slice(5).toLowerCase()}`;
export const monat = (periode: string) => `${MONATE[Number(periode.slice(5, 7)) - 1]} ${periode.slice(0, 4)}`;

type Inhalt = QuartalsInhaltOut;
type Portfolio = Inhalt['portfolios'][number];

/** Kritische Risiken: Auswirkung «hoch» bei Wahrscheinlichkeit «mittel» oder «hoch» (Annahme bis zur Klärung). */
const kritisch = (r: { wahrscheinlichkeit: string; auswirkung: string }) => r.auswirkung === 'hoch' && r.wahrscheinlichkeit !== 'tief';

interface DashboardZeile { nummer: string; name: string; phase: string; status: string | null; trend: string | null; meldung: string; naechsterMeilenstein: { termin: string | null; text: string } | null }
interface Risikolage {
  risiken: { projekt: { nummer: string; name: string } | null; text: string; wahrscheinlichkeit: string; auswirkung: string; massnahme: string }[];
  abhaengigkeiten: { von: { nummer: string; name: string }; zu: { nummer: string; name: string }; text: string }[];
  eskalationen: { projekt: { nummer: string; name: string }; periode: string; grund: string; massnahme: string }[];
}

const pk = (p: { nummer: string; name: string }) => ({ nummer: p.nummer, name: p.name });

/** Zahlen eines Portfolios aus seinem Portfoliobericht (Stand bei dessen Erzeugung). */
function portfolioAus(pf: { id: string; name: string }, periode: string, b: store.PortfolioberichtRow | undefined): Portfolio {
  const d = (b?.inhalt.dashboard as { items?: DashboardZeile[] } | undefined)?.items ?? [];
  const r = (b?.inhalt.risikolage as Risikolage | undefined) ?? { risiken: [], abhaengigkeiten: [], eskalationen: [] };
  return {
    id: pf.id, name: pf.name, periode, berichtId: b?.id ?? null, bereitgestellt: b?.stand === 'bereitgestellt',
    projekte: d.length, imPlan: d.filter(i => i.status === 'im_plan').length, kritisch: d.filter(i => i.status === 'kritisch').length,
    nichtGemeldet: d.filter(i => i.meldung === 'nicht_gemeldet').length,
    kritischeProjekte: d.filter(i => i.status === 'kritisch').map(i => ({ nummer: i.nummer, name: i.name, phase: i.phase, trend: i.trend })),
    meilensteine: d.filter(i => i.naechsterMeilenstein).map(i => ({ projekt: pk(i), text: i.naechsterMeilenstein!.text, termin: i.naechsterMeilenstein!.termin }))
      .sort((a, b) => (a.termin ?? '9999').localeCompare(b.termin ?? '9999')),
    risiken: r.risiken.filter(kritisch).map(x => ({ projekt: x.projekt ? pk(x.projekt) : null, text: x.text, wahrscheinlichkeit: x.wahrscheinlichkeit, auswirkung: x.auswirkung, massnahme: x.massnahme })),
    abhaengigkeiten: r.abhaengigkeiten.map(a => ({ von: pk(a.von), zu: pk(a.zu), text: a.text })),
    eskalationen: r.eskalationen.map(e => ({ projekt: pk(e.projekt), periode: e.periode, grund: e.grund, massnahme: e.massnahme })),
  };
}

/**
 * Inhalt des Entwurfs (UC-012 Schritt 3) in der Lesesicht der UE: Zielerreichung (Stand des Quartals, sonst der letzte
 * frühere), je Portfolio mit Berichtspflicht der Portfoliobericht des letzten Quartalsmonats und die Weiterleitungen.
 */
export async function inhaltErzeugen(tx: Tx, quartal: string): Promise<Inhalt> {
  const hinweise: string[] = [];
  const ziele = await es.ziele(tx, Number(quartal.slice(0, 4)));
  const key = (t: string, id: string) => `${t}:${id}`;
  const jetzt = new Map((await es.eintraege(tx, quartal)).map(e => [key(e.ziel_typ, e.ziel_id), e]));
  const vorher = new Map((await es.letzteEintraege(tx, quartal)).map(e => [key(e.ziel_typ, e.ziel_id), e]));
  const zz = ziele.map(z => {
    const e = jetzt.get(key(z.typ, z.id)) ?? vorher.get(key(z.typ, z.id));
    return { typ: z.typ, id: z.id, nummer: z.nummer, text: z.text, metrik: z.metrik, zielwert: z.zielwert, stand: e?.stand ?? null, beurteilung: e?.beurteilung ?? '', quartal: e?.quartal ?? null };
  });
  const nachgefuehrt = zz.filter(z => z.quartal === quartal).length;
  // K6 Regel «Zielerreichung unvollständig»: Warnung mit dem Stand des Vorquartals
  if (nachgefuehrt < zz.length) hinweise.push(`Zielerreichung ${quartalLabel(quartal)}: ${zz.length - nachgefuehrt} von ${zz.length} Zielen ohne neuen Stand; diese erscheinen mit dem letzten früheren Stand.`);

  const periode = letztePeriode(quartal);
  const berichte = new Map((await store.portfolioberichte(tx, periode)).map(b => [b.portfolio_id, b]));
  const portfolios = (await store.portfolios(tx)).map(pf => {
    const b = berichte.get(pf.id);
    // K6 Z4 «Teilweise»: Entwurf möglich, Zahlen können sich ändern
    if (!b) hinweise.push(`Portfoliobericht ${pf.name} ${monat(periode)} fehlt (Monatsabschluss oder Bericht ausstehend); die Zahlen können sich ändern.`);
    else if (b.stand !== 'bereitgestellt') hinweise.push(`Portfoliobericht ${pf.name} ${monat(periode)} ist noch nicht bereitgestellt; die Zahlen können sich ändern.`);
    return portfolioAus(pf, periode, b);
  });

  const { von, bis } = zeitraum(quartal);
  const weiterleitungen = (await store.weiterleitungen(tx, von, bis)).map(w => ({
    entscheidId: w.entscheid_id, datum: w.datum, gremium: w.gremium, titel: w.titel, ergebnis: w.ergebnis, begruendung: w.begruendung,
    ausserordentlichAm: w.weitergeleitet_am,
  }));
  return { hinweise, zielerreichung: { nachgefuehrt, gesamt: zz.length, ziele: zz }, portfolios, weiterleitungen };
}

/** Aufgabe «Quartalsreporting erstellen» (fachmodell.md 4.2): an `quartalsbericht:write`, erledigt mit dem Traktandieren. */
export const ART_AUFGABE = 'quartalsreporting.erstellen';
export const bezugQuartal = (q: string) => ({ typ: 'quartal', id: q });

export async function aufgabeOeffnen(tx: Tx, quartal: string): Promise<void> {
  await aufgabe.oeffnen(tx, {
    art: ART_AUFGABE, bezug: bezugQuartal(quartal), empfaenger: { recht: 'quartalsbericht:write' },
    titel: `Quartalsreporting ${quartalLabel(quartal)} erstellen`, kontext: 'Bericht an den VR aus Dashboard und Zielerreichung', link: link(quartal),
  });
}

/** Ergebnisse des PRAT (K3 Schritt 8: Quartalsreporting). */
export const ERGEBNISSE = [{ schluessel: 'verabschiedet', label: 'Verabschiedet' }, { schluessel: 'anpassungen', label: 'Anpassungen verlangt' }] as const;

/**
 * Folge des Entscheids (fachmodell.md 2.9; UC-012 Schritt 5, A1), idempotent und angeglichen an das zuletzt erfasste
 * Ergebnis (A-30): «Verabschiedet» stellt den Bericht dem VR bereit; «Anpassungen verlangt» setzt ihn mit den
 * Rückmeldungen des PRAT auf «in Arbeit» zurück und öffnet die Aufgabe erneut (weiter bei Schritt 3).
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge): Promise<void> {
  if (f.bezug.typ !== 'quartalsbericht') return;
  const b = await store.berichtVonId(tx, f.bezug.id);
  if (!b) return;
  if (f.ergebnis === 'verabschiedet') {
    if (b.stand !== 'verabschiedet') await store.standSetzen(tx, b.id, 'verabschiedet');
    await aufgabe.erledigen(tx, { art: ART_AUFGABE, bezug: bezugQuartal(b.quartal) });
    return;
  }
  await store.standSetzen(tx, b.id, 'in_arbeit', { rueckmeldungPrat: f.begruendung });
  await aufgabeOeffnen(tx, b.quartal);
}

/** Art `quartalsreporting` in der Registry der Sitzung (fachmodell.md 2.9): Bericht als Unterlage. */
export function registriereQuartalsreporting(): void {
  registriereTraktandenart({
    art: 'quartalsreporting',
    label: 'Quartalsreporting',
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => {
      const b = bezug.typ === 'quartalsbericht' ? await store.berichtVonId(tx, bezug.id) : null;
      return b ? { titel: `Quartalsreporting ${quartalLabel(b.quartal)}`, antrag: 'Verabschiedung des Quartalsreportings zuhanden des VR' } : null;
    },
    unterlagen: async (tx, bezug) => {
      const b = bezug.typ === 'quartalsbericht' ? await store.berichtVonId(tx, bezug.id) : null;
      if (!b) return [];
      const bereit = b.stand !== 'in_arbeit';
      return [{ art: 'bericht', titel: `Quartalsreporting ${quartalLabel(b.quartal)}`, bereit, hinweis: bereit ? 'Entwurf der UE' : 'in Arbeit', inhalt: { quartalsbericht: b.id, quartal: b.quartal } }];
    },
    beiEntscheid,
  });
}

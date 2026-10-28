/**
 * Priorisierungsentscheid (AP-E5-5; UC-008 Schritte 7–8, A2; Kernablauf K5 Schritte 7–8): Der Antrag (Szenario
 * «beantragt», AP-E5-3) wird als Traktandum der Art `priorisierung` traktandiert. Mit dem Entscheid «Szenario gewählt»
 * werden Rang und Start der enthaltenen Projekte Ist-Stand (Rangfolge «entschieden»), das Szenario «entschieden», die
 * Sponsoren und Projektleitungen der Projekte mit geändertem Rang oder Start informiert. Für jedes laufende Projekt
 * unter der Wasserlinie gilt der mit dem Antrag beantragte Folgeentscheid (A2: zurückstellen, sistieren, abbrechen);
 * Sistieren und Abbrechen leiten UC-015 ein (Aufgabe an die Projektleitung).
 */
import { conflict, invalid, systemActor, type Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { registriereTraktandenart, type EntscheidFolge, type Ergebnis } from '../sitzung/index.ts';
import * as es from './entscheid-store.ts';
import * as store from './store.ts';
import { szenarioRechnen, type Gerechnet } from './szenario-routes.ts';
import * as sz from './szenario-store.ts';

/** Ergebnis des Gremiums (K3 Schritt 8: «Szenario ‹B› gewählt»). */
export const ERGEBNISSE: readonly Ergebnis[] = [{ schluessel: 'szenario_gewaehlt', label: 'Szenario gewählt' }];

export const FOLGE_TEXT: Readonly<Record<es.Folge, string>> = { zurueckstellen: 'Zurückstellen', sistieren: 'Sistieren', abbrechen: 'Abbrechen' };

/** Laufendes Projekt (UC-008 A2): aktiv und über die Initialisierung hinaus, d. h. ab Phase P1 (Annahme AP-E5-5). */
export const laufend = (phase: string) => phase !== 'P0';

export const szenarioLink = (portfolioSchluessel: string, id: string) => `/portfolio/priorisierung/szenarien?portfolio=${portfolioSchluessel}&s=${id}`;
const bezugVon = (id: string) => ({ typ: 'szenario', id });

/** Laufende Projekte unter der Wasserlinie (A2) mit ihrem beantragten Folgeentscheid (null = fehlt). */
export async function unterWasserlinie(tx: Tx, s: sz.SzenarioRow, g?: Gerechnet) {
  const r = g ?? await szenarioRechnen(tx, s, await es.kostenSichtbar(tx, s.portfolio_id));
  const folgen = new Map((await es.folgen(tx, s.id)).map(f => [f.projekt_id, f]));
  return r.positionen.filter(p => p.ueberWasserlinie === false && laufend(p.phase))
    .map(p => ({ projektId: p.projektId, nummer: p.nummer, name: p.name, phase: p.phase, folge: folgen.get(p.projektId) ?? null }));
}

const fehltText = (nummern: string[]) =>
  `Folgeentscheid fehlt: ${nummern.length === 1 ? '1 laufendes Projekt liegt' : `${nummern.length} laufende Projekte liegen`} unter der Wasserlinie ohne Antrag zurückstellen, sistieren oder abbrechen (${nummern.join(', ')}). Ergänzen Sie den Folgeentscheid im Szenario.`;

/** Sperre (I-P1): ohne Folgeentscheid für jedes laufende Projekt unter der Wasserlinie kein Traktandum und kein Entscheid. */
export function pruefeFolgen(offen: Awaited<ReturnType<typeof unterWasserlinie>>): void {
  const fehlt = offen.filter(x => !x.folge).map(x => x.nummer);
  if (fehlt.length) throw conflict(fehltText(fehlt), { reason: 'folge_fehlt', projekte: fehlt });
}

/**
 * Folge des Entscheids (fachmodell.md 2.9; UC-008 Schritt 8, A2) in der Transaktion des Entscheids, idempotent: ein
 * zweites Erfassen (Korrektur) schreibt den Ist-Stand erneut, informiert aber nicht doppelt.
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge): Promise<void> {
  if (f.bezug.typ !== 'szenario' || f.ergebnis !== 'szenario_gewaehlt') return;
  const s = await sz.lesen(tx, f.bezug.id);
  if (!s) return;
  if (s.stand !== 'beantragt' && s.stand !== 'entschieden') {
    throw conflict(`Das Szenario «${s.name}» ist nicht als Antrag gewählt (${s.stand}). Wählen Sie es als Antrag und erfassen Sie den Entscheid erneut.`, { reason: 'stand', stand: s.stand });
  }
  const erneut = s.stand === 'entschieden';
  const g = await szenarioRechnen(tx, s, await es.kostenSichtbar(tx, s.portfolio_id));
  const unter = await unterWasserlinie(tx, s, g);
  try { pruefeFolgen(unter); } catch (e) {
    throw invalid((e as Error).message, [{ path: '/ergebnis', message: 'Folgeentscheid je laufendem Projekt unter der Wasserlinie fehlt (UC-008 A2).' }]);
  }
  const pf = (await store.portfolio(tx, s.portfolio_id))!;
  const enthalten = g.positionen.filter(p => p.aktiv);
  const bisher = await es.rangfolgeEntscheiden(tx, s.portfolio_id, enthalten.map(p => ({ projektId: p.projektId, startMonat: p.startMonat })));
  await es.szenarioEntscheiden(tx, s.id);
  const who = systemActor('system');
  const link = szenarioLink(pf.schluessel, s.id);

  // Sponsoren und Projektleitungen der Projekte mit geändertem Rang oder Start informieren (UC-008 Schritt 8)
  const geaendert = enthalten.filter((p, i) => { const b = bisher.get(p.projektId); return !b || b.rang !== i + 1 || b.start !== p.startMonat; });
  const personen = await es.verantwortliche(tx, enthalten.map(p => p.projektId));
  if (!erneut) {
    const an = new Map<string, string[]>();
    for (const p of geaendert) for (const v of personen.filter(x => x.projekt_id === p.projektId)) an.set(v.person_id, [...(an.get(v.person_id) ?? []), p.nummer]);
    for (const [person, nummern] of an) {
      await mitteilung.senden(tx, {
        an: person, bezug: bezugVon(s.id), link,
        text: `Priorisierung ${pf.name}: Das Gremium hat das Szenario «${s.name}» gewählt. Rang oder Start ändern sich für ${nummern.join(', ')}.`,
      });
    }
  }
  // Folgeentscheide (A2): Sistieren und Abbrechen leiten UC-015 ein (Aufgabe an die Projektleitung)
  for (const u of unter) {
    const folge = u.folge!;
    if (folge.folge !== 'zurueckstellen') {
      for (const v of personen.filter(x => x.projekt_id === u.projektId && x.funktion === 'pl')) {
        await aufgabe.oeffnen(tx, {
          art: `priorisierung.${folge.folge}`, bezug: { typ: 'projekt', id: u.projektId }, empfaenger: { person: v.person_id },
          titel: `${folge.folge === 'sistieren' ? 'Sistierung' : 'Abbruch'} von ${u.nummer} ${u.name} einleiten`,
          kontext: `Priorisierung ${pf.name}: Szenario «${s.name}», Projekt unter der Wasserlinie`,
          link: `/projekte/${u.nummer}`,
        });
      }
    }
    if (!erneut) {
      for (const v of personen.filter(x => x.projekt_id === u.projektId)) {
        await mitteilung.senden(tx, {
          an: v.person_id, bezug: { typ: 'projekt', id: u.projektId }, link: `/projekte/${u.nummer}`,
          text: `Priorisierung ${pf.name}: ${u.nummer} ${u.name} liegt unter der Wasserlinie. Entscheid des Gremiums: ${FOLGE_TEXT[folge.folge]}.`,
        });
      }
    }
  }
  const daten = {
    id: s.id, portfolioId: s.portfolio_id, name: s.name, traktandumId: f.traktandumId, begruendung: f.begruendung,
    rangfolge: enthalten.map((p, i) => ({ projektId: p.projektId, rang: i + 1, startMonat: p.startMonat })),
    folgen: unter.map(u => ({ projektId: u.projektId, folge: u.folge!.folge })),
  };
  await record(tx, who, { action: 'szenario.decided', resourceType: 'szenario', resourceId: s.id, data: daten, event: daten });
}

/** Titel und Antrag des Traktandums (K3 Schritt 6). */
export async function zusammenfassung(tx: Tx, s: sz.SzenarioRow): Promise<{ titel: string; antrag: string }> {
  const pf = await store.portfolio(tx, s.portfolio_id);
  const g = await szenarioRechnen(tx, s, await es.kostenSichtbar(tx, s.portfolio_id));
  const unter = g.positionen.filter(p => p.ueberWasserlinie === false).length;
  return {
    titel: `Priorisierung ${pf?.name ?? ''}: Szenario «${s.name}»`.replace(/\s+/g, ' '),
    antrag: `Szenario «${s.name}» als Ist-Stand wählen: Rang und Start von ${g.positionen.filter(p => p.aktiv).length} Projekten${unter ? `, ${unter} ${unter === 1 ? 'Projekt' : 'Projekte'} unter der Wasserlinie` : ''}.`,
  };
}

/** Art `priorisierung` in der Registry der Sitzung (fachmodell.md 2.9): Titel und Antrag, Entscheidungsvorlage als Unterlage. */
export function registrierePriorisierung(): void {
  registriereTraktandenart({
    art: 'priorisierung',
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => {
      const s = bezug.typ === 'szenario' ? await sz.lesen(tx, bezug.id) : null;
      return s ? zusammenfassung(tx, s) : null;
    },
    unterlagen: async (tx, bezug) => {
      const s = bezug.typ === 'szenario' ? await sz.lesen(tx, bezug.id) : null;
      if (!s) return [];
      return [{
        art: 'bericht', titel: `Entscheidungsvorlage: Szenario «${s.name}»`, bereit: s.vorlage !== null,
        hinweis: s.vorlage ? 'mit allen verglichenen Szenarien' : 'Antrag nicht mehr gewählt',
      }];
    },
    beiEntscheid,
  });
}

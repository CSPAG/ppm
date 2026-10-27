/**
 * Fachaktionen der oberen Module an den Registern (über `index.ts`), in deren Transaktion; die Rechte prüft der Aufrufer,
 * die Lesesicht (RLS) gilt zusätzlich. Jede Aktion schreibt Audit und Ereignis. Werte, die nur diese Aktionen setzen:
 * Baseline (vertrag beim Gate- bzw. Änderungsentscheid, Übernahme), Ist-Kosten (finanzen, A-16), Abnahme eines
 * Meilensteins durch das Gremium (PS.02.03), «gedeckt» beim Ressourcenbedarf (ressource, RK.02.04).
 */
import { notFound, type Actor, type Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import * as store from './store.ts';

/** Alle Einträge eines Registers eines Projekts (bzw. eines Portfolios bei Risiken), in der Ordnung der Liste. */
export async function lesen(tx: Tx, register: store.RegisterName, besitzer: { projektId: string } | { portfolioId: string }): Promise<store.Eintrag[]> {
  return store.list(tx, store.REGISTER[register], { ...besitzer, offset: 0, limit: 100000 });
}

/** Abhängigkeiten eines Projekts in beide Richtungen (UC-002 Schritt 5). */
export const abhaengigkeiten = (tx: Tx, projektId: string) => store.abhaengigkeiten(tx, projektId, 0, 100000);

/** Ressourcenbedarf in FTE aller sichtbaren Projekte im Zeitraum «JJJJ-MM» (UC-009, A-20). */
export const bedarfImZeitraum = store.bedarfImZeitraum;

async function setzen(tx: Tx, who: Actor, register: store.RegisterName, id: string, werte: Record<string, unknown>, aktion: `${string}.${string}`): Promise<void> {
  const r: store.Register = store.REGISTER[register];
  if (!(await store.setzen(tx, r, id, werte))) throw notFound(r.label);
  await record(tx, who, { action: aktion, resourceType: r.name, resourceId: id, data: werte, event: { id, ...(r.vertraulich ? {} : werte) } });
}

/**
 * Baseline nachführen (UC-003 Schritt 10, UC-007 A1; Übernahme A-14): Termine der Meilensteine und Budget der
 * Kostenpositionen aus dem abgenommenen Vertrag.
 */
export async function baselineSetzen(tx: Tx, who: Actor, b: { meilensteine?: { id: string; termin: string | null }[]; kosten?: { id: string; betrag: number | null }[] }): Promise<void> {
  for (const m of b.meilensteine ?? []) await setzen(tx, who, 'meilenstein', m.id, { terminBaseline: m.termin }, 'meilenstein.baselined');
  for (const k of b.kosten ?? []) await setzen(tx, who, 'kosten', k.id, { budgetBaseline: k.betrag }, 'kosten.baselined');
}

/** Meilenstein durch das Gremium abgenommen (PS.02.03, Traktandenart `meilenstein` im Modul statusbericht). */
export const meilensteinAbnehmen = (tx: Tx, who: Actor, id: string, datum: string) =>
  setzen(tx, who, 'meilenstein', id, { abgenommenAm: datum }, 'meilenstein.accepted');

/** Ist-Kosten einer Position nachführen (Modul finanzen, A-16). */
export const istSetzen = (tx: Tx, who: Actor, id: string, betrag: number | null) =>
  setzen(tx, who, 'kosten', id, { ist: betrag }, 'kosten.actuals_recorded');

/** Bedarf durch Zuteilung gedeckt bzw. nicht mehr gedeckt (Modul ressource, RK.02.04). */
export const bedarfGedeckt = (tx: Tx, who: Actor, id: string, gedeckt: boolean) =>
  setzen(tx, who, 'ressourcenbedarf', id, { gedeckt }, 'ressourcenbedarf.coverage_changed');

/**
 * Fachaktionen am Projekt, gemeinsam für die Routen und die oberen Module (über `index.ts`): Anlegen mit Nummer (A-47),
 * Projektorganisation (PP.04.04, UC-002 Schritt 2), Zugriff beim Anlegen vorschlagen (UC-016), Lebenszyklus und Phase. Jede Aktion
 * schreibt Audit und Ereignis in der Transaktion des Aufrufers; die Rechte prüft der Aufrufer (Route bzw. Modul), die
 * Lesesicht (RLS) gilt zusätzlich.
 */
import type { TupleStore } from '@vollholz/iam';
import { conflict, invalid, notFound, preconditionFailed, type Actor, type Db, type Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { ENDZUSTAENDE, VORSCHLAG_JE_FUNKTION, type Funktion, type Lebenszyklus, type Phase, type ProjektCreateIn } from './schemas.ts';
import * as store from './store.ts';

/** Daten für Audit und Ereignis. */
export const snapshot = (r: store.Row) => ({
  id: r.id, nummer: r.nummer, name: r.name, portfolioId: r.portfolio_id, orgEinheitId: r.org_einheit_id, handlungsfeldId: r.handlungsfeld_id,
  phase: r.phase, phasenmodellId: r.phasenmodell_id, lebenszyklus: r.lebenszyklus, vertraulich: r.vertraulich, version: r.version,
});

/** Endzustände sind lesend (UC-015 Schritt 6): Änderungen am Projekt und an der Projektorganisation werden abgewiesen. */
export function pruefeAenderbar(r: store.Row): void {
  if (ENDZUSTAENDE.includes(r.lebenszyklus)) {
    throw conflict(`Das Projekt ${r.nummer} ist ${LEBENSZYKLUS_TEXT[r.lebenszyklus]} und kann nur noch gelesen werden.`, { reason: 'lebenszyklus', lebenszyklus: r.lebenszyklus });
  }
}

const LEBENSZYKLUS_TEXT: Record<Lebenszyklus, string> = {
  aktiv: 'aktiv', sistiert: 'sistiert', abgebrochen: 'abgebrochen', abgeschlossen: 'abgeschlossen', zurueckgezogen: 'zurückgezogen',
};

/** Anlegen in Phase P0 (Initialisierung, UC-001 Schritt 7) oder mit übernommener Phase (Übernahme, A-14). */
export async function anlegen(tx: Tx, ctx: { db: Db; tenantId: string }, who: Actor, input: ProjektCreateIn & { herkunft?: Record<string, unknown> }): Promise<store.Row> {
  const nummer = await store.naechsteNummer(tx, ctx);
  const id = await store.create(tx, nummer, input);
  const r = await store.get(tx, id);
  // Ein Projekt, das die Person danach nicht lesen dürfte (vertraulich, A-34), legt sie nicht an (Transaktion zurück)
  if (!r) throw conflict('Du kannst dieses Projekt nicht anlegen, weil du es danach nicht sehen dürftest (vertraulich).', { reason: 'vertraulich' });
  await record(tx, who, { action: 'projekt.created', resourceType: 'projekt', resourceId: id, data: snapshot(r), event: snapshot(r) });
  return r;
}

// ---------------------------------------------------------------- Lebenszyklus und Phase

/**
 * Übergänge (fachmodell.md 2.5): aktiv → sistiert ↔ aktiv (Wiederaufnahme per Gremiumsentscheid, A-09);
 * aktiv → abgebrochen | abgeschlossen (Exit P4) | zurückgezogen (UC-002 A4).
 */
export const UEBERGAENGE: Record<Lebenszyklus, readonly Lebenszyklus[]> = {
  aktiv: ['sistiert', 'abgebrochen', 'abgeschlossen', 'zurueckgezogen'],
  sistiert: ['aktiv'],
  abgebrochen: [], abgeschlossen: [], zurueckgezogen: [],
};

const LEBENSZYKLUS_AKTION: Record<Lebenszyklus, `projekt.${string}`> = {
  aktiv: 'projekt.resumed', sistiert: 'projekt.suspended', abgebrochen: 'projekt.cancelled', abgeschlossen: 'projekt.completed', zurueckgezogen: 'projekt.withdrawn',
};

/** Lebenszyklus wechseln; 404 wenn unsichtbar, 409 wenn der Übergang nicht erlaubt ist. */
export async function lebenszyklusWechseln(tx: Tx, who: Actor, id: string, ziel: Lebenszyklus, grund?: Record<string, unknown>): Promise<store.Row> {
  const before = await store.get(tx, id);
  if (!before) throw notFound('Projekt');
  if (!UEBERGAENGE[before.lebenszyklus].includes(ziel)) {
    throw conflict(`Das Projekt ${before.nummer} ist ${LEBENSZYKLUS_TEXT[before.lebenszyklus]} und kann nicht ${LEBENSZYKLUS_TEXT[ziel]} werden.`,
      { reason: 'lebenszyklus', lebenszyklus: before.lebenszyklus, ziel });
  }
  if (!(await store.setzen(tx, id, { lebenszyklus: ziel }))) throw notFound('Projekt');
  const r = (await store.get(tx, id))!;
  await record(tx, who, { action: LEBENSZYKLUS_AKTION[ziel], resourceType: 'projekt', resourceId: id, data: { before: snapshot(before), after: snapshot(r), ...grund }, event: snapshot(r) });
  return r;
}

/**
 * Endzustand zurücknehmen (A-30): Ein Entscheid ist bis zum Schliessen der Sitzung korrigierbar, seine Folge wird
 * zurückgenommen. Nur aus der Folge einer Entscheidkorrektur (oberes Modul, keine Route) und nur als Umkehr eines
 * direkten Übergangs: abgeschlossen bzw. abgebrochen → aktiv. Audit `projekt.reopened` mit Grund.
 */
export async function endzustandZuruecknehmen(tx: Tx, who: Actor, id: string, von: 'abgeschlossen' | 'abgebrochen', ziel: 'aktiv', grund: Record<string, unknown>): Promise<store.Row> {
  const before = await store.get(tx, id);
  if (!before) throw notFound('Projekt');
  if (before.lebenszyklus !== von || !UEBERGAENGE[ziel].includes(von)) {
    throw conflict(`Das Projekt ${before.nummer} ist ${LEBENSZYKLUS_TEXT[before.lebenszyklus]}; die Rücknahme von «${LEBENSZYKLUS_TEXT[von]}» ist nicht möglich.`,
      { reason: 'lebenszyklus', lebenszyklus: before.lebenszyklus, ziel });
  }
  if (!(await store.setzen(tx, id, { lebenszyklus: ziel }))) throw notFound('Projekt');
  const r = (await store.get(tx, id))!;
  await record(tx, who, { action: 'projekt.reopened', resourceType: 'projekt', resourceId: id, data: { before: snapshot(before), after: snapshot(r), ...grund }, event: snapshot(r) });
  return r;
}

/** Phase nachführen (Gate-Entscheid, UC-003 Schritt 10), mit der Version des Phasenmodells ab diesem Gate (A-13). */
export async function phaseSetzen(tx: Tx, who: Actor, id: string, phase: Phase, phasenmodellId?: string | null): Promise<store.Row> {
  const before = await store.get(tx, id);
  if (!before) throw notFound('Projekt');
  pruefeAenderbar(before);
  if (!(await store.setzen(tx, id, { phase, ...(phasenmodellId !== undefined ? { phasenmodell_id: phasenmodellId } : {}) }))) throw notFound('Projekt');
  const r = (await store.get(tx, id))!;
  await record(tx, who, { action: 'projekt.phase_changed', resourceType: 'projekt', resourceId: id, data: { before: snapshot(before), after: snapshot(r) }, event: snapshot(r) });
  return r;
}

// ---------------------------------------------------------------- Projektorganisation

export interface Mitglied { personId: string; funktion: Funktion; funktionText?: string; akv?: string }

/** Stand der Projektorganisation (ETag): höchster Stand der Zeilen, 0 ohne Mitglieder. */
export const standVon = (rows: store.MitgliedRow[]) => rows.reduce((m, r) => Math.max(m, r.stand), 0);

/** Bezeichnung der Funktion: fest für `sp` und `pl`, sonst der freie Text (A-72). */
export const funktionBezeichnung = (funktion: Funktion, text = '') => funktion === 'weitere' ? text : FUNKTION_TEXT[funktion];
const FUNKTION_TEXT: Record<'sp' | 'pl', string> = { sp: 'Projektauftraggeber:in', pl: 'Projektleitung' };

/** Text der Funktion bereinigen: nur bei `weitere`, ohne Rand. */
const textVon = (m: Mitglied) => m.funktion === 'weitere' ? (m.funktionText ?? '').trim() : '';

/**
 * Eingaben prüfen: Projektauftraggeber:in und Projektleitung je höchstens einmal (A-04), weitere Funktionen mit Text
 * (A-72), keine Doppel, nur bestehende Personen.
 */
async function pruefe(tx: Tx, liste: Mitglied[]): Promise<void> {
  const fehler: { path: string; message: string }[] = [];
  const gesehen = new Set<string>();
  const einzeln = new Set<Funktion>();
  liste.forEach((m, i) => {
    const text = textVon(m);
    if (m.funktion === 'weitere' && !text) fehler.push({ path: `/mitglieder/${i}/funktionText`, message: 'Gib die Funktion an, z. B. Kernteam.' });
    const k = `${m.funktion}:${text.toLowerCase()}:${m.personId}`;
    if (gesehen.has(k)) fehler.push({ path: `/mitglieder/${i}`, message: 'Diese Person steht schon mit dieser Funktion in der Projektorganisation.' });
    gesehen.add(k);
    if (m.funktion === 'sp' || m.funktion === 'pl') {
      if (einzeln.has(m.funktion)) fehler.push({ path: `/mitglieder/${i}/funktion`, message: `${FUNKTION_TEXT[m.funktion]}: höchstens eine Person.` });
      einzeln.add(m.funktion);
    }
  });
  const vorhanden = await store.personenVorhanden(tx, [...new Set(liste.map(m => m.personId))]);
  liste.forEach((m, i) => { if (!vorhanden.has(m.personId)) fehler.push({ path: `/mitglieder/${i}/personId`, message: 'Diese Person gibt es in der Organisation nicht.' }); });
  if (fehler.length) throw invalid('Die Projektorganisation ist nicht vollständig gültig.', fehler);
}

/**
 * Projektorganisation festlegen (PP.04.04, UC-002 Schritt 2): ersetzt die Liste. Sie ist ein Projektergebnis und
 * vergibt keinen Zugriff (Master Entscheid 16, A-71); den Zugriff regelt der Bereich «Zugriff» (UC-016).
 * `version`: erwarteter Stand (If-Match), sonst 412.
 */
export async function organisationFestlegen(tx: Tx, o: { who: Actor }, id: string, version: number, liste: Mitglied[]): Promise<store.MitgliedRow[]> {
  const projekt = await store.get(tx, id);
  if (!projekt) throw notFound('Projekt');
  pruefeAenderbar(projekt);
  const before = await store.mitglieder(tx, id);
  const stand = standVon(before);
  if (stand !== version) throw preconditionFailed(stand);
  await pruefe(tx, liste);
  await store.ersetzen(tx, id, stand + 1, liste.map(m => ({ personId: m.personId, funktion: m.funktion, funktionText: textVon(m), akv: (m.akv ?? '').trim() })));

  const after = await store.mitglieder(tx, id);
  const daten = (rows: store.MitgliedRow[]) => rows.map(r => ({ personId: r.person_id, funktion: r.funktion, funktionText: r.funktion_text, akv: r.akv }));
  await record(tx, o.who, {
    action: 'projekt.organisation_changed', resourceType: 'projekt', resourceId: id,
    data: { nummer: projekt.nummer, before: daten(before), after: daten(after) },
    event: { id, nummer: projekt.nummer, version: standVon(after), mitglieder: daten(after) },
  });
  return after;
}

/**
 * Zugriff beim Anlegen vorschlagen (UC-016, A-71): Projektauftraggeber:in erhält «Projekt steuern», die Projektleitung
 * «Projekt führen» am Projekt; besteht die Freigabe schon, bleibt sie. Nur beim Anlegen (Freigabe, Übernahme); spätere
 * Änderungen der Projektorganisation ändern den Zugriff nicht.
 */
export async function zugriffVorschlagen(tx: Tx, o: { tuples: TupleStore; who: Actor; principalId: string }, id: string, liste: Mitglied[]): Promise<void> {
  for (const m of liste) {
    if (m.funktion === 'weitere') continue;
    try {
      await o.tuples.grant(tx, { subject: `user:${m.personId}`, relation: VORSCHLAG_JE_FUNKTION[m.funktion], place: { type: 'projekt', id }, createdBy: o.principalId }, o.who);
    } catch (e) {
      // gleiche Freigabe besteht (der Baukasten prüft nach dem Einfügen, die Transaktion bleibt gültig)
      if ((e as { status?: number }).status !== 409) throw e;
    }
  }
}

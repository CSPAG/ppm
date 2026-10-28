/**
 * Fachaktionen am Projekt, gemeinsam für die Routen und die oberen Module (über `index.ts`): Anlegen mit Nummer (A-47),
 * Projektorganisation mit Tupeln (PP.04.04, UC-002 Schritt 2, UC-016 Schritt 2), Lebenszyklus und Phase. Jede Aktion
 * schreibt Audit und Ereignis in der Transaktion des Aufrufers; die Rechte prüft der Aufrufer (Route bzw. Modul), die
 * Lesesicht (RLS) gilt zusätzlich.
 */
import type { TupleStore } from '@vollholz/iam';
import { conflict, invalid, notFound, preconditionFailed, type Actor, type Db, type Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { ENDZUSTAENDE, ROLLEN, type Funktion, type Lebenszyklus, type Phase, type ProjektCreateIn } from './schemas.ts';
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

export interface Mitglied { personId: string; funktion: Funktion; akv?: string }

/** Stand der Projektorganisation (ETag): höchster Stand der Zeilen, 0 ohne Mitglieder. */
export const standVon = (rows: store.MitgliedRow[]) => rows.reduce((m, r) => Math.max(m, r.stand), 0);

/** Eingaben prüfen: Sponsor, Projektleitung und CTL je höchstens einmal (A-04), keine Doppel, nur bestehende Personen. */
async function pruefe(tx: Tx, liste: Mitglied[]): Promise<void> {
  const fehler: { path: string; message: string }[] = [];
  const gesehen = new Set<string>();
  const einzeln = new Map<Funktion, number>();
  liste.forEach((m, i) => {
    const k = `${m.funktion}:${m.personId}`;
    if (gesehen.has(k)) fehler.push({ path: `/mitglieder/${i}`, message: 'Diese Person steht schon mit dieser Funktion in der Projektorganisation.' });
    gesehen.add(k);
    if (m.funktion === 'sp' || m.funktion === 'pl' || m.funktion === 'ctl') {
      if (einzeln.has(m.funktion)) fehler.push({ path: `/mitglieder/${i}/funktion`, message: `${FUNKTION_TEXT[m.funktion]}: höchstens eine Person.` });
      einzeln.set(m.funktion, i);
    }
  });
  const vorhanden = await store.personenVorhanden(tx, [...new Set(liste.map(m => m.personId))]);
  liste.forEach((m, i) => { if (!vorhanden.has(m.personId)) fehler.push({ path: `/mitglieder/${i}/personId`, message: 'Diese Person gibt es in der Organisation nicht.' }); });
  if (fehler.length) throw invalid('Die Projektorganisation ist nicht vollständig gültig.', fehler);
}

const FUNKTION_TEXT: Record<Funktion, string> = { sp: 'Sponsor', pl: 'Projektleitung', ctl: 'CTL', kt: 'Kernteam', koalition: 'Sponsoren-Koalition' };

/**
 * Projektorganisation festlegen (PP.04.04, UC-002 Schritt 2): ersetzt die Liste und gleicht die Rollen am Projekt als
 * Tupel ab (fachmodell.md 3.3) – neue Funktionen erhalten das Tupel, entfernte verlieren es. Befristete Tupel (Stellvertretung)
 * bleiben unberührt; besteht für eine neue Funktion schon ein befristetes, gilt es danach unbefristet.
 * `version`: erwarteter Stand (If-Match), sonst 412.
 */
export async function organisationFestlegen(tx: Tx, o: { tuples: TupleStore; who: Actor; principalId: string }, id: string, version: number, liste: Mitglied[]): Promise<store.MitgliedRow[]> {
  const projekt = await store.get(tx, id);
  if (!projekt) throw notFound('Projekt');
  pruefeAenderbar(projekt);
  const before = await store.mitglieder(tx, id);
  const stand = standVon(before);
  if (stand !== version) throw preconditionFailed(stand);
  await pruefe(tx, liste);
  await store.ersetzen(tx, id, stand + 1, liste.map(m => ({ personId: m.personId, funktion: m.funktion, akv: (m.akv ?? '').trim() })));

  const rolle = (r: { funktion: Funktion }) => ROLLEN.includes(r.funktion);
  const key = (person: string, funktion: string) => `${person}:${funktion}`;
  const alt = new Set(before.filter(rolle).map(r => key(r.person_id, r.funktion)));
  const neu = new Set(liste.filter(rolle).map(m => key(m.personId, m.funktion)));
  const tupel = async (person: string, funktion: string) =>
    (await o.tuples.ofSubject(tx, `user:${person}`)).find(t => t.object_type === 'projekt' && t.object_id === id && t.relation === funktion) ?? null;
  for (const k of alt) {
    if (neu.has(k)) continue;
    const [person, funktion] = k.split(':') as [string, string];
    const t = await tupel(person, funktion);
    if (t && !t.expires_at) await o.tuples.revoke(tx, t.id, o.who);
  }
  for (const k of neu) {
    if (alt.has(k)) continue;
    const [person, funktion] = k.split(':') as [string, string];
    const t = await tupel(person, funktion);
    if (!t) await o.tuples.grant(tx, { subject: `user:${person}`, relation: funktion, place: { type: 'projekt', id }, createdBy: o.principalId }, o.who);
    else if (t.expires_at) await o.tuples.setExpiry(tx, t.id, null, o.who);
  }

  const after = await store.mitglieder(tx, id);
  const daten = (rows: store.MitgliedRow[]) => rows.map(r => ({ personId: r.person_id, funktion: r.funktion, akv: r.akv }));
  await record(tx, o.who, {
    action: 'projekt.organisation_changed', resourceType: 'projekt', resourceId: id,
    data: { nummer: projekt.nummer, before: daten(before), after: daten(after) },
    event: { id, nummer: projekt.nummer, version: standVon(after), mitglieder: daten(after) },
  });
  return after;
}

/**
 * Freigabe der Initialisierung (AP-E4-3; BC DM.01.02, PP.02.04; UC-001 Schritte 6–7, A4, A5; Kernablauf K4 Schritte 8–10):
 * Die UE legt die Idee dem Gremium vor (Kategorie A, B: Traktandum der Art `idee`, Entscheid in K3) oder übergibt sie der
 * Direktion (Kategorie C: Aufgabe `idee.freigeben` an `idee:decide` am Portfolio, UC-001 A4). Die Freigabe legt das
 * Projekt in Phase P0 mit den Angaben der Idee (`projekt.herkunft`) an, setzt Sponsor und Projektleitung (A-05),
 * informiert die Antragstellenden und legt der Projektleitung «Projektvertrag erstellen» in den Eingang (UC-002).
 */
import { invalid, systemActor, type Actor, type Db, type Deps, type Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { projekt } from '../projekt/index.ts';
import { registriereTraktandenart, type EntscheidFolge, type Ergebnis, type FolgeKontext } from '../sitzung/index.ts';
import * as fs from './freigabe-store.ts';
import * as ps from './pruefung-store.ts';
import * as store from './store.ts';

/**
 * Was die Freigabe ausser der Transaktion braucht: Datenbank (Nummer des Projekts) und Tupel (Rollen am Projekt). Die
 * Route gibt `deps`, die Folge des Entscheids den Kontext der Sitzung (`FolgeKontext`).
 */
export interface Zugang { db: Db; tuples: Deps['iam']['tuples'] }

export const link = (nummer: number) => `/portfolio/ideen/${nummer}`;
export const titelVon = (r: Pick<store.Row, 'titel' | 'nummer'>) => r.titel || `Idee ${r.nummer}`;
const bezugVon = (id: string) => ({ typ: 'idee', id });

/** Ergebnisse des Gremiums (K3 Schritt 8: Gate-Review, Initialisierung). */
export const ERGEBNISSE: readonly Ergebnis[] = [
  { schluessel: 'freigegeben', label: 'Freigegeben' }, { schluessel: 'mit_auflagen', label: 'Mit Auflagen freigegeben' },
  { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }, { schluessel: 'abgelehnt', label: 'Abgelehnt' },
];
const FREIGEGEBEN = new Set(['freigegeben', 'mit_auflagen']);

/** Sponsor und Projektleitung sind gesetzt und Personen der Organisation (A-05). */
export async function pruefePersonen(tx: Tx, sponsor: string | null, projektleitung: string | null, praefix = ''): Promise<void> {
  const fehler: { path: string; message: string }[] = [];
  const vorhanden = await fs.personenVorhanden(tx, [sponsor, projektleitung].filter((x): x is string => !!x));
  if (!sponsor) fehler.push({ path: `${praefix}/sponsor`, message: 'Projektauftraggeber:in fehlt: Das Gremium benennt die Projektauftraggeber:in (A-05).' });
  else if (!vorhanden.has(sponsor)) fehler.push({ path: `${praefix}/sponsor`, message: 'Diese Person gibt es in der Organisation nicht.' });
  if (!projektleitung) fehler.push({ path: `${praefix}/projektleitung`, message: 'Projektleitung fehlt: Die Projektauftraggeber:in benennt die Projektleitung (A-05).' });
  else if (!vorhanden.has(projektleitung)) fehler.push({ path: `${praefix}/projektleitung`, message: 'Diese Person gibt es in der Organisation nicht.' });
  if (fehler.length) throw invalid('Für die Freigabe fehlen Projektauftraggeber:in oder Projektleitung.', fehler);
}

/**
 * Initialisierung freigeben (UC-001 Schritt 7, A4.2): Projekt in P0 im Portfolio der Idee mit Name, Handlungsfeld,
 * Direktion (Kategorie C) und den Angaben der Idee in `herkunft` (Ausgangslage, Zielsetzung, Strategiebezug, Nutzen –
 * Vorbelegung des Projektvertrags, UC-002 Schritt 1); Sponsor und Projektleitung als Projektorganisation mit Rollen.
 * Liefert das Projekt. Rechte prüft der Aufrufer; `principalId` ist die entscheidende Person (Tupel «erstellt von»).
 */
export async function initialisieren(tx: Tx, zugang: Zugang, who: Actor, principalId: string, r: store.Row,
  o: { sponsor: string; projektleitung: string; begruendung: string; vorab?: boolean }): Promise<{ id: string; nummer: string; name: string }> {
  const a = (await fs.angaben(tx, r.id))!;
  if (!a.portfolio_id) throw invalid('Die Idee hat kein Portfolio.', [{ path: '/kategorie', message: 'Ordne zuerst die Kategorie zu.' }]);
  const pf = await fs.portfolio(tx, a.portfolio_id);
  const tenantId = (await tx.query<{ t: string }>('SELECT app.tenant_id() AS t')).rows[0]!.t;
  const p = await projekt.anlegen(tx, { db: zugang.db, tenantId }, who, {
    name: titelVon(r).slice(0, 200), portfolioId: a.portfolio_id, phase: 'P0', handlungsfeldId: r.handlungsfeld_id,
    orgEinheitId: pf?.kategorie === 'C' ? pf.org_einheit_id : null,
    herkunft: {
      quelle: 'idee', ideeId: r.id, ideeNummer: r.nummer, ausgangslage: r.ausgangslage, zielsetzung: r.zielsetzung,
      handlungsfeldId: r.handlungsfeld_id, strategischesZielId: r.strategisches_ziel_id, bereiche: r.org_einheit_ids,
      nutzen: r.nutzen_text, aufwand: r.aufwand_text, relevanz: r.relevanz_text, herkunft: r.herkunft, kategorie: a.kategorie,
    },
  });
  const organisation = [
    { personId: o.sponsor, funktion: 'sp' as const, akv: '' },
    { personId: o.projektleitung, funktion: 'pl' as const, akv: '' },
  ];
  await projekt.organisationFestlegen(tx, { who }, p.id, 0, organisation);
  await projekt.zugriffVorschlagen(tx, { tuples: zugang.tuples, who, principalId }, p.id, organisation);
  // vorab (UC-001 A6, A-74): die Idee bleibt «traktandiert» mit dem Projekt, der Entscheid und seine Aufgabe bleiben offen
  if (o.vorab) await ps.setzen(tx, r.id, { projekt_id: p.id, sponsor: o.sponsor, projektleitung: o.projektleitung });
  else {
    await ps.setzen(tx, r.id, { stand: 'freigegeben', projekt_id: p.id, sponsor: o.sponsor, projektleitung: o.projektleitung, freigegeben_at: new Date(), begruendung: o.begruendung });
    await aufgabe.erledigen(tx, { art: 'idee.freigeben', bezug: bezugVon(r.id) });
  }
  const wie = o.vorab ? 'Initialisierung vor dem Entscheid gestartet' : 'Initialisierung freigegeben';
  await aufgabe.oeffnen(tx, {
    art: 'vertrag.erstellen', bezug: { typ: 'projekt', id: p.id }, empfaenger: { person: o.projektleitung },
    titel: `Projektvertrag ${p.nummer} ${p.name} erstellen`, kontext: `${p.nummer} ${p.name} · als PL · ${wie}`,
    link: `/projekte/${p.nummer}/vertrag`,
  });
  await mitteilung.senden(tx, {
    an: r.erfasst_von, bezug: bezugVon(r.id), link: link(r.nummer),
    text: o.vorab
      ? `Zu deiner Projektidee «${titelVon(r)}» startet die Initialisierung schon vor dem Entscheid: Das Projekt ${p.nummer} entsteht in Phase P0, der Entscheid folgt.`
      : `Deine Projektidee «${titelVon(r)}» ist freigegeben: Das Projekt ${p.nummer} entsteht in Phase P0.`,
  });
  if (o.sponsor !== r.erfasst_von) {
    await mitteilung.senden(tx, { an: o.sponsor, bezug: { typ: 'projekt', id: p.id }, text: `Du bist Projektauftraggeber:in des Projekts ${p.nummer} ${p.name} (${wie}).`, link: `/projekte/${p.nummer}` });
  }
  await record(tx, who, {
    action: o.vorab ? 'idee.initialized_early' : 'idee.approved', resourceType: 'idee', resourceId: r.id,
    data: { id: r.id, nummer: r.nummer, projektId: p.id, projektNummer: p.nummer, sponsor: o.sponsor, projektleitung: o.projektleitung, begruendung: o.begruendung },
    event: { id: r.id, nummer: r.nummer, stand: o.vorab ? r.stand : 'freigegeben', projektId: p.id },
  });
  return { id: p.id, nummer: p.nummer, name: p.name };
}

/** Freigabe nachgetragen (UC-001 A6.2): das Projekt läuft schon; der Vermerk entfällt, die Aufgabe ist erledigt. */
async function freigabeNachtragen(tx: Tx, who: Actor, r: store.Row, projektId: string, begruendung: string): Promise<void> {
  await ps.setzen(tx, r.id, { stand: 'freigegeben', freigegeben_at: new Date(), begruendung });
  await aufgabe.erledigen(tx, { art: 'idee.freigeben', bezug: bezugVon(r.id) });
  await mitteilung.senden(tx, { an: r.erfasst_von, bezug: bezugVon(r.id), text: `Deine Projektidee «${titelVon(r)}» ist freigegeben; das Projekt läuft bereits.`, link: link(r.nummer) });
  await record(tx, who, {
    action: 'idee.approved', resourceType: 'idee', resourceId: r.id,
    data: { id: r.id, nummer: r.nummer, projektId, begruendung, nachgetragen: true }, event: { id: r.id, nummer: r.nummer, stand: 'freigegeben', projektId },
  });
}

/**
 * Nicht (mehr) freigegeben (UC-001 A5, Korrektur in der Sitzung A-30): «zurückgestellt» lässt die Idee im Pool, «abgelehnt»
 * weist sie zurück. War sie schon freigegeben, wird das entstandene Projekt zurückgezogen und die Aufgabe des Vertrags
 * entfällt. Die Antragstellenden werden informiert, wenn sich der Stand ändert.
 */
export async function nichtFreigeben(tx: Tx, who: Actor, r: store.Row, stand: 'zurueckgestellt' | 'zurueckgewiesen', begruendung: string): Promise<void> {
  const a = (await fs.angaben(tx, r.id))!;
  // vorab gestartet (UC-001 A6.2, A-74): das Vorhaben läuft weiter; Projektleitung und Auftraggeber:in erfahren den Entscheid
  if (a.projekt_id && r.stand !== 'freigegeben') {
    const p = await fs.projekt(tx, a.projekt_id);
    for (const an of new Set([a.sponsor, a.projektleitung].filter((x): x is string => !!x))) {
      await mitteilung.senden(tx, {
        an, bezug: { typ: 'projekt', id: a.projekt_id }, link: p ? `/projekte/${p.nummer}` : link(r.nummer),
        text: `Das Gremium hat die Initialisierung von «${titelVon(r)}» ${stand === 'zurueckgestellt' ? 'zurückgestellt' : 'nicht freigegeben'}; das Projekt${p ? ` ${p.nummer}` : ''} läuft bereits. Entscheidet, ob ihr es weiterführt oder zurückzieht.`,
      });
    }
    await ps.setzen(tx, r.id, { stand, begruendung });
    await aufgabe.erledigen(tx, { art: 'idee.freigeben', bezug: bezugVon(r.id) });
    await record(tx, who, {
      action: stand === 'zurueckgestellt' ? 'idee.deferred' : 'idee.rejected', resourceType: 'idee', resourceId: r.id,
      data: { id: r.id, nummer: r.nummer, begruendung, projektId: a.projekt_id, projektLaeuft: true }, event: { id: r.id, nummer: r.nummer, stand },
    });
    return;
  }
  if (a.projekt_id) {
    const p = await fs.projekt(tx, a.projekt_id);
    if (p && p.lebenszyklus === 'aktiv') await projekt.lebenszyklusWechseln(tx, who, p.id, 'zurueckgezogen', { grund: 'Entscheid zur Initialisierung korrigiert', ideeId: r.id });
    await aufgabe.entfallen(tx, { art: 'vertrag.erstellen', bezug: { typ: 'projekt', id: a.projekt_id } });
  }
  await ps.setzen(tx, r.id, { stand, begruendung, projekt_id: null, freigegeben_at: null });
  await aufgabe.erledigen(tx, { art: 'idee.freigeben', bezug: bezugVon(r.id) });
  if (r.stand !== stand) {
    await mitteilung.senden(tx, {
      an: r.erfasst_von, bezug: bezugVon(r.id), link: link(r.nummer),
      text: stand === 'zurueckgestellt'
        ? `Deine Projektidee «${titelVon(r)}» ist zurückgestellt; sie bleibt im Pool und kommt erneut zum Entscheid.`
        : `Deine Projektidee «${titelVon(r)}» wird nicht weiterverfolgt. Die Begründung steht bei der Idee.`,
    });
  }
  await record(tx, who, {
    action: stand === 'zurueckgestellt' ? 'idee.deferred' : 'idee.rejected', resourceType: 'idee', resourceId: r.id,
    data: { id: r.id, nummer: r.nummer, begruendung, projektId: a.projekt_id }, event: { id: r.id, nummer: r.nummer, stand },
  });
}

/**
 * Folge des Entscheids im Gremium (fachmodell.md 2.9; UC-001 Schritt 7, A5), in der Transaktion des Entscheids und
 * idempotent: gleicht die Idee dem zuletzt erfassten Ergebnis an (Korrektur, A-30). Für die Freigabe müssen Sponsor und
 * Projektleitung bei der Idee erfasst sein (A-05), sonst scheitert der Entscheid mit 422.
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge, k?: FolgeKontext): Promise<void> {
  if (f.bezug.typ !== 'idee') return;
  const r = await store.get(tx, f.bezug.id);
  if (!r) return;
  // die Person, die den Entscheid erfasst (UE), steht im Audit der Idee und als «erstellt von» am neuen Projekt
  const who = k?.akteur ?? systemActor('system');
  if (FREIGEGEBEN.has(f.ergebnis)) {
    const a = (await fs.angaben(tx, r.id))!;
    if (a.projekt_id && r.stand === 'freigegeben') return;
    // vorab gestartet (UC-001 A6.2): nur den Entscheid nachtragen
    if (a.projekt_id) { await freigabeNachtragen(tx, who, r, a.projekt_id, f.begruendung); return; }
    try {
      await pruefePersonen(tx, a.sponsor, a.projektleitung);
    } catch {
      throw invalid(`Für die Freigabe von «${titelVon(r)}» fehlen Projektauftraggeber:in oder Projektleitung. Erfasse beide bei der Idee (Portfolio › Ideen ${r.nummer}) und erfasse den Entscheid erneut.`,
        [{ path: '/ergebnis', message: 'Projektauftraggeber:in und Projektleitung fehlen (A-05).' }]);
    }
    if (!k) throw new Error('Folge der Freigabe ohne Kontext der Sitzung (FolgeKontext)');
    await initialisieren(tx, k, who, k.principalId, r, { sponsor: a.sponsor!, projektleitung: a.projektleitung!, begruendung: f.begruendung });
    return;
  }
  await nichtFreigeben(tx, who, r, f.ergebnis === 'zurueckgestellt' ? 'zurueckgestellt' : 'zurueckgewiesen', f.begruendung);
}

/** Art `idee` in der Registry der Sitzung (fachmodell.md 2.9): Titel und Antrag aus der Idee, Idee als Beilage. */
export function registriereIdee(): void {
  registriereTraktandenart({
    art: 'idee',
    label: 'Initialisierung',
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => {
      const r = bezug.typ === 'idee' ? await store.get(tx, bezug.id) : null;
      return r ? { titel: `Initialisierung: ${titelVon(r)}`, antrag: antragVon((await fs.angaben(tx, r.id))!.kategorie) } : null;
    },
    unterlagen: async (tx, bezug) => {
      const r = bezug.typ === 'idee' ? await store.get(tx, bezug.id) : null;
      if (!r) return [];
      return [{
        art: 'beilage', titel: `Projektidee ${r.nummer}: ${titelVon(r)}`, bereit: true, hinweis: 'mit Leitfragen und Kriterienraster',
        inhalt: { nummer: r.nummer, ausgangslage: r.ausgangslage, zielsetzung: r.zielsetzung },
      }];
    },
    beiEntscheid,
  });
}

export const antragVon = (kategorie: string | null) =>
  `Initialisierung freigeben${kategorie ? ` (Kategorie ${kategorie})` : ''}, Projektauftraggeber:in und Projektleitung benennen`;

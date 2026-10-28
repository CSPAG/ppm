/**
 * Quality-Check und Unterschriften des Projektvertrags (AP-E3-2; DM.02.05, DM.02.06; UC-002 Schritte 9–10, A5; UC-003
 * Schritte 7–8, A4, A5; K2 Schritte 7–8): Datenzugriff und Übergänge. Läuft in der Transaktion der Route; die Rechte
 * (`vertrag:review`, `vertrag:sign`) prüft die Route vorher.
 *
 * Stände (fachmodell.md 2.10): «in Prüfung» → bestätigt: «zur Unterzeichnung» | Rückmeldung: «in Arbeit»;
 * «zur Unterzeichnung» → alle drei (SP, PL, CTL): «unterzeichnet» | verweigert: «in Arbeit».
 */
import { conflict, type Tx } from '@vollholz/platform';
import { aufgabe, stellvertretung } from '../eingang/index.ts';
import { SCHEMA } from '../../platform.ts';
import * as store from './store.ts';

/** Funktionen, die den Vertrag unterzeichnen (UC-002 Schritt 10; A-04: eine Unterschrift für Auftraggeber/Sponsor). */
export const FUNKTIONEN = ['sp', 'pl', 'ctl'] as const;
export type Funktion = (typeof FUNKTIONEN)[number];
export const FUNKTION_TEXT: Record<Funktion, string> = { sp: 'Sponsor', pl: 'Projektleitung', ctl: 'CTL' };

const Q = `${SCHEMA}.quality_check`;
const U = `${SCHEMA}.unterschrift`;

export interface QualityCheckRow { id: string; version_id: string; ergebnis: 'bestaetigt' | 'rueckmeldung'; kommentare: Record<string, string>; at: Date; by_person: string }
export interface UnterschriftRow {
  id: string; quality_check_id: string; funktion: Funktion; person_id: string; in_vertretung_von: string | null;
  ergebnis: 'unterzeichnet' | 'verweigert'; begruendung: string; at: Date;
}

/** Quality-Checks der Version, neueste zuerst. */
export async function qualityChecks(tx: Tx, versionId: string): Promise<QualityCheckRow[]> {
  return (await tx.query<QualityCheckRow>(
    `SELECT id, version_id, ergebnis, kommentare, at, by_person FROM ${Q} WHERE version_id = $1 ORDER BY at DESC, id`, [versionId])).rows;
}

/** Unterschriften eines Durchgangs (bestätigter Quality-Check). */
export async function unterschriften(tx: Tx, qualityCheckId: string): Promise<UnterschriftRow[]> {
  return (await tx.query<UnterschriftRow>(
    `SELECT id, quality_check_id, funktion, person_id, in_vertretung_von, ergebnis, begruendung, at FROM ${U}
      WHERE quality_check_id = $1 ORDER BY at, funktion`, [qualityCheckId])).rows;
}

/** Laufender Durchgang: der jüngste Quality-Check, wenn er bestätigt ist (sonst gibt es nichts zu unterzeichnen). */
export async function durchgang(tx: Tx, versionId: string): Promise<QualityCheckRow | null> {
  const letzter = (await qualityChecks(tx, versionId))[0];
  return letzter?.ergebnis === 'bestaetigt' ? letzter : null;
}

/**
 * Wer unterzeichnet: Personen der Projektorganisation in den Funktionen SP, PL, CTL (PP.04.04, Tabelle von AP-E0-4).
 * Nur lesend; das Modul projekt bietet dafür (noch) keine Abfrage über `index.ts`.
 */
export async function unterzeichnende(tx: Tx, projektId: string): Promise<Record<Funktion, string[]>> {
  const rows = (await tx.query<{ funktion: Funktion; person_id: string }>(
    `SELECT funktion, person_id FROM ${SCHEMA}.projekt_person WHERE projekt_id = $1 AND funktion = ANY ($2::text[]) ORDER BY position, created_at`,
    [projektId, FUNKTIONEN])).rows;
  const out: Record<Funktion, string[]> = { sp: [], pl: [], ctl: [] };
  for (const r of rows) out[r.funktion].push(r.person_id);
  return out;
}

/**
 * Funktionen, die `person` im Durchgang noch unterzeichnen kann: eigene Funktion oder in Vertretung einer Person, die sie
 * innehat, wenn die Stellvertretung Unterschriften ausdrücklich einschliesst (A-31, UC-016 Schritt 4).
 */
export async function offeneFunktionen(tx: Tx, person: string, soll: Record<Funktion, string[]>, erledigt: readonly UnterschriftRow[]):
  Promise<{ funktion: Funktion; inVertretungVon: string | null }[]> {
  const out: { funktion: Funktion; inVertretungVon: string | null }[] = [];
  for (const f of FUNKTIONEN) {
    if (erledigt.some(u => u.funktion === f)) continue;
    if (soll[f].includes(person)) { out.push({ funktion: f, inVertretungVon: null }); continue; }
    for (const inhaber of soll[f]) {
      const v = await stellvertretung.aktiv(tx, { vertretene: inhaber, vertreter: person });
      if (v?.unterschriften) { out.push({ funktion: f, inVertretungVon: inhaber }); break; }
    }
  }
  return out;
}

/** Anzeigename einer Person der Organisation (Verzeichnis des Baukastens), sonst «eine Person». */
async function personName(tx: Tx, id: string): Promise<string> {
  const r = (await tx.query<{ n: string | null }>(`SELECT coalesce(display_name, email) AS n FROM ${SCHEMA}.principal WHERE id = $1`, [id])).rows[0];
  return r?.n ?? 'eine Person';
}

/** Verhalten nach der letzten Unterschrift (z. B. Traktandum vorschlagen, AP-E3-3): registriert beim Laden des Pakets. */
type BeiUnterzeichnet = (tx: Tx, o: { version: store.VersionRow; projekt: store.ProjektKopf }) => Promise<void>;
const nachUnterzeichnung: BeiUnterzeichnet[] = [];
export const unterzeichnung = {
  /** Registriert Verhalten, das in der Transaktion der letzten Unterschrift läuft (Gate: Traktandum, AP-E3-3). */
  registrieren(fn: BeiUnterzeichnet) { nachUnterzeichnung.push(fn); },
};

/** Ziel der Aufgabe (I-B1): Unterzeichnen öffnet die Zusammenfassung (UI-12), Überarbeiten die Projektakte. */
const link = (p: store.ProjektKopf, ansicht: 'unterzeichnen' | 'bearbeiten') =>
  ansicht === 'unterzeichnen' ? `/projekte/${p.nummer}/vertrag/unterzeichnen` : `/projekte/${p.nummer}/vertrag?version=entwurf`;
const kontext = (p: store.ProjektKopf, v: store.VersionRow) => `${p.nummer} ${p.name} · Version ${v.nummer} für ${v.zielphase}`;

/** Aufgabe «Projektvertrag überarbeiten» an die Projektleitung (fachmodell.md 4.2) mit dem Grund im Kontext. */
async function ueberarbeitenOeffnen(tx: Tx, p: store.ProjektKopf, v: store.VersionRow, soll: Record<Funktion, string[]>, grund: string): Promise<void> {
  for (const pl of soll.pl) {
    await aufgabe.oeffnen(tx, {
      art: 'vertrag.ueberarbeiten', bezug: { typ: 'vertrag_version', id: v.id }, empfaenger: { person: pl },
      titel: `Projektvertrag ${p.name} überarbeiten`, kontext: `${kontext(p, v)} · ${grund}`, link: link(p, 'bearbeiten'),
    });
  }
}

/**
 * Quality-Check erfassen (DM.02.05): bestätigt → Unterzeichnungsaufgaben an SP, PL und CTL (UC-002 Schritt 9, UC-003
 * Schritt 7); Rückmeldung → zurück an die Projektleitung mit den Kommentaren je Kapitel (UC-002 A5, UC-003 A4).
 */
export async function qualityCheckErfassen(tx: Tx, o: {
  version: store.VersionRow; projekt: store.ProjektKopf; erwartet: number; person: string;
  ergebnis: 'bestaetigt' | 'rueckmeldung'; kommentare: Record<string, string>;
}): Promise<{ id: string; fehlend: Funktion[] }> {
  const { version: v, projekt: p } = o;
  const soll = await unterzeichnende(tx, p.id);
  const fehlend = FUNKTIONEN.filter(f => !soll[f].length);
  if (o.ergebnis === 'bestaetigt' && fehlend.length) {
    throw conflict(`Die Projektorganisation ist unvollständig: Es fehlt ${fehlend.map(f => FUNKTION_TEXT[f]).join(', ')}. `
      + 'Ohne diese Funktion kann der Vertrag nicht unterzeichnet werden; legen Sie die Projektorganisation fest.', { reason: 'organisation', fehlend });
  }
  const nach: store.Stand = o.ergebnis === 'bestaetigt' ? 'zur_unterzeichnung' : 'in_arbeit';
  if (!(await store.standSetzen(tx, v.id, o.erwartet, ['in_pruefung'], nach))) return { id: '', fehlend };
  const id = (await tx.query<{ id: string }>(
    `INSERT INTO ${Q} (tenant_id, projekt_id, version_id, ergebnis, kommentare, by_person) VALUES (app.tenant_id(), $1, $2, $3, $4, $5) RETURNING id`,
    [p.id, v.id, o.ergebnis, JSON.stringify(o.kommentare), o.person])).rows[0]!.id;
  await aufgabe.erledigen(tx, { art: 'vertrag.quality_check', bezug: { typ: 'vertrag_version', id: v.id } });
  if (o.ergebnis === 'bestaetigt') {
    for (const f of FUNKTIONEN) {
      for (const person of soll[f]) {
        await aufgabe.oeffnen(tx, {
          art: 'vertrag.unterzeichnen', bezug: { typ: 'vertrag_version', id: v.id }, empfaenger: { person },
          titel: `Projektvertrag Version ${v.nummer} unterzeichnen`, kontext: `${kontext(p, v)} · als ${FUNKTION_TEXT[f]}`, link: link(p, 'unterzeichnen'),
        });
      }
    }
  } else {
    const n = Object.keys(o.kommentare).length;
    await ueberarbeitenOeffnen(tx, p, v, soll, `Rückmeldung aus dem Quality-Check zu ${n === 1 ? '1 Kapitel' : `${n} Kapiteln`}`);
  }
  return { id, fehlend };
}

/**
 * Unterzeichnen oder verweigern (DM.02.06; UC-002 Schritt 10, UC-003 Schritt 8, A5). Unterzeichnet die Person alle
 * Funktionen, die sie innehat oder vertritt. Ist danach jede Funktion unterzeichnet, ist die Version «unterzeichnet»
 * und das registrierte Verhalten läuft; eine Verweigerung beendet den Durchgang und gibt den Entwurf an die PL zurück.
 */
export async function unterzeichnen(tx: Tx, o: {
  version: store.VersionRow; projekt: store.ProjektKopf; erwartet: number; person: string;
  ergebnis: 'unterzeichnet' | 'verweigert'; begruendung: string;
}): Promise<{ funktionen: { funktion: Funktion; inVertretungVon: string | null }[]; vollstaendig: boolean; stand: store.Stand } | null> {
  const { version: v, projekt: p } = o;
  const dg = await durchgang(tx, v.id);
  if (!dg) throw conflict('Es läuft keine Unterzeichnung: Der Quality-Check ist nicht bestätigt.', { reason: 'stand', stand: v.stand });
  const soll = await unterzeichnende(tx, p.id);
  const vorher = await unterschriften(tx, dg.id);
  const funktionen = await offeneFunktionen(tx, o.person, soll, vorher);
  if (!funktionen.length) {
    throw conflict('Sie haben keine offene Unterschrift für diese Version: Sie haben bereits unterzeichnet, oder Sie sind weder Sponsor, Projektleitung noch CTL des Projekts.',
      { reason: 'unterschrift' });
  }
  // Version ändert sich mit jeder Unterschrift (If-Match schützt vor gleichzeitigem Entscheid)
  const vollstaendig = o.ergebnis === 'unterzeichnet' && FUNKTIONEN.every(f => vorher.some(u => u.funktion === f) || funktionen.some(x => x.funktion === f));
  const nach: store.Stand = o.ergebnis === 'verweigert' ? 'in_arbeit' : vollstaendig ? 'unterzeichnet' : 'zur_unterzeichnung';
  if (!(await store.standSetzen(tx, v.id, o.erwartet, ['zur_unterzeichnung'], nach))) return null;
  for (const f of funktionen) {
    await tx.query(
      `INSERT INTO ${U} (tenant_id, projekt_id, version_id, quality_check_id, funktion, person_id, in_vertretung_von, ergebnis, begruendung)
       VALUES (app.tenant_id(), $1, $2, $3, $4, $5, $6, $7, btrim($8))`,
      [p.id, v.id, dg.id, f.funktion, o.person, f.inVertretungVon, o.ergebnis, o.begruendung]);
  }
  // Aufgaben (fachmodell.md 4.2): die eigene bzw. die der vertretenen Person ist erledigt
  for (const person of new Set(funktionen.map(f => f.inVertretungVon ?? o.person))) {
    await aufgabe.erledigen(tx, { art: 'vertrag.unterzeichnen', bezug: { typ: 'vertrag_version', id: v.id }, empfaenger: { person } });
  }
  if (o.ergebnis === 'verweigert') {
    // Durchgang beendet: übrige Unterzeichnungen entfallen, die PL überarbeitet (UC-003 A5)
    await aufgabe.entfallen(tx, { art: 'vertrag.unterzeichnen', bezug: { typ: 'vertrag_version', id: v.id } });
    const grund = o.begruendung.trim().length > 140 ? `${o.begruendung.trim().slice(0, 139)}…` : o.begruendung.trim();
    await ueberarbeitenOeffnen(tx, p, v, soll, `nicht unterzeichnet von ${await personName(tx, o.person)}: ${grund}`);
  } else if (vollstaendig) {
    const r = (await store.version(tx, v.id))!;
    for (const fn of nachUnterzeichnung) await fn(tx, { version: r, projekt: p });
  }
  return { funktionen, vollstaendig, stand: nach };
}

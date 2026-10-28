/**
 * Eskalation (BC PS.03.03; UC-004 A2.2, UC-006 Schritt 7; fachmodell.md 2.8, 2.9, 4.2; AP-E2-4): Ein eingereichter
 * Bericht «kritisch» mit Entscheidbedarf legt eine Eskalation an, schlägt sie dem entscheidenden Gremium des Portfolios
 * als Traktandum der Art `eskalation` vor und öffnet die Aufgabe «Eskalation behandeln» für die Unternehmensentwicklung.
 * Der Entscheid in der Sitzung (AP-E2-2) führt sie sofort nach: «Erledigt mit Massnahme» schliesst sie, «Zurückgestellt»
 * hält sie für die Folgesitzung offen. Zurückziehen des Berichts (10 s) nimmt alles zurück.
 * Aus der Warnung «wesentliche Abweichung» (UC-004 A1.2, K1 Schritt 2) startet die PL eine Eskalation selbst, schon im
 * Entwurf und unabhängig vom Status; sie ist mit dem Bericht verknüpft und bleibt auch beim Zurückziehen (Anlass
 * «abweichung», 161).
 */
import { randomUUID } from 'node:crypto';
import { conflict, type Actor, type Tx } from '@vollholz/platform';
import { aufgabe } from '../eingang/index.ts';
import { registriereTraktandenart, traktandum, type EntscheidFolge } from '../sitzung/index.ts';
import { SCHEMA } from '../../platform.ts';
import { monat } from './aufgabe.ts';
import * as store from './store.ts';

const E = `${SCHEMA}.eskalation`;
export const ART_AUFGABE = 'eskalation.behandeln';
/** Gremium entscheidet über Massnahmen (K3 Schritt 8, Art «Eskalation»). */
export const ERGEBNISSE = [{ schluessel: 'erledigt', label: 'Erledigt mit Massnahme' }, { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }] as const;

export type Anlass = 'kritisch' | 'abweichung';

export interface EskalationRow {
  id: string; projekt_id: string; statusbericht_id: string; anlass: Anlass; vorgeschlagen: boolean; grund: string; massnahme: string;
  stand: 'offen' | 'traktandiert' | 'erledigt'; ergebnis: 'erledigt' | 'zurueckgestellt' | null; entscheid_begruendung: string;
  entschieden_at: Date | null; version: number; created_at: Date; periode: string; nummer: string; name: string; portfolio_id: string;
}

const COLS = `e.id, e.projekt_id, e.statusbericht_id, e.anlass, e.vorgeschlagen, e.grund, e.massnahme, e.stand, e.ergebnis, e.entscheid_begruendung,
  e.entschieden_at, e.version, e.created_at, b.periode, p.nummer, p.name, p.portfolio_id`;
const FROM = `${E} e JOIN ${SCHEMA}.statusbericht b ON b.tenant_id = e.tenant_id AND b.id = e.statusbericht_id
  JOIN ${SCHEMA}.projekt p ON p.tenant_id = e.tenant_id AND p.id = e.projekt_id`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Berichte aus der Liste mit einer Eskalation, die noch nicht erledigt ist (offen oder für die Folgesitzung
 * traktandiert); für den Badge «Eskalation» im Dashboard (AP-E1-3). Lesesicht der Person.
 */
export async function offenZuBerichten(tx: Tx, berichtIds: string[]): Promise<Set<string>> {
  if (!berichtIds.length) return new Set();
  return new Set((await tx.query<{ statusbericht_id: string }>(
    `SELECT e.statusbericht_id FROM ${E} e WHERE e.statusbericht_id = ANY ($1::uuid[]) AND e.stand <> 'erledigt'`, [berichtIds])).rows.map(r => r.statusbericht_id));
}

export async function lesen(tx: Tx, id: string): Promise<EskalationRow | null> {
  if (!UUID.test(id)) return null;
  return (await tx.query<EskalationRow>(`SELECT ${COLS} FROM ${FROM} WHERE e.id = $1`, [id])).rows[0] ?? null;
}

/** Eskalation des Berichts (je Bericht höchstens eine), Lesesicht der Person. */
export async function vonBericht(tx: Tx, statusberichtId: string): Promise<EskalationRow | null> {
  return (await tx.query<EskalationRow>(`SELECT ${COLS} FROM ${FROM} WHERE e.statusbericht_id = $1`, [statusberichtId])).rows[0] ?? null;
}

const bezugVon = (id: string) => ({ typ: 'eskalation', id });
const titelVon = (e: Pick<EskalationRow, 'nummer' | 'name'>) => `Eskalation ${e.nummer} ${e.name}`;
/** Antrag in einem Satz (K3 Schritt 6). */
const antragVon = (e: Pick<EskalationRow, 'massnahme'>) => {
  const m = e.massnahme.trim().replace(/\s+/g, ' ');
  return m ? `Massnahme beschliessen: ${m.length > 280 ? `${m.slice(0, 279)}…` : m}` : 'Über das weitere Vorgehen entscheiden';
};

const KONTEXT: Record<Anlass, string> = { kritisch: '«kritisch» mit Entscheidbedarf', abweichung: 'mit wesentlicher Abweichung' };
/** Hinweis an der Unterlage: der Bericht ist nur beim Anlass «kritisch» kritisch (UC-004 A2.2 bzw. A1.2). */
const HINWEIS: Record<Anlass, string> = { kritisch: 'kritisch, Entscheid nötig', abweichung: 'wesentliche Abweichung, eskaliert durch die Projektleitung' };

/**
 * Eskalation des Berichts anlegen (idempotent je Bericht), dem entscheidenden Gremium als Traktandum vorschlagen und die
 * Aufgabe für die Unternehmensentwicklung öffnen. Ohne entscheidendes Gremium bleibt es bei Eskalation und Aufgabe; die
 * UE traktandiert dann von Hand. `vorgeschlagen`: der Vorschlag steht in der nächsten Sitzung.
 */
async function anlegen(tx: Tx, r: store.Row, o: { anlass: Anlass; grund: string; massnahme: string }): Promise<{ eskalation: EskalationRow; vorgeschlagen: boolean }> {
  const p = await store.projekt(tx, r.projekt_id);
  if (!p) throw conflict('Das Projekt ist nicht sichtbar.');
  const vorschlagen = async (id: string, massnahme: string): Promise<boolean> => {
    try {
      await traktandum.vorschlagen(tx, { art: 'eskalation', bezug: bezugVon(id), projektId: p.id, titel: titelVon(p), antrag: antragVon({ massnahme }) });
      return true;
    } catch (err) {
      // kein entscheidendes Gremium sichtbar (409): die Aufgabe genügt, das Einreichen darf daran nicht scheitern
      if ((err as { status?: number }).status !== 409) throw err;
      return false;
    }
  };
  let e = await vonBericht(tx, r.id);
  let vorgeschlagen: boolean;
  if (!e) {
    // erst vorschlagen, dann anlegen: ob es ein entscheidendes Gremium gibt, steht so schon beim Anlegen fest (die PL
    // darf die Eskalation danach nicht mehr ändern)
    const id = randomUUID();
    vorgeschlagen = await vorschlagen(id, o.massnahme);
    await tx.query(`INSERT INTO ${E} (tenant_id, id, projekt_id, statusbericht_id, anlass, vorgeschlagen, grund, massnahme) VALUES (app.tenant_id(), $1, $2, $3, $4, $5, btrim($6), btrim($7))`,
      [id, r.projekt_id, r.id, o.anlass, vorgeschlagen, o.grund, o.massnahme]);
    e = (await vonBericht(tx, r.id))!;
  } else {
    // je Bericht höchstens eine Eskalation: eine schon erledigte kommt nicht erneut vor das Gremium
    if (e.stand === 'erledigt') return { eskalation: e, vorgeschlagen: false };
    vorgeschlagen = await vorschlagen(e.id, e.massnahme);
  }
  await aufgabe.oeffnen(tx, {
    art: ART_AUFGABE, bezug: bezugVon(e.id), empfaenger: { recht: 'sitzung:write', ort: { typ: 'portfolio', id: p.portfolio_id } },
    titel: `Eskalation ${p.nummer} ${p.name} traktandieren`,
    kontext: `Statusbericht ${monat(r.periode)} ${KONTEXT[e.anlass]}`,
    link: '/gremien/sitzungen',
  });
  return { eskalation: e, vorgeschlagen };
}

/** Einreichen (UC-004 A2.2): bei «kritisch» mit Entscheidbedarf Eskalation anlegen bzw. die bestehende erneut vorschlagen. */
export async function beimEinreichen(tx: Tx, r: store.Row, _who: Actor): Promise<void> {
  if (r.status !== 'kritisch' || !r.entscheid_noetig) return;
  await anlegen(tx, r, { anlass: 'kritisch', grund: r.begruendung, massnahme: r.massnahme });
}

/**
 * Aus der Warnung «wesentliche Abweichung» eskalieren (UC-004 A1.2, K1 Schritt 2): Eskalation zum Bericht (auch im
 * Entwurf, unabhängig vom Status) mit Grund und Massnahme der PL; der Bericht bleibt, wie er ist. Je Bericht höchstens
 * eine Eskalation (409).
 */
export async function ausAbweichung(tx: Tx, r: store.Row, o: { grund: string; massnahme: string }): Promise<{ eskalation: EskalationRow; vorgeschlagen: boolean }> {
  if (await vonBericht(tx, r.id)) throw conflict('Zu diesem Bericht besteht schon eine Eskalation.', { reason: 'eskalation' });
  return anlegen(tx, r, { anlass: 'abweichung', ...o });
}

/**
 * Zurückziehen des Berichts (10 s): noch nicht entschiedene Eskalation aus dem Einreichen samt Vorschlag und Aufgabe
 * entfällt; die von der PL gestartete (Anlass «abweichung») bleibt.
 */
export async function beimZurueckziehen(tx: Tx, r: store.Row, _who: Actor): Promise<void> {
  const e = await vonBericht(tx, r.id);
  if (!e || e.stand !== 'offen' || e.anlass !== 'kritisch') return;
  await traktandum.zuruecknehmen(tx, { art: 'eskalation', bezug: bezugVon(e.id) });
  await aufgabe.entfallen(tx, { art: ART_AUFGABE, bezug: bezugVon(e.id) });
  await tx.query(`DELETE FROM ${E} WHERE id = $1`, [e.id]);
}

/**
 * Folge des Entscheids (fachmodell.md 2.9) in der Transaktion des Entscheids, idempotent auf das zuletzt übergebene
 * Ergebnis (Korrektur in der Sitzung, A-30): erledigt schliesst Eskalation und Aufgabe, zurückgestellt hält beides offen.
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge): Promise<void> {
  const e = await lesen(tx, f.bezug.id);
  if (!e) return;
  const ergebnis = f.ergebnis === 'erledigt' ? 'erledigt' : 'zurueckgestellt';
  await tx.query(
    `UPDATE ${E} SET stand = $2, ergebnis = $3, entscheid_begruendung = btrim($4), entschieden_at = now() WHERE id = $1`,
    [e.id, ergebnis === 'erledigt' ? 'erledigt' : 'traktandiert', ergebnis, f.begruendung]);
  if (ergebnis === 'erledigt') {
    await aufgabe.erledigen(tx, { art: ART_AUFGABE, bezug: bezugVon(e.id) });
  } else {
    await aufgabe.oeffnen(tx, {
      art: ART_AUFGABE, bezug: bezugVon(e.id), empfaenger: { recht: 'sitzung:write', ort: { typ: 'portfolio', id: e.portfolio_id } },
      titel: `Eskalation ${e.nummer} ${e.name} erneut traktandieren`, kontext: 'vom Gremium zurückgestellt', link: '/gremien/sitzungen',
    });
  }
}

/** Art `eskalation` in der Registry der Sitzung (fachmodell.md 2.9): Bericht «kritisch» als Unterlage, Folge oben. */
export function registriereEskalation(): void {
  registriereTraktandenart({
    art: 'eskalation',
    label: 'Eskalation',
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => {
      const e = bezug.typ === 'eskalation' ? await lesen(tx, bezug.id) : null;
      return e ? { titel: titelVon(e), antrag: antragVon(e) } : null;
    },
    unterlagen: async (tx, bezug) => {
      const e = bezug.typ === 'eskalation' ? await lesen(tx, bezug.id) : null;
      if (!e) return [];
      return [{
        art: 'bericht', titel: `Statusbericht ${monat(e.periode)} ${e.nummer}`, bereit: true, hinweis: HINWEIS[e.anlass],
        inhalt: { periode: e.periode, begruendung: e.grund, massnahme: e.massnahme },
      }];
    },
    beiEntscheid,
  });
}

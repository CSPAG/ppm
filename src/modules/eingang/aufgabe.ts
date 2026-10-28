/**
 * Schnittstelle für die Fachmodule (Fachmodell 4.1): Aufgaben öffnen und schliessen, Mitteilungen senden – immer in der
 * Transaktion der auslösenden Änderung. Die Lesesicht lässt Schreiben in `aufgabe` und `mitteilung` nur zu, solange
 * `app.eingang_intern` gesetzt ist (Migration 070); das tun ausschliesslich die Funktionen hier.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

/** Empfänger: eine Person (Unterzeichnen, Rückfrage, Auflage) oder ein Recht an einem Ort (Sammelaufgabe). */
export type Empfaenger =
  | { person: string }
  | { recht: string; ort?: { typ: 'portfolio' | 'projekt'; id: string } };

/** Fachlicher Bezug der Aufgabe, z. B. `{ typ: 'periode', id: '2026-10' }` oder `{ typ: 'vertrag_version', id: <uuid> }`. */
export interface Bezug { typ: string; id: string }

export interface AufgabeOeffnen {
  /** `<modul>.<verb>` aus Fachmodell 4.2, z. B. `statusbericht.erstellen`. */
  art: string;
  bezug: Bezug;
  empfaenger: Empfaenger;
  /** Was zu tun ist, mit Objekt («Statusbericht Oktober erstellen»); Du-Form. */
  titel: string;
  /** Projekt und Rolle («2026-014 Neues KIS · als PL»), optional. */
  kontext?: string | null;
  /** Adresse in der Oberfläche, die direkt zur Aktion führt (I-B1), z. B. `/projekte/2026-014/bericht?periode=2026-10`. */
  link: string;
  /** Frist als Kalendertag (YYYY-MM-DD) und ihre Art (UX-E11); ohne Frist `null`. */
  frist?: { datum: string; art: 'kalendertage' | 'arbeitstage' } | null;
  /** Von Hand erledigbar (ohne fachlichen Übergang, z. B. «Unterlagen lesen»). Standard false. */
  manuell?: boolean;
}

/** Auswahl offener Aufgaben zum Schliessen; ohne `empfaenger` alle Empfänger der Art und des Bezugs. */
export interface AufgabeAuswahl { art: string; bezug: Bezug; empfaenger?: Empfaenger }

const A = `${SCHEMA}.aufgabe`;

/** Führt `fn` mit Schreibrecht des Moduls aus und stellt den vorherigen Wert wieder her (auch geschachtelt). */
export async function intern<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  const prev = (await tx.query<{ v: string | null }>("SELECT current_setting('app.eingang_intern', true) AS v")).rows[0]?.v ?? '';
  await tx.query("SELECT set_config('app.eingang_intern', 'on', true)");
  let ok = false;
  try {
    const r = await fn();
    ok = true;
    return r;
  } finally {
    // nach einem Fehler ist die Transaktion abgebrochen; dann bleibt nichts zurückzusetzen
    if (ok) await tx.query("SELECT set_config('app.eingang_intern', $1, true)", [prev ?? '']);
  }
}

function empfaengerSpalten(e: Empfaenger): { person: string | null; recht: string | null; ortTyp: string; ortId: string | null } {
  if ('person' in e) return { person: e.person, recht: null, ortTyp: 'org', ortId: null };
  return { person: null, recht: e.recht, ortTyp: e.ort?.typ ?? 'org', ortId: e.ort?.id ?? null };
}

/**
 * Aufgabe öffnen. Idempotent je (Art, Bezug, Empfänger): Ist sie schon offen, werden Titel, Kontext, Link und Frist
 * nachgeführt (z. B. «Statusberichte Oktober prüfen · 8 neu»). Liefert die ID.
 */
async function oeffnen(tx: Tx, a: AufgabeOeffnen): Promise<string> {
  const e = empfaengerSpalten(a.empfaenger);
  return intern(tx, async () => (await tx.query<{ id: string }>(
    `INSERT INTO ${A} (tenant_id, art, bezug_typ, bezug_id, empfaenger_person, empfaenger_recht, ort_typ, ort_id, titel, kontext, link, frist, frist_art, manuell)
     VALUES (app.tenant_id(), $1, $2, $3, $4, $5, $6, $7, btrim($8), $9, $10, $11, $12, $13)
     ON CONFLICT (tenant_id, art, bezug_typ, bezug_id, coalesce(empfaenger_person::text, empfaenger_recht), ort_typ, coalesce(ort_id::text, ''))
       WHERE stand = 'offen'
     DO UPDATE SET titel = EXCLUDED.titel, kontext = EXCLUDED.kontext, link = EXCLUDED.link, frist = EXCLUDED.frist,
                   frist_art = EXCLUDED.frist_art, manuell = EXCLUDED.manuell
     RETURNING id`,
    [a.art, a.bezug.typ, a.bezug.id, e.person, e.recht, e.ortTyp, e.ortId, a.titel, a.kontext ?? null, a.link,
      a.frist?.datum ?? null, a.frist?.art ?? null, a.manuell ?? false])).rows[0]!.id);
}

/** Bedingung für die Auswahl ab Platzhalter `$<von>`; mit den Werten in derselben Reihenfolge. */
function auswahl(s: AufgabeAuswahl, von: number): { where: string; args: unknown[] } {
  const args: unknown[] = [s.art, s.bezug.typ, s.bezug.id];
  let where = `art = $${von} AND bezug_typ = $${von + 1} AND bezug_id = $${von + 2}`;
  if (s.empfaenger) {
    const e = empfaengerSpalten(s.empfaenger);
    args.push(e.person, e.recht, e.ortTyp, e.ortId);
    where += ` AND empfaenger_person IS NOT DISTINCT FROM $${von + 3} AND empfaenger_recht IS NOT DISTINCT FROM $${von + 4}
              AND ort_typ = $${von + 5} AND ort_id IS NOT DISTINCT FROM $${von + 6}::uuid`;
  }
  return { where, args };
}

async function schliessen(tx: Tx, s: AufgabeAuswahl, stand: 'erledigt' | 'entfallen'): Promise<number> {
  const a = auswahl(s, 2);
  return intern(tx, async () => {
    const n = (await tx.query(
      `UPDATE ${A} SET stand = $1, erledigt_von = app.principal_id(), erledigt_at = now()
        WHERE stand = 'offen' AND ${a.where}`, [stand, ...a.args])).rowCount ?? 0;
    // Schon von Hand erledigt: die fachliche Handlung beendet sie endgültig, «Rückgängig» öffnet sie nicht mehr
    const b = auswahl(s, 1);
    await tx.query(`UPDATE ${A} SET manuell = false WHERE stand = 'erledigt' AND manuell AND ${b.where}`, b.args);
    return n;
  });
}

/** Aufgaben öffnen und schliessen (Fachmodell 4.1). */
export const aufgabe = {
  oeffnen,
  /** Offene Aufgaben als erledigt schliessen (die Handlung ist getan); liefert die Anzahl. */
  erledigen: (tx: Tx, s: AufgabeAuswahl) => schliessen(tx, s, 'erledigt'),
  /** Offene Aufgaben schliessen, weil sie nicht mehr nötig sind (z. B. Vertrag zurückgezogen); liefert die Anzahl. */
  entfallen: (tx: Tx, s: AufgabeAuswahl) => schliessen(tx, s, 'entfallen'),
};

export interface MitteilungSenden {
  /** Person, die die Mitteilung erhält. */
  an: string;
  bezug: Bezug;
  /** Wer, was, bis wann (I-B4), Du-Form; ohne sensible Inhalte. */
  text: string;
  /** Adresse in der Oberfläche (I-B1), optional. */
  link?: string | null;
}

/** Mitteilungen (Information ohne Handlung, z. B. «Idee zurückgewiesen»); E-Mail folgt mit einem Netz-Adapter (A-44). */
export const mitteilung = {
  async senden(tx: Tx, m: MitteilungSenden): Promise<string> {
    return intern(tx, async () => (await tx.query<{ id: string }>(
      `INSERT INTO ${SCHEMA}.mitteilung (tenant_id, empfaenger_person, bezug_typ, bezug_id, text, link)
       VALUES (app.tenant_id(), $1, $2, $3, btrim($4), $5) RETURNING id`,
      [m.an, m.bezug.typ, m.bezug.id, m.text, m.link ?? null])).rows[0]!.id);
  },
};

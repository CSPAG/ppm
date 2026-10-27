/**
 * Übernahme der laufenden Projekte aus dem Excel-Dashboard (AP-E0-7; K16, A-14): einmalig, je Zeile Stammdaten, Phase,
 * Status, Trend, nächster Meilenstein und Projektleitung. Spalten nach dem heutigen Dashboard (Q6 F7, Q8 Kap. 8.3), als
 * CSV aus Excel gespeichert (Vorlage `scripts/uebernahme/vorlage.csv`).
 *
 * Ablauf: Die ganze Übernahme läuft in einer Transaktion, jede Zeile in einem Savepoint. Der Prüflauf führt alles aus
 * und setzt die Transaktion zurück; so meldet er auch Fehler, die erst die Datenbank feststellt, je Zeile. Gespeichert
 * wird nur ohne Fehler (alles oder nichts). Was obere Module zur Zeile beitragen (Bericht der Vorperiode, Meilenstein),
 * registrieren sie hier (`registriere`), das Modul projekt kennt sie nicht (fachmodell.md 1.1, Rückwirkung über
 * Registrierung).
 */
import type { TupleStore } from '@vollholz/iam';
import { HttpError, type Actor, type Db, type Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import { anlegen, organisationFestlegen } from './aktionen.ts';
import { PHASEN, type Phase } from './schemas.ts';

/** Eine gelesene Zeile des Dashboards (Werte geprüft und normiert). */
export interface UebernahmeZeile {
  /** Zeilennummer in der Datei (Kopf = 1). */
  zeile: number;
  /** «Index» des Dashboards, z. B. «07». */
  index: string;
  handlungsfeld: string;
  prioritaet: string;
  name: string;
  thema: string;
  /** E-Mail-Adresse oder Name der Projektleitung (Verantwortlich Reporting). */
  projektleitung: string;
  phase: Phase;
  /** `YYYY-MM-DD` oder null. */
  abschlussPer: string | null;
  meilensteinTermin: string | null;
  meilenstein: string;
  status: 'im_plan' | 'kritisch' | null;
  /** Schlüssel der Codetabelle `trend`. */
  trend: 'aufwaerts' | 'gleichbleibend' | 'abwaerts' | null;
  /** Bei «kritisch» Pflicht (UC-004 A2); nicht im Dashboard, als zusätzliche Spalten der Vorlage. */
  begruendung: string;
  massnahme: string;
}

export interface Fehler { spalte: string | null; text: string }

/** Beitrag eines oberen Moduls zu jeder übernommenen Zeile, in derselben Transaktion. */
export interface UebernahmeTeil {
  name: string;
  /** Rechte an der Organisation, die der Beitrag braucht (die Route prüft sie zusätzlich). */
  rechte: readonly string[];
  /** Fehler als `HttpError` (z. B. 422 mit `errors`); sie gelten für die Zeile. */
  uebernehmen(tx: Tx, who: Actor, ctx: { projektId: string; periode: string; zeile: UebernahmeZeile }): Promise<void>;
}

const teile: UebernahmeTeil[] = [];

/** Registrierung der oberen Module (Aufruf beim Laden ihres `index.ts`). */
export function registriere(teil: UebernahmeTeil): void {
  if (!teile.some(t => t.name === teil.name)) teile.push(teil);
}

export const rechteDerTeile = () => teile.flatMap(t => t.rechte);

// ---------------------------------------------------------------- Datei lesen

/** Spalten mit den Überschriften des Dashboards (ohne Gross/klein, Leerzeichen und Satzzeichen verglichen). */
const SPALTEN = {
  index: ['index', 'prjkt', 'prjktnr', 'nr'],
  handlungsfeld: ['strategischeshandlungsfeld', 'handlungsfeld'],
  prioritaet: ['prioritaet', 'priorität'],
  name: ['projektname', 'projekt', 'name'],
  thema: ['themainhalt', 'thema', 'inhalt'],
  projektleitung: ['projektleiterin', 'projektleitung', 'verantwortlichreporting', 'projektleiter'],
  phase: ['projektphase', 'phase', 'phaseaktuell', 'aktuell'],
  abschlussPer: ['abschlussper', 'abschluss'],
  meilensteinTermin: ['meilensteintermin', 'termin'],
  meilenstein: ['naechstermeilenstein', 'nächstermeilenstein', 'meilenstein', 'naechstemeilensteine', 'nächstemeilensteine'],
  status: ['status', 'projektstatus'],
  trend: ['trend'],
  begruendung: ['begruendung', 'begründung'],
  massnahme: ['massnahme', 'massnahmen'],
} as const;
type Spalte = keyof typeof SPALTEN;
const PFLICHT: Spalte[] = ['name', 'phase'];

const TEXT: Record<Spalte, string> = {
  index: 'Index', handlungsfeld: 'Strategisches Handlungsfeld', prioritaet: 'Priorität', name: 'Projektname', thema: 'Thema / Inhalt',
  projektleitung: 'Projektleitung', phase: 'Projektphase', abschlussPer: 'Abschluss per', meilensteinTermin: 'Meilenstein Termin',
  meilenstein: 'Nächster Meilenstein', status: 'Status', trend: 'Trend', begruendung: 'Begründung', massnahme: 'Massnahme',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, '');

/** CSV nach RFC 4180 mit Trennzeichen `;` (Excel Schweiz) oder `,`; Anführungszeichen, Zeilenumbrüche im Feld, BOM. */
export function csvZeilen(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const erste = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (erste.match(/;/g)?.length ?? 0) >= (erste.match(/,/g)?.length ?? 0) ? ';' : ',';
  const out: string[][] = [];
  let feld = '', zeile: string[] = [], quote = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (quote) {
      if (c === '"' && t[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') quote = false; else feld += c;
    } else if (c === '"' && feld === '') quote = true;
    else if (c === sep) { zeile.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      zeile.push(feld); out.push(zeile); feld = ''; zeile = [];
    } else feld += c;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); out.push(zeile); }
  return out.filter(z => z.some(f => f.trim() !== ''));
}

/** Datum «31.12.2026», «1.1.2027» oder «2026-12-31» → `YYYY-MM-DD`; ungültig → undefined. */
export function datum(s: string): string | null | undefined {
  const v = s.trim();
  if (!v) return null;
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  const [j, mo, t] = m ? [Number(m[3]), Number(m[2]), Number(m[1])] : (m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)) ? [Number(m[1]), Number(m[2]), Number(m[3])] : [];
  if (!j || !mo || !t) return undefined;
  const d = new Date(Date.UTC(j, mo - 1, t));
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) return undefined;
  return d.toISOString().slice(0, 10);
}

const STATUS: Record<string, UebernahmeZeile['status']> = { implan: 'im_plan', kritisch: 'kritisch' };
/** Trend als Pfeil (Dashboard) oder Wort. */
const TREND: Record<string, UebernahmeZeile['trend']> = {
  '↗': 'aufwaerts', '↑': 'aufwaerts', '⬈': 'aufwaerts', aufwaerts: 'aufwaerts', aufwärts: 'aufwaerts',
  '→': 'gleichbleibend', '➝': 'gleichbleibend', '➔': 'gleichbleibend', gleichbleibend: 'gleichbleibend', gleich: 'gleichbleibend',
  '↘': 'abwaerts', '↓': 'abwaerts', '⬊': 'abwaerts', abwaerts: 'abwaerts', abwärts: 'abwaerts',
};

/** Datei lesen: Kopf erkennen, Werte je Zeile prüfen (Fehler je Zeile und Spalte). */
export function lesen(csv: string): { zeilen: (UebernahmeZeile & { fehler: Fehler[] })[]; kopf: Fehler[] } {
  const roh = csvZeilen(csv);
  if (!roh.length) return { zeilen: [], kopf: [{ spalte: null, text: 'Die Datei ist leer.' }] };
  const kopf = roh[0]!.map(norm);
  const pos = {} as Record<Spalte, number>;
  for (const s of Object.keys(SPALTEN) as Spalte[]) pos[s] = kopf.findIndex(k => (SPALTEN[s] as readonly string[]).map(norm).includes(k));
  const fehlt = PFLICHT.filter(s => pos[s] < 0);
  if (fehlt.length) {
    return { zeilen: [], kopf: fehlt.map(s => ({ spalte: TEXT[s], text: `Spalte «${TEXT[s]}» fehlt in der Kopfzeile. Verwenden Sie die Vorlage.` })) };
  }
  const zeilen = roh.slice(1).map((r, i) => {
    const wert = (s: Spalte) => (pos[s] >= 0 ? (r[pos[s]] ?? '').trim() : '');
    const fehler: Fehler[] = [];
    const f = (s: Spalte, text: string) => fehler.push({ spalte: TEXT[s], text });
    const name = wert('name');
    if (!name) f('name', 'Projektname fehlt.');
    else if (name.length > 200) f('name', 'Projektname: höchstens 200 Zeichen.');
    const phase = wert('phase').toUpperCase().replace(/\s/g, '');
    if (!(PHASEN as readonly string[]).includes(phase)) f('phase', `Projektphase «${wert('phase')}» statt P0 bis P4.`);
    const abschluss = datum(wert('abschlussPer'));
    if (abschluss === undefined) f('abschlussPer', `Abschluss per «${wert('abschlussPer')}» ist kein Datum (TT.MM.JJJJ). Tragen Sie ein Datum ein oder lassen Sie das Feld leer.`);
    const termin = datum(wert('meilensteinTermin'));
    if (termin === undefined) f('meilensteinTermin', `Meilenstein Termin «${wert('meilensteinTermin')}» ist kein Datum (TT.MM.JJJJ).`);
    const meilenstein = wert('meilenstein');
    if (meilenstein.length > 500) f('meilenstein', 'Nächster Meilenstein: höchstens 500 Zeichen.');
    const st = wert('status');
    const status = st ? STATUS[norm(st)] : null;
    if (status === undefined) f('status', `Status «${st}» statt «im Plan» oder «kritisch».`);
    const tr = wert('trend');
    const trend = tr ? TREND[tr] ?? TREND[norm(tr)] : null;
    if (trend === undefined) f('trend', `Trend «${tr}» statt Pfeil (↗ → ↘) oder «aufwärts», «gleichbleibend», «abwärts».`);
    const begruendung = wert('begruendung'), massnahme = wert('massnahme');
    if (status === 'kritisch' && (!begruendung || !massnahme)) {
      f(begruendung ? 'massnahme' : 'begruendung', 'Status «kritisch»: Begründung und Massnahme sind Pflicht (UC-004 A2). Ergänzen Sie die Spalten «Begründung» und «Massnahme».');
    }
    if (begruendung.length > 4000 || massnahme.length > 4000) f('begruendung', 'Begründung und Massnahme: je höchstens 4000 Zeichen.');
    return {
      zeile: i + 2, index: wert('index'), handlungsfeld: wert('handlungsfeld'), prioritaet: wert('prioritaet'), name, thema: wert('thema'),
      projektleitung: wert('projektleitung'), phase: phase as Phase, abschlussPer: abschluss ?? null, meilensteinTermin: termin ?? null,
      meilenstein, status: status ?? null, trend: trend ?? null, begruendung, massnahme, fehler,
    };
  });
  return { zeilen, kopf: [] };
}

// ---------------------------------------------------------------- Übernehmen

export interface ZeileErgebnis { zeile: number; index: string; name: string; nummer: string | null; fehler: Fehler[] }

/** Fehler eines Aufrufs als Fehler der Zeile (Feldfehler einzeln, sonst der Text). */
function alsFehler(e: unknown): Fehler[] {
  if (e instanceof HttpError) {
    const errors = (e.extra as { errors?: { path: string; message: string }[] }).errors;
    return errors?.length ? errors.map(x => ({ spalte: null, text: x.message })) : [{ spalte: null, text: e.detail ?? e.title }];
  }
  const pg = e as { code?: string; message?: string };
  if (pg.code === '42501') return [{ spalte: null, text: 'Keine Berechtigung, diese Zeile zu übernehmen.' }];
  throw e;
}

/** Projektleitung über E-Mail oder Namen (Personen der Organisation, nicht entfernt); eindeutig oder Fehler. */
async function person(tx: Tx, wer: string): Promise<{ id: string } | { fehler: string }> {
  const rows = (await tx.query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.principal WHERE kind = 'user' AND removed_at IS NULL
        AND (lower(email) = lower($1) OR lower(btrim(display_name)) = lower(btrim($1))) LIMIT 2`, [wer])).rows;
  if (rows.length === 1) return { id: rows[0]!.id };
  return { fehler: rows.length ? `Projektleitung «${wer}» ist nicht eindeutig. Geben Sie die E-Mail-Adresse an.` : `Projektleitung «${wer}» gibt es in der Organisation nicht.` };
}

/**
 * Alle Zeilen übernehmen (in der Transaktion des Aufrufers). Liefert das Ergebnis je Zeile; ob gespeichert wird,
 * entscheidet der Aufrufer (Commit nur ohne Fehler).
 */
export async function uebernehmen(tx: Tx, ctx: { db: Db; tenantId: string; tuples: TupleStore; who: Actor; principalId: string },
  o: { csv: string; portfolio: string; periode: string }): Promise<{ kopf: Fehler[]; zeilen: ZeileErgebnis[] }> {
  const { zeilen, kopf } = lesen(o.csv);
  if (kopf.length) return { kopf, zeilen: [] };
  const pf = (await tx.query<{ id: string }>(`SELECT id FROM ${SCHEMA}.portfolio WHERE schluessel = $1`, [o.portfolio])).rows[0];
  if (!pf) return { kopf: [{ spalte: null, text: `Portfolio «${o.portfolio}» gibt es nicht.` }], zeilen: [] };
  const ergebnis: ZeileErgebnis[] = [];
  for (const z of zeilen) {
    const fehler = [...z.fehler];
    let nummer: string | null = null;
    if (!fehler.length) {
      await tx.query('SAVEPOINT uebernahme_zeile');
      try {
        // Einmalig (A-14): dieselbe Zeile des Dashboards nicht zweimal
        if (z.index && (await tx.query(`SELECT 1 FROM ${SCHEMA}.projekt WHERE herkunft->>'quelle' = 'excel' AND herkunft->>'index' = $1 AND portfolio_id = $2`, [z.index, pf.id])).rowCount) {
          fehler.push({ spalte: TEXT.index, text: `Index «${z.index}» ist schon übernommen.` });
        }
        const hf = z.handlungsfeld
          ? (await tx.query<{ id: string }>(`SELECT id FROM ${SCHEMA}.handlungsfeld WHERE lower(btrim(label)) = lower($1)`, [z.handlungsfeld.replace(/\s+/g, ' ')])).rows[0] ?? null
          : null;
        if (z.handlungsfeld && !hf) fehler.push({ spalte: TEXT.handlungsfeld, text: `Handlungsfeld «${z.handlungsfeld}» gibt es nicht. Erfassen Sie es zuerst oder lassen Sie das Feld leer.` });
        const pl = z.projektleitung ? await person(tx, z.projektleitung) : null;
        if (pl && 'fehler' in pl) fehler.push({ spalte: TEXT.projektleitung, text: pl.fehler });
        if (!fehler.length) {
          const herkunft = { quelle: 'excel', index: z.index, thema: z.thema, prioritaet: z.prioritaet, handlungsfeld: z.handlungsfeld };
          const r = await anlegen(tx, ctx, ctx.who, { name: z.name, portfolioId: pf.id, phase: z.phase, handlungsfeldId: hf?.id ?? null, herkunft });
          nummer = r.nummer;
          if (pl && 'id' in pl) {
            await organisationFestlegen(tx, { tuples: ctx.tuples, who: ctx.who, principalId: ctx.principalId }, r.id, 0, [{ personId: pl.id, funktion: 'pl' }]);
          }
          for (const t of teile) await t.uebernehmen(tx, ctx.who, { projektId: r.id, periode: o.periode, zeile: z });
        }
      } catch (e) {
        fehler.push(...alsFehler(e));
      }
      if (fehler.length) { await tx.query('ROLLBACK TO SAVEPOINT uebernahme_zeile'); nummer = null; }
      else await tx.query('RELEASE SAVEPOINT uebernahme_zeile');
    }
    ergebnis.push({ zeile: z.zeile, index: z.index, name: z.name, nummer, fehler });
  }
  return { kopf: [], zeilen: ergebnis };
}

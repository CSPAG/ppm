/**
 * Fachregeln der Prüfung (BC PS.01.02–04, UC-005, Kernablauf K1; AP-E1-2): Auffälligkeiten eines Berichts (Status
 * geändert, Termin verschoben, Prognose über Budget; K1-4), Stand je Projekt in der Periode, Reihenfolge des Posteingangs
 * (I-L5), Fristen der Periode und die Regel, die den Abschluss sperrt.
 */
import type { Tx } from '@vollholz/platform';
import { fristDatum } from '../phasenmodell/index.ts';
import { projektdaten, type Eintrag } from '../projektdaten/index.ts';
import type { AuffaelligkeitOut, PeriodeZeileOut, ZeilenStand } from './pruefung-schemas.ts';
import type * as pstore from './pruefung-store.ts';

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** «Oktober» bzw. «Oktober 2026» für Titel von Aufgaben (Du-Form, de-CH). */
export const monat = (periode: string, mitJahr = false) => `${MONATE[Number(periode.slice(5, 7)) - 1]}${mitJahr ? ` ${periode.slice(0, 4)}` : ''}`;

/** Letzter Tag der Periode: Abschluss durch die UE bis Monatsende (UC-005 Schritt 5, docs/fachmodell.md 2.14). */
export function monatsende(periode: string): string {
  const [j, m] = periode.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10);
}

export function vorperiodeVon(periode: string): string {
  const [j, m] = periode.split('-').map(Number) as [number, number];
  return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Fristen der Periode (A-26, Q8 Kap. 8.4) aus dem Phasenmodell in Kraft (`bericht_aufgabe`, `bericht_stichtag`,
 * docs/fachmodell.md 2.14), nie als Konstante; ohne Phasenmodell in Kraft null («Periode abschliessen» öffnet sich dann
 * mit dem ersten Einreichen).
 */
export async function fristen(tx: Tx, periode: string): Promise<{ berichtAufgabe: string | null; stichtag: string | null; abschlussBis: string }> {
  const erster = `${periode}-01`;
  return {
    berichtAufgabe: (await fristDatum(tx, 'bericht_aufgabe', erster))?.datum ?? null,
    stichtag: (await fristDatum(tx, 'bericht_stichtag', erster))?.datum ?? null,
    abschlussBis: monatsende(periode),
  };
}

const TAG = 86_400_000;
const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / TAG);

/** Eingereicht im Sinn der Prüfung: eingereicht, zurückgegeben oder geprüft (nicht Entwurf). */
export const eingereichterBericht = (z: pstore.ZeileRow) => z.stand !== null && z.stand !== 'entwurf';

/** Register des Projekts, soweit die Prüfung sie braucht; Beträge nur mit `finanzen:read` (Lesesicht, A-33). */
export interface Register { meilensteine: Eintrag[]; kosten: Eintrag[] }

export async function register(tx: Tx, projektId: string): Promise<Register> {
  return {
    meilensteine: await projektdaten.lesen(tx, 'meilenstein', { projektId }),
    kosten: await projektdaten.lesen(tx, 'kosten', { projektId }),
  };
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Auffälligkeiten eines eingereichten Berichts (UC-005 Schritt 2, K1-4):
 * - Status geändert gegenüber der Vorperiode;
 * - Termin verschoben: offener Meilenstein bzw. offenes Lieferergebnis später als in der Baseline, oder «Abschluss per»
 *   später als in der Vorperiode – die grösste Verschiebung;
 * - Prognose über Budget: Prognose einer Phase über dem Budget der Baseline – die grösste Überschreitung.
 * Ohne Baseline bzw. ohne Beträge (kein `finanzen:read`) entfällt die jeweilige Prüfung (Z4).
 */
export function auffaelligkeiten(z: pstore.ZeileRow, r: Register): AuffaelligkeitOut[] {
  const a: AuffaelligkeitOut[] = [];
  if (z.status && z.vor_status && z.status !== z.vor_status) a.push({ art: 'status', von: z.vor_status, nach: z.status });

  let termin: Extract<AuffaelligkeitOut, { art: 'termin' }> | null = null;
  for (const m of r.meilensteine) {
    if (m.art !== 'meilenstein' && m.art !== 'lieferergebnis') continue;
    const base = str(m.terminBaseline), akt = str(m.terminAktuell);
    if (!base || !akt || str(m.erreichtAm)) continue;
    const tage = tageZwischen(base, akt);
    if (tage > 0 && (!termin || tage > termin.tage)) termin = { art: 'termin', tage, bezug: 'baseline', text: String(m.text) };
  }
  if (z.abschluss_per && z.vor_abschluss_per) {
    const tage = tageZwischen(z.vor_abschluss_per, z.abschluss_per);
    if (tage > 0 && (!termin || tage > termin.tage)) termin = { art: 'termin', tage, bezug: 'vorperiode', text: 'Abschluss per' };
  }
  if (termin) a.push(termin);

  const phasen = new Map<string, { budget: number; prognose: number }>();
  for (const k of r.kosten) {
    const budget = num(k.budgetBaseline), prognose = num(k.prognose);
    if (budget === null || prognose === null) continue;
    const p = phasen.get(String(k.phase)) ?? { budget: 0, prognose: 0 };
    p.budget += budget;
    p.prognose += prognose;
    phasen.set(String(k.phase), p);
  }
  let budget: Extract<AuffaelligkeitOut, { art: 'budget' }> | null = null;
  for (const [phase, p] of [...phasen].sort(([x], [y]) => x.localeCompare(y))) {
    if (p.budget <= 0 || p.prognose <= p.budget) continue;
    const prozent = Math.round(((p.prognose - p.budget) / p.budget) * 1000) / 10;
    if (!budget || prozent > budget.prozent) budget = { art: 'budget', prozent, phase };
  }
  if (budget) a.push(budget);
  return a;
}

/** Stand je Projekt in der offenen Periode. */
export function zeilenStand(z: pstore.ZeileRow): ZeilenStand {
  return z.stand === null || z.stand === 'entwurf' ? 'ausstehend' : z.stand;
}

/** Reihenfolge «auffällig zuerst» (K1 Prüfen Schritt 1, I-L5): auffällige, übrige eingereichte, zurückgegebene, ausstehende, geprüfte. */
export function rang(z: Pick<PeriodeZeileOut, 'stand' | 'auffaelligkeiten'>): number {
  switch (z.stand) {
    case 'eingereicht': return z.auffaelligkeiten.length ? 0 : 1;
    case 'zurueckgegeben': return 2;
    case 'ausstehend': return 3;
    case 'nicht_gemeldet': return 4;
    default: return 5;
  }
}

/** Sperre des Abschlusses (UC-005 Schritt 5, K1 Regel): eingereichte, nicht geprüfte Berichte. */
export function abschlussSperre(eingereicht: number): string | null {
  if (!eingereicht) return null;
  return `Abschluss: ${eingereicht} ${eingereicht === 1 ? 'Bericht ist' : 'Berichte sind'} eingereicht, aber nicht geprüft. Prüfe ${eingereicht === 1 ? 'ihn' : 'diese'} zuerst.`;
}

export const PERIODE_ABGESCHLOSSEN = 'Die Periode ist abgeschlossen und gesperrt (Z9).';

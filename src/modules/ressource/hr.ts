/**
 * Personal- und Abwesenheitsdaten aus dem HR-System übernehmen (BC RK.01.02, UC-009 Schritt 1; AP-E7-2): Verarbeitung
 * der Schnittstelle «HR-System › Personal- und Abwesenheitsdaten» (A-54), registriert beim Modul `schnittstelle`
 * (`verarbeitungSetzen`), damit dieses die Ressourcen nicht importiert. Kein eigener Netzverkehr.
 *
 * Format der Lieferung (Annahme AP-E7-2 wie A-62; Adresse und Protokoll stehen nicht in docs/, K23 offen): JSON, eine
 * Liste `{ personalnummer, rolle, monat: "JJJJ-MM", fte, abwesend? }` oder `{ personen: [...] }`. `fte` ist das Pensum
 * der Person in FTE, `abwesend` der Teil davon, der im Monat durch Abwesenheiten entfällt (FTE, Standard 0). Übernommen
 * wird je Rolle und Monat die Summe (Pensum minus Abwesenheit) und die Zahl der Personen, keine Personendaten; ein Lauf
 * ersetzt die gelieferten Monate. Die Rolle muss ein aktiver Codewert der Codetabelle `ressourcenrolle` sein (Pool =
 * Rolle, A-20). Das von der RM festgelegte Angebot (UC-009 Schritt 2) hat Vorrang, ohne Erfassung gilt dieser Wert.
 */
import type { Tx } from '@vollholz/platform';
import { verarbeitungSetzen } from '../schnittstelle/index.ts';
import { codewertAktiv } from '../stammdaten/index.ts';
import { SCHEMA } from '../../platform.ts';

const T = `${SCHEMA}.kapazitaet_hr`;
const NR = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/;
const ROLLE = /^[A-Za-z0-9_]{1,40}$/;
const MONAT = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const zahl = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
const rund = (n: number) => Math.round(n * 100) / 100;

export interface HrZelle { rolle: string; monat: string; fte: number; abwesend: number; personen: number }
export interface HrZelleRow extends HrZelle { uebernommen_at: Date }

/** Lieferung prüfen und je Rolle und Monat zusammenfassen; wirft mit Text für das Laufprotokoll. */
export function personalLesen(antwort: string): HrZelle[] {
  let daten: unknown;
  try { daten = JSON.parse(antwort); } catch { throw new Error('keine gültige JSON-Antwort'); }
  const liste = Array.isArray(daten) ? daten : (daten as { personen?: unknown })?.personen;
  if (!Array.isArray(liste)) throw new Error('erwartet eine Liste von Personen');
  const summe = new Map<string, HrZelle & { nummern: Set<string> }>();
  liste.forEach((x: unknown, i) => {
    const p = x as Record<string, unknown>;
    const nr = typeof p?.personalnummer === 'string' ? p.personalnummer.trim() : typeof p?.personalnummer === 'number' ? String(p.personalnummer) : '';
    const rolle = typeof p?.rolle === 'string' ? p.rolle.trim() : '';
    const monat = p?.monat, fte = zahl(p?.fte), abwesend = zahl(p?.abwesend ?? 0);
    if (!NR.test(nr)) throw new Error(`Eintrag ${i + 1}: Personalnummer fehlt oder ist ungültig`);
    if (!ROLLE.test(rolle)) throw new Error(`Eintrag ${i + 1}: Rolle fehlt oder ist ungültig`);
    if (typeof monat !== 'string' || !MONAT.test(monat)) throw new Error(`Eintrag ${i + 1}: Monat «JJJJ-MM» fehlt`);
    if (typeof fte !== 'number' || !Number.isFinite(fte) || fte < 0 || fte > 10) throw new Error(`Eintrag ${i + 1}: Pensum (FTE) fehlt oder liegt nicht zwischen 0 und 10`);
    if (typeof abwesend !== 'number' || !Number.isFinite(abwesend) || abwesend < 0 || abwesend > fte) throw new Error(`Eintrag ${i + 1}: Abwesenheit (FTE) liegt nicht zwischen 0 und dem Pensum`);
    const key = `${rolle}|${monat}`;
    const z = summe.get(key) ?? { rolle, monat, fte: 0, abwesend: 0, personen: 0, nummern: new Set<string>() };
    z.fte = rund(z.fte + fte - abwesend);
    z.abwesend = rund(z.abwesend + abwesend);
    z.nummern.add(nr);
    z.personen = z.nummern.size;
    summe.set(key, z);
  });
  return [...summe.values()].map(({ nummern: _n, ...z }) => z);
}

/** Gelieferte Monate ersetzen (je Monat alle Rollen: eine Rolle ohne Personen im Monat entfällt). */
export async function hrErsetzen(tx: Tx, zellen: readonly HrZelle[]): Promise<void> {
  const monate = [...new Set(zellen.map(z => z.monat))];
  if (monate.length) await tx.query(`DELETE FROM ${T} WHERE monat = ANY ($1::text[])`, [monate]);
  if (zellen.length) {
    await tx.query(
      `INSERT INTO ${T} (tenant_id, rolle, monat, fte, abwesend, personen)
       SELECT app.tenant_id(), rolle, monat, fte, abwesend, personen FROM unnest($1::text[], $2::text[], $3::numeric[], $4::numeric[], $5::int[]) AS z(rolle, monat, fte, abwesend, personen)`,
      [zellen.map(z => z.rolle), zellen.map(z => z.monat), zellen.map(z => z.fte), zellen.map(z => z.abwesend), zellen.map(z => z.personen)]);
  }
}

/** Kapazität laut HR im Zeitraum «JJJJ-MM» von–bis, nach Rolle und Monat (Lesesicht). */
export async function hrList(tx: Tx, von: string, bis: string): Promise<HrZelleRow[]> {
  return (await tx.query<HrZelleRow>(
    `SELECT rolle, monat, fte::float8 AS fte, abwesend::float8 AS abwesend, personen, uebernommen_at FROM ${T} WHERE monat BETWEEN $1 AND $2 ORDER BY rolle, monat`,
    [von, bis])).rows;
}

/**
 * Angebot für die Auslastung (UC-009 Schritte 1–2): das von der RM festgelegte, wo es eines gibt, sonst die Kapazität
 * laut HR (Annahme AP-E7-2: das Festgelegte hat Vorrang, die Übernahme füllt Lücken und ist markiert).
 */
export function mitHr<A extends { rolle: string; monat: string; fte: number }>(erfasst: readonly A[], hr: readonly HrZelle[]): { rolle: string; monat: string; fte: number }[] {
  const da = new Set(erfasst.map(a => `${a.rolle}|${a.monat}`));
  return [...erfasst.map(a => ({ rolle: a.rolle, monat: a.monat, fte: a.fte })), ...hr.filter(h => !da.has(`${h.rolle}|${h.monat}`)).map(h => ({ rolle: h.rolle, monat: h.monat, fte: h.fte }))];
}

/** Lauf der Schnittstelle (in dessen Transaktion, volle Sicht): prüfen, Rollen gegen die Codetabelle, ersetzen. */
export async function personalUebernehmen(tx: Tx, antwort: string): Promise<number> {
  const zellen = personalLesen(antwort);
  for (const rolle of new Set(zellen.map(z => z.rolle))) {
    if (!(await codewertAktiv(tx, 'ressourcenrolle', rolle))) throw new Error(`Rolle «${rolle}» ist kein aktiver Codewert der Codetabelle «Rolle des Ressourcenbedarfs»`);
  }
  await hrErsetzen(tx, zellen);
  return zellen.length;
}

verarbeitungSetzen('personal', { uebernehmen: personalUebernehmen });

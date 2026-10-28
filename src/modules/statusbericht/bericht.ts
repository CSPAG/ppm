/**
 * Fachregeln des Statusberichts (BC PS.01.01, UC-004, Kernablauf K1): Vorbelegung aus der Vorperiode, Pflichtangaben
 * beim Einreichen, Zustände, in denen die Projektleitung ihn bearbeiten darf, und Rückgängig nach dem Einreichen.
 */
import { conflict, invalid, type Tx } from '@vollholz/platform';
import { DIMENSIONEN, type AbweichungIn, type StatusberichtPutIn } from './schemas.ts';
import type * as store from './store.ts';

/** Phasen mit Berichtspflicht (UC-004 Vorbedingung: P0 bis P3; in P4 kein Bericht, K1 Zustand «Phase P4»). */
export const BERICHTSPHASEN: readonly string[] = ['P0', 'P1', 'P2', 'P3'];

/** Rückgängig nach dem Einreichen (K1 Schritt 8, G6): 10 s im Toast, dazu Kulanz für Netz und Uhr der Oberfläche. */
export const RUECKGAENGIG_SEKUNDEN = 10;
const KULANZ_SEKUNDEN = 5;

/** Leere Beurteilung je Dimension. */
export const leereAbweichung = (): AbweichungIn =>
  Object.fromEntries(DIMENSIONEN.map(d => [d, { stufe: null, kommentar: '' }])) as AbweichungIn;

/** Abweichung vollständig (alle Dimensionen), auch wenn gespeichert nur ein Teil vorliegt. */
export const abweichungVon = (a: Partial<AbweichungIn> | null | undefined): AbweichungIn => ({ ...leereAbweichung(), ...(a ?? {}) });

/**
 * Vorbelegung eines neuen Berichts aus der Vorperiode (UC-004 Schritt 1, K1 I-F2): alle Werte ausser Status und Trend,
 * die jeden Monat bewusst gewählt werden (K1 Entscheid). «Entscheid des PRAT nötig» ebenfalls nicht, weil es eine
 * Eskalation auslöst (UC-004 A2.2). Den nächsten Meilenstein liefert der Meilensteinplan, wenn er einen offenen hat
 * (K1 Schritt 7: «aus dem Plan vorausgefüllt»).
 */
export function vorbelegung(vor: store.Row | null, plan: string | null = null): Required<StatusberichtPutIn> {
  return {
    anlass: 'monatlich',
    status: null,
    trend: null,
    abschlussPer: vor?.abschluss_per ?? null,
    naechsterMeilenstein: plan ?? vor?.naechster_meilenstein ?? '',
    abweichung: abweichungVon(vor?.abweichung),
    abhaengigkeiten: vor?.abhaengigkeiten ?? '',
    entscheide: vor?.entscheide ?? '',
    begruendung: vor?.begruendung ?? '',
    massnahme: vor?.massnahme ?? '',
    entscheidNoetig: false,
  };
}

const DIMENSION_TEXT: Record<(typeof DIMENSIONEN)[number], string> = { inhalt: 'Inhalt', termin: 'Termin', ressourcen: 'Ressourcen', budget: 'Budget' };

/** Werte eines Berichts so, wie die Regeln sie prüfen. */
export type Werte = Pick<Required<StatusberichtPutIn>, 'status' | 'trend' | 'abweichung' | 'begruendung' | 'massnahme'>;

/**
 * Fehlende Pflichtangaben (UC-004 Schritt 7, A2; K1 Regel «Pflichtangaben des Berichts»): Status, Trend, Beurteilung je
 * Dimension; bei «kritisch» Begründung und Massnahme. Reihenfolge = Reihenfolge in der Maske (Sprung zum ersten Feld).
 */
export function fehlend(w: Werte): { feld: string; text: string }[] {
  const f: { feld: string; text: string }[] = [];
  for (const d of DIMENSIONEN) if (!w.abweichung[d]?.stufe) f.push({ feld: `abweichung.${d}`, text: `Beurteilung ${DIMENSION_TEXT[d]}` });
  if (!w.status) f.push({ feld: 'status', text: 'Status' });
  if (!w.trend) f.push({ feld: 'trend', text: 'Trend' });
  if (w.status === 'kritisch') {
    if (!w.begruendung.trim()) f.push({ feld: 'begruendung', text: 'Begründung' });
    if (!w.massnahme.trim()) f.push({ feld: 'massnahme', text: 'Massnahme' });
  }
  return f;
}

export const werteVon = (r: store.Row): Werte => ({
  status: r.status, trend: r.trend, abweichung: abweichungVon(r.abweichung), begruendung: r.begruendung, massnahme: r.massnahme,
});

/** Liste «Status, Trend und Beurteilung Budget» für den Text der Sperre. */
const aufzaehlung = (t: string[]) => (t.length > 1 ? `${t.slice(0, -1).join(', ')} und ${t[t.length - 1]}` : t[0] ?? '');

/** Sperre beim Einreichen mit allen fehlenden Angaben (422, `errors` mit Pfad je Feld für den Sprung). */
export function pruefePflichtangaben(w: Werte): void {
  const f = fehlend(w);
  if (!f.length) return;
  throw invalid(`Angaben fehlen: ${aufzaehlung(f.map(x => x.text))} ${f.length > 1 ? 'sind' : 'ist'} leer. Ergänze sie, um den Bericht einzureichen.`,
    f.map(x => ({ path: `/${x.feld.replace('.', '/')}`, message: x.text })));
}

/** Periode des laufenden Monats (Zeit der Schweiz); spätere Perioden haben noch nicht begonnen. */
export async function laufendePeriode(tx: Tx): Promise<string> {
  return (await tx.query<{ p: string }>("SELECT to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYY-MM') AS p")).rows[0]!.p;
}

export const PERIODE_GESPERRT = 'Die Periode ist abgeschlossen. Ein Bericht nach dem Abschluss zählt für die nächste Periode (A-37).';

/** Warum der Bericht nicht (mehr) bearbeitet werden kann; null = bearbeitbar. Texte für die Sperre (409). */
export function sperre(p: store.ProjektRow, periode: string, laufend: string, periodeStand: 'offen' | 'abgeschlossen', r: store.Row | null): { grund: string; text: string } | null {
  if (p.lebenszyklus !== 'aktiv') return { grund: 'lebenszyklus', text: `Das Projekt ${p.nummer} ist nicht aktiv und berichtet nicht.` };
  if (!BERICHTSPHASEN.includes(p.phase)) return { grund: 'phase', text: `Das Projekt ${p.nummer} ist in Phase ${p.phase} und berichtet nicht mehr monatlich.` };
  if (periode > laufend) return { grund: 'zukunft', text: `Die Periode ${periode} hat noch nicht begonnen.` };
  if (periodeStand === 'abgeschlossen') return { grund: 'periode', text: PERIODE_GESPERRT };
  if (r && r.stand !== 'entwurf' && r.stand !== 'zurueckgegeben') {
    return { grund: 'stand', text: r.stand === 'eingereicht' ? 'Der Bericht ist eingereicht und in Prüfung. Ändern ist erst nach einer Rückfrage möglich.' : 'Der Bericht ist geprüft und kann nicht mehr geändert werden.' };
  }
  return null;
}

export function pruefeBearbeitbar(...a: Parameters<typeof sperre>): void {
  const s = sperre(...a);
  if (s) throw conflict(s.text, { reason: s.grund });
}

/** Rückgängig: nur die einreichende Person, nur solange der Bericht eingereicht ist, innert der Frist. */
export function rueckgaengigMoeglich(r: store.Row, principalId: string, sekunden: number | null): boolean {
  return r.stand === 'eingereicht' && r.eingereicht_by === principalId && sekunden !== null && sekunden <= RUECKGAENGIG_SEKUNDEN + KULANZ_SEKUNDEN;
}

/** Meilenstein des Plans, wie ihn der Bericht nennt: «Abnahme Pilot (30.06.2027)». */
export function meilensteinText(m: { text: string; termin: string | null }): string {
  if (!m.termin) return m.text;
  const [j, mo, t] = m.termin.split('-');
  return `${m.text} (${t}.${mo}.${j})`.slice(0, 500);
}

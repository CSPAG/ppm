/**
 * Suchparameter der Ad-hoc-Auswertungen (I-N5; UI-30, AP-E7-6): `/portfolio/auswertungen?gruppierung=phase&kennzahlen=
 * projekte,kritisch&phase=P2&o=P2`. Filter, Kennzahlen und Gruppierung stehen in der Adresse (G8), `o` öffnet die
 * Einzelwerte einer Gruppe in der Schublade. Unbekanntes und Ungültiges fällt weg.
 */
export const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export const LEBENSZYKLEN = ['aktiv', 'sistiert', 'abgebrochen', 'abgeschlossen', 'zurueckgezogen'] as const;
export const STATUS = ['kritisch', 'im_plan', 'ohne'] as const;
export const KENNZAHLEN = ['projekte', 'kritisch', 'eskalationen', 'meilensteine_offen', 'risiken', 'budget', 'prognose', 'ist'] as const;
export const GRUPPIERUNGEN = ['portfolio', 'phase', 'status', 'lebenszyklus', 'handlungsfeld', 'keine'] as const;
export type Kennzahl = (typeof KENNZAHLEN)[number];
export type Gruppierung = (typeof GRUPPIERUNGEN)[number];

export interface AuswertungenSearch {
  periode?: string; portfolio?: string; phase?: string; lebenszyklus?: string; status?: string; handlungsfeld?: string;
  kennzahlen?: string; gruppierung?: Gruppierung; o?: string;
}

const PERIODE = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const SCHLUESSEL = /^[a-z0-9_-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kommaliste nur mit erlaubten Werten, ohne Doppel; leer → undefined. */
function liste(raw: unknown, erlaubt: readonly string[]): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const w = [...new Set(raw.split(',').filter(x => erlaubt.includes(x)))];
  return w.length ? w.join(',') : undefined;
}

export function validateAuswertungenSearch(raw: Record<string, unknown>): AuswertungenSearch {
  const out: AuswertungenSearch = {};
  if (typeof raw.periode === 'string' && PERIODE.test(raw.periode)) out.periode = raw.periode;
  if (typeof raw.portfolio === 'string' && SCHLUESSEL.test(raw.portfolio)) out.portfolio = raw.portfolio;
  const phase = liste(raw.phase, PHASEN); if (phase) out.phase = phase;
  const lz = liste(raw.lebenszyklus, LEBENSZYKLEN); if (lz) out.lebenszyklus = lz;
  const st = liste(raw.status, STATUS); if (st) out.status = st;
  if (typeof raw.handlungsfeld === 'string' && UUID.test(raw.handlungsfeld)) out.handlungsfeld = raw.handlungsfeld;
  const k = liste(raw.kennzahlen, KENNZAHLEN); if (k) out.kennzahlen = k;
  if (typeof raw.gruppierung === 'string' && (GRUPPIERUNGEN as readonly string[]).includes(raw.gruppierung)) out.gruppierung = raw.gruppierung as Gruppierung;
  if (typeof raw.o === 'string' && raw.o.length <= 60) out.o = raw.o;
  return out;
}

export type SetAuswertungenSearch = (next: Partial<Record<keyof AuswertungenSearch, string | undefined>>, o?: { replace?: boolean }) => void;

/** Gewählte Kennzahlen (Standard wie die API: Projekte, Status kritisch). */
export const kennzahlenVon = (s: AuswertungenSearch): Kennzahl[] => (s.kennzahlen?.split(',') ?? ['projekte', 'kritisch']) as Kennzahl[];

/** Filter ohne Kennzahlen und Gruppierung (für «Alle Filter zurücksetzen» und die Chips, I-L1). */
export const FILTER = ['portfolio', 'phase', 'lebenszyklus', 'status', 'handlungsfeld', 'periode'] as const;

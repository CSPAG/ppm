/**
 * Suchparameter des Monatsabschlusses (I-N5, docs/ux/informationsarchitektur.md «Adressen»):
 * `/portfolio/monatsabschluss?periode=2026-10&stand=eingereicht&sort=auffaellig`; Ansicht «Termine» über
 * `ansicht=termine` (UI-16), Filter `auffaellig=1` und `portfolio=<id>`, Bericht in der Schublade über
 * `o=bericht:<projektnummer>` (Schlüssel der Oberfläche statt interner ID).
 */
export type ZeilenStand = 'eingereicht' | 'zurueckgegeben' | 'geprueft' | 'ausstehend' | 'nicht_gemeldet';

export interface MonatsabschlussSearch {
  periode?: string;
  ansicht?: 'termine';
  stand?: ZeilenStand;
  auffaellig?: '1';
  portfolio?: string;
  sort?: 'nummer';
  o?: string;
}

const STAENDE: readonly ZeilenStand[] = ['eingereicht', 'zurueckgegeben', 'geprueft', 'ausstehend', 'nicht_gemeldet'];
const PERIODE = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const O = /^bericht:[0-9]{4}-[0-9]{3,4}$/;

export const berichtO = (nummer: string) => `bericht:${nummer}`;
export const nummerAusO = (o: string) => o.slice('bericht:'.length);

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateMonatsabschlussSearch(raw: Record<string, unknown>): MonatsabschlussSearch {
  const out: MonatsabschlussSearch = {};
  if (typeof raw.periode === 'string' && PERIODE.test(raw.periode)) out.periode = raw.periode;
  if (raw.ansicht === 'termine') out.ansicht = 'termine';
  if (typeof raw.stand === 'string' && (STAENDE as readonly string[]).includes(raw.stand)) out.stand = raw.stand as ZeilenStand;
  if (raw.auffaellig === '1' || raw.auffaellig === 1) out.auffaellig = '1';
  if (typeof raw.portfolio === 'string' && UUID.test(raw.portfolio)) out.portfolio = raw.portfolio;
  if (raw.sort === 'nummer') out.sort = 'nummer';
  if (typeof raw.o === 'string' && O.test(raw.o)) out.o = raw.o;
  return out;
}

export type SetMonatsabschlussSearch = (next: Partial<Record<keyof MonatsabschlussSearch, string | undefined>>, o?: { replace?: boolean }) => void;

/** Nachbarperiode: −1 vorherige, +1 nächste. */
export function periodePlus(periode: string, delta: number): string {
  const [j, m] = periode.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(j, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

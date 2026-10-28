/**
 * Auswahl hinter den Zahlen des Dashboards (UI-17, Seitentyp Bericht: jede Zahl führt zu ihren Einzelwerten): je Auswahl
 * genau eine Bedingung, mit der die Kennzahlen und der Funnel zählen und die Liste filtert. «Nicht gemeldet» trägt den
 * Status der Vorperiode (A-11) und zählt deshalb nicht zu «im Plan», «kritisch» oder «ohne Status».
 */
import type { DashboardZeile } from './api.ts';

export const AUSWAHLEN = ['im_plan', 'kritisch', 'ohne_status', 'offen', 'nicht_gemeldet', 'ausstehend', 'eskalation'] as const;
export type Auswahl = (typeof AUSWAHLEN)[number];

const gemeldet = (z: DashboardZeile) => z.meldung !== 'nicht_gemeldet';

export const PASST: Record<Auswahl, (z: DashboardZeile) => boolean> = {
  im_plan: z => z.status === 'im_plan' && gemeldet(z),
  kritisch: z => z.status === 'kritisch' && gemeldet(z),
  ohne_status: z => !z.status && gemeldet(z),
  offen: z => z.meldung === 'nicht_gemeldet' || z.meldung === 'ausstehend',
  nicht_gemeldet: z => z.meldung === 'nicht_gemeldet',
  ausstehend: z => z.meldung === 'ausstehend',
  eskalation: z => z.merkmale.includes('eskalation'),
};

/** Zeilen nach Phase und Auswahl (beide optional). */
export function filtern(items: readonly DashboardZeile[], o: { phase?: string; auswahl?: Auswahl }): DashboardZeile[] {
  return items.filter(z => (!o.phase || z.phase === o.phase) && (!o.auswahl || PASST[o.auswahl](z)));
}

export const anzahl = (items: readonly DashboardZeile[], a: Auswahl) => items.filter(PASST[a]).length;

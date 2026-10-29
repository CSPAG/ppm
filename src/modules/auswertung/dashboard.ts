/**
 * Dashboard der Periode (BC PC.04.01, UC-014 Schritt 1; Kernablauf K1, K3; AP-E1-3): Zeilen je Projekt mit Meldung
 * («gemeldet», «ausstehend», «nicht gemeldet», A-11), Badge «Eskalation» (offene Eskalation aus AP-E2-4), Reihenfolge
 * und Funnel nach Phase.
 */
import type { Tx } from '@vollholz/platform';
import { csv } from '../../platform.ts';
import { eskalationen } from '../statusbericht/index.ts';
import type { Auswahl, DashboardZeileOut, Meldung } from './schemas.ts';
import type * as store from './store.ts';

const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
type Phase = (typeof PHASEN)[number];
const istPhase = (p: string | null): p is Phase => !!p && (PHASEN as readonly string[]).includes(p);

export function meldung(z: store.ZeileRow): Meldung {
  if (z.gemeldet) return 'gemeldet';
  if (z.abgeschlossen) return 'nicht_gemeldet';
  return z.pflichtig ? 'ausstehend' : 'ohne_pflicht';
}

/** Zeile des Dashboards; `eskaliert`: Eskalation zum Bericht der Zeile, noch nicht erledigt (AP-E2-4). */
export function zeile(z: store.ZeileRow, portfolio: string, eskaliert: boolean): DashboardZeileOut {
  const phase = istPhase(z.phase) ? z.phase : istPhase(z.projekt_phase) ? z.projekt_phase : 'P0';
  return {
    projektId: z.projekt_id, nummer: z.nummer, name: z.name, portfolioId: z.portfolio_id, portfolio,
    handlungsfeld: z.handlungsfeld, projektleitung: z.projektleitung, phase, abschlussPer: z.abschluss_per,
    naechsterMeilenstein: z.ms_text ? { termin: z.ms_termin, text: z.ms_text } : z.naechster_meilenstein ? { termin: null, text: z.naechster_meilenstein } : null,
    status: z.status, statusVorperiode: z.status_vorperiode, trend: z.trend, meldung: meldung(z), werteAus: z.werte_aus,
    merkmale: [...(eskaliert ? ['eskalation' as const] : []), ...(z.ungeprueft ? ['nicht_geprueft' as const] : [])],
  };
}

/** Kritische zuerst, dann nicht gemeldete bzw. ausstehende, sonst nach Nummer (I-L5: dringend zuerst). */
/** Zeilen mit Badge «Eskalation» aus der Tabelle `eskalation` (über `statusbericht`, Lesesicht der Person). */
export async function zeilen(tx: Tx, rows: store.ZeileRow[], portfolio: (r: store.ZeileRow) => string): Promise<DashboardZeileOut[]> {
  const offen = await eskalationen.offenZuBerichten(tx, rows.flatMap(r => (r.statusbericht_id ? [r.statusbericht_id] : [])));
  return sortieren(rows.map(r => zeile(r, portfolio(r), !!r.statusbericht_id && offen.has(r.statusbericht_id))));
}

export function sortieren(items: DashboardZeileOut[]): DashboardZeileOut[] {
  const rang = (z: DashboardZeileOut) => (z.status === 'kritisch' ? 0 : z.meldung === 'nicht_gemeldet' || z.meldung === 'ausstehend' ? 1 : 2);
  return [...items].sort((a, b) => rang(a) - rang(b) || a.nummer.localeCompare(b.nummer));
}

export function funnel(items: DashboardZeileOut[]) {
  return PHASEN.map(phase => {
    const z = items.filter(i => i.phase === phase);
    return {
      phase, anzahl: z.length,
      imPlan: z.filter(i => i.status === 'im_plan').length,
      kritisch: z.filter(i => i.status === 'kritisch').length,
      ohneStatus: z.filter(i => !i.status).length,
      nichtGemeldet: z.filter(i => i.meldung === 'nicht_gemeldet' || i.meldung === 'ausstehend').length,
    };
  });
}

/**
 * Projekte hinter einer Zahl des Dashboards (UI-17; dieselben Bedingungen wie `web/src/features/dashboard/auswahl.ts`):
 * «nicht gemeldet» trägt den Status der Vorperiode (A-11) und zählt nicht zu im Plan, kritisch oder ohne Status.
 */
const gemeldet = (z: DashboardZeileOut) => z.meldung !== 'nicht_gemeldet';
export const PASST: Record<Auswahl, (z: DashboardZeileOut) => boolean> = {
  im_plan: z => z.status === 'im_plan' && gemeldet(z),
  kritisch: z => z.status === 'kritisch' && gemeldet(z),
  ohne_status: z => !z.status && gemeldet(z),
  offen: z => z.meldung === 'nicht_gemeldet' || z.meldung === 'ausstehend',
  nicht_gemeldet: z => z.meldung === 'nicht_gemeldet',
  ausstehend: z => z.meldung === 'ausstehend',
  eskalation: z => z.merkmale.includes('eskalation'),
};

const STATUS_LABEL: Record<string, string> = { im_plan: 'im Plan', kritisch: 'kritisch' };
const MELDUNG_LABEL: Record<Meldung, string> = { gemeldet: 'gemeldet', ausstehend: 'ausstehend', nicht_gemeldet: 'nicht gemeldet', ohne_pflicht: 'ohne Berichtspflicht' };

/** Export (Seitentyp Bericht): eine Zeile je Projekt in der Reihenfolge der Liste. */
export function alsCsv(items: readonly DashboardZeileOut[]): string {
  return csv([
    ['Nummer', 'Projekt', 'Portfolio', 'Handlungsfeld', 'Projektleitung', 'Phase', 'Abschluss per', 'Nächster Meilenstein', 'Termin', 'Status', 'Status Vorperiode', 'Trend', 'Meldung', 'Werte aus', 'Eskalation'],
    ...items.map(z => [
      z.nummer, z.name, z.portfolio, z.handlungsfeld, z.projektleitung, z.phase, z.abschlussPer, z.naechsterMeilenstein?.text ?? null, z.naechsterMeilenstein?.termin ?? null,
      z.status ? STATUS_LABEL[z.status] ?? z.status : null, z.statusVorperiode ? STATUS_LABEL[z.statusVorperiode] ?? z.statusVorperiode : null, z.trend,
      MELDUNG_LABEL[z.meldung], z.werteAus, z.merkmale.includes('eskalation') ? 'ja' : 'nein',
    ]),
  ]);
}

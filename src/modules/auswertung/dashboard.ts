/**
 * Dashboard der Periode (BC PC.04.01, UC-014 Schritt 1; Kernablauf K1, K3; AP-E1-3): Zeilen je Projekt mit Meldung
 * («gemeldet», «ausstehend», «nicht gemeldet», A-11), Badge «Eskalation», Reihenfolge und Funnel nach Phase.
 */
import type { DashboardZeileOut, Meldung } from './schemas.ts';
import type * as store from './store.ts';

const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
type Phase = (typeof PHASEN)[number];
const istPhase = (p: string | null): p is Phase => !!p && (PHASEN as readonly string[]).includes(p);

export function meldung(z: store.ZeileRow): Meldung {
  if (z.gemeldet) return 'gemeldet';
  if (z.abgeschlossen) return 'nicht_gemeldet';
  return z.pflichtig ? 'ausstehend' : 'ohne_pflicht';
}

export function zeile(z: store.ZeileRow, portfolio: string): DashboardZeileOut {
  const phase = istPhase(z.phase) ? z.phase : istPhase(z.projekt_phase) ? z.projekt_phase : 'P0';
  return {
    projektId: z.projekt_id, nummer: z.nummer, name: z.name, portfolioId: z.portfolio_id, portfolio,
    handlungsfeld: z.handlungsfeld, projektleitung: z.projektleitung, phase, abschlussPer: z.abschluss_per,
    naechsterMeilenstein: z.ms_text ? { termin: z.ms_termin, text: z.ms_text } : z.naechster_meilenstein ? { termin: null, text: z.naechster_meilenstein } : null,
    status: z.status, statusVorperiode: z.status_vorperiode, trend: z.trend, meldung: meldung(z), werteAus: z.werte_aus,
    merkmale: z.gemeldet && z.entscheid_noetig ? ['eskalation'] : [],
  };
}

/** Kritische zuerst, dann nicht gemeldete bzw. ausstehende, sonst nach Nummer (I-L5: dringend zuerst). */
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

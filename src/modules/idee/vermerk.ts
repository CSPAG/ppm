/**
 * Vermerke der Initialisierung (AP-E8-4; UC-001 A6; Master G1, A-74, UX-E12): Die UE startet die Initialisierung vor
 * dem Entscheid des Gremiums; das Projekt trägt «Initialisierung nicht freigegeben», bis der Entscheid erfasst ist.
 * Abgeleitet aus dem Stand der Idee mit Projekt, gespeichert wird nichts.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

export interface Vermerk { art: string; text: string }

/** Vermerk einer Idee mit Projekt, deren Freigabe fehlt (offen, zurückgestellt oder abgelehnt). */
export function ideeVermerke(stand: string, projektId: string | null): Vermerk[] {
  if (!projektId || stand === 'freigegeben') return [];
  if (stand === 'zurueckgewiesen') return [{ art: 'initialisierung_abgelehnt', text: 'Initialisierung nicht freigegeben (abgelehnt)' }];
  if (stand === 'zurueckgestellt') return [{ art: 'initialisierung_zurueckgestellt', text: 'Initialisierung zurückgestellt' }];
  return [{ art: 'initialisierung_nicht_freigegeben', text: 'Initialisierung nicht freigegeben' }];
}

/** Vermerke am Projekt aus der Idee, aus der es entstanden ist (Lesesicht der Person; ohne sichtbare Idee keine). */
export async function vermerkeZumProjekt(tx: Tx, projektId: string): Promise<Vermerk[]> {
  const r = (await tx.query<{ stand: string }>(`SELECT stand FROM ${SCHEMA}.idee WHERE projekt_id = $1`, [projektId])).rows[0];
  return r ? ideeVermerke(r.stand, projektId) : [];
}

/**
 * Vermerk des Abschlusses (AP-E8-4; UC-015 A3; Master G1, A-74, UX-E12): PL oder UE schliessen das Vorhaben vor der
 * Abnahme durch das Gremium; das Projekt ist «abgeschlossen» mit «Abnahme offen», das Traktandum bleibt offen. Abgeleitet
 * aus Lebenszyklus und Stand des Abschlussberichts; der Vermerk entfällt mit der Abnahme.
 */
import type * as store from './store.ts';

export interface Vermerk { art: string; text: string }

/** Abgeschlossen, aber der Abschlussbericht ist noch nicht abgenommen. */
export function abschlussVermerke(p: Pick<store.ProjektKopf, 'lebenszyklus'>, b: Pick<store.BerichtRow, 'art' | 'stand'> | null): Vermerk[] {
  return p.lebenszyklus === 'abgeschlossen' && b?.art === 'abschluss' && (b.stand === 'eingereicht' || b.stand === 'traktandiert')
    ? [{ art: 'abnahme_offen', text: 'Abnahme offen' }] : [];
}

/** Vorab abschliessen ist möglich: aktives Projekt mit eingereichtem Abschlussbericht, Abnahme noch offen. */
export const vorabAbschliessbar = (p: Pick<store.ProjektKopf, 'lebenszyklus'>, b: Pick<store.BerichtRow, 'art' | 'stand'> | null) =>
  p.lebenszyklus === 'aktiv' && b?.art === 'abschluss' && (b.stand === 'eingereicht' || b.stand === 'traktandiert');

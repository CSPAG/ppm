/**
 * Folgen von Einreichen und Zurückziehen für die Erweiterungen des Moduls (docs/fachmodell.md 7.2): Prüfung und
 * Monatsabschluss (AP-E1-2: Sammelaufgabe «Statusberichte prüfen»), Eskalation (AP-E2-4: «kritisch» mit Entscheidbedarf).
 * Sie registrieren sich mit einer Zeile in `index.ts` und laufen in der Transaktion des Übergangs (Wirkung sofort).
 */
import type { Actor, Tx } from '@vollholz/platform';
import type { Row } from './store.ts';

export type Folge = (tx: Tx, bericht: Row, who: Actor) => Promise<void>;

const einreichen: Folge[] = [];
const zurueckziehen: Folge[] = [];

export const folgen = {
  beimEinreichen: (f: Folge) => { einreichen.push(f); },
  beimZurueckziehen: (f: Folge) => { zurueckziehen.push(f); },
};

export async function nachEinreichen(tx: Tx, r: Row, who: Actor): Promise<void> {
  for (const f of einreichen) await f(tx, r, who);
}

export async function nachZurueckziehen(tx: Tx, r: Row, who: Actor): Promise<void> {
  for (const f of zurueckziehen) await f(tx, r, who);
}

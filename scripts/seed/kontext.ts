/** Gemeinsamer Stand der Seed-Schritte: Personen (angemeldet), angelegte Objekte und Protokoll. */
import type { Als } from './api.ts';
import type { DemoPerson } from './personen.ts';

export type PersonKey = 'anna' | 'bruno' | 'ursula' | 'patrick' | 'claudia' | 'thomas' | 'martina' | 'sandra' | 'marco' | 'daniel'
  | 'lea' | 'simon' | 'nina' | 'reto' | 'eva' | 'jonas' | 'sarah';

export interface Portfolio { id: string; schluessel: string; gremium: { id: string; kuerzel: string } }

export interface Projekt {
  key: string;
  id: string;
  nummer: string;
  name: string;
  portfolio: Portfolio;
  phase: string;
  lebenszyklus: 'aktiv' | 'sistiert' | 'abgeschlossen' | 'abgebrochen';
  sp: PersonKey; pl: PersonKey; ctl: PersonKey | null; kt: PersonKey[];
  /** Erste Berichtsperiode (Abstand zum laufenden Monat) */
  berichteAb: number;
}

export interface Kontext {
  org: string;
  tenantId: string;
  p: Record<PersonKey, Als>;
  personen: Record<PersonKey, DemoPerson & { id: string }>;
  orgEinheiten: Record<string, string>;
  handlungsfelder: Record<string, string>;
  ziele: { strategisch: Record<string, string>; jahr: Record<string, string> };
  portfolios: Record<'A' | 'B' | 'C', Portfolio>;
  projekte: Record<string, Projekt>;
  log(text: string): void;
}

export const pid = (k: Kontext, key: PersonKey) => k.personen[key].id;

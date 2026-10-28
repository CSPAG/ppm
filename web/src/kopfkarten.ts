/**
 * Kopfkarten der Startseite «Eingang» (fachmodell.md 4.1, IA «Startseite je Rolle»): eine Zeile je Modul mit dem Recht,
 * das die Karte sichtbar macht, und der Karte aus dem Feature (als eigener Chunk, Q-L6). Der Router gibt die Liste an die
 * Startseite; Features importieren nichts aus `features/eingang`.
 */
import type { KopfKarte } from './features/eingang/index.ts';
import { seite } from './routes/seite.ts';

export const kopfkarten: readonly KopfKarte[] = [
  // Monatszyklus der UE und des PMO (K1 «Prüfen», UC-005): Periode in Arbeit, Stichtag, Abschluss
  { id: 'monatszyklus', recht: 'statusbericht:review', Karte: seite(() => import('./features/monatsabschluss/MonatszyklusKopfKarte.tsx'), 'MonatszyklusKopfKarte') },
  // Eigene Projekte für PL, CTL und SP (UC-016 Schritt 2: Projektrollen je Projekt)
  { id: 'projekte', recht: 'projekt:read', Karte: seite(() => import('./features/projekt/ProjektKopfKarte.tsx'), 'ProjektKopfKarte') },
  // Nächste Sitzung je Gremium für UE, PRAT und GLPA (K3)
  { id: 'sitzung', recht: 'sitzung:read', Karte: seite(() => import('./features/sitzung/SitzungKopfKarte.tsx'), 'SitzungKopfKarte') },
  // Ideen (K4 «vom Eingang mit einem Klick zum Assistenten»): alle Mitglieder reichen Ideen ein (A-46)
  { id: 'idee', recht: 'idee:create', Karte: seite(() => import('./features/idee/IdeeKopfKarte.tsx'), 'IdeeKopfKarte') },
];

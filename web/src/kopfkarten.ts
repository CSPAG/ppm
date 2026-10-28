/**
 * Kopfkarten der Startseite «Eingang» (fachmodell.md 4.1, IA «Startseite je Rolle»): eine Zeile je Modul mit dem Recht,
 * das die Karte sichtbar macht, und der Karte aus dem Feature (als eigener Chunk, Q-L6). Der Router gibt die Liste an die
 * Startseite; Features importieren nichts aus `features/eingang`.
 */
import type { KopfKarte } from './features/eingang/index.ts';
import { seite } from './routes/seite.ts';

export const kopfkarten: readonly KopfKarte[] = [
  // Organisation einrichten (Z2): ohne Portfolio für alle, die Portfolios pflegen (ADM, UE, PMO)
  { id: 'einrichten', recht: 'portfolio:admin', Karte: seite(() => import('./features/portfolios/EinrichtenKopfKarte.tsx'), 'EinrichtenKopfKarte') },
  // Monatszyklus der UE und des PMO (K1 «Prüfen», UC-005): Periode in Arbeit, Stichtag, Abschluss
  { id: 'monatszyklus', recht: 'statusbericht:review', Karte: seite(() => import('./features/monatsabschluss/MonatszyklusKopfKarte.tsx'), 'MonatszyklusKopfKarte') },
  // Eigene Projekte für PL, CTL und SP (UC-016 Schritt 2: Projektrollen je Projekt)
  { id: 'projekte', recht: 'projekt:read', Karte: seite(() => import('./features/projekt/ProjektKopfKarte.tsx'), 'ProjektKopfKarte') },
  // Gesamtstatus des Portfolios für PRAT und GLPA, Projekte der Direktion für DIR (UI-17, Sichtbarkeit nach Recht)
  { id: 'portfolio', recht: 'auswertung:read', Karte: seite(() => import('./features/dashboard/PortfolioKopfKarte.tsx'), 'PortfolioKopfKarte') },
  // Zielzyklus und Zielerreichung für die GL (K6; UC-011, UC-012): wer Ziele bearbeitet
  { id: 'ziele', recht: 'ziel:write', Karte: seite(() => import('./features/ziele/ZielzyklusKopfKarte.tsx'), 'ZielzyklusKopfKarte') },
  // Nächste Sitzung je Gremium für UE, PRAT und GLPA (K3)
  { id: 'sitzung', recht: 'sitzung:read', Karte: seite(() => import('./features/sitzung/SitzungKopfKarte.tsx'), 'SitzungKopfKarte') },
  // Ideen (K4 «vom Eingang mit einem Klick zum Assistenten»): alle Mitglieder reichen Ideen ein (A-46)
  { id: 'idee', recht: 'idee:create', Karte: seite(() => import('./features/idee/IdeeKopfKarte.tsx'), 'IdeeKopfKarte') },
  // Finanzen: Prognose gegenüber Budget, Überschreitungen, Ist-Kosten (FI; UC-010)
  { id: 'finanzen', recht: 'finanzen:write', Karte: seite(() => import('./features/finanzen/FinanzenKopfKarte.tsx'), 'FinanzenKopfKarte') },
  // Ressourcen: offene Bedarfe, Konflikte, Engpässe der nächsten drei Monate (RM; UC-009)
  { id: 'ressourcen', recht: 'ressource:write', Karte: seite(() => import('./features/ressourcen/RessourcenKopfKarte.tsx'), 'RessourcenKopfKarte') },
  // Schnittstellen mit fehlgeschlagenem Lauf (ADM; UC-018)
  { id: 'schnittstellen', recht: 'schnittstelle:admin', Karte: seite(() => import('./features/schnittstellen/SchnittstellenKopfKarte.tsx'), 'SchnittstellenKopfKarte') },
  // Zugänge mit offener Neubesetzung (ADM; UC-016 A1)
  { id: 'neubesetzungen', recht: 'members:admin', Karte: seite(() => import('./features/zugang/NeubesetzungKopfKarte.tsx'), 'NeubesetzungKopfKarte') },
];

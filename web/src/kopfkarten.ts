/**
 * Kopfkarten der Startseite «Eingang» (fachmodell.md 4.1, IA «Startseite je Rolle»): eine Zeile je Modul mit dem Recht,
 * das die Karte sichtbar macht, und der Karte aus dem Feature (als eigener Chunk, Q-L6). Der Router gibt die Liste an die
 * Startseite; Features importieren nichts aus `features/eingang`.
 */
import type { KopfKarte } from './features/eingang/index.ts';
import { seite } from './routes/seite.ts';

export const kopfkarten: readonly KopfKarte[] = [
  // Ideen (K4 «vom Eingang mit einem Klick zum Assistenten»): alle Mitglieder reichen Ideen ein (A-46)
  { id: 'idee', recht: 'idee:create', Karte: seite(() => import('./features/idee/IdeeKopfKarte.tsx'), 'IdeeKopfKarte') },
];

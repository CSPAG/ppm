/** Öffentliche Schnittstelle des Features «Projektvertrag» (UI-07–UI-12); je Datei eines Pakets eine Zeile (fachmodell.md 7.2). */
import { lazy } from 'react';

// Dokumentausgabe (AP-E3-5) als nachgeladener Chunk, nicht im Start-Bundle (Q-L6); beim Einbau in <Suspense> setzen
export const DokumentAusgabe = lazy(() => import('./DokumentAusgabe.tsx').then(m => ({ default: m.DokumentAusgabe })));

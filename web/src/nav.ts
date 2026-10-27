/**
 * Registrierung der Navigation (docs/oberflaeche.md «Navigation»): Hier trägt jedes Feature ein, in welchem Arbeitsraum
 * seine Bereiche liegen, welche Aktionen und Suchen es der Befehlspalette gibt und mit welchem Recht. Die Shell
 * (`shell/nav.ts`) blendet aus, was die Person nicht darf, und Arbeitsräume ohne sichtbaren Bereich (I-N2).
 */
import { sucheHandlungsfelder } from './features/handlungsfeld/index.ts';
import { sitzungsmodusTexte, sitzungTexte } from './features/sitzung/index.ts';
import { sucheZiele, zieleTexte, zielO } from './features/ziele/index.ts';
import type { NavRegistrierung } from './shell/index.ts';
import { T } from './ui/index.ts';

export const navigation: NavRegistrierung = {
  bereiche: [
    // Arbeitsraum «Gremien»: Sitzungen vorbereiten (UI-33, UC-006, AP-E2-1); Jahresrückblick folgt
    { raum: 'gremien', pfad: '/gremien/sitzungen', label: sitzungTexte.bereich, recht: 'sitzung:read' },
    // Entscheide und Auflagen (UI-36, UC-006 A3, AP-E2-2)
    { raum: 'gremien', pfad: '/gremien/entscheide', label: sitzungsmodusTexte.entscheide, recht: 'sitzung:read' },
    // Arbeitsraum «Ziele»: bis zum Zielzyklus (Etappe E6) nur die Handlungsfelder (BC ZM.01.01)
    { raum: 'ziele', pfad: '/ziele/handlungsfelder', label: T.bereich.handlungsfelder, recht: 'handlungsfeld:read' },
    // Strategische Ziele je Handlungsfeld (BC ZM.01.02, AP-E0-9)
    { raum: 'ziele', pfad: '/ziele/strategische-ziele', label: zieleTexte.bereich, recht: 'ziel:read' },
    // Arbeitsraum «Administration»: Phasenmodell (UI-46, AM.02.03) nur für wer es pflegt (IA: UE, PMO, ADM); lesen dürfen
    // alle Rollen (fachmodell.md 3.3), die Administration erscheint dafür aber nicht. Die Verwalten-Seiten des Baukastens
    // kommen nach Recht aus `useIamNav()` dazu (UC-016)
    { raum: 'administration', pfad: '/administration/phasenmodell', label: T.bereich.phasenmodell, recht: 'phasenmodell:write' },
  ],
  aktionen: [
    { id: 'handlungsfeld-anlegen', label: T.aktion.handlungsfeldAnlegen, icon: 'plus', pfad: '/ziele/handlungsfelder?o=neu', recht: 'handlungsfeld:write' },
    { id: 'ziel-anlegen', label: zieleTexte.aktionAnlegen, icon: 'plus', pfad: '/ziele/strategische-ziele?o=neu', recht: 'ziel:write' },
  ],
  suchen: [
    {
      id: 'handlungsfelder', recht: 'handlungsfeld:read',
      suchen: async (q, signal) => (await sucheHandlungsfelder(q, signal)).map(h => ({
        id: `handlungsfeld:${h.id}`, label: h.label, detail: T.bereich.handlungsfelder, icon: 'target', pfad: `/ziele/handlungsfelder?o=${h.id}`,
      })),
    },
    {
      id: 'strategische-ziele', recht: 'ziel:read',
      suchen: async (q, signal) => (await sucheZiele(q, signal)).map(z => ({
        id: `ziel:${z.nummer}`, label: `${z.nummer} ${z.text}`, detail: zieleTexte.bereich, icon: 'target', pfad: `/ziele/strategische-ziele?o=${zielO(z.nummer)}`,
      })),
    },
  ],
};

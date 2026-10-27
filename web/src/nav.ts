/**
 * Registrierung der Navigation (docs/oberflaeche.md «Navigation»): Hier trägt jedes Feature ein, in welchem Arbeitsraum
 * seine Bereiche liegen, welche Aktionen und Suchen es der Befehlspalette gibt und mit welchem Recht. Die Shell
 * (`shell/nav.ts`) blendet aus, was die Person nicht darf, und Arbeitsräume ohne sichtbaren Bereich (I-N2).
 */
import { sucheHandlungsfelder } from './features/handlungsfeld/index.ts';
import { projektTexte, sucheProjekte } from './features/projekt/index.ts';
import { sucheZiele, zieleTexte, zielO } from './features/ziele/index.ts';
import type { NavRegistrierung } from './shell/index.ts';
import { T } from './ui/index.ts';

export const navigation: NavRegistrierung = {
  bereiche: [
    // Arbeitsraum «Projekte»: Meine Projekte mit der Projektakte (UI-05, UI-06; Projektrollen sehen nur ihre Projekte)
    { raum: 'projekte', pfad: '/projekte', label: projektTexte.bereich, recht: 'projekt:read' },
    // Arbeitsraum «Ziele»: bis zum Zielzyklus (Etappe E6) nur die Handlungsfelder (BC ZM.01.01)
    { raum: 'ziele', pfad: '/ziele/handlungsfelder', label: T.bereich.handlungsfelder, recht: 'handlungsfeld:read' },
    // Strategische Ziele je Handlungsfeld (BC ZM.01.02, AP-E0-9)
    { raum: 'ziele', pfad: '/ziele/strategische-ziele', label: zieleTexte.bereich, recht: 'ziel:read' },
    // Arbeitsraum «Administration»: die Verwalten-Seiten des Baukastens kommen nach Recht aus `useIamNav()` dazu (UC-016)
  ],
  aktionen: [
    { id: 'handlungsfeld-anlegen', label: T.aktion.handlungsfeldAnlegen, icon: 'plus', pfad: '/ziele/handlungsfelder?o=neu', recht: 'handlungsfeld:write' },
    { id: 'ziel-anlegen', label: zieleTexte.aktionAnlegen, icon: 'plus', pfad: '/ziele/strategische-ziele?o=neu', recht: 'ziel:write' },
  ],
  suchen: [
    {
      id: 'projekte', recht: 'projekt:read',
      suchen: async (q, signal) => (await sucheProjekte(q, signal)).map(p => ({
        id: `projekt:${p.id}`, label: `${p.nummer} ${p.name}`, detail: projektTexte.palette.detail, icon: 'folder', pfad: `/projekte/${p.nummer}`,
      })),
    },
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

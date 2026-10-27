/**
 * Registrierung der Navigation (docs/oberflaeche.md «Navigation»): Hier trägt jedes Feature ein, in welchem Arbeitsraum
 * seine Bereiche liegen, welche Aktionen und Suchen es der Befehlspalette gibt und mit welchem Recht. Die Shell
 * (`shell/nav.ts`) blendet aus, was die Person nicht darf, und Arbeitsräume ohne sichtbaren Bereich (I-N2).
 */
import { sucheHandlungsfelder } from './features/handlungsfeld/index.ts';
import { stammdatenTexte as TS, sucheOrgEinheiten } from './features/stammdaten/index.ts';
import type { NavRegistrierung } from './shell/index.ts';
import { T } from './ui/index.ts';

export const navigation: NavRegistrierung = {
  bereiche: [
    // Arbeitsraum «Ziele»: bis zum Zielzyklus (Etappe E6) nur die Handlungsfelder (BC ZM.01.01)
    { raum: 'ziele', pfad: '/ziele/handlungsfelder', label: T.bereich.handlungsfelder, recht: 'handlungsfeld:read' },
    // Arbeitsraum «Administration»: Organisation und Codetabellen (UI-44, UI-45; UC-017) sieht nur, wer sie pflegt (IA:
    // Administration nur ADM; lesen dürfen alle Rollen für Auswahllisten); die Verwalten-Seiten des Baukastens kommen nach
    // Recht aus `useIamNav()` dazu (UC-016)
    { raum: 'administration', pfad: '/administration/organisation', label: TS.bereich.organisation, recht: 'stammdaten:write' },
    { raum: 'administration', pfad: '/administration/codetabellen', label: TS.bereich.codetabellen, recht: 'stammdaten:write' },
  ],
  aktionen: [
    { id: 'einheit-anlegen', label: TS.aktion.einheitAnlegen, icon: 'plus', pfad: '/administration/organisation?o=neu', recht: 'stammdaten:write' },
    { id: 'feiertag-erfassen', label: TS.aktion.feiertagErfassen, icon: 'plus', pfad: '/administration/organisation?ansicht=feiertage&o=neu', recht: 'stammdaten:write' },
    { id: 'handlungsfeld-anlegen', label: T.aktion.handlungsfeldAnlegen, icon: 'plus', pfad: '/ziele/handlungsfelder?o=neu', recht: 'handlungsfeld:write' },
  ],
  suchen: [
    {
      id: 'org-einheiten', recht: 'stammdaten:write',
      suchen: async (q, signal) => (await sucheOrgEinheiten(q, signal)).map(o => ({
        id: `org-einheit:${o.id}`, label: `${o.kuerzel} · ${o.name}`, detail: TS.bereich.organisation, icon: 'building', pfad: `/administration/organisation?o=${o.id}`,
      })),
    },
    {
      id: 'handlungsfelder', recht: 'handlungsfeld:read',
      suchen: async (q, signal) => (await sucheHandlungsfelder(q, signal)).map(h => ({
        id: `handlungsfeld:${h.id}`, label: h.label, detail: T.bereich.handlungsfelder, icon: 'target', pfad: `/ziele/handlungsfelder?o=${h.id}`,
      })),
    },
  ],
};

/**
 * Registrierung der Navigation (docs/oberflaeche.md «Navigation»): Hier trägt jedes Feature ein, in welchem Arbeitsraum
 * seine Bereiche liegen, welche Aktionen und Suchen es der Befehlspalette gibt und mit welchem Recht. Die Shell
 * (`shell/nav.ts`) blendet aus, was die Person nicht darf, und Arbeitsräume ohne sichtbaren Bereich (I-N2).
 */
import { eingangTexte } from './features/eingang/index.ts';
import { sucheHandlungsfelder } from './features/handlungsfeld/index.ts';
import { portfoliosTexte } from './features/portfolios/index.ts';
import { projektTexte, sucheProjekte } from './features/projekt/index.ts';
import { sitzungTexte } from './features/sitzung/index.ts';
import { stammdatenTexte as TS, sucheOrgEinheiten } from './features/stammdaten/index.ts';
import { kontoTexte } from './features/konto/index.ts';
import { sucheZiele, zieleTexte, zielO, zielzyklusTexte } from './features/ziele/index.ts';
import type { NavRegistrierung } from './shell/index.ts';
import { T } from './ui/index.ts';

export const navigation: NavRegistrierung = {
  bereiche: [
    // Arbeitsraum «Eingang»: Startseite jeder Rolle (UI-01, UX-E3); jede Rolle enthält tenant:read (fachmodell.md 3.3)
    { raum: 'eingang', pfad: '/eingang', label: eingangTexte.titel, recht: 'tenant:read' },
    // Arbeitsraum «Projekte»: Meine Projekte mit der Projektakte (UI-05, UI-06; Projektrollen sehen nur ihre Projekte)
    { raum: 'projekte', pfad: '/projekte', label: projektTexte.bereich, recht: 'projekt:read' },
    // Arbeitsraum «Gremien»: Sitzungen vorbereiten (UI-33, UC-006, AP-E2-1); Entscheide und Jahresrückblick folgen
    { raum: 'gremien', pfad: '/gremien/sitzungen', label: sitzungTexte.bereich, recht: 'sitzung:read' },
    // Arbeitsraum «Ziele»: bis zum Zielzyklus (Etappe E6) nur die Handlungsfelder (BC ZM.01.01)
    // Zielzyklus des Folgejahres (UC-011 Schritt 1, K6; AP-E6-1); andere Jahre über den Kopf der Seite
    { raum: 'ziele', pfad: `/ziele/${new Date().getFullYear() + 1}`, label: zielzyklusTexte.bereich, recht: 'ziel:read' },
    // Arbeitsraum «Ziele»: Handlungsfelder (BC ZM.01.01)
    { raum: 'ziele', pfad: '/ziele/handlungsfelder', label: T.bereich.handlungsfelder, recht: 'handlungsfeld:read' },
    // Strategische Ziele je Handlungsfeld (BC ZM.01.02, AP-E0-9)
    { raum: 'ziele', pfad: '/ziele/strategische-ziele', label: zieleTexte.bereich, recht: 'ziel:read' },
    // Arbeitsraum «Administration»: Organisation und Codetabellen (UI-44, UI-45; UC-017) sieht nur, wer sie pflegt (IA:
    // Administration nur ADM; lesen dürfen alle Rollen für Auswahllisten); die Verwalten-Seiten des Baukastens kommen nach
    // Recht aus `useIamNav()` dazu (UC-016)
    { raum: 'administration', pfad: '/administration/organisation', label: TS.bereich.organisation, recht: 'stammdaten:write' },
    { raum: 'administration', pfad: '/administration/codetabellen', label: TS.bereich.codetabellen, recht: 'stammdaten:write' },
    // Arbeitsraum «Administration»: Phasenmodell (UI-46, AM.02.03) nur für wer es pflegt (IA: UE, PMO, ADM); lesen dürfen
    // alle Rollen (fachmodell.md 3.3), die Administration erscheint dafür aber nicht. Die Verwalten-Seiten des Baukastens
    // kommen nach Recht aus `useIamNav()` dazu (UC-016)
    { raum: 'administration', pfad: '/administration/phasenmodell', label: T.bereich.phasenmodell, recht: 'phasenmodell:write' },
    // Portfolios und Gremien (UI-47): sichtbar für UE, PMO und ADM (IA «Sichtbarkeit je Rolle»: Recht portfolio:admin)
    { raum: 'administration', pfad: '/administration/portfolios', label: portfoliosTexte.bereich, recht: 'portfolio:admin' },
  ],
  aktionen: [
    { id: 'einheit-anlegen', label: TS.aktion.einheitAnlegen, icon: 'plus', pfad: '/administration/organisation?o=neu', recht: 'stammdaten:write' },
    { id: 'feiertag-erfassen', label: TS.aktion.feiertagErfassen, icon: 'plus', pfad: '/administration/organisation?ansicht=feiertage&o=neu', recht: 'stammdaten:write' },
    // Befehlspalette «Stellvertretung erfassen» (IA «Navigation», UC-016 Schritt 4)
    { id: 'stellvertretung-erfassen', label: kontoTexte.erfassen, icon: 'users', pfad: '/konto/stellvertretung?o=neu', recht: 'tenant:read' },
    { id: 'portfolio-anlegen', label: portfoliosTexte.aktionAnlegen, icon: 'plus', pfad: '/administration/portfolios?o=neu', recht: 'portfolio:admin' },
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
    {
      id: 'strategische-ziele', recht: 'ziel:read',
      suchen: async (q, signal) => (await sucheZiele(q, signal)).map(z => ({
        id: `ziel:${z.nummer}`, label: `${z.nummer} ${z.text}`, detail: zieleTexte.bereich, icon: 'target', pfad: `/ziele/strategische-ziele?o=${zielO(z.nummer)}`,
      })),
    },
  ],
};

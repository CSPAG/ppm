/**
 * Registrierung der Navigation (docs/oberflaeche.md «Navigation»): Hier trägt jedes Feature ein, in welchem Arbeitsraum
 * seine Bereiche liegen, welche Aktionen und Suchen es der Befehlspalette gibt und mit welchem Recht. Die Shell
 * (`shell/nav.ts`) blendet aus, was die Person nicht darf, und Arbeitsräume ohne sichtbaren Bereich (I-N2).
 */
import { berichtTexte, laufendePeriode } from './features/bericht/index.ts';
import { anzahlOffen, eingangTexte } from './features/eingang/index.ts';
import { sucheHandlungsfelder } from './features/handlungsfeld/index.ts';
import { portfoliosTexte } from './features/portfolios/index.ts';
import { zugangTexte } from './features/zugang/index.ts';
import { projektTexte, sucheProjekte } from './features/projekt/index.ts';
import { sitzungsmodusTexte, sitzungTexte } from './features/sitzung/index.ts';
import { ideeNeuPfad, ideeTexte } from './features/idee/index.ts';
import { ressourcenPfad, ressourcenTexte } from './features/ressourcen/index.ts';
import { priorisierungPfad, priorisierungTexte } from './features/priorisierung/index.ts';
import { dashboardTexte } from './features/dashboard/index.ts';
import { monatsabschlussTexte } from './features/monatsabschluss/index.ts';
import { stammdatenTexte as TS, sucheOrgEinheiten } from './features/stammdaten/index.ts';
import { vorlagenTexte } from './features/vorlagen/index.ts';
import { kontoTexte } from './features/konto/index.ts';
import { roadmapTexte, sucheZiele, zielerreichungTexte, zieleTexte, zielO, zielzyklusTexte } from './features/ziele/index.ts';
import type { NavRegistrierung } from './shell/index.ts';
import { T } from './ui/index.ts';

export const navigation: NavRegistrierung = {
  bereiche: [
    // Arbeitsraum «Eingang»: Startseite jeder Rolle (UI-01, UX-E3); jede Rolle enthält tenant:read (fachmodell.md 3.3)
    { raum: 'eingang', pfad: '/eingang', label: eingangTexte.titel, recht: 'tenant:read' },
    // Arbeitsraum «Projekte»: Meine Projekte mit der Projektakte (UI-05, UI-06; Projektrollen sehen nur ihre Projekte)
    { raum: 'projekte', pfad: '/projekte', label: projektTexte.bereich, recht: 'projekt:read' },
    // Arbeitsraum «Gremien»: Sitzungen vorbereiten (UI-33, UC-006, AP-E2-1); Jahresrückblick folgt
    { raum: 'gremien', pfad: '/gremien/sitzungen', label: sitzungTexte.bereich, recht: 'sitzung:read' },
    // Entscheide und Auflagen (UI-36, UC-006 A3, AP-E2-2)
    { raum: 'gremien', pfad: '/gremien/entscheide', label: sitzungsmodusTexte.entscheide, recht: 'sitzung:read' },
    // Arbeitsraum «Portfolio» › Dashboard (UI-17, PC.04.01; AP-E1-3): erster Bereich des Portfolios (IA)
    { raum: 'portfolio', pfad: '/portfolio/dashboard', label: dashboardTexte.bereich, recht: 'auswertung:read' },
    // Arbeitsraum «Portfolio» › Ideen (K4, AP-E4-1): alle Mitglieder reichen Ideen ein (A-46); Pool der UE folgt (AP-E4-2)
    { raum: 'portfolio', pfad: '/portfolio/ideen', label: ideeTexte.bereich, recht: ['idee:create', 'idee:read'] },
    // Zielzyklus des Folgejahres (UC-011 Schritt 1, K6; AP-E6-1); andere Jahre über den Kopf der Seite
    { raum: 'ziele', pfad: `/ziele/${new Date().getFullYear() + 1}`, label: zielzyklusTexte.bereich, recht: 'ziel:read', muster: /^\/ziele\/\d{4}\/?$/ },
    // Arbeitsraum «Ziele»: Handlungsfelder (BC ZM.01.01)
    { raum: 'ziele', pfad: '/ziele/handlungsfelder', label: T.bereich.handlungsfelder, recht: 'handlungsfeld:read' },
    // Strategische Ziele je Handlungsfeld (BC ZM.01.02, AP-E0-9)
    { raum: 'ziele', pfad: '/ziele/strategische-ziele', label: zieleTexte.bereich, recht: 'ziel:read' },
    // Zielerreichung je Quartal (BC ZM.03.01, AP-E6-3); führt ins zuletzt abgeschlossene Quartal
    { raum: 'ziele', pfad: '/ziele/zielerreichung', label: zielerreichungTexte.bereich, recht: 'ziel:read', muster: /^\/ziele\/\d{4}\/zielerreichung\/?$/ },
    // Arbeitsraum «Portfolio»: Ressourcen mit Auslastung und Kapazität (BC RK.01.01, RK.02.04, AP-E5-4)
    // Priorisierung mit Bewertung und Modell (BC PP.01.02, PP.01.03, PP.02.01, AP-E5-1); Gremium mit Recht am Portfolio
    { raum: 'portfolio', pfad: '/portfolio/priorisierung', label: priorisierungTexte.bereich, recht: 'priorisierung:read' },
    { raum: 'portfolio', pfad: '/portfolio/ressourcen', label: ressourcenTexte.bereich, recht: 'ressource:read' },
    // Arbeitsraum «Portfolio»: Monatsabschluss der Unternehmensentwicklung (UI-15, UI-16; K1, UC-005; AP-E1-2)
    // Portfolio › Auswertungen › Roadmap (UI-31, AP-E6-2): sichtbar wie die Auswertungen (auswertung:read; IA «Sichtbarkeit je
    // Rolle»: Portfolio nicht für Antragstellende und Leser:innen); lesen über die API dürfen alle Angemeldeten (A-35)
    { raum: 'portfolio', pfad: '/portfolio/roadmap', label: roadmapTexte.bereich, recht: 'auswertung:read' },
    { raum: 'portfolio', pfad: '/portfolio/monatsabschluss', label: monatsabschlussTexte.bereich, recht: 'statusbericht:review' },
    // Arbeitsraum «Administration»: Organisation und Codetabellen (UI-44, UI-45; UC-017) sieht nur, wer sie pflegt (IA:
    // Administration nur ADM; lesen dürfen alle Rollen für Auswahllisten); die Verwalten-Seiten des Baukastens kommen nach
    // Recht aus `useIamNav()` dazu (UC-016)
    { raum: 'administration', pfad: '/administration/organisation', label: TS.bereich.organisation, recht: 'stammdaten:write' },
    { raum: 'administration', pfad: '/administration/codetabellen', label: TS.bereich.codetabellen, recht: 'stammdaten:write' },
    // Vorlagen (UI-48, AM.03.01, AP-E7-7): pflegt die UE (vorlage:write)
    { raum: 'administration', pfad: '/administration/vorlagen', label: vorlagenTexte.bereich, recht: 'vorlage:write' },
    // Arbeitsraum «Administration»: Phasenmodell (UI-46, AM.02.03) nur für wer es pflegt (IA: UE, PMO, ADM); lesen dürfen
    // alle Rollen (fachmodell.md 3.3), die Administration erscheint dafür aber nicht. Die Verwalten-Seiten des Baukastens
    // kommen nach Recht aus `useIamNav()` dazu (UC-016)
    { raum: 'administration', pfad: '/administration/phasenmodell', label: T.bereich.phasenmodell, recht: 'phasenmodell:write' },
    // Portfolios und Gremien (UI-47): sichtbar für UE, PMO und ADM (IA «Sichtbarkeit je Rolle»: Recht portfolio:admin)
    { raum: 'administration', pfad: '/administration/portfolios', label: portfoliosTexte.bereich, recht: 'portfolio:admin' },
    // Zugänge entziehen mit Neubesetzung (UC-016 A1): wer Mitglieder verwaltet; die Neubesetzung gehört dazu
    { raum: 'administration', pfad: '/administration/zugaenge', label: zugangTexte.bereich, recht: 'members:admin', muster: /^\/administration\/(zugaenge|neubesetzungen)(\/|$)/ },
  ],
  aktionen: [
    // Befehlspalette «Projektidee einreichen» für alle, die Ideen erfassen (K4 Einstieg)
    { id: 'idee-einreichen', label: ideeTexte.einreichen, icon: 'plus', pfad: ideeNeuPfad(), recht: 'idee:create' },
    { id: 'einheit-anlegen', label: TS.aktion.einheitAnlegen, icon: 'plus', pfad: '/administration/organisation?o=neu', recht: 'stammdaten:write' },
    { id: 'feiertag-erfassen', label: TS.aktion.feiertagErfassen, icon: 'plus', pfad: '/administration/organisation?ansicht=feiertage&o=neu', recht: 'stammdaten:write' },
    // Befehlspalette «Stellvertretung erfassen» (IA «Navigation», UC-016 Schritt 4)
    { id: 'stellvertretung-erfassen', label: kontoTexte.erfassen, icon: 'users', pfad: '/konto/stellvertretung?o=neu', recht: 'tenant:read' },
    { id: 'zugang-entziehen', label: zugangTexte.aktionEntziehen, icon: 'user', pfad: '/administration/zugaenge?o=entziehen', recht: 'members:admin' },
    { id: 'portfolio-anlegen', label: portfoliosTexte.aktionAnlegen, icon: 'plus', pfad: '/administration/portfolios?o=neu', recht: 'portfolio:admin' },
    { id: 'handlungsfeld-anlegen', label: T.aktion.handlungsfeldAnlegen, icon: 'plus', pfad: '/ziele/handlungsfelder?o=neu', recht: 'handlungsfeld:write' },
    { id: 'ziel-anlegen', label: zieleTexte.aktionAnlegen, icon: 'plus', pfad: '/ziele/strategische-ziele?o=neu', recht: 'ziel:write' },
    { id: 'projekte-bewerten', label: priorisierungTexte.aktionBewerten, icon: 'layers', pfad: priorisierungPfad.bewertung, recht: 'priorisierung:write' },
    { id: 'bewertungsmodell', label: priorisierungTexte.aktionModell, icon: 'rules', pfad: priorisierungPfad.modell, recht: 'priorisierung:write' },
    { id: 'auslastung-analysieren', label: ressourcenTexte.aktionAuslastung, icon: 'grid', pfad: ressourcenPfad.auslastung, recht: 'ressource:read' },
    { id: 'kapazitaet-planen', label: ressourcenTexte.aktionKapazitaet, icon: 'calendar', pfad: ressourcenPfad.kapazitaet, recht: 'ressource:write' },
  ],
  // Zähler offener Aufgaben an «Eingang» (I-N3); jede Rolle enthält tenant:read
  zaehler: [{ raum: 'eingang', recht: 'tenant:read', queryKey: anzahlOffen.queryKey, laden: anzahlOffen.laden, text: eingangTexte.zaehler }],
  // Kontomenü und «Mehr»: Profil und Stellvertretung (UI-43, UC-016 Schritt 4)
  konto: [{ id: 'stellvertretung', label: kontoTexte.titel, icon: 'users', pfad: '/konto/stellvertretung', recht: 'tenant:read' }],
  suchen: [
    // «Statusbericht erstellen» mit Projektwahl (K1 Einstieg Befehlspalette): Bericht der laufenden Periode
    {
      id: 'statusbericht', recht: 'statusbericht:write',
      suchen: async (q, signal) => (await sucheProjekte(q, signal)).filter(p => p.lebenszyklus === 'aktiv' && p.phase !== 'P4').map(p => ({
        id: `statusbericht:${p.id}`, label: berichtTexte.palette(p.nummer, p.name), detail: berichtTexte.reiter, icon: 'doc', pfad: `/projekte/${p.nummer}/bericht?periode=${laufendePeriode()}`,
      })),
    },
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

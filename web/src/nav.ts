/**
 * Registrierung der Navigation (docs/oberflaeche.md «Navigation»): Hier trägt jedes Feature ein, in welchem Arbeitsraum
 * seine Bereiche liegen, welche Aktionen und Suchen es der Befehlspalette gibt und mit welchem Recht. Die Shell
 * (`shell/nav.ts`) blendet aus, was die Person nicht darf, und Arbeitsräume ohne sichtbaren Bereich (I-N2).
 */
import { abschlussNav } from './features/abschluss/index.ts';
import { berichtNav, laufendePeriode } from './features/bericht/index.ts';
import { anzahlOffen, eingangNav } from './features/eingang/index.ts';
import { sucheHandlungsfelder } from './features/handlungsfeld/index.ts';
import { portfoliosNav } from './features/portfolios/index.ts';
import { suchePersonen, zugangNav } from './features/zugang/index.ts';
import { projektNav, sucheProjekte, sucheProjektPersonen } from './features/projekt/index.ts';
import { naechsteSitzungPfad, sitzungNav } from './features/sitzung/index.ts';
import { jahresrueckblickNav } from './features/jahresrueckblick/index.ts';
import { ideeNav, ideeNeuPfad, sucheIdeen } from './features/idee/index.ts';
import { ressourcenPfad, ressourcenTexte } from './features/ressourcen/index.ts';
import { finanzenPfad, finanzenTexte } from './features/finanzen/index.ts';
import { priorisierungPfad, priorisierungTexte } from './features/priorisierung/index.ts';
import { dashboardNav } from './features/dashboard/index.ts';
import { monatsabschlussNav } from './features/monatsabschluss/index.ts';
import { stammdatenNav as TS, sucheOrgEinheiten } from './features/stammdaten/index.ts';
import { vorlagenNav } from './features/vorlagen/index.ts';
import { vertragNav } from './features/vertrag/index.ts';
import { kontoNav } from './features/konto/index.ts';
import { schnittstellenNav as TX } from './features/schnittstellen/index.ts';
import { sucheZiele, zieleNav, zielO } from './features/ziele/index.ts';
import type { NavRegistrierung } from './shell/index.ts';
import { T } from './ui/index.ts';

export const navigation: NavRegistrierung = {
  bereiche: [
    // Arbeitsraum «Eingang»: Startseite jeder Rolle (UI-01, UX-E3); jede Rolle enthält tenant:read (fachmodell.md 3.3)
    { raum: 'eingang', pfad: '/eingang', label: eingangNav.titel, recht: 'tenant:read' },
    // Arbeitsraum «Projekte»: Meine Projekte mit der Projektakte (UI-05, UI-06; Projektrollen sehen nur ihre Projekte)
    { raum: 'projekte', pfad: '/projekte', label: projektNav.bereich, recht: 'projekt:read' },
    // Arbeitsraum «Gremien»: Sitzungen vorbereiten (UI-33, UC-006, AP-E2-1)
    { raum: 'gremien', pfad: '/gremien/sitzungen', label: sitzungNav.bereich, recht: 'sitzung:read', muster: /^\/gremien\/(sitzungen|(?!(entscheide|jahresrueckblick)\/?$)[a-z0-9][a-z0-9-]*(\/sitzungen.*)?)\/?$/ },
    // Entscheide und Auflagen (UI-36, UC-006 A3, AP-E2-2)
    { raum: 'gremien', pfad: '/gremien/entscheide', label: sitzungNav.entscheide, recht: 'sitzung:read' },
    // Jahresrückblick (UI-37, UC-013, AP-E7-5) für Gremium und UE; führt im Q4 ins laufende Jahr, sonst ins Vorjahr
    { raum: 'gremien', pfad: '/gremien/jahresrueckblick', label: jahresrueckblickNav.bereich, recht: ['sitzung:read', 'quartalsbericht:write'], muster: /^\/gremien\/jahresrueckblick(\/\d{4})?\/?$/ },
    // Arbeitsraum «Portfolio» › Dashboard (UI-17, PC.04.01; AP-E1-3): erster Bereich des Portfolios (IA)
    { raum: 'portfolio', pfad: '/portfolio/dashboard', label: dashboardNav.dashboard, recht: 'auswertung:read', muster: /^\/portfolio\/dashboard\/?$/ },
    // Risikolage (UI-18) und Portfoliobericht (UI-29), AP-E2-3
    { raum: 'portfolio', pfad: '/portfolio/dashboard/risiken', label: dashboardNav.risiken, recht: 'auswertung:read' },
    { raum: 'portfolio', pfad: '/portfolio/auswertungen/portfoliobericht', label: dashboardNav.portfoliobericht, recht: 'auswertung:read' },
    // Lessons Learned (UI-32, PS.04.03; AP-E7-1): sichtbar wie die Auswertungen; Projektrollen sehen sie in der Projektakte
    { raum: 'portfolio', pfad: '/portfolio/auswertungen/lessons-learned', label: abschlussNav.lessons, recht: 'auswertung:read' },
    // Arbeitsraum «Portfolio» › Ideen (K4, AP-E4-1): alle Mitglieder reichen Ideen ein (A-46); Pool der UE folgt (AP-E4-2)
    { raum: 'portfolio', pfad: '/portfolio/ideen', label: ideeNav.bereich, recht: ['idee:create', 'idee:read'] },
    // Zielzyklus des Folgejahres (UC-011 Schritt 1, K6; AP-E6-1); andere Jahre über den Kopf der Seite
    { raum: 'ziele', pfad: `/ziele/${new Date().getFullYear() + 1}`, label: zieleNav.zielzyklus, recht: 'ziel:read', muster: /^\/ziele\/\d{4}\/?$/ },
    // Arbeitsraum «Ziele»: Handlungsfelder (BC ZM.01.01)
    { raum: 'ziele', pfad: '/ziele/handlungsfelder', label: T.bereich.handlungsfelder, recht: 'handlungsfeld:read' },
    // Strategische Ziele je Handlungsfeld (BC ZM.01.02, AP-E0-9)
    { raum: 'ziele', pfad: '/ziele/strategische-ziele', label: zieleNav.ziele, recht: 'ziel:read' },
    // Zielerreichung je Quartal (BC ZM.03.01, AP-E6-3); führt ins zuletzt abgeschlossene Quartal
    { raum: 'ziele', pfad: '/ziele/zielerreichung', label: zieleNav.zielerreichung, recht: 'ziel:read', muster: /^\/ziele\/\d{4}\/zielerreichung\/?$/ },
    // Quartalsreporting an den VR (BC ZM.03.02, AP-E6-4); führt ins zuletzt abgeschlossene Quartal
    { raum: 'ziele', pfad: '/ziele/quartalsreporting', label: zieleNav.quartalsreporting, recht: 'ziel:read', muster: /^\/ziele\/\d{4}\/quartalsreporting\/?$/ },
    // Arbeitsraum «Portfolio»: Ressourcen mit Auslastung und Kapazität (BC RK.01.01, RK.02.04, AP-E5-4)
    // Priorisierung mit Bewertung und Modell (BC PP.01.02, PP.01.03, PP.02.01, AP-E5-1); Gremium mit Recht am Portfolio
    { raum: 'portfolio', pfad: '/portfolio/priorisierung', label: priorisierungTexte.bereich, recht: 'priorisierung:read' },
    { raum: 'portfolio', pfad: '/portfolio/ressourcen', label: ressourcenTexte.bereich, recht: 'ressource:read' },
    // Finanzen (UI-26–UI-28, UC-010, AP-E7-4): Beträge mit finanzen:read (Organisation oder Portfolio, A-33)
    { raum: 'portfolio', pfad: finanzenPfad.uebersicht, label: finanzenTexte.bereich, recht: 'finanzen:read' },
    // Arbeitsraum «Portfolio»: Monatsabschluss der Unternehmensentwicklung (UI-15, UI-16; K1, UC-005; AP-E1-2)
    // Portfolio › Auswertungen › Roadmap (UI-31, AP-E6-2): sichtbar wie die Auswertungen (auswertung:read; IA «Sichtbarkeit je
    // Rolle»: Portfolio nicht für Antragstellende und Leser:innen); lesen über die API dürfen alle Angemeldeten (A-35)
    // Portfolio › Auswertungen (UI-30; PC.04.03, UC-014 A2; AP-E7-6): Ad-hoc-Auswertungen nur für UE und FI; aktiv nur auf
    // der eigenen Adresse, nicht unter dem Portfoliobericht (`/portfolio/auswertungen/portfoliobericht`)
    { raum: 'portfolio', pfad: '/portfolio/auswertungen', label: dashboardNav.auswertungen, recht: 'auswertung:write', muster: /^\/portfolio\/auswertungen\/?$/ },
    { raum: 'portfolio', pfad: '/portfolio/roadmap', label: zieleNav.roadmap, recht: 'auswertung:read' },
    { raum: 'portfolio', pfad: '/portfolio/monatsabschluss', label: monatsabschlussNav.bereich, recht: 'statusbericht:review' },
    // Arbeitsraum «Administration»: Organisation und Codetabellen (UI-44, UI-45; UC-017) sieht nur, wer sie pflegt (IA:
    // Administration nur ADM; lesen dürfen alle Rollen für Auswahllisten); die Verwalten-Seiten des Baukastens kommen nach
    // Recht aus `useIamNav()` dazu (UC-016)
    { raum: 'administration', pfad: '/administration/organisation', label: TS.bereich.organisation, recht: 'stammdaten:write' },
    { raum: 'administration', pfad: '/administration/codetabellen', label: TS.bereich.codetabellen, recht: 'stammdaten:write' },
    // Vorlagen (UI-48, AM.03.01, AP-E7-7): pflegt die UE (vorlage:write)
    { raum: 'administration', pfad: '/administration/vorlagen', label: vorlagenNav.bereich, recht: 'vorlage:write' },
    // Arbeitsraum «Administration»: Phasenmodell (UI-46, AM.02.03) nur für wer es pflegt (IA: UE, PMO, ADM); lesen dürfen
    // alle Rollen (fachmodell.md 3.3), die Administration erscheint dafür aber nicht. Die Verwalten-Seiten des Baukastens
    // kommen nach Recht aus `useIamNav()` dazu (UC-016)
    { raum: 'administration', pfad: '/administration/phasenmodell', label: T.bereich.phasenmodell, recht: 'phasenmodell:write' },
    // Portfolios und Gremien (UI-47): sichtbar für UE, PMO und ADM (IA «Sichtbarkeit je Rolle»: Recht portfolio:admin)
    { raum: 'administration', pfad: '/administration/portfolios', label: portfoliosNav.bereich, recht: 'portfolio:admin' },
    // Schnittstellen (UI-49, AM.03.02) nur ADM (schnittstelle:admin); Änderungsprotokoll (UI-50, AM.03.03) ADM und UE (audit:read)
    { raum: 'administration', pfad: '/administration/schnittstellen', label: TX.bereich.schnittstellen, recht: 'schnittstelle:admin' },
    { raum: 'administration', pfad: '/administration/aenderungsprotokoll', label: TX.bereich.protokoll, recht: 'audit:read' },
    // Zugänge entziehen mit Neubesetzung (UC-016 A1): wer Mitglieder verwaltet; die Neubesetzung gehört dazu
    { raum: 'administration', pfad: '/administration/zugaenge', label: zugangNav.bereich, recht: 'members:admin', muster: /^\/administration\/(zugaenge|neubesetzungen)(\/|$)/ },
  ],
  aktionen: [
    // Befehlspalette «Projektidee einreichen» für alle, die Ideen erfassen (K4 Einstieg)
    { id: 'idee-einreichen', label: ideeNav.einreichen, icon: 'plus', pfad: ideeNeuPfad(), recht: 'idee:create' },
    { id: 'einheit-anlegen', label: TS.aktion.einheitAnlegen, icon: 'plus', pfad: '/administration/organisation?o=neu', recht: 'stammdaten:write' },
    { id: 'feiertag-erfassen', label: TS.aktion.feiertagErfassen, icon: 'plus', pfad: '/administration/organisation?ansicht=feiertage&o=neu', recht: 'stammdaten:write' },
    // «Nächste Sitzung öffnen» (IA «Navigation», K3): Mitglieder sehen Sitzungen über ihr Gremium (Recht irgendwo)
    { id: 'naechste-sitzung', label: sitzungNav.aktionNaechste, icon: 'gavel', pfad: '/gremien/sitzungen', recht: 'sitzung:read', irgendwo: true, ziel: naechsteSitzungPfad },
    // «Dashboard öffnen» (IA «Navigation», UI-17)
    { id: 'dashboard', label: dashboardNav.aktionOeffnen, icon: 'grid', pfad: '/portfolio/dashboard', recht: 'auswertung:read', irgendwo: true },
    // Befehlspalette «Stellvertretung erfassen» (IA «Navigation», UC-016 Schritt 4)
    { id: 'stellvertretung-erfassen', label: kontoNav.erfassen, icon: 'users', pfad: '/konto/stellvertretung?o=neu', recht: 'tenant:read' },
    { id: 'schnittstelle-einrichten', label: TX.aktion.einrichten, icon: 'plug', pfad: '/administration/schnittstellen?o=neu', recht: 'schnittstelle:admin' },
    { id: 'zugang-entziehen', label: zugangNav.aktionEntziehen, icon: 'user', pfad: '/administration/zugaenge?o=entziehen', recht: 'members:admin' },
    { id: 'portfolio-anlegen', label: portfoliosNav.aktionAnlegen, icon: 'plus', pfad: '/administration/portfolios?o=neu', recht: 'portfolio:admin' },
    { id: 'handlungsfeld-anlegen', label: T.aktion.handlungsfeldAnlegen, icon: 'plus', pfad: '/ziele/handlungsfelder?o=neu', recht: 'handlungsfeld:write' },
    { id: 'ziel-anlegen', label: zieleNav.aktionAnlegen, icon: 'plus', pfad: '/ziele/strategische-ziele?o=neu', recht: 'ziel:write' },
    { id: 'projekte-bewerten', label: priorisierungTexte.aktionBewerten, icon: 'layers', pfad: priorisierungPfad.bewertung, recht: 'priorisierung:write' },
    { id: 'bewertungsmodell', label: priorisierungTexte.aktionModell, icon: 'rules', pfad: priorisierungPfad.modell, recht: 'priorisierung:write' },
    { id: 'auslastung-analysieren', label: ressourcenTexte.aktionAuslastung, icon: 'grid', pfad: ressourcenPfad.auslastung, recht: 'ressource:read' },
    { id: 'budget-uebergeben', label: finanzenTexte.aktionBudget, icon: 'download', pfad: finanzenPfad.budgetprozess, recht: 'finanzen:write' },
    { id: 'kapazitaet-planen', label: ressourcenTexte.aktionKapazitaet, icon: 'calendar', pfad: ressourcenPfad.kapazitaet, recht: 'ressource:write' },
  ],
  // Zähler offener Aufgaben an «Eingang» (I-N3); jede Rolle enthält tenant:read
  zaehler: [{ raum: 'eingang', recht: 'tenant:read', queryKey: anzahlOffen.queryKey, laden: anzahlOffen.laden, text: eingangNav.zaehler }],
  // Kontomenü und «Mehr»: Profil und Stellvertretung (UI-43, UC-016 Schritt 4)
  konto: [{ id: 'stellvertretung', label: kontoNav.titel, icon: 'users', pfad: '/konto/stellvertretung', recht: 'tenant:read' }],
  suchen: [
    // «Statusbericht erstellen» mit Projektwahl (K1 Einstieg Befehlspalette): Bericht der laufenden Periode
    {
      id: 'statusbericht', recht: 'statusbericht:write',
      suchen: async (q, signal) => (await sucheProjekte(q, signal)).filter(p => p.lebenszyklus === 'aktiv' && p.phase !== 'P4').map(p => ({
        id: `statusbericht:${p.id}`, label: berichtNav.palette(p.nummer, p.name), detail: berichtNav.reiter, icon: 'doc', pfad: `/projekte/${p.nummer}/bericht?periode=${laufendePeriode()}`,
      })),
    },
    // «Änderung beantragen» mit Projektwahl (IA «Navigation», K2 Einstieg; UC-007): Dialog im Reiter Vertrag, der
    // prüft, ob eine Änderung möglich ist (`can.entwerfen`); laufende Projekte wie im Vertrag (aktiv oder sistiert)
    {
      id: 'aenderung', recht: 'vertrag:write',
      suchen: async (q, signal) => (await sucheProjekte(q, signal)).filter(p => p.lebenszyklus === 'aktiv' || p.lebenszyklus === 'sistiert').map(p => ({
        id: `aenderung:${p.id}`, label: vertragNav.palette(p.nummer, p.name), detail: vertragNav.antrag, icon: 'edit', pfad: `/projekte/${encodeURIComponent(p.nummer)}/vertrag?aenderung=1`,
      })),
    },
    {
      id: 'projekte', recht: 'projekt:read',
      suchen: async (q, signal) => (await sucheProjekte(q, signal)).map(p => ({
        id: `projekt:${p.id}`, label: `${p.nummer} ${p.name}`, detail: projektNav.palette.detail, icon: 'folder', pfad: `/projekte/${p.nummer}`,
      })),
    },
    // Ideen nach Titel oder Nummer (I-N4): eigene für Antragstellende, eingereichte für den Ideenpool
    {
      id: 'ideen', recht: ['idee:create', 'idee:read'],
      suchen: async (q, signal) => (await sucheIdeen(q, signal)).map(i => ({
        id: `idee:${i.id}`, label: `${i.nummer} ${i.titel}`, detail: ideeNav.bereich, icon: 'doc', pfad: `/portfolio/ideen/${i.nummer}`,
      })),
    },
    // Personen nach Name oder E-Mail (I-N4): nur für die Administration (members:admin), Treffer in Verwalten › Mitglieder
    {
      id: 'personen', recht: 'members:admin',
      suchen: async (q, signal) => (await suchePersonen(q, signal)).map(p => ({
        id: `person:${p.id}`, label: p.name || p.email || p.id, detail: [p.email, zugangNav.palette.mitglieder].filter(Boolean).join(' · '), icon: 'user', pfad: '/verwalten/mitglieder',
      })),
    },
    // Personen nach Name für alle mit Leserecht auf Projekte (I-N4, IA «Navigation»): nur Personen mit einer Funktion in
    // Projekten, die die suchende Person sieht, mit dieser Funktion als Kontext und ohne E-Mail; Treffer führt ins Projekt
    {
      id: 'personen-projekte', recht: 'projekt:read',
      suchen: async (q, signal) => (await sucheProjektPersonen(q, signal)).filter(p => p.kontexte.length).map(p => ({
        id: `projekt-person:${p.id}`, label: p.name,
        detail: p.kontexte.map(k => `${projektNav.funktion[k.funktion]} · ${k.nummer}`).join(', '), icon: 'user', pfad: `/projekte/${encodeURIComponent(p.kontexte[0]!.nummer)}`,
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
        id: `ziel:${z.nummer}`, label: `${z.nummer} ${z.text}`, detail: zieleNav.ziele, icon: 'target', pfad: `/ziele/strategische-ziele?o=${zielO(z.nummer)}`,
      })),
    },
  ],
};

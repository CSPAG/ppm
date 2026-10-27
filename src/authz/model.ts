/**
 * Modell der App (Spezifikation identity-kit 7.3 und 8): einzige Quelle für Rechte, Rollen, Scopes und Orte.
 * Daraus entstehen `GET /v1/authz/catalog`, die Prüfungen (`req.need`), die CHECKs der Tupel und die Scopes in
 * `infra/keycloak/platform.json`.
 *
 * Stufe «mittel» (docs/fachmodell.md, Abschnitt 3): Kette `org → portfolio → projekt`. Gremien sind kein eigener Ort,
 * Rechte im Gremium sind Rollen am Portfolio (A-45). Rollen nach den Akteuren (Master §5) und der Sichtbarkeit je Rolle
 * (docs/ux/informationsarchitektur.md). Vollständig für alle Etappen; spätere Pakete ändern nur `mcpTools` (Block je
 * Modul) und `capabilities` (fachmodell.md 7.2).
 *
 * Nach jeder Änderung: `npm run identity:platform-json`.
 */
import { defineModel } from '@vollholz/iam';

/** Grundmenge jeder Rolle (fachmodell.md 3.3). */
const BASIS = ['tenant:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read'] as const;

/** Rechte der UE; PMO hat dieselben (A-42). */
const UE = [
  ...BASIS,
  'projekt:read', 'projekt:write', 'projekt:create', 'projekt:organisation', 'projekt:vertraulich',
  'finanzen:read', 'statusbericht:review', 'periode:close', 'vertrag:review', 'sitzung:read', 'sitzung:write',
  'idee:read', 'idee:write', 'priorisierung:read', 'priorisierung:write', 'ressource:read', 'auswertung:read', 'auswertung:write',
  'ziel:read', 'ziel:freigabe', 'zielerreichung:write', 'quartalsbericht:write', 'phasenmodell:write', 'portfolio:admin',
  'vorlage:write', 'audit:read', 'handlungsfeld:read',
] as const;

export const model = defineModel({
  product: 'ppm',
  permissions: {
    // ZM.01.01
    'handlungsfeld:read': { label: 'Handlungsfelder lesen', group: 'handlungsfelder', description: 'Strategische Handlungsfelder und ihren Verlauf sehen.', resources: ['org'] },
    'handlungsfeld:write': { label: 'Handlungsfelder pflegen', group: 'handlungsfelder', description: 'Strategische Handlungsfelder anlegen und ändern.', resources: ['org'] },
    'handlungsfeld:delete': { label: 'Handlungsfelder löschen', group: 'handlungsfelder', description: 'Strategische Handlungsfelder löschen.', resources: ['org'] },
    // ZM.01.02, ZM.02.01–04, ZM.03.01, ZM.03.02, PP.04.03
    'ziel:read': { label: 'Ziele lesen', group: 'ziele', description: 'Strategische Ziele, Jahresziele und Roadmap sehen.', resources: ['org'] },
    'ziel:write': { label: 'Ziele pflegen', group: 'ziele', description: 'Strategische Ziele, Jahresziele und Hauptaktivitäten erfassen.', resources: ['org'] },
    'ziel:freigabe': { label: 'Ziele freigeben', group: 'ziele', description: 'Freigabe der Jahresziele erfassen und die Roadmap publizieren.', resources: ['org'] },
    'zielerreichung:write': { label: 'Zielerreichung erfassen', group: 'ziele', description: 'Stand der Zielerreichung je Quartal erfassen.', resources: ['org'] },
    'quartalsbericht:write': { label: 'Quartalsreporting erstellen', group: 'ziele', description: 'Quartalsreporting erstellen und traktandieren.', resources: ['org'] },
    // AM.02.01, AM.02.02
    'stammdaten:read': { label: 'Stammdaten lesen', group: 'stammdaten', description: 'Organisationseinheiten, Codetabellen und Feiertage sehen.', resources: ['org'] },
    'stammdaten:write': { label: 'Stammdaten pflegen', group: 'stammdaten', description: 'Organisationseinheiten, Codetabellen und Feiertage pflegen.', resources: ['org'] },
    // AM.02.03
    'phasenmodell:read': { label: 'Phasenmodell lesen', group: 'phasenmodell', description: 'Phasen, Gates, Leitfragen, Fristen und Toleranzen sehen.', resources: ['org'] },
    'phasenmodell:write': { label: 'Phasenmodell pflegen', group: 'phasenmodell', description: 'Entwürfe des Phasenmodells bearbeiten.', resources: ['org'] },
    'phasenmodell:activate': { label: 'Phasenmodell in Kraft setzen', group: 'phasenmodell', description: 'Einen Entwurf des Phasenmodells in Kraft setzen.', resources: ['org'] },
    // AM.02.04
    'portfolio:read': { label: 'Portfolios lesen', group: 'portfolios', description: 'Portfolios, Gremien, Gremienweg und Sitzungstermine sehen.', resources: ['org'] },
    'portfolio:admin': { label: 'Portfolios verwalten', group: 'portfolios', description: 'Portfolios, Gremien, Gremienweg und Sitzungstermine pflegen.', resources: ['org'] },
    // Projekte und ihre Register (PP.04.04, UC-002, UC-004)
    'projekt:read': { label: 'Projekte lesen', group: 'projekte', description: 'Projekte und ihre Register sehen.', resources: ['org', 'portfolio', 'projekt'] },
    'projekt:write': { label: 'Projekte pflegen', group: 'projekte', description: 'Angaben und Register eines Projekts pflegen.', resources: ['org', 'projekt'] },
    'projekt:create': { label: 'Projekte anlegen', group: 'projekte', description: 'Projekte anlegen (Übernahme, Initialisierung).', resources: ['org', 'portfolio'] },
    'projekt:organisation': { label: 'Projektorganisation festlegen', group: 'projekte', description: 'Sponsor, Projektleitung, Controlling und Kernteam eines Projekts festlegen.', resources: ['org', 'projekt'] },
    'projekt:vertraulich': { label: 'Vertrauliche Projekte sehen', group: 'projekte', description: 'Als vertraulich gekennzeichnete Projekte sehen (A-34).', resources: ['org', 'portfolio'] },
    // UX-OF-12 (A-33), UC-010
    'finanzen:read': { label: 'Beträge sehen', group: 'finanzen', description: 'Budget, Prognose und Ist-Kosten der Projekte sehen.', resources: ['org', 'portfolio', 'projekt'] },
    'finanzen:write': { label: 'Finanzen pflegen', group: 'finanzen', description: 'Ist-Kosten, Begründungen von Abweichungen und Budgetübergabe pflegen.', resources: ['org'] },
    // PS.01.01–03, UC-005, PC.03.03
    'statusbericht:write': { label: 'Statusberichte erstellen', group: 'berichte', description: 'Statusberichte eines Projekts erfassen und einreichen.', resources: ['org', 'projekt'] },
    'statusbericht:review': { label: 'Statusberichte prüfen', group: 'berichte', description: 'Eingereichte Statusberichte prüfen und Rückfragen stellen.', resources: ['org', 'portfolio'] },
    'periode:close': { label: 'Monat abschliessen', group: 'berichte', description: 'Die Berichtsperiode abschliessen.', resources: ['org'] },
    'kpi:write': { label: 'KPI-Werte erfassen', group: 'berichte', description: 'Werte der KPIs eines Projekts erfassen.', resources: ['org', 'projekt'] },
    // DM.02.01–07, PS.02.01, PS.02.05, PS.03.01, PS.03.02
    'vertrag:write': { label: 'Projektverträge bearbeiten', group: 'vertraege', description: 'Projektvertrag, Gate-Antrag und Änderungsantrag bearbeiten und einreichen.', resources: ['org', 'projekt'] },
    'vertrag:review': { label: 'Quality-Check durchführen', group: 'vertraege', description: 'Eingereichte Projektverträge prüfen (Quality-Check).', resources: ['org'] },
    'vertrag:sign': { label: 'Projektverträge unterzeichnen', group: 'vertraege', description: 'Projektverträge unterzeichnen oder die Unterschrift verweigern.', resources: ['org', 'projekt'] },
    'vertrag:decide': { label: 'Über Verträge entscheiden', group: 'vertraege', description: 'Vertragsentwürfe zurückziehen und über Änderungen entscheiden.', resources: ['org', 'projekt'] },
    // UC-006
    'sitzung:read': { label: 'Sitzungen lesen', group: 'gremien', description: 'Sitzungen der Gremien und ihre Unterlagen ab Versand sehen.', resources: ['org', 'portfolio'] },
    'sitzung:write': { label: 'Sitzungen vorbereiten', group: 'gremien', description: 'Sitzungen vorbereiten, Entscheide erfassen und das Protokoll versenden.', resources: ['org', 'portfolio'] },
    // UC-001
    'idee:create': { label: 'Ideen erfassen', group: 'ideen', description: 'Eigene Projektideen erfassen und einreichen.', resources: ['org'] },
    'idee:read': { label: 'Ideenpool lesen', group: 'ideen', description: 'Alle Projektideen im Ideenpool sehen.', resources: ['org', 'portfolio'] },
    'idee:write': { label: 'Ideen prüfen', group: 'ideen', description: 'Projektideen prüfen, ergänzen lassen, zusammenführen und zurückweisen.', resources: ['org'] },
    'idee:decide': { label: 'Initialisierung freigeben', group: 'ideen', description: 'Die Initialisierung einer Idee der Kategorie C freigeben.', resources: ['org', 'portfolio'] },
    // UC-008
    'priorisierung:read': { label: 'Priorisierung lesen', group: 'priorisierung', description: 'Bewertungen, Matrix, Rangfolge und Szenarien sehen.', resources: ['org', 'portfolio'] },
    'priorisierung:write': { label: 'Priorisieren', group: 'priorisierung', description: 'Bewertungsmodell, Bewertungen, Rangfolge und Szenarien pflegen.', resources: ['org'] },
    // UC-009, RK.02.04
    'ressource:read': { label: 'Ressourcen lesen', group: 'ressourcen', description: 'Kapazität, Bedarf und Auslastung sehen.', resources: ['org'] },
    'ressource:write': { label: 'Ressourcen planen', group: 'ressourcen', description: 'Kapazität pflegen und Bedarf zuteilen.', resources: ['org'] },
    // UC-014
    'auswertung:read': { label: 'Auswertungen lesen', group: 'auswertungen', description: 'Dashboard, Risikolage und Portfoliobericht sehen.', resources: ['org', 'portfolio'] },
    'auswertung:write': { label: 'Auswertungen erstellen', group: 'auswertungen', description: 'Portfoliobericht und Ad-hoc-Auswertungen erstellen.', resources: ['org'] },
    // AM.03.01, AM.03.02
    'vorlage:write': { label: 'Vorlagen pflegen', group: 'vorlagen', description: 'Vorlagen und ihre Feldzuordnung pflegen.', resources: ['org'] },
    'schnittstelle:admin': { label: 'Schnittstellen verwalten', group: 'schnittstellen', description: 'Schnittstellen zu Umsystemen einrichten und Läufe starten.', resources: ['org'], scope: false },
    'webhook:admin': { label: 'Webhooks verwalten', group: 'webhooks', description: 'Webhooks der Organisation anlegen und löschen.', resources: ['org'], scope: false },
  },
  groups: [
    { key: 'handlungsfelder', label: 'Handlungsfelder', match: 'handlungsfeld' },
    { key: 'ziele', label: 'Ziele', match: 'ziel' },
    { key: 'stammdaten', label: 'Stammdaten', match: 'stammdaten' },
    { key: 'phasenmodell', label: 'Phasenmodell', match: 'phasenmodell' },
    { key: 'portfolios', label: 'Portfolios', match: 'portfolio' },
    { key: 'projekte', label: 'Projekte', match: 'projekt' },
    { key: 'finanzen', label: 'Finanzen', match: ['beträge', 'finanzen'] },
    { key: 'berichte', label: 'Berichte', match: 'bericht' },
    { key: 'vertraege', label: 'Verträge', match: 'vertr' },
    { key: 'gremien', label: 'Gremien', match: ['sitzung', 'gremi'] },
    { key: 'ideen', label: 'Ideen', match: 'idee' },
    { key: 'priorisierung', label: 'Priorisierung', match: 'priorisier' },
    { key: 'ressourcen', label: 'Ressourcen', match: 'ressource' },
    { key: 'auswertungen', label: 'Auswertungen', match: 'auswertung' },
    { key: 'vorlagen', label: 'Vorlagen', match: 'vorlage' },
    { key: 'schnittstellen', label: 'Schnittstellen', match: 'schnittstelle' },
    { key: 'webhooks', label: 'Webhooks', match: 'webhook' },
  ],
  roles: {
    // Rollen an der Organisation (Akteure Master §5; ADM = org-admin aus dem Paket)
    ue: {
      label: 'Programmleitung (UE)',
      description: 'Steuert das Portfolio: Projekte, Beträge, Berichte prüfen und Monat abschliessen, Verträge prüfen, Sitzungen, Ideen, Priorisierung, Ressourcen und Auswertungen lesen, Ziele freigeben, Phasenmodell und Portfolios pflegen, Vorlagen, Protokoll, Handlungsfelder, Stammdaten lesen.',
      permissions: UE,
    },
    pmo: {
      label: 'PMO',
      description: 'Wie die Programmleitung (A-42): Projekte, Beträge, Berichte, Verträge, Sitzungen, Ideen, Priorisierung, Ressourcen, Auswertungen, Ziele, Phasenmodell, Portfolios, Vorlagen, Protokoll, Handlungsfelder, Stammdaten lesen.',
      permissions: UE,
    },
    gl: {
      label: 'Geschäftsleitung',
      description: 'Pflegt Handlungsfelder und Ziele, liest Projekte, Beträge (A-41), Sitzungen und Auswertungen; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'ziel:read', 'ziel:write', 'zielerreichung:write', 'handlungsfeld:read', 'handlungsfeld:write', 'handlungsfeld:delete',
        'projekt:read', 'auswertung:read', 'finanzen:read', 'sitzung:read'],
    },
    fi: {
      label: 'Finanzen (FI)',
      description: 'Pflegt Finanzen und Auswertungen, liest Projekte und Ziele; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'ziel:read', 'projekt:read', 'finanzen:read', 'finanzen:write', 'auswertung:read', 'auswertung:write'],
    },
    rm: {
      label: 'Ressourcenmanagement (RM)',
      description: 'Plant Ressourcen, liest Projekte, Auswertungen und Ziele; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'ziel:read', 'projekt:read', 'ressource:read', 'ressource:write', 'auswertung:read'],
    },
    antragsteller: {
      label: 'Antragsteller:in',
      description: 'Erfasst eigene Ideen (A-46: alle Mitglieder); Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'idee:create'],
    },
    leser: {
      label: 'Leser:in',
      description: 'Liest Handlungsfelder und Ziele; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'handlungsfeld:read', 'ziel:read'],
    },
    // Rollen am Portfolio (Gremium: PRAT, GLPA; Direktion bei Kategorie C; A-45)
    gremium: {
      label: 'Gremium',
      description: 'Mitglied des entscheidenden Gremiums: liest Projekte (auch vertrauliche), Beträge, Sitzungen, Ideen, Priorisierung, Auswertungen und Ziele des Portfolios; Stammdaten und Phasenmodell lesen.',
      permissions: [...BASIS, 'ziel:read', 'projekt:read', 'projekt:vertraulich', 'finanzen:read', 'sitzung:read', 'idee:read', 'priorisierung:read', 'auswertung:read'],
    },
    direktion: {
      label: 'Direktion',
      description: 'Direktion eines Portfolios der Kategorie C: legt Projekte an, liest Beträge, Ideen, Auswertungen und Ziele, gibt die Initialisierung von Ideen frei; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'ziel:read', 'projekt:read', 'projekt:create', 'finanzen:read', 'idee:read', 'idee:decide', 'auswertung:read'],
    },
    // Rollen am Projekt (Projektorganisation PP.04.04, setzt das Modul projekt)
    sp: {
      label: 'Sponsor:in (SP)',
      description: 'Liest das Projekt und Beträge, legt die Projektorganisation fest, unterzeichnet Verträge und entscheidet über Änderungen; Ziele, Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'ziel:read', 'projekt:read', 'projekt:organisation', 'finanzen:read', 'vertrag:sign', 'vertrag:decide'],
    },
    pl: {
      label: 'Projektleitung (PL)',
      description: 'Pflegt das Projekt und die Projektorganisation, sieht Beträge, erstellt Statusberichte und KPI-Werte, bearbeitet und unterzeichnet Verträge; Ziele, Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'ziel:read', 'projekt:read', 'projekt:write', 'projekt:organisation', 'finanzen:read', 'statusbericht:write', 'kpi:write', 'vertrag:write', 'vertrag:sign'],
    },
    ctl: {
      label: 'Controlling (CTL)',
      description: 'Liest das Projekt und Beträge, erfasst KPI-Werte für Berichte und unterzeichnet Verträge; Ziele, Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'ziel:read', 'projekt:read', 'finanzen:read', 'kpi:write', 'vertrag:sign'],
    },
    kt: {
      label: 'Kernteam (KT)',
      description: 'Liest das Projekt ohne Beträge; Ziele, Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'ziel:read', 'projekt:read'],
    },
  },
  // Lesende Scopes: alle *:read ausser Beträgen (finanzen:read); handlungsfeld:write besteht (fachmodell.md 3.3)
  scopes: {
    'ppm:read': {
      text: 'PPM lesen',
      permissions: ['tenant:read', 'handlungsfeld:read', 'ziel:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read', 'projekt:read',
        'sitzung:read', 'idee:read', 'priorisierung:read', 'ressource:read', 'auswertung:read'],
    },
    'handlungsfeld:write': { text: 'Handlungsfelder pflegen', permissions: ['handlungsfeld:write', 'handlungsfeld:delete'] },
  },
  types: {
    // Rollen an der Organisation begrenzt: Portfolio- und Projektrollen gelten nur an ihrem Ort (fachmodell.md 3.3)
    org: { label: 'Organisation', roles: ['ue', 'pmo', 'gl', 'fi', 'rm', 'antragsteller', 'leser'] },
    portfolio: { label: 'Portfolio', parent: 'org', roles: ['gremium', 'direktion'], read: 'projekt:read' },
    projekt: { label: 'Projekt', parent: 'portfolio', roles: ['pl', 'ctl', 'sp', 'kt'], leaf: true, read: 'projekt:read', write: 'projekt:write' },
  },
  mcpTools: {
    // stammdaten
    list_org_einheiten: { title: 'Organisationseinheiten auflisten', permission: 'stammdaten:read', readOnly: true },
    // eingang
    list_aufgaben: { title: 'Aufgaben auflisten', permission: 'tenant:read', readOnly: true },
    // handlungsfeld
    list_handlungsfelder: { title: 'Handlungsfelder auflisten', permission: 'handlungsfeld:read', readOnly: true },
    get_handlungsfeld: { title: 'Handlungsfeld lesen', permission: 'handlungsfeld:read', readOnly: true },
    // portfolio
    list_portfolios: { title: 'Portfolios mit Gremien und Gremienweg auflisten', permission: 'portfolio:read', readOnly: true },
    // ziel
    list_ziele: { title: 'Strategische Ziele auflisten', permission: 'ziel:read', readOnly: true },
    // phasenmodell
    get_phasenmodell: { title: 'Phasenmodell lesen', permission: 'phasenmodell:read', readOnly: true },
    // projekt
    list_projekte: { title: 'Projekte auflisten', permission: 'projekt:read', readOnly: true },
    get_projekt: { title: 'Projekt lesen', permission: 'projekt:read', readOnly: true },
    // sitzung
    list_sitzungen: { title: 'Sitzungen eines Gremiums auflisten', permission: 'sitzung:read', readOnly: true },
    get_sitzung: { title: 'Sitzung mit Traktandenliste lesen', permission: 'sitzung:read', readOnly: true },
  },
  capabilities: {
    // projekt: Fähigkeiten `can` je Projekt (Projekt ändern, Projektorganisation festlegen)
    projekt: { write: 'projekt:write', organisation: 'projekt:organisation' },
  },
  features: { audit: true },
});

export type Permission = (typeof model.permissions)[number];

/**
 * Modell der App (Spezifikation identity-kit 7.3 und 8): einzige Quelle für Rechte, Rollen, Scopes und Orte.
 * Daraus entstehen `GET /v1/authz/catalog`, die Prüfungen (`req.need`), die CHECKs der Tupel und die Scopes in
 * `infra/keycloak/platform.json`.
 *
 * Stufe «mittel» (docs/fachmodell.md, Abschnitt 3): Kette `org → portfolio → projekt`. Gremien sind kein eigener Ort,
 * Rechte im Gremium sind Rollen am Portfolio (A-45). Rollen nach Master Entscheid 18 (fachmodell.md 3.3, A-70): steuern
 * und führen je Portfolio und Projekt, dazu Gremium, Mitlesen, Mitglied und die übergreifenden Rollen. Jede Rolle enthält
 * nur Rechte, die an ihrem Ort gelten (ausser der Grundmenge), damit «Recht irgendwo» nur zeigt, was die Person tun kann.
 * Eigene Rollen der Organisation ergänzt der Baukasten zur Laufzeit (iam 5.0). Spätere Pakete ändern nur `mcpTools`
 * (Block je Modul) und `capabilities` (fachmodell.md 7.2).
 *
 * Nach jeder Änderung: `npm run identity:platform-json`.
 */
import { defineModel } from '@vollholz/iam';

/** Grundmenge jeder Rolle (fachmodell.md 3.3). */
const BASIS = ['tenant:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read'] as const;

/**
 * Leserechte von «Alle Portfolios lesen»: alles ausser Ressourcen, weil die Zuteilung einzelner Personen sensibel ist
 * (darstellung.md, Sensible Daten: nur wer Ressourcen plant, die Person selbst und die Projektleitung).
 */
const LESEN = [
  ...BASIS, 'handlungsfeld:read', 'ziel:read', 'projekt:list', 'projekt:read', 'projekt:vertraulich', 'finanzen:read', 'sitzung:read',
  'idee:list', 'idee:read', 'priorisierung:read', 'auswertung:read',
] as const;

/** «Alle Portfolios führen»: alle Fachrechte ausser Stammdaten, Inkraftsetzen des Phasenmodells, Schnittstellen und Webhooks. */
const FUEHREN = [
  ...LESEN, 'ressource:read',
  'handlungsfeld:write', 'handlungsfeld:delete', 'ziel:write', 'ziel:freigabe', 'zielerreichung:write', 'quartalsbericht:write',
  'phasenmodell:write', 'portfolio:admin', 'projekt:write', 'projekt:create', 'projekt:organisation', 'finanzen:write',
  'statusbericht:write', 'statusbericht:review', 'periode:close', 'kpi:write', 'vertrag:write', 'vertrag:review', 'vertrag:sign',
  'vertrag:decide', 'sitzung:write', 'idee:create', 'idee:write', 'idee:decide', 'priorisierung:write', 'ressource:write',
  'auswertung:write', 'vorlage:write', 'access:admin', 'audit:read',
] as const;

/** «Portfolio steuern» (z. B. die Direktion für ihr Portfolio C); Grundlage von «Portfolio führen». */
const PORTFOLIO_STEUERN = [
  ...BASIS, 'projekt:read', 'projekt:vertraulich', 'finanzen:read', 'sitzung:read', 'idee:read', 'idee:decide', 'priorisierung:read',
  'auswertung:read', 'vertrag:sign', 'vertrag:decide',
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
    'projekt:list': { label: 'Projekte auflisten', group: 'projekte', description: 'Kopfdaten aller nicht vertraulichen Projekte sehen (Master Entscheid 14).', resources: ['org'] },
    'projekt:read': { label: 'Projekte lesen', group: 'projekte', description: 'Projekte und ihre Register sehen.', resources: ['org', 'portfolio', 'projekt'] },
    'projekt:write': { label: 'Projekte pflegen', group: 'projekte', description: 'Angaben und Register eines Projekts pflegen.', resources: ['org', 'portfolio', 'projekt'] },
    'projekt:create': { label: 'Projekte anlegen', group: 'projekte', description: 'Projekte anlegen (Übernahme, Initialisierung).', resources: ['org', 'portfolio'] },
    'projekt:organisation': { label: 'Projektorganisation festlegen', group: 'projekte', description: 'Projektorganisation pflegen (Projektergebnis, ohne Wirkung auf den Zugriff).', resources: ['org', 'portfolio', 'projekt'] },
    'projekt:vertraulich': { label: 'Vertrauliche Projekte sehen', group: 'projekte', description: 'Als vertraulich gekennzeichnete Projekte sehen (A-34).', resources: ['org', 'portfolio'] },
    // UX-OF-12 (A-33), UC-010
    'finanzen:read': { label: 'Beträge sehen', group: 'finanzen', description: 'Budget, Prognose und Ist-Kosten der Projekte sehen.', resources: ['org', 'portfolio', 'projekt'] },
    'finanzen:write': { label: 'Finanzen pflegen', group: 'finanzen', description: 'Ist-Kosten, Begründungen von Abweichungen und Budgetübergabe pflegen.', resources: ['org'] },
    // PS.01.01–03, UC-005, PC.03.03
    'statusbericht:write': { label: 'Statusberichte erstellen', group: 'berichte', description: 'Statusberichte eines Projekts erfassen und einreichen.', resources: ['org', 'portfolio', 'projekt'] },
    'statusbericht:review': { label: 'Statusberichte prüfen', group: 'berichte', description: 'Eingereichte Statusberichte prüfen und Rückfragen stellen.', resources: ['org', 'portfolio'] },
    'periode:close': { label: 'Monat abschliessen', group: 'berichte', description: 'Die Berichtsperiode abschliessen.', resources: ['org'] },
    'kpi:write': { label: 'KPI-Werte erfassen', group: 'berichte', description: 'Werte der KPIs eines Projekts erfassen.', resources: ['org', 'portfolio', 'projekt'] },
    // DM.02.01–07, PS.02.01, PS.02.05, PS.03.01, PS.03.02
    'vertrag:write': { label: 'Projektverträge bearbeiten', group: 'vertraege', description: 'Projektvertrag, Gate-Antrag und Änderungsantrag bearbeiten und einreichen.', resources: ['org', 'portfolio', 'projekt'] },
    'vertrag:review': { label: 'Quality-Check durchführen', group: 'vertraege', description: 'Eingereichte Projektverträge prüfen (Quality-Check).', resources: ['org'] },
    'vertrag:sign': { label: 'Projektverträge unterzeichnen', group: 'vertraege', description: 'Projektverträge unterzeichnen oder die Unterschrift verweigern (Vermerk; wer unterzeichnet, bestimmt die Funktion).', resources: ['org', 'portfolio', 'projekt'] },
    'vertrag:decide': { label: 'Über Verträge entscheiden', group: 'vertraege', description: 'Vertragsentwürfe zurückziehen und über Änderungen entscheiden (Vermerk).', resources: ['org', 'portfolio', 'projekt'] },
    // UC-006
    'sitzung:read': { label: 'Sitzungen lesen', group: 'gremien', description: 'Sitzungen der Gremien und ihre Unterlagen ab Versand sehen.', resources: ['org', 'portfolio'] },
    'sitzung:write': { label: 'Sitzungen vorbereiten', group: 'gremien', description: 'Sitzungen vorbereiten, Entscheide erfassen und das Protokoll versenden.', resources: ['org', 'portfolio'] },
    // UC-001
    'idee:create': { label: 'Ideen erfassen', group: 'ideen', description: 'Eigene Projektideen erfassen und einreichen.', resources: ['org'] },
    'idee:list': { label: 'Eingereichte Ideen lesen', group: 'ideen', description: 'Eingereichte Projektideen nach Vorlage lesen, ohne die Prüfung (Master Entscheid 14).', resources: ['org'] },
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
    // Übergreifend an der Organisation (Master Entscheid 18; ADM = org-admin aus dem Paket)
    mitglied: {
      label: 'Mitglied',
      description: 'Alle Mitglieder: lesen Handlungsfelder, Ziele, Stammdaten, Phasenmodell und Portfolios, listen Projekte auf, lesen eingereichte Ideen und erfassen eigene.',
      permissions: [...BASIS, 'handlungsfeld:read', 'ziel:read', 'projekt:list', 'idee:list', 'idee:create'],
    },
    'alle-lesen': {
      label: 'Alle Portfolios lesen',
      description: 'Liest alle Portfolios: Projekte (auch vertrauliche), Beträge, Sitzungen, Ideen, Priorisierung, Auswertungen, Handlungsfelder, Ziele, Stammdaten und Phasenmodell; keine Ressourcenplanung (Personendaten).',
      permissions: LESEN,
    },
    'alle-fuehren': {
      label: 'Alle Portfolios führen',
      description: 'Führt alle Portfolios: Projekte, Beträge und Finanzen, Berichte und Monatsabschluss, Verträge, Sitzungen der Gremien, Ideen, Priorisierung, Ressourcen, Auswertungen, Handlungsfelder und Ziele, Phasenmodell, Portfolios und Vorlagen; Stammdaten lesen, Änderungsprotokoll einsehen, Zugriff verwalten.',
      permissions: FUEHREN,
    },
    // Je Portfolio (Gremium: PRAT, GLPA; Direktion bei Kategorie C; A-45)
    'portfolio-steuern': {
      label: 'Portfolio steuern',
      description: 'Steuert ein Portfolio: liest Projekte (auch vertrauliche), Beträge, Sitzungen, Ideen, Priorisierung, Auswertungen, Stammdaten, Phasenmodell und Portfolios, gibt Initialisierungen frei und vermerkt Entscheide zu Verträgen.',
      permissions: PORTFOLIO_STEUERN,
    },
    'portfolio-fuehren': {
      label: 'Portfolio führen',
      description: 'Führt ein Portfolio: liest Projekte (auch vertrauliche), Beträge, Ideen, Priorisierung, Auswertungen, Stammdaten, Phasenmodell und Portfolios, legt Projekte an und pflegt sie, erstellt und prüft Berichte, bearbeitet Verträge, bereitet Sitzungen vor und verwaltet den Zugriff.',
      permissions: [...PORTFOLIO_STEUERN, 'projekt:create', 'projekt:write', 'projekt:organisation', 'statusbericht:write', 'statusbericht:review',
        'kpi:write', 'vertrag:write', 'sitzung:write', 'access:admin'],
    },
    gremium: {
      label: 'Gremium',
      description: 'Mitglied des entscheidenden Gremiums: liest Projekte (auch vertrauliche), Beträge, Sitzungen, Ideen, Priorisierung und Auswertungen des Portfolios; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'projekt:read', 'projekt:vertraulich', 'finanzen:read', 'sitzung:read', 'idee:read', 'priorisierung:read', 'auswertung:read'],
    },
    // Je Projekt (Zugriff, getrennt von der Projektorganisation; Master Entscheid 16)
    'projekt-steuern': {
      label: 'Projekt steuern',
      description: 'Steuert ein Projekt, z. B. als Projektauftraggeber:in: liest Projekt und Beträge, legt die Projektorganisation mit fest, unterzeichnet Verträge und entscheidet Änderungen als Vermerk; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'projekt:read', 'projekt:organisation', 'finanzen:read', 'vertrag:sign', 'vertrag:decide'],
    },
    'projekt-fuehren': {
      label: 'Projekt führen',
      description: 'Führt ein Projekt, z. B. als Projektleitung oder PMO: pflegt Projekt und Projektorganisation, sieht Beträge, erstellt Berichte und KPI-Werte, bearbeitet und unterzeichnet Verträge, verwaltet den Zugriff; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'projekt:read', 'projekt:write', 'projekt:organisation', 'finanzen:read', 'statusbericht:write', 'kpi:write',
        'vertrag:write', 'vertrag:sign', 'access:admin'],
    },
    'projekt-mitlesen': {
      label: 'Projekt mitlesen',
      description: 'Liest ein Projekt mit Beträgen, z. B. als Kernteam; Stammdaten, Phasenmodell und Portfolios lesen.',
      permissions: [...BASIS, 'projekt:read', 'finanzen:read'],
    },
    // Abgelöst (A-70): an keinem Ort vergebbar und ohne Rechte; bleiben nur, damit der Abgleich der Bedingungen von
    // authz_tuple auf bestehenden Datenbanken gelingt, bevor Migration 420 die Tupel umbenennt. Mit dem nächsten Paket
    // entfernen.
    ...Object.fromEntries((['ue', 'pmo', 'gl', 'fi', 'rm', 'antragsteller', 'leser', 'direktion', 'sp', 'pl', 'ctl', 'kt'] as const)
      .map(k => [k, { label: `Abgelöst (${k})`, description: 'Abgelöste Rolle (Master Entscheid 18); nicht mehr vergebbar.', permissions: ['tenant:read'] as const }])),
  },
  // Lesende Scopes: alle *:read und *:list ausser Beträgen (finanzen:read); handlungsfeld:write besteht (fachmodell.md 3.3)
  scopes: {
    'ppm:read': {
      text: 'PPM lesen',
      permissions: ['tenant:read', 'handlungsfeld:read', 'ziel:read', 'stammdaten:read', 'phasenmodell:read', 'portfolio:read', 'projekt:list',
        'projekt:read', 'sitzung:read', 'idee:list', 'idee:read', 'priorisierung:read', 'ressource:read', 'auswertung:read'],
    },
    'handlungsfeld:write': { text: 'Handlungsfelder pflegen', permissions: ['handlungsfeld:write', 'handlungsfeld:delete'] },
  },
  types: {
    // Rollen an ihren Ort gebunden (fachmodell.md 3.3, Master Entscheid 18)
    org: { label: 'Organisation', roles: ['mitglied', 'alle-lesen', 'alle-fuehren'] },
    portfolio: { label: 'Portfolio', parent: 'org', roles: ['portfolio-steuern', 'portfolio-fuehren', 'gremium'], read: 'projekt:read' },
    projekt: { label: 'Projekt', parent: 'portfolio', roles: ['projekt-steuern', 'projekt-fuehren', 'projekt-mitlesen'], leaf: true, read: 'projekt:read', write: 'projekt:write' },
  },
  mcpTools: {
    // eingang
    list_aufgaben: { title: 'Aufgaben auflisten', permission: 'tenant:read', readOnly: true },
    // stammdaten
    list_org_einheiten: { title: 'Organisationseinheiten auflisten', permission: 'stammdaten:read', readOnly: true },
    // handlungsfeld
    list_handlungsfelder: { title: 'Handlungsfelder auflisten', permission: 'handlungsfeld:read', readOnly: true },
    get_handlungsfeld: { title: 'Handlungsfeld lesen', permission: 'handlungsfeld:read', readOnly: true },
    // phasenmodell
    get_phasenmodell: { title: 'Phasenmodell lesen', permission: 'phasenmodell:read', readOnly: true },
    // projekt
    list_projekte: { title: 'Projekte auflisten', permission: 'projekt:read', readOnly: true },
    get_projekt: { title: 'Projekt lesen', permission: 'projekt:read', readOnly: true },
    // portfolio
    list_portfolios: { title: 'Portfolios mit Gremien und Gremienweg auflisten', permission: 'portfolio:read', readOnly: true },
    // projektdaten
    get_projektdaten: { title: 'Register eines Projekts lesen', permission: 'projekt:read', readOnly: true },
    // vertrag
    get_vertrag: { title: 'Projektvertrag lesen', permission: 'projekt:read', readOnly: true },
    compare_vertrag: { title: 'Vertragsversionen vergleichen', permission: 'projekt:read', readOnly: true },
    // ziel
    list_ziele: { title: 'Strategische Ziele auflisten', permission: 'ziel:read', readOnly: true },
    get_roadmap: { title: 'Portfolio-Roadmap lesen', permission: 'tenant:read', readOnly: true },
    // sitzung
    list_sitzungen: { title: 'Sitzungen eines Gremiums auflisten', permission: 'sitzung:read', readOnly: true },
    get_sitzung: { title: 'Sitzung mit Traktandenliste lesen', permission: 'sitzung:read', readOnly: true },
    list_entscheide: { title: 'Entscheide und Auflagen auflisten', permission: 'sitzung:read', readOnly: true },
    // statusbericht
    list_statusberichte: { title: 'Statusberichte auflisten', permission: 'projekt:read', readOnly: true },
    get_periode: { title: 'Monatsabschluss einer Periode lesen', permission: 'statusbericht:review', readOnly: true },
    // auswertung
    get_dashboard: { title: 'Dashboard der Periode lesen', permission: 'auswertung:read', readOnly: true },
    // ressource
    get_auslastung: { title: 'Auslastung je Rolle und Monat', permission: 'ressource:read', readOnly: true },
    // priorisierung
    get_matrix: { title: 'Portfolio-Matrix lesen', permission: 'priorisierung:read', readOnly: true },
    compare_szenarien: { title: 'Szenarien vergleichen', permission: 'priorisierung:read', readOnly: true },
    // finanzen
    get_finanzen: { title: 'Finanzübersicht lesen', permission: 'finanzen:read', readOnly: true },
    list_bedarfe: { title: 'Bedarfsliste mit Deckung', permission: 'ressource:read', readOnly: true },
    // idee
    list_ideen: { title: 'Projektideen auflisten', permission: 'idee:read', readOnly: true },
    get_idee: { title: 'Projektidee lesen', permission: 'idee:read', readOnly: true },
    // abschluss
    list_lessons_learned: { title: 'Lessons Learned auflisten', permission: 'projekt:read', readOnly: true },
  },
  capabilities: {
    // projekt: Fähigkeiten `can` je Projekt (Projekt ändern, Projektorganisation festlegen)
    projekt: { write: 'projekt:write', organisation: 'projekt:organisation' },
  },
  features: { audit: true },
});

export type Permission = (typeof model.permissions)[number];

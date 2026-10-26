/**
 * Modell der App (Spezifikation 7.3 und 8): einzige Quelle für Rechte, Rollen, Scopes, Orte und MCP-Werkzeuge.
 * Daraus entstehen `GET /v1/authz/catalog`, die Prüfungen (`req.need`), die Fähigkeiten `can`, die CHECKs der Tupel und
 * die Scopes in `infra/keycloak/platform.json`.
 *
 * Nach jeder Änderung: `npm run identity:platform-json` (der Konformitätstest prüft, dass die Datei aktuell ist).
 */
import { defineModel } from '@vollholz/iam';

export const model = defineModel({
  product: 'ppm',
  permissions: {
    'projekt:read': { label: 'Projekte lesen', group: 'projekte', description: 'Projekte und ihren Verlauf sehen.', resources: ['org', 'projekt'] },
    'projekt:write': { label: 'Projekte ändern', group: 'projekte', description: 'Projekte anlegen und ändern.', resources: ['org', 'projekt'] },
    'projekt:delete': { label: 'Projekte löschen', group: 'projekte', description: 'Projekte löschen.', resources: ['org', 'projekt'] },
    'webhook:admin': { label: 'Webhooks verwalten', group: 'integration', description: 'Ausgehende Webhooks einrichten, ändern und löschen.', scope: false },
    'access:admin': { resources: ['org', 'projekt'] },
  },
  groups: [
    { key: 'projekte', label: 'Projekte', match: 'projekt' },
    { key: 'integration', label: 'Integration', match: ['integration', 'webhook'] },
  ],
  roles: {
    editor: {
      label: 'Bearbeiter:in',
      description: 'Liest, ändert und löscht Projekte und gibt Zugriff darauf frei; Organisation lesen.',
      permissions: ['tenant:read', 'projekt:read', 'projekt:write', 'projekt:delete', 'access:admin'],
    },
    viewer: { label: 'Leser:in', description: 'Liest Projekte; Organisation lesen.', permissions: ['tenant:read', 'projekt:read'] },
    auditor: { label: 'Revisor:in', description: 'Liest Projekte und das Protokoll; Organisation lesen.', permissions: ['tenant:read', 'projekt:read', 'audit:read'] },
  },
  scopes: {
    'ppm:read': { text: 'Projekte lesen', permissions: ['tenant:read', 'projekt:read'] },
    'projekt:write': { text: 'Projekte ändern', permissions: ['projekt:write', 'projekt:delete'] },
  },
  types: {
    org: { label: 'Organisation', roles: ['editor', 'viewer', 'auditor'] },
    projekt: { label: 'Projekt', parent: 'org', roles: ['editor', 'viewer'], leaf: true, classified: true, read: 'projekt:read', write: 'projekt:write' },
  },
  capabilities: { projekt: { write: 'projekt:write', delete: 'projekt:delete' } },
  mcpTools: {
    list_projekte: { title: 'Projekte auflisten', permission: 'projekt:read', readOnly: true },
    get_projekt: { title: 'Projekt lesen', permission: 'projekt:read', readOnly: true },
  },
  features: { audit: true },
});

/**
 * Modell der App (Spezifikation identity-kit 7.3 und 8): einzige Quelle für Rechte, Rollen, Scopes und Orte.
 * Daraus entstehen `GET /v1/authz/catalog`, die Prüfungen (`req.need`), die CHECKs der Tupel und die Scopes in
 * `infra/keycloak/platform.json`.
 *
 * Stufe «einfach» (nur Rollen an der Organisation): Die Rollen der Projekte (PL, CTL, SP, KT), Portfolios und Gremien
 * kommen mit den Modulen dazu, die sie brauchen (docs/ux/informationsarchitektur.md, Sichtbarkeit je Rolle).
 *
 * Nach jeder Änderung: `npm run identity:platform-json`.
 */
import { defineModel } from '@vollholz/iam';

export const model = defineModel({
  product: 'ppm',
  permissions: {
    'handlungsfeld:read': { label: 'Handlungsfelder lesen', group: 'handlungsfelder', description: 'Strategische Handlungsfelder und ihren Verlauf sehen.', resources: ['org'] },
    'handlungsfeld:write': { label: 'Handlungsfelder pflegen', group: 'handlungsfelder', description: 'Strategische Handlungsfelder anlegen und ändern.', resources: ['org'] },
    'handlungsfeld:delete': { label: 'Handlungsfelder löschen', group: 'handlungsfelder', description: 'Strategische Handlungsfelder löschen.', resources: ['org'] },
    'webhook:admin': { label: 'Webhooks verwalten', group: 'webhooks', description: 'Webhooks der Organisation anlegen und löschen.', resources: ['org'], scope: false },
  },
  groups: [{ key: 'handlungsfelder', label: 'Handlungsfelder', match: 'handlungsfeld' }, { key: 'webhooks', label: 'Webhooks', match: 'webhook' }],
  roles: {
    // BC ZM.01.01: Akteure GL und ADM (ADM = org-admin aus dem Paket)
    gl: {
      label: 'Geschäftsleitung',
      description: 'Pflegt die strategischen Handlungsfelder; Organisation lesen.',
      permissions: ['tenant:read', 'handlungsfeld:read', 'handlungsfeld:write', 'handlungsfeld:delete'],
    },
    leser: { label: 'Leser:in', description: 'Liest die strategischen Handlungsfelder; Organisation lesen.', permissions: ['tenant:read', 'handlungsfeld:read'] },
  },
  scopes: {
    'ppm:read': { text: 'PPM lesen', permissions: ['tenant:read', 'handlungsfeld:read'] },
    'handlungsfeld:write': { text: 'Handlungsfelder pflegen', permissions: ['handlungsfeld:write', 'handlungsfeld:delete'] },
  },
  mcpTools: {
    list_handlungsfelder: { title: 'Handlungsfelder auflisten', permission: 'handlungsfeld:read', readOnly: true },
    get_handlungsfeld: { title: 'Handlungsfeld lesen', permission: 'handlungsfeld:read', readOnly: true },
  },
  features: { audit: true },
});

export type Permission = (typeof model.permissions)[number];

/** Testdaten: Projekte, Personen mit Rollen und ein Katalog mit dem Ort «projekt». */
import type { AuthzCatalog, Me } from '@vollholz/iam-web';
import { CATALOG } from '@vollholz/iam-web/testing';
import type { Schemas } from '../api/client.ts';

type Projekt = Schemas['Projekt'];

export const ID = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
  c: '33333333-3333-4333-8333-333333333333',
};

export function projekt(over: Partial<Projekt> = {}): Projekt {
  return {
    id: ID.a, label: 'Alpha', beschreibung: 'Erstes Projekt', beginn: '2026-01-01', ende: '2026-12-31', classification: 0, version: 3,
    createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-20T08:00:00.000Z', can: { write: true, delete: true }, ...over,
  };
}

const P = (key: string, label: string) => ({ key, label, group: 'projekte', resources: ['org', 'projekt'], adminOnly: false, description: label });

export const PPM_CATALOG: AuthzCatalog = {
  ...CATALOG,
  permissions: [...CATALOG.permissions.filter(p => !p.key.startsWith('note:') && p.key !== 'folder:admin'),
    P('projekt:read', 'Projekte lesen'), P('projekt:write', 'Projekte ändern'), P('projekt:delete', 'Projekte löschen')],
  groups: [...CATALOG.groups.filter(g => g.key !== 'notes'), { key: 'projekte', label: 'Projekte' }],
  types: [
    { key: 'org', label: 'Organisation', parent: null, roles: ['org-admin', 'editor', 'viewer', 'auditor'], relations: ['org-admin', 'editor', 'viewer', 'auditor'] },
    { key: 'projekt', label: 'Projekt', parent: 'org', roles: ['editor', 'viewer'], relations: ['editor', 'viewer'], leaf: true, classified: true, read: 'projekt:read', write: 'projekt:write' },
  ],
};

export const EDITOR: Partial<Me> = { roles: ['editor'], permissions: ['tenant:read', 'projekt:read', 'projekt:write', 'projekt:delete', 'access:admin'], clearance: 1 };
export const VIEWER: Partial<Me> = { roles: ['viewer'], permissions: ['tenant:read', 'projekt:read'], clearance: 0 };

/** Testhilfe: Feature mit fester Sitzung (StaticIam) und nachgebildeter API (mockIamApi). */
import { render } from '@testing-library/react';
import { StaticIam } from '@vollholz/iam-web/testing';
import type { Me } from '@vollholz/iam-web';
import type { ReactNode } from 'react';
import '../auth/permissions.ts';

export const CATALOG_PPM = {
  permissions: [
    { key: 'tenant:read', label: 'Organisation lesen', group: 'tenant', description: '', resources: ['org'], adminOnly: false },
    { key: 'handlungsfeld:read', label: 'Handlungsfelder lesen', group: 'handlungsfelder', description: '', resources: ['org'], adminOnly: false },
    { key: 'handlungsfeld:write', label: 'Handlungsfelder pflegen', group: 'handlungsfelder', description: '', resources: ['org'], adminOnly: false },
    { key: 'handlungsfeld:delete', label: 'Handlungsfelder löschen', group: 'handlungsfelder', description: '', resources: ['org'], adminOnly: false },
  ],
  groups: [{ key: 'handlungsfelder', label: 'Handlungsfelder', match: 'handlungsfeld' }],
  roles: [
    { key: 'org-admin', label: 'Admin', description: '', permissions: ['tenant:read', 'handlungsfeld:read', 'handlungsfeld:write', 'handlungsfeld:delete'], adminOnly: true },
    { key: 'gl', label: 'Geschäftsleitung', description: '', permissions: ['tenant:read', 'handlungsfeld:read', 'handlungsfeld:write', 'handlungsfeld:delete'], adminOnly: false },
    { key: 'leser', label: 'Leser:in', description: '', permissions: ['tenant:read', 'handlungsfeld:read'], adminOnly: false },
  ],
  scopes: [],
  types: [
    { key: 'org', label: 'Organisation', parent: null, roles: ['org-admin', 'gl', 'leser'], relations: ['org-admin', 'gl', 'leser'] },
  ],
  classifications: [{ level: 0, label: 'intern' }, { level: 1, label: 'vertraulich' }, { level: 2, label: 'streng vertraulich' }],
  mcpTools: [],
};

export function renderWithIam(ui: ReactNode, me: Partial<Me> = {}) {
  return render(<StaticIam me={{ roles: ['gl'], permissions: ['tenant:read', 'handlungsfeld:read', 'handlungsfeld:write', 'handlungsfeld:delete'], ...me }}>{ui}</StaticIam>);
}

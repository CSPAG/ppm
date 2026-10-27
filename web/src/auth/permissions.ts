/**
 * Rechte der App für die Typen von `@vollholz/iam-web` (`can`, `<Can perm>`): wie `src/authz/model.ts` des
 * Backends, dazu die reservierten des Baukastens.
 */
export type AppPermission =
  | 'tenant:read' | 'tenant:admin' | 'members:admin' | 'access:admin' | 'audit:read'
  | 'handlungsfeld:read' | 'handlungsfeld:write' | 'handlungsfeld:delete' | 'webhook:admin';

declare module '@vollholz/iam-web' {
  interface Register { permission: AppPermission }
}

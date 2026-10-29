/**
 * Rechte der App für die Typen von `@vollholz/iam-web` (`can`, `<Can perm>`): wie `src/authz/model.ts` des
 * Backends (docs/fachmodell.md 3.2), dazu die reservierten des Baukastens.
 */
export type AppPermission =
  | 'tenant:read' | 'tenant:admin' | 'members:admin' | 'access:admin' | 'audit:read'
  | 'handlungsfeld:read' | 'handlungsfeld:write' | 'handlungsfeld:delete'
  | 'ziel:read' | 'ziel:write' | 'ziel:freigabe' | 'zielerreichung:write' | 'quartalsbericht:write'
  | 'stammdaten:read' | 'stammdaten:write'
  | 'phasenmodell:read' | 'phasenmodell:write' | 'phasenmodell:activate'
  | 'portfolio:read' | 'portfolio:admin'
  | 'projekt:list' | 'projekt:read' | 'projekt:write' | 'projekt:create' | 'projekt:organisation' | 'projekt:vertraulich'
  | 'finanzen:read' | 'finanzen:write'
  | 'statusbericht:write' | 'statusbericht:review' | 'periode:close' | 'kpi:write'
  | 'vertrag:write' | 'vertrag:review' | 'vertrag:sign' | 'vertrag:decide'
  | 'sitzung:read' | 'sitzung:write'
  | 'idee:create' | 'idee:list' | 'idee:read' | 'idee:write' | 'idee:decide'
  | 'priorisierung:read' | 'priorisierung:write'
  | 'ressource:read' | 'ressource:write'
  | 'auswertung:read' | 'auswertung:write'
  | 'vorlage:write' | 'schnittstelle:admin' | 'webhook:admin';

declare module '@vollholz/iam-web' {
  interface Register { permission: AppPermission }
}

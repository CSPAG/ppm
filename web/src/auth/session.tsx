/**
 * Sitzung für die App: Person, Organisation des Tabs und Rechte aus iam-web, in der Form, die Features und Shell
 * brauchen. Rechte an einer Ressource kommen aus deren `can` (Antwort der API); ohne `can` gilt das Recht an der
 * Organisation.
 */
import { useIam, useResourceCan, type Permission } from '@vollholz/iam-web';

export interface AppSession {
  name: string;
  email: string | null;
  orgName: string;
  /** Freigabestufe (0–2): höher klassifizierte Einträge sind nicht sichtbar. */
  clearance: 0 | 1 | 2;
  can: (p: Permission) => boolean;
  canSomewhere: (p: Permission) => boolean;
}

export function useSession(): AppSession {
  const s = useIam();
  const { me } = s;
  return {
    name: me.person.name ?? me.person.email ?? '', email: me.person.email, orgName: s.orgName, clearance: me.clearance,
    can: p => s.can(p), canSomewhere: p => s.canSomewhere(p),
  };
}

/** Initialen für das Kontomenü. */
export function initialsOf(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export { useResourceCan };

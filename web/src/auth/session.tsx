/**
 * Sitzung für die App: Person, Organisation dieses Tabs und Rechte aus `@vollholz/iam-web`. Rechte an einer Ressource
 * kommen aus `can` der Antworten der API, nicht aus der Sitzung.
 */
import { Can, useIam } from '@vollholz/iam-web';

export { Can };

export function useSession() {
  const { me, can, canSomewhere, orgName, switchOrg, logout } = useIam();
  return { me, can, canSomewhere, orgName, switchOrg, logout, person: me.person };
}

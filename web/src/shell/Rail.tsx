/** Leiste links: Seiten der App und die Gruppe «Zugang» des Baukastens (nach Recht). Auf schmalen Bildschirmen oben. */
import { IamNav, useIamConfig } from '@vollholz/iam-web';
import { Icon, T } from '../ui/index.ts';
import { useShell } from './context.ts';

export function Rail() {
  const { nav } = useShell();
  const { router: { Link, usePathname } } = useIamConfig();
  const path = usePathname();
  return (
    <aside className="rail">
      <div className="brand"><Icon name="layers" size={22} /> <span>{T.app}</span></div>
      <nav aria-label={T.nav.main}>
        <ul>
          {nav.map(n => (
            <li key={n.to}>
              <Link to={n.to} className="rail-link" {...(path.startsWith(n.to) ? { 'aria-current': 'page' as const } : {})}><Icon name={n.icon} /> {n.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <IamNav className="rail-iam" />
    </aside>
  );
}

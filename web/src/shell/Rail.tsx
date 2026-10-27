/**
 * Navigation links wie in vollholz/assets: Arbeitsräume der App (docs/ux/informationsarchitektur.md), darunter die
 * Gruppe «Zugang» des Baukastens (nach Recht). Schmal als Blatt von links (Knopf in der Topbar).
 */
import { IamNav, useIamConfig } from '@vollholz/iam-web';
import { Icon, T } from '../ui/index.ts';
import { useShell } from './context.ts';

export function Rail({ open }: { open: boolean }) {
  const { nav } = useShell();
  const { router: { Link, usePathname } } = useIamConfig();
  const path = usePathname();
  return (
    <nav className={`rail${open ? ' open' : ''}`} id="rail" aria-label={T.nav.main}>
      <div className="rail-sec">
        {nav.map(n => {
          const on = path === n.to || path.startsWith(`${n.to}/`);
          return (
            <Link key={n.to} to={n.to} className={`nav${on ? ' on' : ''}`} {...(on ? { 'aria-current': 'page' as const } : {})}>
              <Icon name={n.icon} /><span className="lbl">{n.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="rail-sec"><IamNav className="rail-iam" /></div>
    </nav>
  );
}

/**
 * Navigation links (Rail): Einträge der App und die Gruppe «Zugang» von iam-web (Mitglieder, Anmeldung,
 * Organisationen) nach Recht. Auf schmalen Bildschirmen öffnet der Menüknopf dieselbe Navigation als Schublade.
 */
import { IamNav } from '@vollholz/iam-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useSession } from '../auth/session.tsx';
import { Icon } from '../ui/Icons.tsx';
import { Overlay } from '../ui/Overlay.tsx';
import { useShellConfig } from './context.ts';

function RailLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { nav } = useShellConfig();
  const session = useSession();
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <>
      <nav aria-label="Hauptnavigation" className="rail-nav">
        <ul>
          {nav.filter(n => !n.perm || session.canSomewhere(n.perm)).map(n => {
            const active = pathname === n.to || pathname.startsWith(`${n.to}/`);
            return (
              <li key={n.to}>
                <Link to={n.to} className={`rail-i${active ? ' rail-on' : ''}`} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
                  <Icon name={n.icon} /><span>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Klick auf einen Eintrag schliesst die Schublade (Ereignis steigt vom Link auf) */}
      <div className="rail-iam" onClickCapture={onNavigate}><IamNav /></div>
    </>
  );
}

export function Rail() {
  return <aside className="rail" aria-label="Navigation"><RailLinks /></aside>;
}

export function RailDrawer({ onClose }: { onClose: () => void }) {
  return (
    <Overlay kind="drawer" className="overlay-left" title="Navigation" onClose={onClose}>
      <RailLinks onNavigate={onClose} />
    </Overlay>
  );
}

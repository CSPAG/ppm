/** Unbekannte Adresse innerhalb der App. */
import { Link } from '@tanstack/react-router';
import { Icon } from '../ui/Icons.tsx';

export function NotFound() {
  return (
    <div className="page">
      <div className="state state-empty">
        <Icon name="search" size={28} />
        <h1 className="state-title">Seite nicht gefunden</h1>
        <p className="muted">Diese Adresse gibt es in PPM nicht. Vielleicht hat sich der Link geändert.</p>
        <Link className="btn" to="/projekte">Zu den Projekten</Link>
      </div>
    </div>
  );
}

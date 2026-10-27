/**
 * Projektstatus und Trend (docs/ux/darstellung.md; Q8 Kap. 9, AM.02.02): Status immer als Kreis mit Symbol und Text,
 * nie nur Farbe (Q-B5, UX-E6); Trend als Pfeil mit Text für Bildschirmleser; Wechsel gegenüber der Vorperiode als
 * «Im Plan → Kritisch». «Nicht gemeldet» (UC-005 A3) zeigt den Status der Vorperiode dazu.
 */
import { Icon } from './Icon.tsx';
import type { IconName } from './icons.ts';
import { T } from './texte/index.ts';

export type Projektstatus = 'im-plan' | 'kritisch' | 'nicht-gemeldet';
export type Trend = 'auf' | 'gleich' | 'ab';

const TREND_ICON: Record<Trend, IconName> = { auf: 'trend-up', gleich: 'trend-flat', ab: 'trend-down' };

/** Kreis mit Symbol: gefüllt mit Haken (im Plan), gefüllt mit Ausrufezeichen (kritisch), gestrichelt (nicht gemeldet). */
function Kreis({ status }: { status: Projektstatus }) {
  return (
    <svg className={`pst-k pst-${status}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {status === 'nicht-gemeldet' ? <circle cx="8" cy="8" r="6.5" className="pst-strich" /> : <circle cx="8" cy="8" r="7.5" className="pst-voll" />}
      {status === 'im-plan' ? <path d="M4.6 8.2l2.3 2.3 4.5-4.8" className="pst-sym" /> : null}
      {status === 'kritisch' ? <path d="M8 4v5M8 11.6v.1" className="pst-sym" /> : null}
    </svg>
  );
}

export interface StatusProps {
  status: Projektstatus;
  /** Status der Vorperiode; bei einem Wechsel «Im Plan → Kritisch». */
  vorperiode?: Projektstatus;
  trend?: Trend;
  /** Nur Kreis und Pfeil (enge Spalten); der Text bleibt für Bildschirmleser und als Tooltip. */
  kompakt?: boolean;
}

/** Text des Status samt Wechsel, z. B. für Tooltips, Exporte und Tests. */
export function statusText({ status, vorperiode }: Pick<StatusProps, 'status' | 'vorperiode'>): string {
  const jetzt = T.status[status];
  if (!vorperiode) return jetzt;
  if (status === 'nicht-gemeldet') return `${jetzt} · ${T.status.vorperiode(T.status[vorperiode])}`;
  return vorperiode === status ? jetzt : `${T.status[vorperiode]} → ${jetzt}`;
}

export function Status({ status, vorperiode, trend, kompakt = false }: StatusProps) {
  const text = statusText({ status, vorperiode });
  return (
    <span className={`pst${kompakt ? ' kompakt' : ''}`} title={kompakt ? text : undefined}>
      <Kreis status={status} />
      <span className={kompakt ? 'sr' : 'pst-t'}>{text}</span>
      {trend ? <TrendPfeil trend={trend} /> : null}
    </span>
  );
}

export function TrendPfeil({ trend }: { trend: Trend }) {
  return (
    <span className="trend" title={T.status.trend[trend]}>
      <Icon name={TREND_ICON[trend]} /><span className="sr">{T.status.trend[trend]}</span>
    </span>
  );
}

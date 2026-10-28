/**
 * Kopf des Bereichs «Finanzen» (Portfolio › Finanzen, UC-010): Titel und Reiter (I-N6: Arbeitsraum › Bereich › Ansicht).
 * «Budgetprozess» nur mit `finanzen:read` an der Organisation (Jahresbedarf aller Projekte).
 */
import type { MouseEvent, ReactNode } from 'react';
import { Icon } from '../../ui/index.ts';
import { PFAD, type Reiter } from './pfade.ts';
import { TF } from './texte.ts';

export function Kopf({ reiter, titel = TF.title, sub, reiterSichtbar, navigieren, aktionen, query = '' }: {
  reiter: Reiter; titel?: string; sub: ReactNode; reiterSichtbar: readonly Reiter[]; navigieren(pfad: string): void; aktionen?: ReactNode; query?: string;
}) {
  const klick = (href: string) => (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigieren(href);
  };
  return (
    <header className="mh">
      <div className="mh-row">
        <div className="mh-title">
          <div className="type-ico neutral"><Icon name="graph" /></div>
          <div className="minw0">
            <h1 id="page-title">{titel}</h1>
            <div className="sub">{sub}</div>
          </div>
        </div>
        {aktionen ? <div className="acts">{aktionen}</div> : null}
      </div>
      {reiterSichtbar.length > 1 ? (
        <nav className="tabs" aria-label={TF.title}>
          {reiterSichtbar.map(r => {
            const href = `${PFAD[r]}${r !== 'budgetprozess' && query ? `?${query}` : ''}`;
            return <a key={r} className={`tab${r === reiter ? ' on' : ''}`} href={href} aria-current={r === reiter ? 'page' : undefined} onClick={klick(href)}>{TF.tabs[r]}</a>;
          })}
        </nav>
      ) : null}
    </header>
  );
}

/** Reiter nach Recht: Budgetprozess nur mit Recht an der Organisation. */
export const reiterFuer = (orgLesen: boolean): Reiter[] => (orgLesen ? ['uebersicht', 'abweichungen', 'budgetprozess'] : ['uebersicht', 'abweichungen']);

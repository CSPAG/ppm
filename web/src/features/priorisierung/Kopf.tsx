/**
 * Kopf des Bereichs «Priorisierung» (Portfolio › Priorisierung, K5): Titel und Reiter (I-N6: Arbeitsraum › Bereich ›
 * Ansicht). «Modell» nur mit `priorisierung:read` an der Organisation; Matrix und Szenarien kommen mit AP-E5-2 und AP-E5-3.
 */
import type { MouseEvent, ReactNode } from 'react';
import { Icon } from '../../ui/index.ts';
import { TP } from './texte.ts';

import { PFAD, type Reiter } from './pfade.ts';

export { PFAD, type Reiter };

export function Kopf({ reiter, sub, reiterSichtbar, navigieren, aktionen, query = '' }: {
  reiter: Reiter; sub: ReactNode; reiterSichtbar: readonly Reiter[]; navigieren(pfad: string): void; aktionen?: ReactNode; query?: string;
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
          <div className="type-ico neutral"><Icon name="layers" /></div>
          <div className="minw0">
            <h1 id="page-title">{TP.title}</h1>
            <div className="sub">{sub}</div>
          </div>
        </div>
        {aktionen ? <div className="acts">{aktionen}</div> : null}
      </div>
      {reiterSichtbar.length > 1 ? (
        <nav className="tabs" aria-label={TP.title}>
          {reiterSichtbar.map(r => {
            const href = `${PFAD[r]}${r === 'bewertung' && query ? `?${query}` : ''}`;
            return <a key={r} className={`tab${r === reiter ? ' on' : ''}`} href={href} aria-current={r === reiter ? 'page' : undefined} onClick={klick(href)}>{TP.tabs[r]}</a>;
          })}
        </nav>
      ) : null}
    </header>
  );
}

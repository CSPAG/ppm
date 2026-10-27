/**
 * Kopf des Bereichs «Ressourcen» (Portfolio › Ressourcen, UI-23–UI-25): Titel, Reiter Auslastung, Kapazität und Bedarf (I-N6:
 * Arbeitsraum › Bereich › Ansicht) und der Zeitraum als ein Baustein (I-F8), beides in der Adresse (I-N5).
 */
import { useId, type MouseEvent, type ReactNode } from 'react';
import { Icon } from '../../ui/index.ts';
import { TR } from './texte.ts';

export type Reiter = 'auslastung' | 'kapazitaet' | 'bedarf';
export const PFAD = { auslastung: '/portfolio/ressourcen/auslastung', kapazitaet: '/portfolio/ressourcen/kapazitaet', bedarf: '/portfolio/ressourcen/bedarf' } as const satisfies Record<Reiter, string>;

export interface KopfProps {
  reiter: Reiter;
  sub: string;
  /** Wechsel zu einem anderen Reiter (Router); der Zeitraum bleibt. */
  navigieren(pfad: string): void;
  zeitraum: { von?: string; bis?: string };
  setZeitraum(z: { von?: string; bis?: string }): void;
  aktionen?: ReactNode;
}

export function Kopf({ reiter, sub, navigieren, zeitraum, setZeitraum, aktionen }: KopfProps) {
  const id = useId();
  const query = new URLSearchParams(Object.entries(zeitraum).filter((e): e is [string, string] => !!e[1])).toString();
  const href = (r: Reiter) => `${PFAD[r]}${query ? `?${query}` : ''}`;
  const klick = (r: Reiter) => (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigieren(href(r));
  };
  return (
    <>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="users" /></div>
            <div className="minw0">
              <h1 id="page-title">{TR.title}</h1>
              <div className="sub">{sub}</div>
            </div>
          </div>
          {aktionen ? <div className="acts">{aktionen}</div> : null}
        </div>
        <nav className="tabs" aria-label={TR.title}>
          {(Object.keys(PFAD) as Reiter[]).map(r => (
            <a key={r} className={`tab${r === reiter ? ' on' : ''}`} href={href(r)} aria-current={r === reiter ? 'page' : undefined} onClick={klick(r)}>{TR.tabs[r]}</a>
          ))}
        </nav>
      </header>
      <div className="toolbar">
        <fieldset className="res-zeitraum">
          <legend className="sr">{TR.zeitraum}</legend>
          <label htmlFor={`${id}-von`}>{TR.von}</label>
          <input id={`${id}-von`} type="month" value={zeitraum.von ?? ''} onChange={e => setZeitraum({ von: e.target.value || undefined })} />
          <label htmlFor={`${id}-bis`}>{TR.bis}</label>
          <input id={`${id}-bis`} type="month" value={zeitraum.bis ?? ''} onChange={e => setZeitraum({ bis: e.target.value || undefined })} />
        </fieldset>
      </div>
    </>
  );
}

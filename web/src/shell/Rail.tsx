/**
 * Leiste links (I-N3, IA «Navigation»): ab 1024 px Arbeitsräume mit Namen, darunter die Bereiche des aktiven
 * Arbeitsraums; 768–1023 px schmal mit Symbol und Name. Unter 1024 px wechselt man den Bereich über die Bereichsleiste
 * in der Arbeitsfläche, unter 768 px liegt die Navigation unten (`BottomNav`).
 */
import { useIamConfig } from '@vollholz/iam-web';
import { useEffect, useRef, useState } from 'react';
import { Icon, T } from '../ui/index.ts';
import type { SichtbarerRaum, Zaehler } from './nav.ts';
import { Zahl } from './Zahl.tsx';

export function Rail({ raeume, zaehler = {} }: { raeume: SichtbarerRaum[]; zaehler?: Zaehler }) {
  const { router: { Link } } = useIamConfig();
  return (
    <nav className="rail" aria-label={T.nav.main}>
      <ul className="rail-sec">
        {raeume.map(r => {
          const sub = r.aktiv && r.bereiche.length > 1;
          return (
            <li key={r.id}>
              <Link to={r.pfad} className={`nav raum${r.aktiv ? ' on' : ''}`} {...(r.aktiv && !sub ? { 'aria-current': 'page' as const } : {})}>
                <Icon name={r.icon} /><span className="lbl">{r.label}</span><Zahl z={zaehler[r.id]} />
              </Link>
              {sub ? (
                <ul className="rail-sub" aria-label={r.label}>
                  {r.bereiche.map(b => (
                    <li key={b.pfad}>
                      <Link to={b.pfad} className={`nav d-1${b.aktiv ? ' on' : ''}`} {...(b.aktiv ? { 'aria-current': 'page' as const } : {})}>
                        <span className="lbl">{b.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Bereiche des aktiven Arbeitsraums als Leiste über der Arbeitsfläche, nur unter 1024 px und mit mehr als einem Bereich.
 * Passt sie nicht in die Breite, scrollt sie: der aktive Bereich steht im sichtbaren Teil, eine ausgeblendete Kante zeigt,
 * auf welcher Seite weitere Bereiche folgen.
 */
export function BereichLeiste({ raum }: { raum: SichtbarerRaum | undefined }) {
  const { router: { Link } } = useIamConfig();
  const ref = useRef<HTMLElement>(null);
  const [mehr, setMehr] = useState({ links: false, rechts: false });
  const aktiv = raum?.bereiche.find(b => b.aktiv)?.pfad;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const pruefen = () => setMehr({ links: el.scrollLeft > 1, rechts: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    pruefen();
    el.addEventListener('scroll', pruefen, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(pruefen);
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', pruefen); ro?.disconnect(); };
  }, [raum?.id, aktiv]);
  if (!raum || raum.bereiche.length < 2) return null;
  return (
    <nav ref={ref} className={`bereiche${mehr.links ? ' mehr-links' : ''}${mehr.rechts ? ' mehr-rechts' : ''}`} aria-label={`${T.nav.bereiche} ${raum.label}`}>
      {raum.bereiche.map(b => (
        <Link key={b.pfad} to={b.pfad} className={`tab${b.aktiv ? ' on' : ''}`} {...(b.aktiv ? { 'aria-current': 'page' as const } : {})}>{b.label}</Link>
      ))}
    </nav>
  );
}

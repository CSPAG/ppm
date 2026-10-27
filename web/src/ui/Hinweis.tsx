/**
 * Hinweis und Regelmeldung (docs/ux/rahmen/interaktion.md I-P1 bis I-P6, docs/ux/darstellung.md «Regelprüfung»):
 * drei Stufen Hinweis (blau), Warnung (gelb), Sperre (rot), immer Symbol und Text. Die Regelmeldung baut den Text nach
 * «‹Regel›: ‹Ist› statt ‹Grenze› (‹wer, wann›). ‹Vorschlag›.» (I-P2); `regelText` liefert denselben Text für alle
 * Stellen (vorher, dabei, danach; I-P3). Die Quelle der Regel ist auf Wunsch einblendbar.
 */
import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import type { IconName } from './icons.ts';
import { T } from './texte/index.ts';

export type Stufe = 'hinweis' | 'warnung' | 'sperre';

const ICON: Record<Stufe, IconName> = { hinweis: 'info', warnung: 'warn', sperre: 'ban' };

export interface HinweisProps {
  stufe: Stufe;
  children: ReactNode;
  /** Ausweg als Schaltfläche oder Link (z. B. «Änderung beantragen»). */
  aktion?: ReactNode;
  /** Quelle der Regel (PM-Handbuch Kapitel, Projektvertrag), einblendbar. */
  quelle?: ReactNode;
  /** Ansagen, wenn die Meldung erscheint (Prüfung während der Eingabe); sonst statisch. */
  live?: boolean;
}

export function Hinweis({ stufe, children, aktion, quelle, live = false }: HinweisProps) {
  const role = live ? (stufe === 'sperre' ? 'alert' : 'status') : undefined;
  return (
    <div className={`hinweis hinweis-${stufe}`} role={role}>
      <Icon name={ICON[stufe]} />
      <div className="hinweis-b">
        <p><strong>{T.regel.stufe[stufe]}: </strong>{children}</p>
        {quelle ? <details className="hinweis-q"><summary>{T.regel.quelle}</summary><div>{quelle}</div></details> : null}
      </div>
      {aktion ? <div className="hinweis-a">{aktion}</div> : null}
    </div>
  );
}

export interface Regel {
  /** Regel in Klartext, z. B. «Unterlagen». */
  regel: string;
  /** Ist-Wert, z. B. «Versand 3». */
  ist: string;
  /** Grenze, z. B. «mindestens 5 Arbeitstage vor der Sitzung». */
  grenze?: string;
  /** Betroffene Person bzw. Zeit, z. B. «PRAT Mi 12.11.». */
  wer?: string;
  /** Ausweg oder Vorschlag als Satz. */
  vorschlag?: string;
}

/** Text einer Regelmeldung nach I-P2. */
export function regelText({ regel, ist, grenze, wer, vorschlag }: Regel): string {
  const satz = `${regel}: ${ist}${grenze ? ` ${T.regel.statt} ${grenze}` : ''}${wer ? ` (${wer})` : ''}.`;
  return vorschlag ? `${satz} ${vorschlag}` : satz;
}

export function Regelmeldung({ stufe, aktion, quelle, live, ...regel }: Regel & Omit<HinweisProps, 'children'>) {
  return <Hinweis stufe={stufe} aktion={aktion} quelle={quelle} live={live}>{regelText(regel)}</Hinweis>;
}

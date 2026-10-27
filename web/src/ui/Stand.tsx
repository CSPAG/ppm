/**
 * Bearbeitungsstand als Badge mit Rahmen (docs/ux/darstellung.md, UX-E6): ein Satz Familien für alle Objekte mit
 * Bearbeitungsstand (Projektidee, Projektvertrag, Statusbericht, Änderung, Traktandum, Jahresziele, Quartalsreporting,
 * Projekt). Jede Familie hat Symbol und Farbe, der Text nennt den Stand des Objekts (Q-B5).
 */
import { Icon } from './Icon.tsx';
import type { IconName } from './icons.ts';

export type StandFamilie = 'entwurf' | 'wartet' | 'traktandiert' | 'positiv' | 'negativ' | 'ruhend' | 'gesperrt';

const FAMILIE: Record<StandFamilie, { icon: IconName; ton: 'neutral' | 'info' | 'ok' | 'bad' }> = {
  entwurf: { icon: 'edit', ton: 'neutral' },
  wartet: { icon: 'clock', ton: 'info' },
  traktandiert: { icon: 'calendar', ton: 'info' },
  positiv: { icon: 'check', ton: 'ok' },
  negativ: { icon: 'x', ton: 'bad' },
  ruhend: { icon: 'minus', ton: 'neutral' },
  gesperrt: { icon: 'lock', ton: 'neutral' },
};

export interface StandProps {
  familie: StandFamilie;
  /** Stand des Objekts, z. B. «eingereicht», «in Prüfung», «abgenommen». */
  label: string;
  /** Zusatz, z. B. «wartet auf Unternehmensentwicklung» oder «traktandiert PRAT Mi 10.12.». */
  detail?: string;
}

export function Stand({ familie, label, detail }: StandProps) {
  const f = FAMILIE[familie];
  return (
    <span className={`stand stand-${f.ton}`} data-familie={familie}>
      <Icon name={f.icon} />
      <span>{label}{detail ? <span className="stand-d"> · {detail}</span> : null}</span>
    </span>
  );
}

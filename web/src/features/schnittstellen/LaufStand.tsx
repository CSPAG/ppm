/** Stand eines Laufs (UI-49) mit Zeitpunkt, für die Liste und das Laufprotokoll. */
import { fmtZeitpunkt, Stand } from '../../ui/index.ts';
import type { Lauf } from './api.ts';
import { TX } from './texte.ts';

const FAMILIE = { laeuft: 'wartet', erfolgreich: 'positiv', fehlgeschlagen: 'negativ' } as const;

export function LaufStand({ l }: { l: Pick<Lauf, 'stand' | 'start'> | null }) {
  if (!l) return <span className="empty">{TX.s.keinLauf}</span>;
  return <Stand familie={FAMILIE[l.stand]} label={TX.s.stand[l.stand] ?? l.stand} detail={fmtZeitpunkt(l.start)} />;
}

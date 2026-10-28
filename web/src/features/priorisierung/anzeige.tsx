/** Stand einer Modellversion als Badge (darstellung.md: Entwurf, in Kraft = gilt, abgelöst). */
import { Stand } from '../../ui/index.ts';
import type { BewertungsmodellKurz } from './api.ts';
import { TP } from './texte.ts';

export function standAnzeige(m: BewertungsmodellKurz) {
  if (m.stand === 'entwurf') return <Stand familie="entwurf" label={TP.stand.entwurf!} />;
  return m.aktuell ? <Stand familie="positiv" label={TP.stand.in_kraft!} detail={TP.aktuell} /> : <Stand familie="ruhend" label={TP.abgeloest} />;
}

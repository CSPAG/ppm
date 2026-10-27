/** Zähler an einem Arbeitsraum (I-N3): sichtbar als Zahl, für Bildschirmleser als Text im Namen des Links. */
import type { Zaehler } from './nav.ts';

export function Zahl({ z }: { z: Zaehler[keyof Zaehler] }) {
  if (!z) return null;
  return <><span className="zahl" aria-hidden="true">{z.n > 99 ? '99+' : z.n}</span><span className="sr">, {z.text}</span></>;
}

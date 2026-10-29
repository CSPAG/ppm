/**
 * «Weiter ohne Vermerk» (UX-E12, A-74): Aktion, die vor einer Prüfung, Freigabe oder Abnahme weitergeht. Der Dialog
 * nennt vorher, was offen bleibt (I-R1 Stufe 3); bestätigt wird mit der Aktion selbst, nicht mit «OK».
 */
import { useState, type ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import type { IconName } from './icons.ts';
import { Dialog } from './Overlay.tsx';
import { ErrorState } from './states.tsx';
import { T } from './texte/index.ts';

export function VorabAktion({ label, frage, wirkung, icon = 'arrow', laeuft, fehler, ausfuehren }: {
  label: string; frage: string; wirkung: ReactNode; icon?: IconName;
  laeuft: boolean; fehler?: unknown;
  /** Führt die Aktion aus; `fertig` schliesst den Dialog nach Erfolg. */
  ausfuehren(fertig: () => void): void;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOffen(true)}><Icon name={icon} />{label}</button>
      {offen ? (
        <Dialog title={frage} onClose={() => setOffen(false)} footer={<>
          <button type="button" className="btn" onClick={() => setOffen(false)} data-autofocus>{T.common.cancel}</button>
          <button type="button" className="btn primary" disabled={laeuft} onClick={() => ausfuehren(() => setOffen(false))}>{label}</button>
        </>}>
          <p>{wirkung}</p>
          {fehler ? <ErrorState error={fehler} /> : null}
        </Dialog>
      ) : null}
    </>
  );
}

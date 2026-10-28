/** Gemeinsame Teile der Seiten «Zugänge» und «Neubesetzung»: Link in der App und Name eines Orts. */
import type { MouseEvent, ReactNode } from 'react';
import { useOrt } from './api.ts';
import { Z } from './texte.ts';

/** Navigation innerhalb der App (der Router gibt sie hinein; Features kennen den Router nicht). */
export type Gehe = (pfad: string) => void;

/** Link mit Adresse, Klick navigiert in der App. */
export function Ziel({ pfad, gehe, className, children }: { pfad: string; gehe: Gehe; className?: string; children: ReactNode }) {
  const klick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    gehe(pfad);
  };
  return <a href={pfad} className={className} onClick={klick}>{children}</a>;
}

/** Name des Orts aus der API der App (der Baukasten liefert keine Namen). */
export function OrtName({ typ, id }: { typ: string; id: string }) {
  const ort = useOrt(typ, id);
  if (ort.isPending) return <span className="sk sk-text" aria-hidden="true" />;
  return <>{ort.data?.name ?? Z.detail.ortUnbekannt(typ)}</>;
}

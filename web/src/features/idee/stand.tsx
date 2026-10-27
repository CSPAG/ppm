/**
 * Stand einer Idee als Badge (darstellung.md «Bearbeitungsstand», UX-E6) mit dem letzten Ereignis (K4 «Stand
 * verfolgen»: «in Prüfung seit Fr 3.10.», Entwurf «zuletzt bearbeitet Mo 6.10.»); Texte in Klartext für Antragstellende.
 */
import type { MouseEvent, ReactNode } from 'react';
import { fmtDatum, Stand, type StandFamilie } from '../../ui/index.ts';
import type { IdeeStand } from './api.ts';
import { TI } from './texte.ts';

const FAMILIE: Record<IdeeStand, StandFamilie> = {
  entwurf: 'entwurf', eingereicht: 'wartet', in_pruefung: 'wartet', in_ergaenzung: 'wartet', traktandiert: 'traktandiert',
  freigegeben: 'positiv', zurueckgestellt: 'ruhend', zurueckgewiesen: 'negativ', zusammengefuehrt: 'ruhend',
};

export function IdeeStandBadge({ stand, standAt, updatedAt }: { stand: IdeeStand; standAt: string; updatedAt: string }) {
  const detail = stand === 'entwurf' ? TI.zuletzt(fmtDatum(updatedAt)) : TI.seit(fmtDatum(standAt));
  return <Stand familie={FAMILIE[stand]} label={TI.stand[stand] ?? stand} detail={detail} />;
}

/** Navigation innerhalb der App (der Router gibt sie hinein; Features kennen den Router nicht). */
export type Gehe = (pfad: string) => void;

/** Link mit Adresse (öffnen in neuem Tab möglich), Klick navigiert in der App. */
export function Verweis({ pfad, gehe, className, children }: { pfad: string; gehe: Gehe; className?: string; children: ReactNode }) {
  const klick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    gehe(pfad);
  };
  return <a href={pfad} className={className} onClick={klick}>{children}</a>;
}

export const ideePfad = (nummer: number, schritt?: number) => `/portfolio/ideen/${nummer}${schritt ? `?schritt=${schritt}` : ''}`;

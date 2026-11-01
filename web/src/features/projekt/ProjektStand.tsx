/**
 * Stand des Projekts als Badge (docs/ux/darstellung.md «Bearbeitungsstand»): «aktiv» ohne Badge, sonst Familie und Text;
 * «vertraulich» als eigenes Merkmal mit Schloss, auch geerbt vom Portfolio (Master Entscheid 22, I-Z3: wer es sieht, sieht
 * auch, dass es sensibel ist).
 */
import { Icon, Stand } from '../../ui/index.ts';
import type { Projekt } from './api.ts';
import { TP } from './texte.ts';

export function ProjektStand({ projekt: p }: { projekt: Pick<Projekt, 'lebenszyklus' | 'vertraulich'> & { portfolioVertraulich?: boolean } }) {
  return (
    <>
      {p.lebenszyklus !== 'aktiv' ? <Stand familie={TP.familie[p.lebenszyklus]} label={TP.lebenszyklus[p.lebenszyklus]} /> : null}
      {p.vertraulich || p.portfolioVertraulich ? <span className="merkmal merkmal-vertraulich" title={TP.vertraulichHinweis}><Icon name="lock" />{TP.vertraulich}</span> : null}
    </>
  );
}

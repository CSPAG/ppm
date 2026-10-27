/**
 * Kopfkarte «Ideen» auf der Startseite (fachmodell.md 4.1; K4 Einstieg: «Projektidee einreichen» im Kopf für
 * Antragstellende, ein Klick vom Eingang zum Assistenten): eigene Ideen nach Stand, mit `idee:write` die eingereichten
 * Ideen im Pool. Die Karte führt über Adressen (die Startseite gibt keine Navigation hinein).
 */
import { Icon } from '../../ui/index.ts';
import { useIdeeKopf } from './api.ts';
import { ideeNeuPfad } from './search.ts';
import { TI } from './texte.ts';
import './idee.css';

export function IdeeKopfKarte() {
  const k = useIdeeKopf().data;
  const teile = k ? [
    k.eigene.inErgaenzung ? TI.kopfErgaenzung(k.eigene.inErgaenzung) : '',
    k.eigene.entwurf ? TI.kopfEntwurf(k.eigene.entwurf) : '',
    k.eigene.laufend ? TI.kopfLaufend(k.eigene.laufend) : '',
    k.zuPruefen ? TI.kopfZuPruefen(k.zuPruefen) : '',
  ].filter(Boolean) : [];
  return (
    <div className="idee-kopf">
      <h3><a href="/portfolio/ideen">{TI.kopfTitel}</a></h3>
      <p>{teile.length ? teile.join(' · ') : TI.kopfLeer}</p>
      <a href={ideeNeuPfad()} className="btn primary sm"><Icon name="plus" />{TI.einreichen}</a>
    </div>
  );
}

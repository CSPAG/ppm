/**
 * Kopfkarte «Finanzen» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle», FI:
 * «Prognose gegenüber Budget über das Portfolio, Anzahl Projekte mit Überschreitung, letzter Lauf der Ist-Kosten»;
 * UC-010): Summe der sichtbaren Projekte aus der Finanzübersicht, Projekte über der Toleranz (A-10) mit Sprung zu den
 * Abweichungen, Stand der Ist-Kosten.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState, fmtBetragKurz, fmtPeriode } from '../../ui/index.ts';
import { useFinanzen } from './api.ts';
import { PFAD } from './pfade.ts';
import { TF } from './texte.ts';

export function FinanzenKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useFinanzen('uebersicht', null, false);
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const { summe, projekte, istStand } = q.data;
  if (!projekte.length) return null;
  const ueber = projekte.filter(p => p.abweichung.wesentlich).length;
  return (
    <>
      <h2><Link to={PFAD.uebersicht}>{TF.kopfkarte.titel}</Link></h2>
      <p>{TF.kopfkarte.prognose(fmtBetragKurz(summe.prognose), fmtBetragKurz(summe.budget))}</p>
      <p className="muted small">{[ueber ? TF.kopfkarte.ueberschritten(ueber) : '', istStand ? TF.kopfkarte.istBis(fmtPeriode(istStand)) : TF.kopfkarte.ohneIst].filter(Boolean).join(' · ')}</p>
      {ueber ? <Link to={PFAD.abweichungen} className="btn primary sm">{TF.kopfkarte.abweichungen}</Link> : null}
    </>
  );
}

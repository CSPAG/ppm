/**
 * Kopfkarte «Monatszyklus» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle», UE
 * und PMO; Kernablauf K1 «Prüfen»): Periode in Arbeit mit eingereichten und geprüften Berichten, Stichtag und Abschluss,
 * darunter die Direktaktion «Berichte prüfen». Ohne `statusbericht:review` liefert die API nichts, die Karte entfällt.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState, fmtDatum, fmtFrist, fmtPeriode } from '../../ui/index.ts';
import { useKopf } from './api.ts';
import { TM } from './texte.ts';

export function MonatszyklusKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useKopf(true);
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const k = q.data.pruefen;
  if (!k) return null;
  const pfad = `/portfolio/monatsabschluss?periode=${k.periode}`;
  return (
    <>
      <h2><Link to={pfad}>{TM.kopfkarte.titel(fmtPeriode(k.periode))}</Link></h2>
      <p>{`${TM.kopf.eingereicht(k.eingereicht + k.zurueckgegeben + k.geprueft, k.projekte)}, ${TM.kopf.geprueft(k.geprueft)}`}</p>
      <p className="muted small">
        {[k.stichtag ? TM.kopf.stichtag(fmtDatum(k.stichtag)) : '', TM.kopf.abschlussBis(fmtFrist(k.abschlussBis))].filter(Boolean).join(' · ')}
      </p>
      {k.eingereicht
        ? <Link to={`${pfad}&stand=eingereicht`} className="btn primary sm">{TM.kopfkarte.zuPruefen(k.eingereicht)}</Link>
        : <Link to={pfad} className="btn sm">{TM.kopfkarte.oeffnen}</Link>}
    </>
  );
}

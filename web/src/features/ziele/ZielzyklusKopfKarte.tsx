/**
 * Kopfkarte «Jahresziele» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle», GL:
 * «Jahresziele 2027: 28 von 32 mit Metrik · Vorlage an den VR bis 15.11.»; Zielerreichung des letzten Quartals; K6):
 * Zielzyklus des Folgejahres (UC-011) und Fortschritt der Zielerreichung im zuletzt abgeschlossenen Quartal (UC-012).
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState, fmtDatum, fmtQuartal } from '../../ui/index.ts';
import { useZielerreichung } from './ZielerreichungApi.ts';
import { abgeschlossenesQuartal } from './ZielerreichungSearch.ts';
import { useZielzyklus } from './ZielzyklusApi.ts';
import { TZZ } from './ZielzyklusTexte.ts';

export function ZielzyklusKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const jahr = new Date().getFullYear() + 1;
  const q = abgeschlossenesQuartal();
  const zyklus = useZielzyklus(jahr);
  const erreichung = useZielerreichung(`${q.jahr}-Q${q.quartal}`);
  if (zyklus.isPending) return <span className="sk" aria-hidden="true" />;
  if (zyklus.error) return <ErrorState error={zyklus.error} onRetry={() => void zyklus.refetch()} />;
  const z = zyklus.data;
  const jahresziele = z.strategischeZiele.flatMap(s => s.jahresziele);
  const f = erreichung.data?.fortschritt;
  return (
    <>
      <h2><Link to={`/ziele/${jahr}`}>{TZZ.kopfkarte.titel(jahr)}</Link></h2>
      {z.zieljahr ? (
        <p>
          {[TZZ.kopfkarte.mitMetrik(jahresziele.length - z.pruefung.ohneMetrik.length, jahresziele.length),
            z.zieljahr.vorlageBis ? TZZ.kopfkarte.vorlageBis(fmtDatum(z.zieljahr.vorlageBis)) : ''].filter(Boolean).join(' · ')}
        </p>
      ) : <p className="muted">{TZZ.kopfkarte.nichtGestartet}</p>}
      {f && f.gesamt ? (
        <Link to={`/ziele/${q.jahr}/zielerreichung?quartal=q${q.quartal}`} className="small">
          {TZZ.kopfkarte.zielerreichung(fmtQuartal(q.jahr, q.quartal), f.nachgefuehrt, f.gesamt)}
        </Link>
      ) : null}
    </>
  );
}

/**
 * Kopfkarte «Portfolio» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle»: PRAT
 * und GLPA «Gesamtstatus des Portfolios (27 im Plan · 4 kritisch · 2 Eskalationen)», DIR «Projekte der Direktion mit
 * Status und Trend»): Zahlen über die sichtbaren Projekte des Dashboards (UI-17, letzte abgeschlossene Periode), darunter
 * die kritischen Projekte. Die Direktion sieht so ihr Portfolio (Sichtbarkeit nach Recht, I-N2). Ohne Projekte entfällt
 * die Karte.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState, fmtPeriode, Status, type Trend } from '../../ui/index.ts';
import { useDashboard } from './api.ts';
import { TD } from './texte.ts';

const MAX = 3;
const TREND: Record<string, Trend> = { aufwaerts: 'auf', gleichbleibend: 'gleich', abwaerts: 'ab' };

export function PortfolioKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useDashboard(undefined, undefined, true);
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const { items, periode } = q.data;
  if (!items.length) return null;
  const n = (s: 'im_plan' | 'kritisch' | null) => items.filter(i => i.status === s).length;
  const eskalationen = items.filter(i => i.merkmale.includes('eskalation')).length;
  const kritisch = items.filter(i => i.status === 'kritisch');
  return (
    <>
      <h2><Link to="/portfolio/dashboard">{TD.kopfkarte.titel(fmtPeriode(periode))}</Link></h2>
      <p>
        {[TD.kopfkarte.imPlan(n('im_plan')), TD.kopfkarte.kritisch(n('kritisch')), n(null) ? TD.kopfkarte.ohneStatus(n(null)) : '',
          eskalationen ? TD.kopfkarte.eskalationen(eskalationen) : ''].filter(Boolean).join(' · ')}
      </p>
      {kritisch.length ? (
        <ul>
          {kritisch.slice(0, MAX).map(i => (
            <li key={i.projektId}>
              <Link to={`/projekte/${encodeURIComponent(i.nummer)}`}>{`${i.nummer} ${i.name}`}</Link>
              <span className="small"><Status status="kritisch" trend={i.trend ? TREND[i.trend] : undefined} /></span>
            </li>
          ))}
        </ul>
      ) : null}
      <Link to="/portfolio/dashboard" className="btn sm">{TD.aktionOeffnen}</Link>
    </>
  );
}

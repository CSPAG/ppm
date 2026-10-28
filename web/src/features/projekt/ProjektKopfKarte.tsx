/**
 * Kopfkarte «Meine Projekte» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle»:
 * PL, CTL, SP «je eigenes Projekt»): laufende Projekte, in denen die Person eine Funktion hat, mit Phase und Rolle;
 * jedes führt in die Projektakte. Ohne eigenes Projekt entfällt die Karte. Status, Trend und nächste Frist folgen mit
 * der Erweiterung von `GET /v1/projekte/kopf`.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState, fmtPhase } from '../../ui/index.ts';
import { useProjektKopf } from './api.ts';
import { TP } from './texte.ts';

const MAX = 5;

export function ProjektKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useProjektKopf();
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const { projekte, anzahl } = q.data;
  if (!anzahl) return null;
  return (
    <>
      <h2><Link to="/projekte">{TP.kopfkarte.titel}</Link></h2>
      <ul>
        {projekte.slice(0, MAX).map(p => (
          <li key={p.id}>
            <Link to={`/projekte/${encodeURIComponent(p.nummer)}`}>{`${p.nummer} ${p.name}`}</Link>
            <span className="muted small">
              {[fmtPhase(p.phase), p.lebenszyklus === 'sistiert' ? TP.lebenszyklus.sistiert : '', p.rollen.map(r => TP.funktion[r]).join(', ')].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      {anzahl > MAX ? <Link to="/projekte" className="small">{TP.kopfkarte.alle(anzahl)}</Link> : null}
    </>
  );
}

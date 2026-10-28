/**
 * Kopfkarte «Schnittstellen» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle»,
 * ADM: «Schnittstellenläufe mit Fehler», «Lauf ‹ERP Ist-Kosten› fehlgeschlagen»; UC-018): eingerichtete Schnittstellen,
 * deren letzter Lauf fehlgeschlagen ist, je mit Sprung zur Schnittstelle. Läuft alles, entfällt die Karte.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState } from '../../ui/index.ts';
import { useSchnittstellen } from './api.ts';
import { TX } from './texte.ts';

const MAX = 3;

export function SchnittstellenKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useSchnittstellen();
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const fehler = q.data.items.filter(s => s.letzterLauf?.stand === 'fehlgeschlagen');
  if (!fehler.length) return null;
  return (
    <>
      <h2><Link to="/administration/schnittstellen">{TX.kopfkarte.titel}</Link></h2>
      <p className="eg-ueber">{TX.kopfkarte.fehler(fehler.length)}</p>
      <ul>
        {fehler.slice(0, MAX).map(s => (
          <li key={s.id}>
            <Link to={`/administration/schnittstellen?o=${s.id}`}>{TX.kopfkarte.lauf(s.name)}</Link>
            {s.letzterLauf?.fehler ? <span className="muted small">{s.letzterLauf.fehler}</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

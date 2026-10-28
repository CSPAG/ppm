/**
 * Kopfkarte «Organisation einrichten» auf der Startseite (Zustand Z2 «leer beim ersten Mal», interaktion.md; UI-47,
 * AM.02.04): Solange die Organisation kein Portfolio hat, führt sie ADM, UE und PMO zu Administration › Portfolios und
 * Gremien. Sobald es ein Portfolio gibt, entfällt die Karte.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState, Icon } from '../../ui/index.ts';
import { useGibtPortfolio } from './api.ts';
import { TP } from './texte.ts';

export function EinrichtenKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useGibtPortfolio();
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.data) return null;
  return (
    <>
      <h2>{TP.kopfkarte.titel}</h2>
      <p>{TP.kopfkarte.text}</p>
      <Link to="/administration/portfolios" className="btn primary sm"><Icon name="plus" />{TP.kopfkarte.einrichten}</Link>
    </>
  );
}

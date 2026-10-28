/**
 * Kopfkarte «Zugänge» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle», ADM:
 * «Zugänge zu entziehen», «Rollen von ‹Person› neu besetzen»; UC-016 A1): entzogene Zugänge mit noch offenen Rollen,
 * je mit Sprung zur Neubesetzung. Ohne offene Neubesetzung entfällt die Karte.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState } from '../../ui/index.ts';
import { useNeubesetzungen } from './api.ts';
import { Z } from './texte.ts';

const MAX = 3;

export function NeubesetzungKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useNeubesetzungen(true);
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const offen = q.data.items.filter(n => !n.erledigt && n.offeneRollen > 0);
  if (!offen.length) return null;
  return (
    <>
      <h2><Link to="/administration/zugaenge">{Z.kopfkarte.titel}</Link></h2>
      <p>{Z.kopfkarte.offen(offen.length)}</p>
      <ul>
        {offen.slice(0, MAX).map(n => (
          <li key={n.id}><Link to={`/administration/neubesetzungen/${n.id}`}>{Z.kopfkarte.person(n.person.name)}</Link></li>
        ))}
      </ul>
    </>
  );
}

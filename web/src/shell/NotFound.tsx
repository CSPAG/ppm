/** Seite für unbekannte Pfade. */
import { useIamConfig } from '@vollholz/iam-web';
import { T } from '../ui/index.ts';

export function NotFound() {
  const { router: { Link } } = useIamConfig();
  return (
    <section className="page" aria-labelledby="nf-title">
      <h1 id="nf-title">{T.notFound.title}</h1>
      <p>{T.notFound.text}</p>
      <Link to="/ziele/handlungsfelder" className="btn">{T.notFound.back}</Link>
    </section>
  );
}

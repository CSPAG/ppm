/** Seite für unbekannte Pfade (Leerzustand wie in vollholz/assets). */
import { useIamConfig } from '@vollholz/iam-web';
import { Icon, T } from '../ui/index.ts';

export function NotFound() {
  const { router: { Link } } = useIamConfig();
  return (
    <section className="emptystate" aria-labelledby="nf-title">
      <Icon name="search" />
      <h1 id="nf-title">{T.notFound.title}</h1>
      <div>{T.notFound.text}</div>
      <Link to="/ziele/handlungsfelder" className="btn">{T.notFound.back}</Link>
    </section>
  );
}

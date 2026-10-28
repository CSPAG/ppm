/**
 * Zustände einer Ansicht: laden, leer, Fehler (problem+json verständlich), alle mit passender Rolle für Screenreader;
 * gestaltet wie in vollholz/assets (`.loading`, `.emptystate`).
 */
import { describeError } from '@vollholz/iam-web';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { T } from './texte/index.ts';

/** `wert` erst nach `ms` übernehmen (Skelett nicht bei kurzen Ladezeiten, Z1). */
export function useVerzoegert(wert: boolean, ms = 300): boolean {
  const [spaet, setSpaet] = useState(false);
  useEffect(() => {
    if (!wert) return;
    const t = setTimeout(() => setSpaet(true), ms);
    return () => { clearTimeout(t); setSpaet(false); };
  }, [wert, ms]);
  return wert && spaet;
}

export function Skelett({ zeilen = 5 }: { zeilen?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: zeilen }, (_, i) => <div key={i} className="sk-row"><span className="sk" /><span className="sk" /><span className="sk" /></div>)}
    </div>
  );
}

/**
 * Laden (Z1, docs/ux/rahmen/interaktion.md): Skelett in der Form des Inhalts, erst nach 300 ms, nie ein Spinner; die
 * Ansage für Bildschirmleser steht sofort.
 */
export function Loading({ label = T.common.loading, zeilen = 4 }: { label?: string; zeilen?: number }) {
  const skelett = useVerzoegert(true);
  return <div aria-busy="true"><span className="sr" role="status">{label}</span>{skelett ? <Skelett zeilen={zeilen} /> : null}</div>;
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="emptystate"><Icon name="search" /><div>{children}</div>{action}</div>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = describeError(error);
  return (
    <div className="emptystate" role="alert">
      <Icon name={e.status === 403 ? 'shield' : 'warn'} />
      <h3>{e.title || T.common.error}</h3>
      {e.detail ? <div>{e.detail}</div> : null}
      {e.requestId ? <div className="muted small">Referenz <span className="mono">{e.requestId}</span></div> : null}
      {onRetry ? <button type="button" className="btn" onClick={onRetry}>{T.common.retry}</button> : null}
    </div>
  );
}

/**
 * Fehler eines Teils der Seite (Z5): sagt, was nicht geladen ist, und bietet «Erneut versuchen»; der Rest der Seite bleibt
 * nutzbar. Nie «keine Daten» zeigen, wenn die Abfrage gescheitert ist.
 */
export function TeilFehler({ was, error, onRetry }: { was: string; error: unknown; onRetry: () => void }) {
  const e = describeError(error);
  return (
    <div className="hinweis hinweis-warnung" role="alert">
      <Icon name="warn" />
      <div>
        <strong>{T.common.teilFehler(was)}</strong>{e.detail ? ` ${e.detail}` : ''}{' '}
        <button type="button" className="btn sm" onClick={onRetry}>{T.common.retry}</button>
      </div>
    </div>
  );
}

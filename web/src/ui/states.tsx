/**
 * Zustände einer Ansicht: laden, leer, Fehler (problem+json verständlich), alle mit passender Rolle für Screenreader;
 * gestaltet wie in vollholz/assets (`.loading`, `.emptystate`).
 */
import { describeError } from '@vollholz/iam-web';
import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { T } from './texts.ts';

export function Loading({ label = T.common.loading }: { label?: string }) {
  return <div className="loading" role="status" aria-live="polite"><span className="spin" aria-hidden="true" /><span>{label}</span></div>;
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

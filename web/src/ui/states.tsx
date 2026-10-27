/** Zustände einer Ansicht: laden, leer, Fehler (problem+json verständlich), alle mit passender Rolle für Screenreader. */
import { describeError } from '@vollholz/iam-web';
import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { T } from './texts.ts';

export function Loading({ label = T.common.loading }: { label?: string }) {
  return <div className="state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="state state-empty"><p>{children}</p>{action}</div>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = describeError(error);
  return (
    <div className="state state-error" role="alert">
      <Icon name="alert" />
      <div>
        <p className="state-title">{e.title || T.common.error}</p>
        {e.detail ? <p>{e.detail}</p> : null}
        {e.requestId ? <p className="muted">Referenz: <code>{e.requestId}</code></p> : null}
        {onRetry ? <button type="button" className="btn" onClick={onRetry}>{T.common.retry}</button> : null}
      </div>
    </div>
  );
}

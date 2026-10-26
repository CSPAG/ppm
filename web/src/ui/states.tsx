/** Zustände einer Ansicht: laden, leer, Fehler – überall gleich, mit Text für Screenreader. */
import { describeError } from '@vollholz/iam-web';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icons.tsx';

export function Loading({ label = 'Wird geladen …' }: { label?: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Platzhalterzeilen während des ersten Ladens einer Liste. */
export function SkeletonList({ rows = 5, label = 'Liste wird geladen …' }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton-row" aria-hidden="true" />)}
    </div>
  );
}

export function Empty({ icon = 'folder', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state state-empty">
      <Icon name={icon} size={28} />
      <h2 className="state-title">{title}</h2>
      {children ? <p className="muted">{children}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const d = describeError(error);
  return (
    <div className="state state-error" role="alert">
      <Icon name="alert" size={28} />
      <h2 className="state-title">{title ?? d.title}</h2>
      {d.detail ? <p className="muted">{d.detail}</p> : null}
      {d.requestId ? <p className="muted small">Referenz: <code>{d.requestId}</code></p> : null}
      {onRetry ? <button type="button" className="btn" onClick={onRetry}><Icon name="refresh" />Erneut versuchen</button> : null}
    </div>
  );
}

/** Fehler in einem Formular oder einer Schublade (kompakt, ohne Symbolfläche). */
export function InlineError({ error, children }: { error?: unknown; children?: ReactNode }) {
  const d = error === undefined ? null : describeError(error);
  return (
    <div className="inline-error" role="alert">
      <Icon name="alert" />
      <div>
        {d ? <strong>{d.title}</strong> : null}
        {d?.detail ? <span> {d.detail}</span> : null}
        {children}
      </div>
    </div>
  );
}

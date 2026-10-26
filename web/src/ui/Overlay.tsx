/**
 * Modale Ebenen: Schublade (rechts, auf schmalen Bildschirmen ganze Breite) und Dialog (Mitte). Per Portal in
 * `document.body`, mit Fokusfalle (Tab und Umschalt+Tab bleiben in der Ebene), Esc zum Schliessen und Rückgabe des
 * Fokus an das auslösende Element. Nur die oberste Ebene reagiert; Ebenen von iam-web (z. B. «Zugriff») liegen in
 * eigenen Portalen darüber und fangen ihren Fokus selbst.
 */
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons.tsx';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Offene Ebenen dieser App, oberste zuletzt. */
const stack: HTMLElement[] = [];

const visible = (el: HTMLElement) => !el.closest('[hidden]') && (typeof el.checkVisibility !== 'function' || el.checkVisibility());

/**
 * Fokusfalle für `ref`: beim Öffnen Fokus auf `[data-autofocus]` bzw. das erste fokussierbare Element (sonst die Ebene),
 * beim Schliessen zurück an das vorher fokussierte Element.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  const esc = useRef(onEscape);
  useEffect(() => { esc.current = onEscape; });
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(root);
    const items = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
    const first = root.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0] ?? root;
    first.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== root) return;
      if (e.key === 'Escape' && esc.current) { e.preventDefault(); e.stopPropagation(); esc.current(); return; }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) { e.preventDefault(); root.focus(); return; }
      const a = list[0]!, z = list[list.length - 1]!;
      const at = document.activeElement;
      if (e.shiftKey && (at === a || at === root)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && at === z) { e.preventDefault(); a.focus(); }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      const i = stack.lastIndexOf(root);
      if (i >= 0) stack.splice(i, 1);
      if (before && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [ref, active]);
}

export interface OverlayProps {
  kind?: 'drawer' | 'dialog';
  title: ReactNode;
  /** Zeile unter dem Titel (z. B. Klassifizierung). */
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** `alertdialog` für Rückfragen. */
  role?: 'dialog' | 'alertdialog';
  /** Zugänglicher Name des Knopfs «Schliessen». */
  closeLabel?: string;
  className?: string;
}

export function Overlay({ kind = 'dialog', title, sub, onClose, children, footer, role = 'dialog', closeLabel = 'Schliessen', className }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, true, onClose);
  return createPortal(
    <div className={`overlay overlay-${kind}`}>
      <div className="overlay-backdrop" aria-hidden="true" onClick={onClose} />
      <div ref={ref} className={`overlay-panel${className ? ` ${className}` : ''}`} role={role} aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="overlay-head">
          <div className="overlay-title">
            <h2 id={titleId}>{title}</h2>
            {sub ? <div className="overlay-sub">{sub}</div> : null}
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label={closeLabel} title={closeLabel}><Icon name="close" /></button>
        </header>
        <div className="overlay-body">{children}</div>
        {footer ? <footer className="overlay-foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Rückfrage vor einer Aktion, die sich nicht rückgängig machen lässt; Fokus zuerst auf «Abbrechen». */
export function Confirm({ title, children, confirmLabel, onConfirm, onCancel, busy, danger = true }: {
  title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; danger?: boolean;
}) {
  return (
    <Overlay title={title} onClose={onCancel} role="alertdialog"
      footer={(
        <>
          <button type="button" className="btn" onClick={onCancel} data-autofocus>Abbrechen</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>{confirmLabel}</button>
        </>
      )}>
      {children}
    </Overlay>
  );
}

/**
 * Überlagerungen mit Fokusfalle: Schublade (rechts, auf 390 px ganze Breite) und Dialog. Fokus beim Öffnen auf das erste
 * Feld bzw. `[data-autofocus]`, Tab bleibt innen, Esc schliesst, danach Fokus zurück auf den Auslöser.
 */
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.tsx';
import { T } from './texts.ts';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const stack: HTMLElement[] = [];

export function useFocusTrap(ref: RefObject<HTMLElement | null>, onEscape: () => void) {
  const esc = useRef(onEscape);
  useEffect(() => { esc.current = onEscape; }, [onEscape]);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const before = document.activeElement as HTMLElement | null;
    stack.push(root);
    const first = root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE) ?? root;
    first.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== root) return;
      if (e.key === 'Escape') { e.preventDefault(); esc.current(); return; }
      if (e.key !== 'Tab') return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) { e.preventDefault(); return; }
      const a = items[0]!, z = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === a || document.activeElement === root)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(root), 1);
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [ref]);
}

interface OverlayProps { title: string; onClose(): void; children: ReactNode; footer?: ReactNode; actions?: ReactNode }

export function Drawer({ title, onClose, children, footer, actions }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, onClose);
  return createPortal(
    <div className="overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <header className="drawer-h">
          <h2 id={id}>{title}</h2>
          <div className="drawer-actions">
            {actions}
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={T.common.close}><Icon name="close" /></button>
          </div>
        </header>
        <div className="drawer-b">{children}</div>
        {footer ? <footer className="drawer-f">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Dialog({ title, onClose, children, footer }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, onClose);
  return createPortal(
    <div className="overlay overlay-center" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <h2 id={id} className="dialog-h">{title}</h2>
        <div className="dialog-b">{children}</div>
        {footer ? <div className="dialog-f">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Rückfrage vor einer Aktion, die sich nicht rückgängig machen lässt. */
export function Confirm({ title, text, confirm, onConfirm, onClose, busy }: { title: string; text: string; confirm: string; onConfirm(): void; onClose(): void; busy?: boolean }) {
  return (
    <Dialog title={title} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose} data-autofocus>{T.common.cancel}</button>
      <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>{confirm}</button>
    </>}>
      <p>{text}</p>
    </Dialog>
  );
}

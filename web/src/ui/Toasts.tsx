/**
 * Kurze Rückmeldungen unten (Live-Region `status`, Fehler als `alert`). Dieselbe Schnittstelle wie `ToastApi` von
 * iam-web: Die App gibt sie an `IamProvider` weiter, damit es nur eine Stelle für Meldungen gibt.
 */
import { describeError, type ToastApi, type ToastOptions } from '@vollholz/iam-web';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icons.tsx';

interface Item { id: number; text: string; tone: 'info' | 'error'; action?: ToastOptions['action'] }

const Ctx = createContext<ToastApi>({ show: () => {}, error: () => {} });

export const useToast = (): ToastApi => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const remove = useCallback((id: number) => setItems(l => l.filter(x => x.id !== id)), []);
  const show = useCallback<ToastApi['show']>((text, opts = {}) => {
    const id = ++seq.current;
    setItems(l => [...l.slice(-3), { id, text, tone: opts.tone ?? 'info', action: opts.action }]);
    setTimeout(() => remove(id), opts.ms ?? (opts.action ? 8000 : opts.tone === 'error' ? 9000 : 4500));
  }, [remove]);
  const api = useMemo<ToastApi>(() => ({
    show,
    error(e, prefix) {
      const d = describeError(e);
      show(`${prefix ? `${prefix}: ` : ''}${d.title}${d.detail ? ` – ${d.detail}` : ''}`, { tone: 'error' });
    },
  }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map(x => (
          <div key={x.id} className={`toast${x.tone === 'error' ? ' toast-error' : ''}`} role={x.tone === 'error' ? 'alert' : undefined}>
            <span>{x.text}</span>
            {x.action ? <button type="button" className="btn btn-sm" onClick={() => { x.action!.run(); remove(x.id); }}>{x.action.label}</button> : null}
            <button type="button" className="iconbtn iconbtn-sm" aria-label="Meldung schliessen" onClick={() => remove(x.id)}><Icon name="close" size={14} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

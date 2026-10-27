/** Befehlspalette (Strg+K bzw. ⌘K, wie in vollholz/assets): Seiten der App, Verwalten-Seiten und Farbschema, mit Tastatur bedienbar. */
import { useIamConfig, useIamNav } from '@vollholz/iam-web';
import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyTheme, Icon, T, useFocusTrap, type IconName } from '../ui/index.ts';
import { useShell } from './context.ts';

interface Command { id: string; label: string; icon: IconName; run(): void }

export function CommandPalette({ onClose }: { onClose(): void }) {
  const { nav } = useShell();
  const iamNav = useIamNav();
  const { router } = useIamConfig();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);
  const all = useMemo<Command[]>(() => [
    ...nav.map(n => ({ id: n.to, label: n.label, icon: n.icon, run: () => router.navigate(n.to) })),
    ...iamNav.map(n => ({ id: n.path, label: n.title, icon: 'users' as const, run: () => router.navigate(n.path) })),
    { id: 'theme-light', label: `${T.theme.label}: ${T.theme.light}`, icon: 'eye', run: () => applyTheme('light') },
    { id: 'theme-dark', label: `${T.theme.label}: ${T.theme.dark}`, icon: 'eye', run: () => applyTheme('dark') },
    { id: 'theme-system', label: `${T.theme.label}: ${T.theme.system}`, icon: 'eye', run: () => applyTheme('system') },
  ], [nav, iamNav, router]);
  const hits = all.filter(c => c.label.toLowerCase().includes(q.trim().toLowerCase()));
  const run = (c: Command | undefined) => { if (!c) return; onClose(); c.run(); };
  return createPortal(
    <div className="overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="pal" role="dialog" aria-modal="true" aria-label={T.palette.title}>
        <div className="pal-in">
          <Icon name="search" />
          <input role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
            aria-label={T.palette.placeholder} placeholder={T.palette.placeholder} value={q} data-autofocus
            onChange={e => { setQ(e.target.value); setActive(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); run(hits[active]); }
            }} />
          <kbd aria-hidden="true">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label={T.palette.title} className="pal-l">
          {hits.length === 0 ? <li className="pal-g" role="presentation">{T.palette.empty}</li> : hits.map((c, i) => (
            // Tastatur über das Eingabefeld (aria-activedescendant, Pfeile und Eingabetaste)
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li key={c.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={`pal-i${i === active ? ' on' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => run(c)}><Icon name={c.icon} /><span className="lb">{c.label}</span></li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

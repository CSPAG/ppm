/** Befehlspalette (Strg+K bzw. ⌘K): Seiten der App, Verwalten-Seiten und Farbschema, mit Tastatur bedienbar. */
import { useIamConfig, useIamNav } from '@vollholz/iam-web';
import { useEffect, useId, useMemo, useState } from 'react';
import { applyTheme, Dialog, T } from '../ui/index.ts';
import { useShell } from './context.ts';

interface Command { id: string; label: string; run(): void }

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)} aria-keyshortcuts="Control+K">
        {T.nav.palette} <kbd>{T.palette.hint}</kbd>
      </button>
      {open ? <Palette onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Palette({ onClose }: { onClose(): void }) {
  const { nav } = useShell();
  const iamNav = useIamNav();
  const { router } = useIamConfig();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const all = useMemo<Command[]>(() => [
    ...nav.map(n => ({ id: n.to, label: n.label, run: () => router.navigate(n.to) })),
    ...iamNav.map(n => ({ id: n.path, label: n.title, run: () => router.navigate(n.path) })),
    { id: 'theme-light', label: `${T.theme.label}: ${T.theme.light}`, run: () => applyTheme('light') },
    { id: 'theme-dark', label: `${T.theme.label}: ${T.theme.dark}`, run: () => applyTheme('dark') },
    { id: 'theme-system', label: `${T.theme.label}: ${T.theme.system}`, run: () => applyTheme('system') },
  ], [nav, iamNav, router]);
  const hits = all.filter(c => c.label.toLowerCase().includes(q.trim().toLowerCase()));
  const run = (c: Command | undefined) => { if (!c) return; onClose(); c.run(); };
  return (
    <Dialog title={T.palette.title} onClose={onClose}>
      <input role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
        aria-label={T.palette.placeholder} placeholder={T.palette.placeholder} value={q} data-autofocus className="palette-input"
        onChange={e => { setQ(e.target.value); setActive(0); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); run(hits[active]); }
        }} />
      <ul id={listId} role="listbox" aria-label={T.palette.title} className="palette-list">
        {hits.length === 0 ? <li className="muted" role="presentation">{T.palette.empty}</li> : hits.map((c, i) => (
          // Tastatur über das Eingabefeld (aria-activedescendant, Pfeile und Eingabetaste)
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li key={c.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => run(c)}>{c.label}</li>
        ))}
      </ul>
    </Dialog>
  );
}

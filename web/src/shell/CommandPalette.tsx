/**
 * Befehlspalette (Strg+K bzw. Cmd+K): Navigation, Aktionen der Features, Verwalten-Seiten von iam-web und
 * Darstellung. Tastatur: Pfeile wählen, Enter führt aus, Esc schliesst (Combobox mit Listbox nach ARIA).
 */
import { useIamNav } from '@vollholz/iam-web';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useSession } from '../auth/session.tsx';
import { Overlay } from '../ui/Overlay.tsx';
import { useTheme } from '../ui/theme.ts';
import { matches, useShellConfig, type Command } from './context.ts';

/** Strg+K / Cmd+K öffnet die Palette. */
export function usePaletteHotkey(open: () => void) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { nav, actions } = useShellConfig();
  const session = useSession();
  const iamNav = useIamNav();
  const { theme, toggle } = useTheme();
  const id = useId();
  const [input, setInput] = useState('');
  const [active, setActive] = useState(0);

  const all = useMemo<Command[]>(() => [
    ...nav.filter(n => !n.perm || session.canSomewhere(n.perm)).map(n => ({ id: `nav:${n.to}`, label: n.label, group: 'Navigation' as const, to: n.to })),
    ...actions.filter(a => !a.perm || session.can(a.perm)),
    ...iamNav.map(n => ({ id: `iam:${n.id}`, label: n.title, group: 'Verwalten' as const, to: n.path })),
    { id: 'theme', label: theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung', group: 'Darstellung' as const, keywords: 'Thema hell dunkel Farben', run: toggle },
  ], [nav, actions, iamNav, session, theme, toggle]);
  const found = all.filter(c => matches(c, input));
  const current = Math.min(active, Math.max(found.length - 1, 0));

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    if (c.to) router.history.push(c.to);
    c.run?.();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((current + 1) % Math.max(found.length, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((current - 1 + found.length) % Math.max(found.length, 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(Math.max(found.length - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(found[current]); }
  };

  return (
    <Overlay title="Befehle" onClose={onClose} className="palette">
      <label htmlFor={`${id}-in`} className="sr-only">Befehl suchen</label>
      <input id={`${id}-in`} className="palette-input" type="text" role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={found[current] ? `${id}-${current}` : undefined} placeholder="Befehl oder Seite suchen …" autoComplete="off"
        value={input} onChange={e => { setInput(e.target.value); setActive(0); }} onKeyDown={onKey} data-autofocus />
      <div id={`${id}-list`} role="listbox" aria-label="Befehle" className="palette-list">
        {found.map((c, i) => (
          // Auswahl per Tastatur über das Eingabefeld (aria-activedescendant), Maus per Klick
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <div key={c.id} id={`${id}-${i}`} role="option" tabIndex={-1} aria-selected={i === current} className={`palette-i${i === current ? ' palette-on' : ''}`}
            onMouseMove={() => setActive(i)} onClick={() => run(c)}>
            <span>{c.label}</span><span className="muted small">{c.group}</span>
          </div>
        ))}
      </div>
      {!found.length ? <p className="muted" role="status">Kein Befehl gefunden.</p> : null}
    </Overlay>
  );
}

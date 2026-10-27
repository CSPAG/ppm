/**
 * Befehlspalette (Strg+K bzw. ⌘K, I-N4, IA «Navigation»): Seiten (sichtbare Arbeitsräume und Bereiche), Aktionen nach
 * Recht, Suche nach Objekten über die registrierten Suchen (ab zwei Zeichen, gefiltert nach Recht und von der API je
 * Objekt) und Farbschema. Mit Tastatur bedienbar (Combobox mit Liste), Anzahl der Einträge wird angesagt (Q-B3).
 */
import { useIamConfig } from '@vollholz/iam-web';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyTheme, Icon, T, useFocusTrap, type IconName } from '../ui/index.ts';
import type { AktionEintrag, SichtbarerRaum, SucheEintrag, Treffer } from './nav.ts';

interface Befehl { id: string; label: string; detail?: string; icon: IconName; gruppe: string; run(): void }

/** Treffer der Suchen nach kurzer Pause; abgebrochen, sobald sich die Eingabe ändert. */
function useTreffer(suchen: readonly SucheEintrag[], q: string) {
  const [stand, setStand] = useState<{ q: string; treffer: Treffer[]; fehler: boolean } | null>(null);
  const aktiv = q.trim().length >= 2 && suchen.length > 0;
  useEffect(() => {
    if (!aktiv) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      void Promise.allSettled(suchen.map(s => s.suchen(q.trim(), ac.signal))).then(r => {
        if (ac.signal.aborted) return;
        setStand({ q, treffer: r.flatMap(x => (x.status === 'fulfilled' ? x.value : [])), fehler: r.some(x => x.status === 'rejected') });
      });
    }, 200);
    return () => { clearTimeout(t); ac.abort(); };
  }, [aktiv, suchen, q]);
  if (!aktiv) return { treffer: [], sucht: false, fehler: false };
  return stand?.q === q ? { treffer: stand.treffer, sucht: false, fehler: stand.fehler } : { treffer: [], sucht: true, fehler: false };
}

export function CommandPalette({ raeume, aktionen, suchen, onClose }: {
  raeume: SichtbarerRaum[]; aktionen: AktionEintrag[]; suchen: readonly SucheEintrag[]; onClose(): void;
}) {
  const { router } = useIamConfig();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);
  const statisch = useMemo<Befehl[]>(() => [
    ...raeume.flatMap(r => (r.bereiche.length > 1
      ? r.bereiche.map(b => ({ id: b.pfad, label: `${r.label} › ${b.label}`, icon: r.icon, gruppe: T.palette.seiten, run: () => router.navigate(b.pfad) }))
      : [{ id: r.pfad, label: r.bereiche[0]!.label === r.label ? r.label : `${r.label} › ${r.bereiche[0]!.label}`, icon: r.icon, gruppe: T.palette.seiten, run: () => router.navigate(r.pfad) }])),
    ...aktionen.map(a => ({ id: `aktion:${a.id}`, label: a.label, icon: a.icon, gruppe: T.palette.aktionen, run: () => router.navigate(a.pfad) })),
    { id: 'theme-light', label: `${T.theme.label}: ${T.theme.light}`, icon: 'eye', gruppe: T.palette.darstellung, run: () => applyTheme('light') },
    { id: 'theme-dark', label: `${T.theme.label}: ${T.theme.dark}`, icon: 'eye', gruppe: T.palette.darstellung, run: () => applyTheme('dark') },
    { id: 'theme-system', label: `${T.theme.label}: ${T.theme.system}`, icon: 'eye', gruppe: T.palette.darstellung, run: () => applyTheme('system') },
  ], [raeume, aktionen, router]);
  const { treffer, sucht, fehler } = useTreffer(suchen, q);
  const s = q.trim().toLowerCase();
  const hits: Befehl[] = [
    ...statisch.filter(c => c.label.toLowerCase().includes(s)),
    ...treffer.map(t => ({ id: `treffer:${t.id}`, label: t.label, detail: t.detail, icon: t.icon, gruppe: T.palette.treffer, run: () => router.navigate(t.pfad) })),
  ];
  const cur = Math.min(active, Math.max(hits.length - 1, 0));
  const run = (c: Befehl | undefined) => { if (!c) return; onClose(); c.run(); };
  return createPortal(
    <div className="overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="pal" role="dialog" aria-modal="true" aria-label={T.palette.title}>
        <div className="pal-in">
          <Icon name="search" />
          <input role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={hits[cur] ? `${listId}-${cur}` : undefined}
            aria-autocomplete="list" aria-label={T.palette.placeholder} placeholder={T.palette.placeholder} value={q} data-autofocus
            onChange={e => { setQ(e.target.value); setActive(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(cur + 1, hits.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(cur - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); run(hits[cur]); }
            }} />
          <kbd aria-hidden="true">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label={T.palette.title} className="pal-l">
          {hits.map((c, i) => (
            <PalItem key={c.id} c={c} i={i} listId={listId} on={i === cur} kopf={i === 0 || hits[i - 1]!.gruppe !== c.gruppe}
              onHover={() => setActive(i)} onRun={() => run(c)} />
          ))}
          {hits.length === 0 && !sucht ? <li className="pal-g" role="presentation">{T.palette.empty}</li> : null}
        </ul>
        <div className="pal-f" role="status">
          {sucht ? T.palette.sucht : fehler ? T.palette.fehler : T.palette.anzahl(hits.length)}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PalItem({ c, i, listId, on, kopf, onHover, onRun }: { c: Befehl; i: number; listId: string; on: boolean; kopf: boolean; onHover(): void; onRun(): void }) {
  return (
    <>
      {kopf ? <li className="pal-g" role="presentation">{c.gruppe}</li> : null}
      {/* Tastatur über das Eingabefeld (aria-activedescendant, Pfeile und Eingabetaste) */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <li id={`${listId}-${i}`} role="option" aria-selected={on} className={`pal-i${on ? ' on' : ''}`} onMouseEnter={onHover} onClick={onRun}>
        <Icon name={c.icon} /><span className="lb">{c.label}</span>{c.detail ? <span className="sb">{c.detail}</span> : null}
      </li>
    </>
  );
}

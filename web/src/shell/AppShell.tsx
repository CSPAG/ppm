/**
 * Werkbank wie in vollholz/assets: Topbar (Marke mit Organisation, Suche als Befehlspalette, Farbschema, Kontomenü),
 * Navigation links, Arbeitsfläche als «Karte», Schubladen rechts. Strg/⌘ K öffnet die Befehlspalette.
 */
import { useRouterState } from '@tanstack/react-router';
import { AccountMenu, BreakGlassBanner, initials, useIam } from '@vollholz/iam-web';
import { useEffect, useState, type ReactNode } from 'react';
import { avatarColor, Icon, T } from '../ui/index.ts';
import { CommandPalette } from './CommandPalette.tsx';
import { Rail } from './Rail.tsx';
import { ThemeToggle } from './ThemeSwitch.tsx';

export function AppShell({ children }: { children: ReactNode }) {
  const { me, orgName } = useIam();
  const [palette, setPalette] = useState(false);
  const path = useRouterState({ select: s => s.location.pathname });
  // Navigation schmal als Blatt: offen nur für die Seite, auf der sie geöffnet wurde (Wechsel der Seite schliesst sie)
  const [railOpenAt, setRailOpenAt] = useState<string | null>(null);
  const railOpen = railOpenAt === path;
  const setRailOpen = (open: boolean) => setRailOpenAt(open ? path : null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <a href="#main" className="skip">{T.nav.skip}</a>
      <div className="app">
        <header className="top">
          <button type="button" className="iconbtn menu-btn" aria-label={T.nav.open} aria-expanded={railOpen} aria-controls="rail" onClick={() => setRailOpen(!railOpen)}><Icon name="menu" /></button>
          <div className="brand">
            <div className="brand-mark"><Icon name="layers" /></div><span className="bt">{T.app}</span>
            {orgName ? <small className="org" title={orgName}><span className="sr">Organisation </span>{orgName}</small> : null}
          </div>
          <button type="button" className="omni" onClick={() => setPalette(true)} aria-keyshortcuts="Control+K" aria-label={T.nav.omni}>
            <Icon name="search" /><span>{T.nav.omni}</span><kbd aria-hidden="true">{T.palette.hint}</kbd>
          </button>
          <ThemeToggle />
          <AccountMenu avatar={<span className="avatar" style={{ background: avatarColor(me.person.subject) }} aria-hidden="true">{initials(me.person.name ?? me.person.email ?? '?')}</span>} />
        </header>
        <div className="shell">
          {railOpen ? <div className="scrim rail-scrim" aria-hidden="true" onClick={() => setRailOpen(false)} /> : null}
          <Rail open={railOpen} />
          <main className="main" id="main" tabIndex={-1}>
            <BreakGlassBanner />
            {children}
          </main>
        </div>
      </div>
      {palette ? <CommandPalette onClose={() => setPalette(false)} /> : null}
    </>
  );
}

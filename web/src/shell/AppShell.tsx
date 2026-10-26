/**
 * Rahmen der App: Sprunglink, Kopf (Marke, Organisation, Befehle, hell/dunkel, Kontomenü mit Organisationswechsel),
 * Navigation (Rail) und Inhalt. Wird erst mit Sitzung gezeichnet (IamProvider), daher sind Person und Organisation
 * hier immer bekannt.
 */
import { AccountMenu, BreakGlassBanner } from '@vollholz/iam-web';
import { Outlet } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { initialsOf, useSession } from '../auth/session.tsx';
import { Icon } from '../ui/Icons.tsx';
import { useTheme } from '../ui/theme.ts';
import { CommandPalette, usePaletteHotkey } from './CommandPalette.tsx';
import { Rail, RailDrawer } from './Rail.tsx';

export function AppShell() {
  const session = useSession();
  const { theme, toggle } = useTheme();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const openPalette = useCallback(() => setPalette(true), []);
  usePaletteHotkey(openPalette);
  return (
    <div className="shell">
      <a className="skip" href="#main">Zum Inhalt springen</a>
      <header className="topbar">
        <button type="button" className="iconbtn only-narrow" aria-label="Navigation öffnen" aria-expanded={menu} onClick={() => setMenu(true)}><Icon name="menu" /></button>
        <span className="brand"><span className="brand-mark" aria-hidden="true">P</span><span className="brand-name">PPM</span></span>
        <span className="org" title="Organisation dieses Tabs"><span className="sr-only">Organisation: </span>{session.orgName}</span>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost palette-btn" onClick={openPalette} aria-keyshortcuts="Control+K Meta+K">
          <Icon name="command" /><span className="palette-label">Befehle</span><kbd className="only-wide" aria-hidden="true">Strg K</kbd>
        </button>
        <button type="button" className="iconbtn" onClick={toggle} aria-label={theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'} title={theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <AccountMenu avatar={<span className="avatar" aria-hidden="true">{initialsOf(session.name)}</span>} />
      </header>
      <BreakGlassBanner />
      <div className="shell-body">
        <Rail />
        <main id="main" className="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {menu ? <RailDrawer onClose={() => setMenu(false)} /> : null}
      {palette ? <CommandPalette onClose={() => setPalette(false)} /> : null}
    </div>
  );
}

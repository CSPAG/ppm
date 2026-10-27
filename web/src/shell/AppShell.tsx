/** Rahmen der App: Sprunglink, Leiste, Kopf mit Organisation, Befehlen, Farbschema und Kontomenü, Inhalt. */
import { AccountMenu, BreakGlassBanner, initials, useIam } from '@vollholz/iam-web';
import type { ReactNode } from 'react';
import { T } from '../ui/index.ts';
import { CommandPalette } from './CommandPalette.tsx';
import { Rail } from './Rail.tsx';
import { ThemeSwitch } from './ThemeSwitch.tsx';

export function AppShell({ children }: { children: ReactNode }) {
  const { me, orgName } = useIam();
  return (
    <div className="shell">
      <a href="#main" className="skip">{T.nav.skip}</a>
      <Rail />
      <div className="shell-main">
        <header className="topbar">
          <span className="org">{orgName}</span>
          <div className="topbar-actions">
            <CommandPalette />
            <ThemeSwitch />
            <AccountMenu avatar={<span className="avatar">{initials(me.person.name ?? me.person.email ?? '?')}</span>} />
          </div>
        </header>
        <BreakGlassBanner />
        <main id="main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

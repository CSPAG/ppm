/**
 * Wurzel der App innerhalb des Routers: Baukasten (Sitzung, Organisation, Verwalten-Seiten), Navigation und Shell.
 * Hier und im Router treffen Features und Shell aufeinander; sonst kennen sie sich nicht.
 */
import { Outlet } from '@tanstack/react-router';
import { AppIam } from './auth/index.ts';
import { AppShell, ShellCtx, type ShellContext } from './shell/index.ts';
import { T } from './ui/index.ts';

// Arbeitsräume nach docs/ux/informationsarchitektur.md; weitere kommen mit ihren Etappen (docs/ux/fahrplan.md)
const shell: ShellContext = { nav: [{ to: '/ziele', label: T.nav.ziele, icon: 'target' }] };

export function Root() {
  return (
    <AppIam>
      <ShellCtx.Provider value={shell}>
        <AppShell><Outlet /></AppShell>
      </ShellCtx.Provider>
    </AppIam>
  );
}

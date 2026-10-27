/**
 * Wurzel der App innerhalb des Routers: Baukasten (Sitzung, Organisation, Verwalten-Seiten), Navigation und Shell.
 * Hier und im Router treffen Features und Shell aufeinander; sonst kennen sie sich nicht.
 */
import { Outlet } from '@tanstack/react-router';
import { AppIam } from './auth/index.ts';
import { navigation } from './nav.ts';
import { AppShell, ShellCtx } from './shell/index.ts';

export function Root() {
  return (
    <AppIam>
      <ShellCtx.Provider value={navigation}>
        <AppShell><Outlet /></AppShell>
      </ShellCtx.Provider>
    </AppIam>
  );
}

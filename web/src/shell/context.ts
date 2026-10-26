/**
 * Vertrag der Shell: Einträge der Navigation (aus router.tsx, wo die Features ihre Routen registrieren) und Befehle
 * der Befehlspalette. Features kennen die Shell nicht; sie erscheinen hier nur über router.tsx.
 */
import { createContext, useContext } from 'react';
import type { IconName } from '../ui/Icons.tsx';

export interface NavItem {
  /** Pfad mit Suchtext, z. B. `/projekte`. */
  to: string;
  label: string;
  icon: IconName;
  /** Recht, ohne das der Eintrag fehlt. */
  perm?: string;
}

export interface Command {
  id: string;
  label: string;
  group: 'Navigation' | 'Aktionen' | 'Verwalten' | 'Darstellung';
  /** Weitere Suchbegriffe. */
  keywords?: string;
  /** Pfad (Navigation) oder Aktion. */
  to?: string;
  run?: () => void;
}

export interface ShellConfig {
  nav: NavItem[];
  /** Befehle der Features (z. B. «Neues Projekt»), gefiltert nach Recht. */
  actions: (Command & { perm?: string })[];
}

export const ShellContext = createContext<ShellConfig>({ nav: [], actions: [] });
export const useShellConfig = (): ShellConfig => useContext(ShellContext);

/** Nur Treffer, deren Text alle Wörter der Eingabe enthält (ohne Gross-/Kleinschreibung und Akzente). */
export function matches(c: Command, input: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hay = norm(`${c.label} ${c.group} ${c.keywords ?? ''}`);
  return norm(input).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

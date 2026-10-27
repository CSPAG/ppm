/** Registrierung der Navigation für die Shell; die Einträge setzt die App (`src/nav.ts`), die Shell kennt keine Features. */
import { createContext, useContext } from 'react';
import type { NavRegistrierung } from './nav.ts';

export const ShellCtx = createContext<NavRegistrierung>({ bereiche: [], aktionen: [], suchen: [] });
export const useShell = () => useContext(ShellCtx);

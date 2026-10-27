/** Navigation der App für die Shell; die Einträge setzt der Router (die Shell kennt keine Features). */
import { createContext, useContext } from 'react';
import type { IconName } from '../ui/index.ts';

export interface NavItem { to: string; label: string; icon: IconName }
export interface ShellContext { nav: NavItem[] }

export const ShellCtx = createContext<ShellContext>({ nav: [] });
export const useShell = () => useContext(ShellCtx);

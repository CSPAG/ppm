/**
 * Hell/dunkel: `public/theme.js` setzt `data-theme` vor dem ersten Zeichnen; hier Wahl ändern und dem System folgen,
 * solange die Wahl «system» ist.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'ppm.theme';
const EVENT = 'ppm:theme';

function read(): ThemeMode {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch { return 'system'; }
}

const systemDark = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Wirksames Thema an <html> setzen. */
export function applyTheme(mode: ThemeMode = read()) {
  const dark = mode === 'dark' || (mode === 'system' && systemDark());
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function setTheme(mode: ThemeMode) {
  try {
    if (mode === 'system') window.localStorage.removeItem(KEY); else window.localStorage.setItem(KEY, mode);
  } catch { /* Speicher gesperrt: gilt nur bis zum Neuladen */ }
  applyTheme(mode);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void) {
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const onSystem = () => { if (read() === 'system') applyTheme('system'); fn(); };
  mq?.addEventListener('change', onSystem);
  window.addEventListener(EVENT, fn);
  return () => { mq?.removeEventListener('change', onSystem); window.removeEventListener(EVENT, fn); };
}

const current = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

/** Wirksames Thema und Umschalten zwischen hell und dunkel. */
export function useTheme(): { theme: 'light' | 'dark'; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as const);
  const toggle = useCallback(() => setTheme(current() === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}

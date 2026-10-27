/** Farbschema hell, dunkel oder wie das System; `public/theme.js` setzt es vor dem ersten Zeichnen. */
export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'ppm.theme';

export function themeMode(): ThemeMode {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

export function applyTheme(mode: ThemeMode) {
  try { if (mode === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch { /* ohne Speicher */ }
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Auswahl hell, dunkel, wie System. */
import { useId, useState } from 'react';
import { applyTheme, T, themeMode, type ThemeMode } from '../ui/index.ts';

export function ThemeSwitch() {
  const id = useId();
  const [mode, setMode] = useState<ThemeMode>(themeMode);
  return (
    <div className="theme-switch">
      <label htmlFor={id} className="sr-only">{T.theme.label}</label>
      <select id={id} value={mode} onChange={e => { const m = e.target.value as ThemeMode; setMode(m); applyTheme(m); }}>
        <option value="system">{T.theme.system}</option>
        <option value="light">{T.theme.light}</option>
        <option value="dark">{T.theme.dark}</option>
      </select>
    </div>
  );
}

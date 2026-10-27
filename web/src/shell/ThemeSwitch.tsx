/** Hell/Dunkel umschalten (Knopf in der Topbar wie in vollholz/assets); «Wie System» über die Befehlspalette. */
import { applyTheme, Icon, T } from '../ui/index.ts';

export function ThemeToggle() {
  const toggle = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  return <button type="button" className="iconbtn" onClick={toggle} aria-label={T.theme.toggle} title={T.theme.toggle}><Icon name="eye" /></button>;
}

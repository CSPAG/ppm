/**
 * Symbole als SVG im DOM (keine externe Datei, keine Schrift): Striche in `currentColor`, dekorativ (`aria-hidden`).
 * Bedeutung trägt immer der Text daneben oder ein zugänglicher Name des Knopfs.
 */
import type { SVGProps } from 'react';

const PATHS = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  chevron: 'M9 6l6 6-6 6',
  share: 'M16 5a3 3 0 1 1 0 .1zM6 12a3 3 0 1 1 0 .1zM16 19a3 3 0 1 1 0 .1zM8.6 10.7l4.8-2.4M8.6 13.3l4.8 2.4',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5v.5',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className={`icon${className ? ` ${className}` : ''}`}
      fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}

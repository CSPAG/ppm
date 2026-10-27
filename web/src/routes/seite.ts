/**
 * Seiten der Features erst bei Bedarf laden (Q-L6: Start-Bundle ≤ 250 kB gzip): `seite(() => import(…), 'Name')` liefert
 * eine React-Komponente mit den Props der Seite; die Router-Funktionen bleiben im Start-Bundle, der Code der Seite kommt
 * als eigener Chunk (beim Zeigen auf einen Link vorgeladen, `defaultPreload: 'intent'`).
 */
import { lazy, type ComponentType } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- beliebige Props; der Typ der Seite bleibt erhalten
export function seite<M extends Record<K, ComponentType<any>>, K extends keyof M & string>(laden: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await laden())[name] }));
}

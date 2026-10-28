/**
 * App-weite Kürzel nach docs/ux/rahmen/interaktion.md Abschnitt 11: «/» setzt den Fokus in die Suche der aktuellen
 * Liste, «?» öffnet die Übersicht der Kürzel der Ansicht. Die Übersicht nennt die festen Kürzel und alle Kürzel, die
 * die Ansicht an ihren Bedienelementen mit `aria-keyshortcuts` ausweist (z. B. B, R, E im Monatsabschluss), damit
 * jedes ansichtsbezogene Kürzel ohne eigene Liste in der Übersicht steht. Nie in Eingaben und nie über einem Dialog.
 */
import { Dialog, T } from '../ui/index.ts';

const K = T.kuerzel;

/** Taste im Eingabefeld oder mit Modifikator: Kürzel gelten nicht (Bildschirmleser, Browser). */
function ausEingabe(e: KeyboardEvent): boolean {
  const el = e.target;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

const dialogOffen = () => !!document.querySelector('[role="dialog"][aria-modal="true"]');

/** Suche der aktuellen Liste: das erste sichtbare Suchfeld der Arbeitsfläche. */
function suchfeld(): HTMLInputElement | null {
  const felder = document.querySelectorAll<HTMLInputElement>('#main input[type="search"], #main [role="search"] input');
  return [...felder].find(f => !f.disabled && (typeof f.checkVisibility !== 'function' || f.checkVisibility())) ?? null;
}

/**
 * Behandelt «/» und «?»; `true`, wenn die Taste verbraucht ist. «?» entsteht je nach Tastaturbelegung mit
 * Umschalt, deshalb zählt `e.key`, nicht der Tastencode.
 */
export function kuerzelTaste(e: KeyboardEvent, uebersicht: () => void): boolean {
  if (e.defaultPrevented || ausEingabe(e) || dialogOffen()) return false;
  if (e.key === '/') {
    const f = suchfeld();
    if (!f) return false;
    f.focus();
    f.select();
    return true;
  }
  if (e.key === '?') { uebersicht(); return true; }
  return false;
}

interface Eintrag { taste: string; wirkung: string }

/** Kürzel der Ansicht aus `aria-keyshortcuts` (Bezeichnung ohne den Namen der Zeile, je Taste einmal). */
function ansichtsKuerzel(): Eintrag[] {
  const seen = new Map<string, string>();
  for (const el of document.querySelectorAll<HTMLElement>('#main [aria-keyshortcuts]')) {
    const taste = el.getAttribute('aria-keyshortcuts')!.trim();
    if (!taste || seen.has(taste)) continue;
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').split(':')[0]!.trim();
    if (name) seen.set(taste, name);
  }
  return [...seen].map(([taste, wirkung]) => ({ taste: taste.replace(/Control\+/g, 'Strg+'), wirkung }));
}

export function KuerzelUebersicht({ onClose }: { onClose(): void }) {
  const ansicht = ansichtsKuerzel();
  const tabelle = (titel: string, liste: readonly Eintrag[]) => (
    <table className="kz-tab">
      <caption>{titel}</caption>
      <thead><tr><th scope="col">{K.taste}</th><th scope="col">{K.wirkung}</th></tr></thead>
      <tbody>{liste.map(k => <tr key={k.taste}><td><kbd>{k.taste}</kbd></td><td>{k.wirkung}</td></tr>)}</tbody>
    </table>
  );
  return (
    <Dialog title={K.titel} onClose={onClose} footer={<button type="button" className="btn" onClick={onClose} data-autofocus>{K.schliessen}</button>}>
      {tabelle(K.allgemein, K.fest)}
      {ansicht.length ? tabelle(K.ansicht, ansicht) : <p className="muted small">{K.keineAnsicht}</p>}
    </Dialog>
  );
}

/**
 * Gremium im Kopf des Arbeitsraums Gremien (Informationsarchitektur «Kontext im Kopf», `/gremien/prat`; I-N5): Wahl unter
 * den entscheidenden Gremien, deren Sitzungen die Person sieht (I-N2), oder «Alle Gremien». Mit nur einem Gremium ist es
 * ohne Wahl gesetzt. Die Wahl gilt für Sitzungen und Entscheide (und später den Jahresrückblick); zuletzt gewählt wird je
 * Gerät gemerkt, damit der Wechsel zwischen den Bereichen das Gremium behält.
 */
import { useId } from 'react';
import type { Gremium } from './api.ts';
import { TS } from './texte.ts';

const SCHLUESSEL = 'ppm.gremien.gremium';

/** Zuletzt gewähltes Gremium (Kürzel; leer: alle); `undefined`, wenn nichts gemerkt oder der Speicher fehlt. */
export function gemerktesGremium(): string | undefined {
  try { return localStorage.getItem(SCHLUESSEL) ?? undefined; } catch { return undefined; }
}

export function gremiumMerken(kuerzel: string | undefined): void {
  try { localStorage.setItem(SCHLUESSEL, kuerzel ?? ''); } catch { /* ohne Speicher: nur die Adresse trägt das Gremium */ }
}

/**
 * Gremium, das ohne Wahl gilt, wenn die Adresse keines nennt: das einzige sichtbare, sonst das gemerkte (sofern noch
 * sichtbar); sonst keines (alle Gremien).
 */
export function vorgabeGremium(gremien: readonly Gremium[]): string | undefined {
  if (gremien.length === 1) return gremien[0]!.kuerzel;
  const g = gemerktesGremium();
  return g && gremien.some(x => x.kuerzel === g) ? g : undefined;
}

export const gremiumLabel = (g: Pick<Gremium, 'kuerzel' | 'name'>) => `${g.kuerzel.toUpperCase()} · ${g.name}`;

export function GremiumWahl({ gremien, wert, onWahl }: { gremien: readonly Gremium[] | undefined; wert: string | undefined; onWahl(kuerzel: string | undefined): void }) {
  const id = useId();
  if (!gremien?.length) return null;
  if (gremien.length === 1) return <span className="pill sz-gremium-fest" aria-label={`${TS.gremium}: ${gremiumLabel(gremien[0]!)}`}>{gremiumLabel(gremien[0]!)}</span>;
  return (
    <div className="sz-gremium-wahl">
      <label htmlFor={id}>{TS.gremium}</label>
      <select id={id} value={wert ?? ''} onChange={e => { const k = e.target.value || undefined; gremiumMerken(k); onWahl(k); }}>
        <option value="">{TS.alleGremien}</option>
        {gremien.map(g => <option key={g.id} value={g.kuerzel}>{gremiumLabel(g)}</option>)}
      </select>
    </div>
  );
}

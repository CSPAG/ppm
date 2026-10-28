/**
 * Regeln für sichtbare Texte (Spezifikation L10, Querschnitt «Texte»): kein Eszett in irgendeiner Quelldatei, in
 * Texten weder «Mandant» noch «Tenant» (Begriff «Organisation»), Anrede «Du» statt «Sie» (UX-E7, UX-OF-1; wie
 * `scripts/check-address.ts`).
 */
import { describe, expect, it } from 'vitest';
import { T } from './index.ts';

const sources = import.meta.glob('../../**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ESZETT = String.fromCharCode(223);

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') return [String((v as (...a: unknown[]) => unknown)('X', 1))];
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings);
  return [];
}

/** Texte in Quelldateien: Inhalt von Anführungszeichen mit Leerzeichen und Text zwischen JSX-Tags. */
function visible(src: string): string[] {
  const quoted = [...src.matchAll(/'([^'\n]*\s[^'\n]*)'|`([^`]*\s[^`]*)`/g)].map(m => m[1] ?? m[2] ?? '');
  const jsx = [...src.matchAll(/>([^<>{}\n]*[A-Za-zÄÖÜäöü][^<>{}\n]*)</g)].map(m => m[1] ?? '');
  return [...quoted, ...jsx];
}

/** Sie-Form (Höflichkeitspronomen). */
const FORMAL = /\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/;
const TENANT = /\b(Mandant\w*|Tenant\w*)\b/;

describe('Texte', () => {
  it('kein Eszett in den Quelldateien', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    for (const [file, src] of Object.entries(sources)) expect(src.includes(ESZETT), file).toBe(false);
  });

  it('Texte der App in Du-Form, ohne Mandant/Tenant', () => {
    for (const s of strings(T)) {
      expect(s, s).not.toMatch(FORMAL);
      expect(s, s).not.toMatch(TENANT);
    }
  });

  it('sichtbare Texte in Komponenten ohne Sie-Form und ohne Mandant/Tenant', () => {
    for (const [file, src] of Object.entries(sources)) {
      if (!file.endsWith('.tsx') || file.includes('.test.')) continue;
      for (const s of visible(src)) {
        expect(s, `${file}: ${s}`).not.toMatch(FORMAL);
        expect(s, `${file}: ${s}`).not.toMatch(TENANT);
      }
    }
  });
});

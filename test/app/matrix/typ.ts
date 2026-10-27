/**
 * Matrix der Mandantentrennung je Modul (docs/fachmodell.md 7.2): Jedes Modul beschreibt in `test/app/matrix/<modul>.ts`
 * seine Tabellen (Testdaten für `rls.test.ts`), seine Policies und seine Routen (Fälle für `tenant-isolation.test.ts`);
 * `index.ts` sammelt sie mit einer Zeile je Modul.
 */
import type { Tx } from '@vollholz/platform';
import type { TestApi } from '../api.ts';

/** Fall einer Route: fremde ID (404 wie unbekannt), Liste oder Anlegen (nur eigene Daten). */
export interface RouteCase { method: string; url: string; body?: unknown; headers?: Record<string, string>; kind: 'foreign' | 'list' | 'create' }

export interface Matrix {
  /** Tabellen mit tenant_id: je eine Zeile für den Mandanten anlegen (volle Sicht), liefert eine Bedingung auf sie. Reihenfolge = Reihenfolge beim Anlegen. */
  tables?: Record<string, (tx: Tx, tenantId: string) => Promise<string>>;
  /** Policies ausser tenant_isolation, so wie PostgreSQL sie ausgibt. */
  policies?: readonly string[];
  /** Tags der API-Doku, deren Routen vollständig in `cases` stehen. */
  tags?: readonly string[];
  /** Objekte von A über die API anlegen; liefert benannte IDs (Schlüssel global eindeutig, z. B. `handlungsfeld`). */
  seed?: (api: TestApi, a: Record<string, string>, mark: string) => Promise<Record<string, string>>;
  /** Fälle je Route (`<METHODE> <pfad>`), mit den IDs aller Module. */
  cases?: Record<string, (ids: Record<string, string>) => RouteCase>;
  /** Nach den Anfragen von B: Daten von A sind unverändert. */
  unchanged?: (api: TestApi, a: Record<string, string>, mark: string) => Promise<void>;
}

/** Alle Module zusammen; doppelte Tabellen oder Routen sind ein Fehler. */
export function sammle(module: readonly Matrix[]) {
  const tables: NonNullable<Matrix['tables']> = {};
  const cases: NonNullable<Matrix['cases']> = {};
  for (const m of module) {
    for (const [k, v] of Object.entries(m.tables ?? {})) { if (tables[k]) throw new Error(`Tabelle ${k} doppelt`); tables[k] = v; }
    for (const [k, v] of Object.entries(m.cases ?? {})) { if (cases[k]) throw new Error(`Route ${k} doppelt`); cases[k] = v; }
  }
  return {
    tables, cases,
    policies: module.flatMap(m => m.policies ?? []),
    tags: module.flatMap(m => m.tags ?? []),
    seeds: module.flatMap(m => (m.seed ? [m.seed] : [])),
    unchanged: module.flatMap(m => (m.unchanged ? [m.unchanged] : [])),
  };
}

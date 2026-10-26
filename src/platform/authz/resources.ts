/**
 * Ressourcen der App für die Entscheidung (Spezifikation 7.7): Kette der Orte, Existenz und Klassifizierung.
 * Kette: `org` → `projekt`. Ein neuer Typ unter `org` kommt in TABLES; ein Typ mit Eltern braucht eine eigene Kette
 * (Vorlage: identity-kit › docs/neue-app.md › Ressourcen).
 */
import { flatResources, refKey, type Level, type ResourceModel } from '@vollholz/iam';

/** Typ → Tabelle (volle Sicht). */
export const TABLES = { projekt: 'ppm.projekt' } as const;

/** Typen mit Klassifizierung (Spalte `classification`). */
const CLASSIFIED: (keyof typeof TABLES)[] = ['projekt'];

const flat = flatResources({ tables: TABLES });

export const resources: ResourceModel<null> = {
  ...flat,
  classification: async (tx, refs) => {
    const out = new Map<string, Level>();
    for (const type of CLASSIFIED) {
      const ids = refs.filter(r => r.type === type && r.id).map(r => r.id!);
      if (!ids.length) continue;
      const rows = (await tx.query<{ id: string; c: Level }>(`SELECT id, classification AS c FROM ${TABLES[type]} WHERE id = ANY($1::uuid[])`, [ids])).rows;
      for (const r of rows) out.set(refKey({ type, id: r.id }), r.c);
    }
    return out;
  },
};

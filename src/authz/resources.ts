/**
 * Ressourcen der App (identity-kit 7.7): Stufe «mittel», Kette `org → portfolio → projekt` (docs/fachmodell.md 3.1).
 * Der Zustand ist das Portfolio je Projekt (`ppm.projekt.portfolio_id`); `version` ist eine Prüfsumme genau dieser
 * Paare und ändert sich mit jedem Anlegen, Löschen und Verschieben (nicht `max(updated_at)`: `now()` ist die Zeit des
 * Transaktionsbeginns, eine früher begonnene Verschiebung bliebe unbemerkt). Keine Klassifizierung:
 * «vertraulich» ist eine Spalte mit eigener Policy (A-34).
 */
import type { ResourceModel, ResourceRef } from '@vollholz/iam';

/** Projekt-ID → Portfolio-ID. */
type Kette = Map<string, string>;

const TABELLEN: Record<string, string> = { portfolio: 'ppm.portfolio', projekt: 'ppm.projekt' };

export const resources: ResourceModel<Kette> = {
  load: async tx => new Map((await tx.query<{ id: string; portfolio_id: string }>('SELECT id, portfolio_id FROM ppm.projekt')).rows.map(r => [r.id, r.portfolio_id])),
  version: async tx => (await tx.query<{ v: string }>(
    "SELECT count(*) || ':' || md5(coalesce(string_agg(id::text || '>' || portfolio_id::text, ',' ORDER BY id), '')) AS v FROM ppm.projekt")).rows[0]!.v,
  chain: (portfolioVon, ref): ResourceRef[] => {
    if (ref.type === 'org') return [{ type: 'org' }];
    if (ref.type === 'portfolio') return [{ type: 'org' }, ref];
    return [{ type: 'org' }, { type: 'portfolio', id: portfolioVon.get(ref.id ?? '') ?? null }, ref];
  },
  exists: async (tx, ref) => {
    if (ref.type === 'org') return true;
    const tabelle = TABELLEN[ref.type];
    if (!tabelle || !ref.id) return false;
    return ((await tx.query(`SELECT 1 FROM ${tabelle} WHERE id::text = $1`, [ref.id])).rowCount ?? 0) > 0;
  },
};

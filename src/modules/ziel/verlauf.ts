/**
 * Versionen statt Sperre an den Jahreszielen (AP-E8-5; UC-011, K6 Z9; Master G2, A-75, UX-E13): Änderungen nach der
 * Vorlage an den VR markieren Zieljahr und Jahresziel «geändert nach Vorlage»; Verlauf des Jahres aus dem Audit.
 */
import { Type } from '@sinclair/typebox';
import type { Deps, Tx } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { fullTx, SCHEMA } from '../../platform.ts';
import { JahrParams } from './zyklus-schemas.ts';
import type * as store from './zyklus-store.ts';

/** Nach der Vorlage geändert (A-75): Zieljahr und, falls genannt, Jahresziel markieren; liefert, ob markiert wurde. */
export async function nachVorlage(tx: Tx, zj: store.ZieljahrRow, jahreszielId?: string): Promise<boolean> {
  if (zj.stand === 'in_arbeit') return false;
  await tx.query(`UPDATE ${SCHEMA}.zieljahr SET geaendert_nach_vorlage_at = now() WHERE id = $1`, [zj.id]);
  if (jahreszielId) await tx.query(`UPDATE ${SCHEMA}.jahresziel SET geaendert_nach_vorlage_at = now() WHERE id = $1`, [jahreszielId]);
  return true;
}

const AKTION: Record<string, string> = {
  'zieljahr.created': 'Zielzyklus eröffnet', 'zieljahr.updated': 'Zielzyklus geändert', 'zieljahr.submitted': 'dem VR vorgelegt',
  'zieljahr.approved': 'vom VR freigegeben', 'zieljahr.changes_requested': 'Anpassungen verlangt',
  'jahresziel.created': 'Jahresziel erfasst', 'jahresziel.updated': 'Jahresziel geändert', 'jahresziel.deleted': 'Jahresziel gelöscht',
  'hauptaktivitaet.created': 'Hauptaktivität erfasst', 'hauptaktivitaet.updated': 'Hauptaktivität geändert', 'hauptaktivitaet.deleted': 'Hauptaktivität gelöscht',
};

const ENTSCHEIDE = new Set(['zieljahr.submitted', 'zieljahr.approved', 'zieljahr.changes_requested']);

const Verlauf = Type.Object({
  items: Type.Array(Type.Object({
    at: Type.String({ format: 'date-time' }), person: Type.Union([Type.String(), Type.Null()]), aktion: Type.String(), text: Type.String(),
    nachVorlage: Type.Boolean({ description: 'Nach der Vorlage an den VR («geändert nach Vorlage», A-75).' }),
  }, { additionalProperties: false })),
}, { $id: 'ZieljahrVerlauf', additionalProperties: false });

export function registerVerlaufRoutes(app: FastifyInstance, deps: Deps): void {
  app.addSchema(Verlauf);
  app.get('/v1/ziele/:jahr/verlauf', {
    schema: {
      tags: ['Ziele'], summary: 'Verlauf der Jahresziele', params: JahrParams, response: { 200: Type.Ref('ZieljahrVerlauf') },
      description: 'Zielzyklus, Vorlage, Freigabe und alle Änderungen an Jahreszielen und Hauptaktivitäten des Jahres, älteste zuerst; nach der Vorlage markiert (A-75, UX-E13). Ohne Zielzyklus leer. Mit `ziel:read`.',
    },
  }, async req => {
    const { jahr } = req.params as { jahr: number };
    await req.need('ziel:read');
    const rows = await fullTx(deps.db, req.requirePrincipal().tenantId, async tx => {
      const zj = (await tx.query<{ id: string; vorgelegt_at: Date | null }>(`SELECT id, vorgelegt_at FROM ${SCHEMA}.zieljahr WHERE jahr = $1`, [jahr])).rows[0];
      if (!zj) return null;
      const items = (await tx.query<{ ts: Date; actor_name: string | null; action: string }>(
        `SELECT a.ts, a.actor_name, a.action FROM ${SCHEMA}.audit_log a
          WHERE (a.resource_type = 'zieljahr' AND a.resource_id = $1)
             OR (a.resource_type = 'jahresziel' AND (a.data->>'jahr')::int = $2)
             OR (a.resource_type = 'jahresziel' AND (a.data->'after'->>'jahr')::int = $2)
             OR (a.resource_type = 'hauptaktivitaet' AND EXISTS (SELECT 1 FROM ${SCHEMA}.jahresziel j WHERE j.jahr = $2
                  AND j.id::text IN (a.data->>'jahreszielId', a.data->'after'->>'jahreszielId')))
          ORDER BY a.ts, a.id`, [zj.id, jahr])).rows;
      return { vorgelegt: zj.vorgelegt_at, items };
    });
    if (!rows) return { items: [] };
    const ab = rows.vorgelegt?.getTime() ?? null;
    return {
      items: rows.items.map(r => {
        // Änderungen an Zielen nach der Vorlage; Vorlage und Entscheid des VR selbst sind keine
        const nach = ab !== null && r.ts.getTime() > ab && !ENTSCHEIDE.has(r.action);
        return { at: r.ts.toISOString(), person: r.actor_name, aktion: nach ? `${r.action}.amended` : r.action, text: `${AKTION[r.action] ?? r.action}${nach ? ' · geändert nach Vorlage' : ''}`, nachVorlage: nach };
      }),
    };
  });
}

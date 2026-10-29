/**
 * Verlauf der Sitzung (AP-E8-5; UC-006, K3; Master G2, A-75, UX-E13): Versand und alle Änderungen danach an Sitzung,
 * Traktanden, Einladungen und Unterlagen, älteste zuerst, aus dem Audit. Für alle, die die Sitzung sehen (Lesesicht der
 * Sitzung; vor dem Versand sehen Mitglieder sie nicht).
 */
import { Type } from '@sinclair/typebox';
import { IdParams, notFound, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { fullTx, SCHEMA } from '../../platform.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';

const AKTION: Record<string, string> = {
  'sitzung.created': 'Sitzung angelegt', 'sitzung.updated': 'Sitzung geändert', 'sitzung.reordered': 'Reihenfolge geändert', 'sitzung.dispatched': 'Unterlagen versendet',
  'traktandum.scheduled': 'Traktandum aufgenommen', 'traktandum.updated': 'Traktandum geändert', 'traktandum.unscheduled': 'Traktandum entfernt',
  'traktandum.postponed': 'Traktandum verschoben', 'traktandum.invitations_changed': 'Einladungen geändert', 'traktandum.amended': 'Unterlagen nachgeführt',
};

const Verlauf = Type.Object({
  items: Type.Array(Type.Object({
    at: Type.String({ format: 'date-time' }), person: Type.Union([Type.String(), Type.Null()]), aktion: Type.String(), text: Type.String(),
    nachVersand: Type.Boolean({ description: 'Nach dem Versand («geändert nach Versand», A-75).' }),
  }, { additionalProperties: false })),
}, { $id: 'SitzungVerlauf', additionalProperties: false });

export function registerVerlaufRoutes(app: FastifyInstance, deps: Deps): void {
  app.addSchema(Verlauf);
  app.get('/v1/sitzungen/:id/verlauf', {
    schema: {
      tags: [TAG], summary: 'Verlauf der Sitzung', params: IdParams, response: { 200: Type.Ref('SitzungVerlauf') },
      description: 'Änderungen an Sitzung, Traktanden, Einladungen und Unterlagen, älteste zuerst; nach dem Versand markiert (A-75, UX-E13). Mit `sitzung:read` am Portfolio, unter der Lesesicht der Sitzung.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const s = await req.tx(tx => store.getSitzung(tx, id));
    if (!s) throw notFound('Sitzung');
    await req.need('sitzung:read', { type: 'portfolio', id: s.portfolio_id });
    const rows = await fullTx(deps.db, req.requirePrincipal().tenantId, async tx => (await tx.query<{ ts: Date; actor_name: string | null; action: string }>(
      `SELECT a.ts, a.actor_name, a.action FROM ${SCHEMA}.audit_log a
        WHERE (a.resource_type = 'sitzung' AND a.resource_id = $1)
           OR (a.resource_type = 'traktandum' AND a.resource_id IN (SELECT t.id FROM ${SCHEMA}.traktandum t WHERE t.sitzung_id = $1))
        ORDER BY a.ts, a.id`, [id])).rows);
    const versand = s.versendet_at?.getTime() ?? null;
    return {
      items: rows.map(r => {
        const nach = versand !== null && r.ts.getTime() > versand && r.action !== 'sitzung.dispatched';
        return { at: r.ts.toISOString(), person: r.actor_name, aktion: nach ? `${r.action}.amended` : r.action, text: `${AKTION[r.action] ?? r.action}${nach ? ' · geändert nach Versand' : ''}`, nachVersand: nach };
      }),
    };
  });
}

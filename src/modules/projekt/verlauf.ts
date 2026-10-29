/**
 * Verlauf der Projektakte (AP-E8-5; UC-015 Schritt 6, UC-018; Master G2, A-75, UX-E13): Änderungen am Projekt und an
 * den Objekten der Akte (Projektorganisation, Register, Berichte, Vertrag, Abschluss), älteste zuerst, aus dem Audit;
 * nach dem Abschluss markiert. Für alle mit Leserecht am Projekt.
 */
import { Type } from '@sinclair/typebox';
import { IdParams, notFound, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { fullTx, SCHEMA } from '../../platform.ts';
import * as store from './store.ts';

/** Höchstens so viele Einträge (die jüngsten); ältere stehen im Änderungsprotokoll (UI-50). */
const LIMIT = 500;

/** Sichtbare Texte: eigene für den Lebenszyklus des Projekts, sonst Objekt + Tätigkeit. */
const AKTION: Record<string, string> = {
  'projekt.created': 'Projekt angelegt', 'projekt.updated': 'Projekt geändert', 'projekt.organisation_changed': 'Projektorganisation geändert',
  'projekt.phase_changed': 'Phase nachgeführt', 'projekt.phase_started': 'Phase begonnen', 'projekt.resumed': 'wieder aufgenommen',
  'projekt.suspended': 'sistiert', 'projekt.cancelled': 'abgebrochen', 'projekt.completed': 'abgeschlossen', 'projekt.withdrawn': 'zurückgezogen',
  'projekt.reopened': 'Abschluss zurückgenommen', 'projekt.resumption_requested': 'Wiederaufnahme beantragt',
};
const OBJEKT: Record<string, string> = {
  abschlussbericht: 'Abschlussbericht', eskalation: 'Eskalation', gate_antrag: 'Gate-Antrag', kpi: 'KPI-Wert', kpi_wert: 'KPI-Wert',
  lessons_learned: 'Lessons Learned', meilenstein: 'Meilenstein', meldung: 'Meldung', risiko: 'Risiko', statusbericht: 'Statusbericht',
  vertrag: 'Projektvertrag', vertrag_version: 'Projektvertrag', kosten: 'Kosten', ressourcenbedarf: 'Ressourcenbedarf', nutzenpruefung: 'Nutzenprüfung',
};
const TAETIGKEIT: Record<string, string> = {
  created: 'erfasst', updated: 'geändert', deleted: 'gelöscht', recorded: 'erfasst', submitted: 'eingereicht', signed: 'unterschrieben',
  baselined: 'als Baseline festgehalten', exported: 'exportiert', withdrawn: 'zurückgezogen', reviewed: 'geprüft', returned: 'zurückgegeben',
  accepted: 'abgenommen', amended: 'geändert nach Abschluss',
};
function text(action: string, objekt: string | null): string {
  if (AKTION[action]) return AKTION[action];
  const [art = '', taetigkeit = ''] = action.split('.');
  return `${OBJEKT[art] ?? OBJEKT[objekt ?? ''] ?? art} ${TAETIGKEIT[taetigkeit] ?? taetigkeit.replaceAll('_', ' ')}`.trim();
}

const Verlauf = Type.Object({
  items: Type.Array(Type.Object({
    at: Type.String({ format: 'date-time' }), person: Type.Union([Type.String(), Type.Null()]),
    aktion: Type.String({ description: 'Aktion aus dem Audit; nach dem Abschluss mit Zusatz «.amended».' }), objekt: Type.String(), text: Type.String(),
    nachAbschluss: Type.Boolean({ description: 'Nach dem Abschluss («geändert nach Abschluss», A-75).' }),
  }, { additionalProperties: false })),
}, { $id: 'ProjektVerlauf', additionalProperties: false });

export function registerVerlaufRoutes(app: FastifyInstance, deps: Deps): void {
  app.addSchema(Verlauf);
  app.get('/v1/projekte/:id/verlauf', {
    schema: {
      tags: ['Projekte'], summary: 'Verlauf der Projektakte', params: IdParams, response: { 200: Type.Ref('ProjektVerlauf') },
      description: 'Wer wann was an der Projektakte geändert hat (Projekt und Objekte mit Bezug zum Projekt), älteste zuerst, höchstens die jüngsten 500; Einträge nach dem Abschluss markiert (A-75, UX-E13). Mit `projekt:read` am Projekt.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', { type: 'projekt', id });
    const p = await req.tx(tx => store.get(tx, id));
    if (!p) throw notFound('Projekt');
    const rows = await fullTx(deps.db, req.requirePrincipal().tenantId, async tx => (await tx.query<{ ts: Date; actor_name: string | null; action: string; resource_type: string | null }>(
      `SELECT * FROM (SELECT a.id, a.ts, a.actor_name, a.action, a.resource_type FROM ${SCHEMA}.audit_log a
          WHERE a.resource_id = $1 OR a.data->>'projektId' = $1::text ORDER BY a.ts DESC, a.id DESC LIMIT ${LIMIT}) x
        ORDER BY x.ts, x.id`, [id])).rows);
    // Zeitpunkt des Abschlusses: letzter Wechsel in einen Endzustand (abgeschlossen bzw. abgebrochen)
    const ende = [...rows].reverse().find(r => r.action === 'projekt.completed' || r.action === 'projekt.cancelled')?.ts.getTime() ?? null;
    const beendet = p.lebenszyklus === 'abgeschlossen' || p.lebenszyklus === 'abgebrochen';
    return {
      items: rows.map(r => {
        const nach = beendet && ende !== null && r.ts.getTime() > ende;
        return {
          at: r.ts.toISOString(), person: r.actor_name, aktion: nach ? `${r.action}.amended` : r.action, objekt: r.resource_type ?? '',
          text: `${text(r.action, r.resource_type)}${nach ? ' · geändert nach Abschluss' : ''}`, nachAbschluss: nach,
        };
      }),
    };
  });
}

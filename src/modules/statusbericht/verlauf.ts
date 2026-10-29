/**
 * Versionen statt Sperre am Statusbericht (AP-E8-5; UC-004 A4, UC-005 A4; Master G2, A-75, UX-E13): Änderungen nach dem
 * Einreichen bzw. nach dem Abschluss der Periode sind erlaubt und markiert; ein geprüfter Bericht wird erneut geprüft,
 * nach dem Abschluss führt die Änderung das Dashboard der Periode nach. Verlauf am Bericht aus dem Audit.
 */
import { Type } from '@sinclair/typebox';
import { notFound, type Actor, type Db, type Deps, type Tx } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { fullTx, record, SCHEMA } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { linkMonatsabschluss } from './pruefung-routes.ts';
import { monat } from './pruefung.ts';
import { BerichtParams } from './schemas.ts';
import * as store from './store.ts';

const S = SCHEMA;
export type GeaendertNach = 'einreichen' | 'abschluss';
export const GEAENDERT_TEXT: Record<GeaendertNach, string> = { einreichen: 'geändert nach Einreichen', abschluss: 'geändert nach Abschluss' };

/** Ist die Änderung eine «nach …»? Eingereichter oder geprüfter Bericht bzw. abgeschlossene Periode. */
export function nachWas(r: store.Row | null, periodeStand: 'offen' | 'abgeschlossen'): GeaendertNach | null {
  if (periodeStand === 'abgeschlossen') return r ? 'abschluss' : null;
  return r && (r.stand === 'eingereicht' || r.stand === 'geprueft') ? 'einreichen' : null;
}

/**
 * Markieren nach der Änderung: «geändert nach …», ein geprüfter Bericht ist wieder eingereicht (die Prüfung bleibt im
 * Verlauf), die Prüfaufgabe der UE öffnet sich (sie sieht die Änderung).
 */
export async function markieren(tx: Tx, who: Actor, vorher: store.Row, r: store.Row, nach: GeaendertNach): Promise<void> {
  const neu = (await tx.query<{ id: string }>(
    `UPDATE ${S}.statusbericht SET geaendert_nach = $2, geaendert_nach_at = now(), stand = CASE WHEN stand = 'geprueft' THEN 'eingereicht' ELSE stand END
      WHERE id = $1 RETURNING id`, [r.id, nach])).rows[0];
  if (!neu) return;
  await record(tx, who, {
    action: 'statusbericht.amended', resourceType: 'statusbericht', resourceId: r.id,
    data: { nach, vorherStand: vorher.stand, periode: r.periode, projektId: r.projekt_id }, event: { id: r.id, periode: r.periode, nach },
  });
  if (r.stand === 'eingereicht' || r.stand === 'geprueft') {
    await aufgabe.oeffnen(tx, {
      art: 'statusbericht.pruefen', bezug: { typ: 'periode', id: r.periode }, empfaenger: { recht: 'statusbericht:review' },
      titel: `Statusberichte ${monat(r.periode)} prüfen`, kontext: GEAENDERT_TEXT[nach], link: linkMonatsabschluss(r.periode, 'eingereicht'),
    });
  }
}

/**
 * Dashboard der abgeschlossenen Periode nachführen (UC-005 A4.1): Werte des eingereichten Berichts in die Zeile des
 * Projekts. Die Zeile ist sonst unveränderlich; in voller Sicht (Migration 460), das Recht prüft die Route.
 */
export async function dashboardNachfuehren(db: Db, tenantId: string, r: store.Row): Promise<void> {
  if (r.stand !== 'eingereicht' && r.stand !== 'geprueft') return;
  await fullTx(db, tenantId, tx => tx.query(
    `UPDATE ${S}.dashboard_zeile SET statusbericht_id = $3, gemeldet = true, status = $4, trend = $5, phase = $6, abschluss_per = $7::date,
            naechster_meilenstein = $8, werte_aus = $1
      WHERE periode = $1 AND projekt_id = $2`,
    [r.periode, r.projekt_id, r.id, r.status, r.trend, r.phase, r.abschluss_per, r.naechster_meilenstein]));
}

export interface VerlaufEintrag { at: Date; person: string | null; aktion: string; text: string }

const AKTION: Record<string, string> = {
  'statusbericht.created': 'erfasst', 'statusbericht.updated': 'geändert', 'statusbericht.submitted': 'eingereicht',
  'statusbericht.withdrawn': 'zurückgezogen', 'statusbericht.reviewed': 'geprüft', 'statusbericht.review_withdrawn': 'Prüfung zurückgenommen',
  'statusbericht.returned': 'Rückfrage gestellt', 'statusbericht.amended': 'geändert nach',
};

/** Verlauf des Berichts aus dem Audit (A-75): für alle, die den Bericht lesen; das Leserecht prüft die Route. */
export async function verlauf(db: Db, tenantId: string, berichtId: string): Promise<VerlaufEintrag[]> {
  const rows = await fullTx(db, tenantId, async tx => (await tx.query<{ ts: Date; actor_name: string | null; action: string; data: { nach?: GeaendertNach } }>(
    `SELECT ts, actor_name, action, data FROM ${S}.audit_log WHERE resource_type = 'statusbericht' AND resource_id = $1 ORDER BY ts, id`, [berichtId])).rows);
  return rows.map(x => ({
    at: x.ts, person: x.actor_name, aktion: x.action,
    text: x.action === 'statusbericht.amended' && x.data.nach ? GEAENDERT_TEXT[x.data.nach] : AKTION[x.action] ?? x.action,
  }));
}

const Verlauf = Type.Object({
  items: Type.Array(Type.Object({
    at: Type.String({ format: 'date-time' }), person: Type.Union([Type.String(), Type.Null()]), aktion: Type.String(), text: Type.String(),
  }, { additionalProperties: false })),
}, { $id: 'StatusberichtVerlauf', additionalProperties: false });

/** Verlauf am Bericht (UX-E13): wer wann was getan hat, für alle mit Leserecht am Projekt. */
export function registerVerlaufRoutes(app: FastifyInstance, deps: Deps): void {
  app.addSchema(Verlauf);
  app.get('/v1/projekte/:id/berichte/:periode/verlauf', {
    schema: {
      tags: ['Statusberichte'], summary: 'Verlauf des Statusberichts', params: BerichtParams, response: { 200: Type.Ref('StatusberichtVerlauf') },
      description: 'Erfassen, Einreichen, Prüfen, Rückfragen und Änderungen nach dem Einreichen bzw. nach dem Abschluss («geändert nach …», A-75, UX-E13), älteste zuerst. Mit `projekt:read` am Projekt.',
    },
  }, async req => {
    const { id, periode } = req.params as { id: string; periode: string };
    await req.need('projekt:read', { type: 'projekt', id });
    const r = await req.tx(tx => store.get(tx, id, periode));
    if (!r) throw notFound('Statusbericht');
    return { items: (await verlauf(deps.db, req.requirePrincipal().tenantId, r.id)).map(x => ({ ...x, at: x.at.toISOString() })) };
  });
}

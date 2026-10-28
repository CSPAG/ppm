/**
 * Route der Ad-hoc-Auswertungen (BC PC.04.03; UC-014 A2.1; AP-E7-6): Recht `auswertung:write` an der Organisation (UE,
 * FI; docs/fachmodell.md 3.3), Beträge zusätzlich mit `finanzen:read` an der Organisation. Lesesicht über `req.tx`.
 * Export als CSV über `format=csv` (ohne Fremdbibliothek).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { forbidden, invalid, type Deps } from '@vollholz/platform';
import { auswerten, csv, GRUPPIERUNG_LABEL, istFinanz, KENNZAHL_LABEL, LEBENSZYKLUS_LABEL, projekte, STATUS_LABEL } from './adhoc.ts';
import {
  Auswertung, AuswertungEinzelwert, AuswertungGruppe, AuswertungQuery, KENNZAHLEN,
  type AuswertungEinzelwertOut, type AuswertungGruppeOut, type AuswertungOut, type AuswertungQueryIn, type Kennzahl,
} from './adhoc-schemas.ts';
import { SCHEMA } from '../../platform.ts';
import * as store from './store.ts';

export const TAG_ADHOC = 'Auswertungen';
const RECHT = 'auswertung:write';
const teile = (s: string | undefined) => (s ? [...new Set(s.split(','))] : undefined);

export function registerAdhocRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [AuswertungGruppe, AuswertungEinzelwert, Auswertung]) app.addSchema(s);

  app.get('/v1/auswertungen', {
    schema: {
      tags: [TAG_ADHOC], summary: 'Ad-hoc-Auswertung',
      description: 'Ad-hoc-Auswertung (UC-014 A2, PC.04.03): Projekte der sichtbaren Portfolios nach Filter (Portfolio, Phase, Lebenszyklus, Status des letzten Berichts bis zur Stichperiode, Handlungsfeld), Kennzahlen je Gruppe mit Summe und den Einzelwerten je Projekt. Beträge (Budget, Prognose, Ist aus den Kostenpositionen) nur mit `finanzen:read` an der Organisation. Mit `format=csv` als Export (Gruppen oder mit `ebene=einzelwerte` je Projekt). Recht `auswertung:write` an der Organisation.',
      querystring: AuswertungQuery, response: { 200: Type.Ref('Auswertung') },
    },
  }, async (req, reply) => {
    const q = req.query as AuswertungQueryIn;
    req.requirePrincipal();
    if (!(await req.can(RECHT))) throw forbidden('Ad-hoc-Auswertungen erstellen die Unternehmensentwicklung und die Finanzen.');
    const finanzen = await req.can('finanzen:read');
    const kennzahlen = (teile(q.kennzahlen) ?? ['projekte', 'kritisch']) as Kennzahl[];
    if (!finanzen && kennzahlen.some(istFinanz)) throw forbidden('Beträge sehen nur Personen mit Leserecht auf die Finanzen.');
    if (q.ebene && q.format !== 'csv') throw invalid('`ebene` gilt nur für den Export.', [{ path: '/ebene', message: 'nur mit format=csv' }]);
    const gruppierung = q.gruppierung ?? 'portfolio';

    const out = await req.tx(async (tx): Promise<AuswertungOut> => {
      const sichtbar = await store.portfolios(tx);
      const schluessel = teile(q.portfolio);
      const unbekannt = (schluessel ?? []).filter(s => !sichtbar.some(p => p.schluessel === s));
      if (unbekannt.length) throw invalid('Diese Portfolios gibt es nicht, oder Sie sehen sie nicht.', [{ path: '/portfolio', message: unbekannt.join(', ') }]);
      const periode = q.periode ?? await store.laufendePeriode(tx);
      const rows = await projekte(tx, {
        periode, finanzen,
        portfolioIds: sichtbar.filter(p => !schluessel || schluessel.includes(p.schluessel)).map(p => p.id),
        phasen: teile(q.phase), lebenszyklen: teile(q.lebenszyklus) ?? ['aktiv'], status: teile(q.status), handlungsfeldId: q.handlungsfeld,
      });
      const handlungsfelder = (await tx.query<{ id: string; label: string }>(`SELECT id, label FROM ${SCHEMA}.handlungsfeld ORDER BY position, label, id`)).rows;
      return {
        periode, gruppierung,
        kennzahlen: KENNZAHLEN.filter(k => kennzahlen.includes(k)).map(k => ({ schluessel: k, label: KENNZAHL_LABEL[k], einheit: istFinanz(k) ? 'chf' as const : 'anzahl' as const })),
        ...auswerten(rows, KENNZAHLEN.filter(k => kennzahlen.includes(k)), gruppierung),
        optionen: { portfolios: sichtbar.map(p => ({ schluessel: p.schluessel, name: p.name })), handlungsfelder, finanzen },
      };
    });
    if (q.format !== 'csv') return out;

    const ks = out.kennzahlen;
    const zeilen = q.ebene === 'einzelwerte'
      ? [['Nummer', 'Projekt', 'Portfolio', 'Phase', 'Lebenszyklus', 'Status', 'Handlungsfeld', ...ks.map(k => k.label)],
        ...(out.einzelwerte as AuswertungEinzelwertOut[]).map(e => [e.nummer, e.name, e.portfolio, e.phase, LEBENSZYKLUS_LABEL[e.lebenszyklus] ?? e.lebenszyklus, e.status ? STATUS_LABEL[e.status]! : null, e.handlungsfeld, ...ks.map(k => e.werte[k.schluessel] ?? 0)])]
      : [[GRUPPIERUNG_LABEL[gruppierung], ...ks.map(k => k.label)],
        ...(out.gruppen as AuswertungGruppeOut[]).map(g => [g.label, ...ks.map(k => g.werte[k.schluessel] ?? 0)]),
        ['Summe', ...ks.map(k => out.summe[k.schluessel] ?? 0)]];
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="auswertung-${out.periode}${q.ebene === 'einzelwerte' ? '-einzelwerte' : ''}.csv"`)
      .send(csv(zeilen));
  });
}

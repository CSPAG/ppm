/**
 * Routen der Freigabe der Jahresziele (BC ZM.02.02; UC-011 Schritte 6–7, A2; Kernablauf K6 Schritte 6–7):
 * Zusammenfassung vor der Vorlage, «Zur Freigabe vorlegen» (GL, ziel:write) und «Freigabe erfassen» (UE,
 * ziel:freigabe; der VR ist kein Benutzer, UX-E8). Übergänge als eigene POST-Routen mit `If-Match` auf die Version des
 * Zieljahrs; Audit, Ereignis und Aufgaben in derselben Transaktion.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, etag, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { FreigabeErfassen, Vorlage, type FreigabeErfassenIn, type VorlageOut } from './freigabe-schemas.ts';
import * as store from './freigabe-store.ts';
import { VERVOLLSTAENDIGEN, zieljahrBezug, zieljahrOut } from './zyklus-routes.ts';
import { JahrParams } from './zyklus-schemas.ts';
import * as zyklus from './zyklus-store.ts';

const TAG = 'Ziele';

const datumCh = (d: string) => d.split('-').reverse().join('.');

/** Sperre der Vorlage (K6 Regeln, I-P2): Regel, Ist-Wert, betroffene Ziele, Ausweg. */
export const metrikFehltText = (nummern: string[]) =>
  `Metrik fehlt: ${nummern.length === 1 ? '1 Jahresziel hat' : `${nummern.length} Jahresziele haben`} keine Metrik oder keinen Zielwert (${nummern.join(', ')}). Ergänze Metrik und Zielwert.`;

const snapshot = (r: zyklus.ZieljahrRow) => ({ id: r.id, jahr: r.jahr, stand: r.stand, freigabeAt: r.freigabe_at, version: r.version });

async function vorlageLesen(req: FastifyRequest, jahr: number): Promise<VorlageOut> {
  const d = await req.tx(async tx => {
    const zj = await zyklus.getJahr(tx, jahr);
    if (!zj) throw notFound(`Zielzyklus ${jahr}`);
    return {
      zj,
      felder: await store.jeHandlungsfeld(tx, jahr),
      anzahl: await store.anzahl(tx, jahr),
      vorjahr: await store.vorjahrVorhanden(tx, jahr),
      ohneMetrik: await store.ohneMetrik(tx, jahr),
      ohneUmsetzung: await store.ohneUmsetzung(tx, jahr),
    };
  });
  return {
    jahr, stand: d.zj.stand, version: d.zj.version, anzahl: d.anzahl,
    anzahlVorjahr: d.vorjahr ? d.felder.reduce((n, f) => n + f.anzahl_vorjahr, 0) : null,
    jeHandlungsfeld: d.felder.map(f => ({ handlungsfeldId: f.handlungsfeld_id, label: f.label, anzahl: f.anzahl, anzahlVorjahr: f.anzahl_vorjahr })),
    ohneMetrik: d.ohneMetrik, ohneUmsetzung: d.ohneUmsetzung,
    can: {
      vorlegen: d.zj.stand === 'in_arbeit' && await req.can('ziel:write'),
      freigabe: d.zj.stand === 'zur_freigabe' && await req.can('ziel:freigabe'),
    },
  };
}

export function registerFreigabeRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Vorlage, FreigabeErfassen]) app.addSchema(s);

  app.get('/v1/ziele/:jahr/vorlage', {
    schema: {
      tags: [TAG], summary: 'Vorlage an den VR vorbereiten', params: JahrParams, response: { 200: Type.Ref('ZielVorlage') },
      description: 'Zusammenfassung (Jahresziele je Handlungsfeld, Vergleich zum Vorjahr) und Prüfung vor dem Vorlegen (K6 Schritt 6). Ohne Zielzyklus 404.',
    },
  }, async req => {
    const { jahr } = req.params as { jahr: number };
    await req.need('ziel:read');
    return vorlageLesen(req, jahr);
  });

  app.post('/v1/ziele/:jahr/vorlegen', {
    schema: {
      tags: [TAG], summary: 'Jahresziele zur Freigabe vorlegen', params: JahrParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Zieljahr') },
      description: 'Setzt die Jahresziele auf «zur Freigabe» (UC-011 Schritt 6); danach gesperrt bis zum Entscheid des VR. 409 ausserhalb von «in Arbeit», ohne Jahresziele oder solange ein Jahresziel keine Metrik bzw. keinen Zielwert hat (`reason: metrik_fehlt`, `ohneMetrik`). Erledigt die Aufgabe «Jahresziele vervollständigen».',
    },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    const version = requireIfMatch(req);
    await req.need('ziel:write');
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await zyklus.getJahr(tx, jahr, 'exklusiv');
      if (!before) throw notFound(`Zielzyklus ${jahr}`);
      if (before.version !== version) throw preconditionFailed(before.version);
      if (before.stand !== 'in_arbeit') throw conflict(`Die Jahresziele ${jahr} sind nicht in Arbeit und können nicht vorgelegt werden.`, { reason: 'stand', stand: before.stand });
      if (!(await store.anzahl(tx, jahr))) throw conflict(`Der Zielzyklus ${jahr} hat noch keine Jahresziele. Füge zuerst Jahresziele hinzu.`, { reason: 'leer' });
      // Jedes Ziel hat eine Metrik (UC-011 Schritt 5): Sperre beim Vorlegen (K6 Regeln)
      const fehlt = await store.ohneMetrik(tx, jahr);
      if (fehlt.length) throw conflict(metrikFehltText(fehlt.map(f => f.nummer)), { reason: 'metrik_fehlt', ohneMetrik: fehlt });
      const r = await store.setzen(tx, jahr, version, { stand: 'zur_freigabe', vorgelegt: true });
      if (!r) throw preconditionFailed(before.version);
      await aufgabe.erledigen(tx, { art: VERVOLLSTAENDIGEN, bezug: zieljahrBezug(r) });
      await record(tx, who, { action: 'zieljahr.submitted', resourceType: 'zieljahr', resourceId: r.id, data: { before: snapshot(before), after: snapshot(r) }, event: snapshot(r) });
      return r;
    });
    reply.header('etag', etag(row.version));
    return zieljahrOut(row, false);
  });

  app.post('/v1/ziele/:jahr/freigabe', {
    schema: {
      tags: [TAG], summary: 'Freigabe des VR erfassen', params: JahrParams, headers: IfMatchHeaders, body: Type.Ref('FreigabeErfassen'), response: { 200: Type.Ref('Zieljahr') },
      description: 'Entscheid des VR (UC-011 Schritt 7, UE): «freigegeben» setzt die Jahresziele in Kraft; «anpassungen» (A2) setzt sie mit den Rückmeldungen auf «in Arbeit» zurück und legt allen mit `ziel:write` (GL) die Aufgabe zum Anpassen in den Eingang. 409 ausserhalb von «zur Freigabe».',
    },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    const version = requireIfMatch(req);
    await req.need('ziel:freigabe');
    const body = req.body as FreigabeErfassenIn;
    const text = (body.text ?? '').trim();
    if (body.entscheid === 'anpassungen' && !text) {
      throw invalid('Die Rückmeldungen des VR fehlen.', [{ path: '/text', message: 'Erfasse, welche Anpassungen der VR verlangt.' }]);
    }
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await zyklus.getJahr(tx, jahr, 'exklusiv');
      if (!before) throw notFound(`Zielzyklus ${jahr}`);
      if (before.version !== version) throw preconditionFailed(before.version);
      if (before.stand !== 'zur_freigabe') throw conflict(`Die Jahresziele ${jahr} liegen dem VR nicht zur Freigabe vor.`, { reason: 'stand', stand: before.stand });
      const freigegeben = body.entscheid === 'freigegeben';
      const r = await store.setzen(tx, jahr, version, freigegeben
        ? { stand: 'in_kraft', freigabeAt: body.datum, freigabeText: text }
        : { stand: 'in_arbeit', freigabeAt: null, freigabeText: text });
      if (!r) throw preconditionFailed(before.version);
      if (!freigegeben) {
        // GL informieren (UC-011 A2): Aufgabe an alle mit ziel:write, weiter bei Schritt 3
        await aufgabe.oeffnen(tx, {
          art: VERVOLLSTAENDIGEN, bezug: zieljahrBezug(r), empfaenger: { recht: 'ziel:write' },
          titel: `Jahresziele ${jahr} anpassen`,
          kontext: `Der VR verlangt Anpassungen (Entscheid ${datumCh(body.datum)})`,
          link: `/ziele/${jahr}`,
          frist: r.vorlage_bis && r.vorlage_bis >= body.datum ? { datum: r.vorlage_bis, art: 'kalendertage' } : null,
        });
      }
      await record(tx, who, {
        action: freigegeben ? 'zieljahr.approved' : 'zieljahr.changes_requested', resourceType: 'zieljahr', resourceId: r.id,
        data: { before: snapshot(before), after: snapshot(r), entscheid: body.entscheid, datum: body.datum, text }, event: snapshot(r),
      });
      return r;
    });
    reply.header('etag', etag(row.version));
    return zieljahrOut(row, await req.can('ziel:write'));
  });
}

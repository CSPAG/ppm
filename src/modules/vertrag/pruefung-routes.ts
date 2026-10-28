/**
 * Routen für Quality-Check und Unterschriften (AP-E3-2; fachmodell.md 5: `POST …/quality-check`, `POST …/unterschriften`)
 * nach dem Muster der Handlungsfelder: Lesesicht über `req.tx`, Rechte am Projekt, `can`, ETag/If-Match (412),
 * Idempotenz, Audit und Ereignis in derselben Transaktion.
 *
 * Die Übergänge setzen den Stand der Vertragsversion, die nur mit `vertrag:write` schreibbar ist (Lesesicht 170). Die UE
 * (`vertrag:review`) und die Unterzeichnenden (`vertrag:sign`) haben dieses Recht nicht: Nach der Prüfung ihres Rechts
 * läuft der Übergang darum in voller Sicht (`fullTx`), als Systemverhalten des Ablaufs (wie die Baseline, baseline.ts).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch,
  type Deps, type Tx,
} from '@vollholz/platform';
import { fullTx, record } from '../../platform.ts';
import { STAND_TEXT } from './entwurf.ts';
import * as pruefung from './pruefung.ts';
import { Pruefung, QualityCheckIn, UnterschriftIn, type PruefungOut, type QualityCheckInT, type UnterschriftInT } from './pruefung-schemas.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';

const projektOrt = (id: string) => ({ type: 'projekt', id });

/** Version und Projekt unter der Lesesicht, sonst 404 (fremde und unbekannte IDs gleich). */
async function sichtbar(tx: Tx, id: string): Promise<{ v: store.VersionRow; p: store.ProjektKopf }> {
  const v = await store.version(tx, id);
  const p = v && await store.projekt(tx, v.projekt_id);
  if (!v || !p) throw notFound('Vertragsversion');
  return { v, p };
}

async function ausgabe(req: FastifyRequest, tx: Tx, v: store.VersionRow, p: store.ProjektKopf, person: string): Promise<PruefungOut> {
  const checks = await pruefung.qualityChecks(tx, v.id);
  const dg = checks[0]?.ergebnis === 'bestaetigt' ? checks[0] : null;
  const soll = await pruefung.unterzeichnende(tx, p.id);
  const us = dg ? await pruefung.unterschriften(tx, dg.id) : [];
  const offen = v.stand === 'zur_unterzeichnung' && await req.can('vertrag:sign', projektOrt(p.id))
    ? await pruefung.offeneFunktionen(tx, person, soll, us) : [];
  return {
    versionId: v.id, nummer: v.nummer, stand: v.stand, version: v.version,
    qualityChecks: checks.map(q => ({
      id: q.id, ergebnis: q.ergebnis, at: q.at, personId: q.by_person,
      kommentare: Object.entries(q.kommentare).map(([k, text]) => ({ kapitel: Number(k), text })).sort((a, b) => a.kapitel - b.kapitel),
    })),
    unterzeichnung: dg ? {
      qualityCheckId: dg.id,
      anzahl: us.filter(u => u.ergebnis === 'unterzeichnet').length,
      vollstaendig: pruefung.FUNKTIONEN.every(f => us.some(u => u.funktion === f && u.ergebnis === 'unterzeichnet')),
      funktionen: pruefung.FUNKTIONEN.map(f => {
        const u = us.find(x => x.funktion === f);
        return {
          funktion: f, personen: soll[f],
          unterschrift: u ? { personId: u.person_id, inVertretungVon: u.in_vertretung_von, ergebnis: u.ergebnis, begruendung: u.begruendung, at: u.at } : null,
        };
      }),
    } : null,
    can: {
      qualityCheck: v.stand === 'in_pruefung' && v.anlass !== 'aenderung' && await req.can('vertrag:review'),
      unterzeichnen: offen,
    },
  };
}

export function registerPruefungRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Pruefung, QualityCheckIn, UnterschriftIn]) app.addSchema(s);
  const voll = <T>(req: FastifyRequest, fn: (tx: Tx) => Promise<T>) => fullTx(deps.db, req.requirePrincipal().tenantId, fn);

  app.get('/v1/vertragsversionen/:id/pruefung', {
    schema: {
      tags: [TAG], summary: 'Quality-Check und Unterschriften', params: IdParams, response: { 200: Type.Ref('VertragPruefung') },
      description: 'Quality-Checks mit Kommentar je Kapitel und der Stand der Unterschriften («2 von 3», K2 Schritt 8); `can.unterzeichnen` nennt die Funktionen, die die Person jetzt '
        + 'unterzeichnen kann (eigene oder in Vertretung mit Recht auf Unterschriften, A-31).',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const person = req.requirePrincipal().principalId;
    const { v, p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:read', projektOrt(p.id));
    const out = await req.tx(tx => ausgabe(req, tx, v, p, person));
    reply.header('etag', etag(v.version));
    return out;
  });

  app.post('/v1/vertragsversionen/:id/quality-check', {
    schema: {
      tags: [TAG], summary: 'Quality-Check erfassen', params: IdParams, headers: IfMatchHeaders,
      body: Type.Ref('VertragQualityCheckIn'), response: { 200: Type.Ref('VertragPruefung') },
      description: 'Nur «in Prüfung», mit `vertrag:review` (DM.02.05). `bestaetigt` → «zur Unterzeichnung», Sponsor, Projektleitung und CTL erhalten je eine Aufgabe (UC-002 Schritt 9); '
        + 'fehlt eine dieser Funktionen in der Projektorganisation: 409. `rueckmeldung` → «in Arbeit» mit Kommentaren je Kapitel, die PL erhält «Projektvertrag überarbeiten» (UC-002 A5). '
        + '`If-Match` = Version der Vertragsversion.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const body = req.body as QualityCheckInT;
    const person = req.requirePrincipal().principalId;
    const { v, p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('vertrag:review');
    const kommentare = Object.fromEntries((body.kommentare ?? []).map(k => [String(k.kapitel), k.text.trim()]));
    if ((body.kommentare ?? []).length !== Object.keys(kommentare).length) {
      throw invalid('Je Kapitel höchstens ein Kommentar.', [{ path: '/kommentare', message: 'Kapitel doppelt' }]);
    }
    if (body.ergebnis === 'rueckmeldung' && !Object.keys(kommentare).length) {
      throw invalid('Rückmeldung fehlt: Die Projektleitung erfährt sonst nicht, was zu ändern ist. Kommentieren Sie mindestens ein Kapitel.',
        [{ path: '/kommentare', message: 'mindestens ein Kommentar' }]);
    }
    const who = actorOf(req);
    await voll(req, async tx => {
      const r = await store.version(tx, id);
      if (!r) throw notFound('Vertragsversion');
      if (r.stand !== 'in_pruefung') throw conflict(`Version ${r.nummer} ist ${STAND_TEXT[r.stand]}, nicht in Prüfung.`, { reason: 'stand', stand: r.stand });
      // eine Änderung entscheidet der Sponsor ohne Quality-Check (UC-007 Schritt 3; AP-E3-4)
      if (r.anlass === 'aenderung') throw conflict('Eine Änderung entscheidet der Sponsor; ein Quality-Check ist nicht vorgesehen.', { reason: 'anlass' });
      if (r.version !== erwartet) throw preconditionFailed(r.version);
      const q = await pruefung.qualityCheckErfassen(tx, { version: r, projekt: p, erwartet, person, ergebnis: body.ergebnis, kommentare });
      if (!q.id) throw preconditionFailed(r.version + 1);
      const daten = { id, projektId: p.id, nummer: r.nummer, qualityCheckId: q.id, ergebnis: body.ergebnis, kapitel: Object.keys(kommentare).map(Number) };
      await record(tx, who, {
        action: body.ergebnis === 'bestaetigt' ? 'vertrag.review_confirmed' : 'vertrag.review_returned', resourceType: 'vertrag_version', resourceId: id,
        data: { ...daten, projekt: p.nummer }, event: daten,
      });
    });
    const out = await req.tx(async tx => ausgabe(req, tx, (await store.version(tx, id))!, p, person));
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/vertragsversionen/:id/unterschriften', {
    schema: {
      tags: [TAG], summary: 'Unterzeichnen oder verweigern', params: IdParams, headers: IfMatchHeaders,
      body: Type.Ref('VertragUnterschriftIn'), response: { 200: Type.Ref('VertragPruefung') },
      description: 'Nur «zur Unterzeichnung», mit `vertrag:sign` am Projekt (DM.02.06). Die Person unterzeichnet alle Funktionen (SP, PL, CTL), die sie innehat oder in Vertretung mit '
        + 'Recht auf Unterschriften wahrnimmt (A-31); protokolliert mit Person und Zeitpunkt. Nach der letzten Funktion: «unterzeichnet» (UC-002 Schritt 10). `verweigert` mit '
        + 'Begründung (Pflicht) → «in Arbeit», die PL erhält die Begründung im Eingang (UC-003 A5). Keine offene Unterschrift der Person: 409. `If-Match` = Version der Vertragsversion.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const body = req.body as UnterschriftInT;
    const person = req.requirePrincipal().principalId;
    const { p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('vertrag:sign', projektOrt(p.id));
    const begruendung = (body.begruendung ?? '').trim();
    if (body.ergebnis === 'verweigert' && !begruendung) {
      throw invalid('Begründung fehlt: Die Projektleitung erfährt sonst nicht, was zu ändern ist.', [{ path: '/begruendung', message: 'Pflicht beim Verweigern' }]);
    }
    const who = actorOf(req);
    await voll(req, async tx => {
      const r = await store.version(tx, id);
      if (!r) throw notFound('Vertragsversion');
      if (r.stand !== 'zur_unterzeichnung') throw conflict(`Version ${r.nummer} ist ${STAND_TEXT[r.stand]}, nicht zur Unterzeichnung.`, { reason: 'stand', stand: r.stand });
      if (r.version !== erwartet) throw preconditionFailed(r.version);
      const u = await pruefung.unterzeichnen(tx, { version: r, projekt: p, erwartet, person, ergebnis: body.ergebnis, begruendung });
      if (!u) throw preconditionFailed(r.version + 1);
      const daten = {
        id, projektId: p.id, nummer: r.nummer, ergebnis: body.ergebnis, stand: u.stand, vollstaendig: u.vollstaendig,
        funktionen: u.funktionen.map(f => ({ funktion: f.funktion, inVertretungVon: f.inVertretungVon })),
      };
      await record(tx, who, {
        action: body.ergebnis === 'unterzeichnet' ? 'vertrag.signed' : 'vertrag.signature_refused', resourceType: 'vertrag_version', resourceId: id,
        data: { ...daten, projekt: p.nummer, ...(begruendung ? { begruendung } : {}) }, event: daten,
      });
    });
    const out = await req.tx(async tx => ausgabe(req, tx, (await store.version(tx, id))!, p, person));
    reply.header('etag', etag(out.version));
    return out;
  });
}

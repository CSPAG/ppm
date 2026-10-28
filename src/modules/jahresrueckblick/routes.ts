/**
 * Routen des Jahresrückblicks (BC ZM.03.03, UC-013; AP-E7-5; fachmodell.md 5): `GET` erzeugt die Auswertung, `PUT`
 * erfasst Erkenntnisse und Massnahmen (If-Match, W/"0" beim ersten Speichern), `POST …/traktandieren` setzt sie auf die
 * Traktandenliste des PRAT. Lesen mit `ziel:read`, erfassen mit `quartalsbericht:write` (UE).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { actorOf, conflict, etag, IfMatchHeaders, preconditionFailed, requireIfMatch, type Deps } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { anfordern } from './lessons.ts';
import { antwort, traktandieren } from './rueckblick.ts';
import { Jahresauswertung, JahrParams, Jahresrueckblick, JahresrueckblickPut, type JahresrueckblickOut, type JahresrueckblickPutIn } from './schemas.ts';
import * as store from './store.ts';

export const TAG = 'Jahresrückblick';
const SCHREIBEN = 'quartalsbericht:write';

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Jahresauswertung, Jahresrueckblick, JahresrueckblickPut]) app.addSchema(s);

  app.get('/v1/jahresrueckblicke/:jahr', {
    schema: {
      tags: [TAG], summary: 'Jahresrückblick', params: JahrParams, response: { 200: Type.Ref('Jahresrueckblick') },
      description: 'Jahresauswertung (UC-013 Schritt 1): Zielerreichung des Jahres, abgeschlossene, abgebrochene und laufende Vorhaben; Erkenntnisse und Massnahmen. In Arbeit live, ab dem Traktandieren der Stand bei Traktandierung. Recht `ziel:read` oder `quartalsbericht:write`. ETag = Fassung (W/"0", solange nichts gespeichert ist).',
    },
  }, async (req, reply): Promise<JahresrueckblickOut> => {
    const { jahr } = req.params as { jahr: number };
    const schreiben = await req.can(SCHREIBEN);
    if (!schreiben) await req.need('ziel:read');
    const out = await req.tx(async tx => antwort(tx, jahr, await store.lesen(tx, jahr), schreiben));
    reply.header('etag', etag(out.version));
    return out;
  });

  app.put('/v1/jahresrueckblicke/:jahr', {
    schema: {
      tags: [TAG], summary: 'Erkenntnisse und Massnahmen erfassen', params: JahrParams, headers: Type.Partial(IfMatchHeaders),
      body: Type.Ref('JahresrueckblickPut'), response: { 200: Type.Ref('Jahresrueckblick') },
      description: 'Legt den Jahresrückblick an bzw. erfasst Erkenntnisse und Massnahmen für den nächsten Zielzyklus (UC-013 Schritt 4); nicht während der Traktandierung (409). Bestehend nur mit `If-Match`.',
    },
  }, async (req, reply): Promise<JahresrueckblickOut> => {
    const { jahr } = req.params as { jahr: number };
    const body = req.body as JahresrueckblickPutIn;
    await req.need(SCHREIBEN);
    const who = actorOf(req);
    const t = { erkenntnisse: body.erkenntnisse.trim(), massnahmen: body.massnahmen.trim() };
    const out = await req.tx(async tx => {
      const r = await store.lesen(tx, jahr);
      // Anlegen ohne If-Match; bestehend nur mit If-Match (sonst 428)
      const version = r ? requireIfMatch(req) : 0;
      if (r?.stand === 'traktandiert') throw conflict('Der Jahresrückblick ist traktandiert. Erfasse die Erkenntnisse nach dem Entscheid des PRAT.');
      if (r && r.version !== version) throw preconditionFailed(r.version);
      // Gleichzeitig geändert bzw. angelegt: 412 statt einer verlorenen Änderung
      if (r && !(await store.erfassen(tx, r.id, version, t))) throw preconditionFailed((await store.vonId(tx, r.id))?.version ?? r.version);
      const id = r ? r.id : await store.anlegen(tx, jahr, t);
      if (!id) throw preconditionFailed((await store.lesen(tx, jahr))?.version ?? 1);
      await record(tx, who, { action: r ? 'jahresrueckblick.updated' : 'jahresrueckblick.created', resourceType: 'jahresrueckblick', resourceId: id, data: { jahr } });
      return antwort(tx, jahr, await store.lesen(tx, jahr), true);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/jahresrueckblicke/:jahr/traktandieren', {
    schema: {
      tags: [TAG], summary: 'Jahresrückblick traktandieren', params: JahrParams, response: { 200: Type.Ref('Jahresrueckblick') },
      description: 'Hält die Jahresauswertung fest und schlägt sie dem PRAT vor (entscheidendes Gremium des Portfolios der Kategorie A; UC-013 Schritt 3, UC-006). Ohne gespeicherten Jahresrückblick 404, bereits traktandiert oder ausgewertet 409. Recht `quartalsbericht:write`.',
    },
  }, async (req, reply): Promise<JahresrueckblickOut> => {
    const { jahr } = req.params as { jahr: number };
    await req.need(SCHREIBEN);
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const r = await traktandieren(tx, jahr);
      await record(tx, who, { action: 'jahresrueckblick.scheduled', resourceType: 'jahresrueckblick', resourceId: r.id, data: { jahr }, event: { id: r.id, jahr } });
      return antwort(tx, jahr, r, true);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/jahresrueckblicke/:jahr/lessons-learned/anfordern', {
    schema: {
      tags: [TAG], summary: 'Lessons Learned anfordern', params: JahrParams,
      response: { 200: Type.Object({
        vorhaben: Type.Integer({ description: 'Im Jahr abgeschlossene Vorhaben ohne Lessons Learned.' }),
        aufgaben: Type.Integer({ description: 'Geöffnete oder nachgeführte Aufgaben an die Projektleitungen.' }),
      }, { additionalProperties: false }) },
      description: 'Legt den Projektleitungen der im Jahr abgeschlossenen Vorhaben ohne Lessons Learned die Aufgabe «Lessons Learned erfassen» in den Eingang (UC-013 A1); idempotent je Projekt und Person, erledigt mit der ersten erfassten Lesson Learned. Legt den Jahresrückblick an, falls noch keiner gespeichert ist. Recht `quartalsbericht:write`.',
    },
  }, async (req) => {
    const { jahr } = req.params as { jahr: number };
    await req.need(SCHREIBEN);
    const who = actorOf(req);
    return req.tx(async tx => {
      // Anfordern gehört zur Arbeit am Rückblick (UC-013 Schritt 2): ohne gespeicherten Rückblick wird er angelegt
      const leer = { erkenntnisse: '', massnahmen: '' };
      const id = (await store.lesen(tx, jahr))?.id ?? (await store.anlegen(tx, jahr, leer)) ?? (await store.lesen(tx, jahr))!.id;
      const n = await anfordern(tx, jahr);
      await record(tx, who, { action: 'jahresrueckblick.lessons_requested', resourceType: 'jahresrueckblick', resourceId: id, data: { jahr, ...n } });
      return n;
    });
  });
}

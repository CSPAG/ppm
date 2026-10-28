/**
 * Routen der Vorlagen (AM.03.01; UC-018 Schritte 1–2; AP-E3-5 Grundbestand, AP-E7-7 Versionen und Feldzuordnung) nach dem
 * Muster der Handlungsfelder: Recht `vorlage:write` (UE), Lesesicht über `req.tx`, Fähigkeiten `can`, If-Match (412),
 * Idempotenz (Querschnitt), Audit und Ereignis in derselben Transaktion.
 *
 * Ablauf: Word-Vorlage hochladen → Platzhalter werden gelesen und mit Vorschlag zugeordnet (Entwurf) → Zuordnung
 * ergänzen → System prüft → aktiv setzen; die aktive Version gilt für künftige Word-Ausgaben dieser Art (DM.02.07).
 */
import { createHash } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import {
  actorOf, conflict, etag, IdempotencyHeaders, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { ART_NAME, ARTEN, type Art } from './arten.ts';
import { katalog } from './felder.ts';
import { grundbestand } from './grundbestand.ts';
import { MIME } from './modell.ts';
import { pruefen, vorschlag } from './pruefung.ts';
import {
  ArtParams, Feld, Grundbestand, Meldung, Pruefung, VersionCreate, VersionParams, VersionPatch, VorlageArt, VorlageDetail, VorlageList, VorlageVersion,
  type VersionCreateIn, type VersionPatchIn, type VorlageVersionOut,
} from './schemas.ts';
import * as store from './store.ts';
import { lesen, VorlageFehler } from './wordvorlage.ts';

export const TAG = 'Vorlagen';

/** Grösste Datei (5 MB) und grösste Anfrage (Base64 mit Rand). */
const MAX_DATEI = 5 * 1024 * 1024;
const BODY_LIMIT = 8 * 1024 * 1024;

const RECHT = 'vorlage:write';

const grundOut = (art: Art) => {
  const g = grundbestand(art);
  return g ? { version: g.version, quelle: g.quelle } : null;
};

const versionOut = (r: store.VersionRow): VorlageVersionOut => {
  const p = pruefen(r.art, r.platzhalter, r.zuordnung, r.personendaten);
  const entwurf = r.stand === 'entwurf';
  return {
    id: r.id, art: r.art, version: r.version, stand: r.stand, dateiname: r.dateiname, groesse: Number(r.groesse), sha256: r.sha256,
    platzhalter: r.platzhalter, zuordnung: r.zuordnung, personendaten: r.personendaten, bemerkung: r.bemerkung, aktivAt: r.aktiv_at,
    erstelltAt: r.created_at, erstelltVon: r.created_by ? { id: r.created_by, name: r.created_name } : null, rev: r.rev, pruefung: p,
    can: { zuordnen: entwurf, aktivieren: entwurf && p.aktivierbar, entfernen: entwurf },
  };
};
const snapshot = (r: store.VersionRow) => ({ art: r.art, version: r.version, stand: r.stand, dateiname: r.dateiname, sha256: r.sha256, zuordnung: r.zuordnung, rev: r.rev });

async function version(tx: Tx, art: Art, nr: number): Promise<store.VersionRow> {
  const r = await store.eine(tx, art, nr);
  if (!r) throw notFound('Vorlage');
  return r;
}

/** Entwurf mit passendem Stand der Zeile, sonst 409 (nicht Entwurf) bzw. 412. */
function entwurf(r: store.VersionRow, rev: number): void {
  if (r.stand !== 'entwurf') throw conflict(`Version ${r.version} ist ${r.stand === 'aktiv' ? 'aktiv' : 'abgelöst'} und lässt sich nicht mehr ändern. Laden Sie eine neue Version hoch.`, { reason: 'nicht_entwurf' });
  if (r.rev !== rev) throw preconditionFailed(r.rev);
}

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Grundbestand, Feld, Meldung, Pruefung, VorlageVersion, VorlageArt, VorlageList, VorlageDetail, VersionCreate, VersionPatch]) app.addSchema(s);

  app.get('/v1/vorlagen', {
    schema: {
      tags: [TAG], summary: 'Vorlagen auflisten', response: { 200: Type.Ref('VorlageList') },
      description: 'Alle Dokumentarten (UC-018 Schritt 1) mit Grundbestand, aktiver Version, Anzahl Versionen und Entwürfe und ob ein Modul Daten liefert.',
    },
  }, async req => {
    await req.need(RECHT);
    const rows = await req.tx(tx => store.alle(tx));
    return {
      items: ARTEN.map(art => {
        const v = rows.filter(r => r.art === art);
        return {
          art, name: ART_NAME[art], grundbestand: grundOut(art), aktiv: v.find(r => r.stand === 'aktiv')?.version ?? null,
          entwuerfe: v.filter(r => r.stand === 'entwurf').length, versionen: v.length, datenquelle: katalog(art) !== null,
        };
      }),
    };
  });

  app.get('/v1/vorlagen/:art', {
    schema: {
      tags: [TAG], summary: 'Vorlage einer Dokumentart', params: ArtParams, response: { 200: Type.Ref('VorlageDetail') },
      description: 'Versionen (neueste zuerst) mit Platzhaltern, Zuordnung und Prüfung, dazu der Feldkatalog der Art.',
    },
  }, async req => {
    const { art } = req.params as { art: Art };
    await req.need(RECHT);
    const rows = await req.tx(tx => store.alle(tx, art));
    return { art, name: ART_NAME[art], grundbestand: grundOut(art), felder: katalog(art) ? [...katalog(art)!] : null, versionen: rows.map(versionOut) };
  });

  app.post('/v1/vorlagen/:art/versionen', {
    bodyLimit: BODY_LIMIT,
    schema: {
      tags: [TAG], summary: 'Neue Version hochladen', params: ArtParams, headers: IdempotencyHeaders, body: Type.Ref('VorlageVersionCreate'),
      response: { 201: Type.Ref('VorlageVersion') },
      description: 'Word-Datei (.docx, höchstens 5 MB) als Base64. Das System liest die Platzhalter («Projektname»), schlägt die Zuordnung vor '
        + '(wie in der letzten Version bzw. nach gleicher Bezeichnung) und legt die Version als Entwurf an. Ungültige Datei: 422.',
    },
  }, async (req, reply) => {
    const { art } = req.params as { art: Art };
    await req.need(RECHT);
    const body = req.body as VersionCreateIn;
    const datei = Buffer.from(body.inhalt, 'base64');
    if (!datei.length || datei.length > MAX_DATEI) {
      throw invalid('Die Datei ist leer oder grösser als 5 MB.', [{ path: '/inhalt', message: 'Höchstens 5 MB.' }]);
    }
    let gelesen: ReturnType<typeof lesen>;
    try { gelesen = lesen(datei); } catch (e) {
      if (e instanceof VorlageFehler) throw invalid(e.message, [{ path: '/inhalt', message: e.message }]);
      throw e;
    }
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const bisher = (await store.alle(tx, art))[0]?.zuordnung ?? {};
      const nr = await store.anlegen(tx, art, {
        dateiname: body.dateiname, datei, sha256: createHash('sha256').update(datei).digest('hex'), platzhalter: gelesen.platzhalter,
        zuordnung: vorschlag(gelesen.platzhalter, katalog(art), bisher), personendaten: /Personendaten/i.test(gelesen.text), bemerkung: body.bemerkung ?? '',
      });
      const r = await version(tx, art, nr);
      await record(tx, who, { action: 'vorlage.created', resourceType: 'vorlage', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      return r;
    });
    return reply.code(201).header('location', `/v1/vorlagen/${art}/versionen/${row.version}`).header('etag', etag(row.rev)).send(versionOut(row));
  });

  app.get('/v1/vorlagen/:art/versionen/:version', {
    schema: { tags: [TAG], summary: 'Version lesen', params: VersionParams, response: { 200: Type.Ref('VorlageVersion') }, description: 'Mit Prüfung der Zuordnung; `ETag` für Änderungen.' },
  }, async (req, reply) => {
    const { art, version: nr } = req.params as { art: Art; version: number };
    await req.need(RECHT);
    const r = await req.tx(tx => version(tx, art, nr));
    reply.header('etag', etag(r.rev));
    return versionOut(r);
  });

  app.get('/v1/vorlagen/:art/versionen/:version/datei', {
    schema: {
      tags: [TAG], summary: 'Datei der Version herunterladen', params: VersionParams,
      response: { 200: { description: 'Word-Datei (Content-Disposition: attachment).', content: { [MIME.docx]: { schema: Type.String({ format: 'binary' }) } } } },
    },
  }, async (req, reply) => {
    const { art, version: nr } = req.params as { art: Art; version: number };
    await req.need(RECHT);
    const d = await req.tx(tx => store.datei(tx, art, nr));
    if (!d) throw notFound('Vorlage');
    const name = d.dateiname.replace(/[^A-Za-z0-9._-]/g, '_');
    return reply.header('content-type', MIME.docx).header('content-disposition', `attachment; filename="${name}"`).header('cache-control', 'private, no-store').send(d.datei);
  });

  app.patch('/v1/vorlagen/:art/versionen/:version', {
    schema: {
      tags: [TAG], summary: 'Zuordnung ändern', params: VersionParams, headers: IfMatchHeaders, body: Type.Ref('VorlageVersionPatch'), response: { 200: Type.Ref('VorlageVersion') },
      description: 'Ganze Zuordnung (Platzhalter → Datenfeld) und Bemerkung; nur Entwürfe (sonst 409), mit `If-Match` (412). Platzhalter, die die Datei nicht enthält: 422.',
    },
  }, async (req, reply) => {
    const { art, version: nr } = req.params as { art: Art; version: number };
    const rev = requireIfMatch(req);
    await req.need(RECHT);
    const body = req.body as VersionPatchIn;
    const who = actorOf(req);
    const r = await req.tx(async tx => {
      const vorher = await version(tx, art, nr);
      entwurf(vorher, rev);
      let zuordnung = vorher.zuordnung;
      if (body.zuordnung) {
        const fremd = Object.keys(body.zuordnung).filter(p => !vorher.platzhalter.includes(p));
        if (fremd.length) throw invalid('Die Zuordnung nennt Platzhalter, die die Datei nicht enthält.', fremd.map(p => ({ path: `/zuordnung/${p}`, message: 'Platzhalter fehlt in der Datei.' })));
        zuordnung = Object.fromEntries(vorher.platzhalter.map(p => [p, body.zuordnung![p] ?? null]));
      }
      if (!(await store.zuordnen(tx, art, nr, rev, zuordnung, body.bemerkung))) throw preconditionFailed(vorher.rev);
      const nach = await version(tx, art, nr);
      await record(tx, who, { action: 'vorlage.updated', resourceType: 'vorlage', resourceId: nach.id, data: { before: snapshot(vorher), after: snapshot(nach) }, event: snapshot(nach) });
      return nach;
    });
    reply.header('etag', etag(r.rev));
    return versionOut(r);
  });

  app.post('/v1/vorlagen/:art/versionen/:version/aktivieren', {
    schema: {
      tags: [TAG], summary: 'Version aktiv setzen', params: VersionParams, headers: IfMatchHeaders, response: { 200: Type.Ref('VorlageVersion') },
      description: 'Die Version gilt ab sofort für künftige Word-Ausgaben der Art (DM.02.07); die bisher aktive wird abgelöst. Sperre in der Prüfung: 409 mit `pruefung`.',
    },
  }, async (req, reply) => {
    const { art, version: nr } = req.params as { art: Art; version: number };
    const rev = requireIfMatch(req);
    await req.need(RECHT);
    const who = actorOf(req);
    const r = await req.tx(async tx => {
      const vorher = await version(tx, art, nr);
      entwurf(vorher, rev);
      const p = pruefen(art, vorher.platzhalter, vorher.zuordnung, vorher.personendaten);
      if (!p.aktivierbar) throw conflict(p.meldungen.filter(m => m.stufe === 'sperre').map(m => m.text).join(' '), { reason: 'pruefung', pruefung: p });
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`vorlage:${art}`]);
      if (!(await store.aktivieren(tx, art, nr, rev))) throw preconditionFailed(vorher.rev);
      const nach = await version(tx, art, nr);
      await record(tx, who, { action: 'vorlage.activated', resourceType: 'vorlage', resourceId: nach.id, data: snapshot(nach), event: snapshot(nach) });
      return nach;
    });
    reply.header('etag', etag(r.rev));
    return versionOut(r);
  });

  app.delete('/v1/vorlagen/:art/versionen/:version', {
    schema: { tags: [TAG], summary: 'Entwurf löschen', params: VersionParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) }, description: 'Nur Entwürfe (sonst 409), mit `If-Match`.' },
  }, async (req, reply) => {
    const { art, version: nr } = req.params as { art: Art; version: number };
    const rev = requireIfMatch(req);
    await req.need(RECHT);
    const who = actorOf(req);
    await req.tx(async tx => {
      const vorher = await version(tx, art, nr);
      entwurf(vorher, rev);
      if (!(await store.entfernen(tx, art, nr, rev))) throw preconditionFailed(vorher.rev);
      await record(tx, who, { action: 'vorlage.deleted', resourceType: 'vorlage', resourceId: vorher.id, data: snapshot(vorher), event: { id: vorher.id } });
    });
    return reply.code(204).send();
  });
}

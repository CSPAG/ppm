/**
 * Lessons Learned (BC PS.04.03; UC-015 Schritt 4, A1.1; UC-013 Schritt 1, A1; UI-32 Portfolio › Auswertungen › Lessons
 * Learned): erfassen am Projekt durch die Projektleitung (`projekt:write`), auch nach dem Abschluss (UC-013 A1.2
 * «PL erfassen die Lessons Learned»); lesen, wer das Projekt sieht, damit künftige Vorhaben sie nutzen (Schritt 4).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, notFound, preconditionFailed, requireIfMatch,
  type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { LessonQuery, type LessonInT, type LessonOut, type LessonPatchT } from './schemas.ts';
import * as store from './store.ts';

export const TAG_LESSONS = 'Lessons Learned';

const projektOrt = (id: string) => ({ type: 'projekt', id });

export function lessonOut(l: store.LessonRow, personen: Map<string, string>, can: { write: boolean }): LessonOut {
  return {
    id: l.id, projekt: { id: l.projekt_id, nummer: l.nummer, name: l.name }, text: l.text, kategorie: l.kategorie, jahr: l.jahr,
    version: l.version, createdAt: l.created_at, von: (l.created_by && personen.get(l.created_by)) || 'Person nicht verfügbar', can,
  };
}

const snapshot = (l: store.LessonRow) => ({ id: l.id, projektId: l.projekt_id, nummer: l.nummer, kategorie: l.kategorie, jahr: l.jahr, version: l.version });

/** Zurückgezogene Projekte (UC-002 A4) haben keinen Abschluss und keine Lessons Learned. */
function pruefeProjekt(p: store.ProjektKopf): void {
  if (p.lebenszyklus === 'zurueckgezogen') throw conflict(`Das Projekt ${p.nummer} ist zurückgezogen.`, { reason: 'lebenszyklus', lebenszyklus: p.lebenszyklus });
}

async function lessonSichtbar(tx: Tx, id: string): Promise<store.LessonRow> {
  const l = await store.lesson(tx, id);
  if (!l) throw notFound('Lesson Learned');
  return l;
}

export function registerLessonsRoutes(app: FastifyInstance, _deps: Deps): void {
  app.get('/v1/lessons-learned', {
    schema: {
      tags: [TAG_LESSONS], summary: 'Lessons Learned auflisten', querystring: LessonQuery, response: { 200: Type.Ref('AbschlussLessonList') },
      description: 'Alle Lessons Learned der sichtbaren Projekte, neueste zuerst, mit Filter Jahr, Projekt, Kategorie und Suche; Cursor (UI-32, UC-013 Schritt 1).',
    },
  }, async req => {
    await req.needSomewhere('projekt:read');
    const q = req.query as { jahr?: number; projekt?: string; kategorie?: string; q?: string; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = JSON.stringify([q.jahr, q.projekt, q.kategorie, q.q]);
    const after = decodeCursor<{ c: string; i: string; f: string }>(q.cursor, v => typeof v.c === 'string' && typeof v.i === 'string' && v.f === filter);
    const caps = new Map<string, boolean>();
    const darf = async (projektId: string) => {
      if (!caps.has(projektId)) caps.set(projektId, await req.can('projekt:write', projektOrt(projektId)));
      return caps.get(projektId)!;
    };
    const { rows, kategorien, personen } = await req.tx(async tx => {
      const projektId = q.projekt ? await store.projektNachNummer(tx, q.projekt) : undefined;
      const rows = projektId === null ? [] : await store.lessons(tx, { jahr: q.jahr, projektId, kategorie: q.kategorie, q: q.q?.trim() || undefined, after, limit });
      return { rows, kategorien: await store.kategorien(tx), personen: await store.personen(tx, [...new Set(rows.flatMap(r => (r.created_by ? [r.created_by] : [])))]) };
    });
    const page = rows.slice(0, limit);
    const items: LessonOut[] = [];
    for (const l of page) items.push(lessonOut(l, personen, { write: await darf(l.projekt_id) }));
    const last = page[page.length - 1];
    return { items, kategorien, nextCursor: rows.length > limit && last ? encodeCursor({ c: last.created_at.toISOString(), i: last.id, f: filter }) : null };
  });

  app.post('/v1/projekte/:id/lessons-learned', {
    schema: {
      tags: [TAG_LESSONS], summary: 'Lesson Learned erfassen', params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('AbschlussLessonIn'),
      response: { 201: Type.Ref('AbschlussLessonLearned') },
      description: 'Erkenntnis zum Projekt (PS.04.03) mit Jahr der Erfassung; auch nach Abschluss, Sistierung oder Abbruch (UC-013 A1). `projekt:write` am Projekt.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as LessonInT;
    const p = await req.tx(async tx => (await store.projekt(tx, id)) ?? null);
    if (!p) throw notFound('Projekt');
    await req.need('projekt:write', projektOrt(p.id));
    const who = actorOf(req);
    const { l, personen } = await req.tx(async tx => {
      pruefeProjekt(p);
      const neu = (await store.lesson(tx, await store.lessonAnlegen(tx, p.id, body.text, body.kategorie ?? '')))!;
      await record(tx, who, { action: 'lessons_learned.created', resourceType: 'lessons_learned', resourceId: neu.id, data: { ...snapshot(neu), text: neu.text }, event: snapshot(neu) });
      return { l: neu, personen: await store.personen(tx, neu.created_by ? [neu.created_by] : []) };
    });
    return reply.code(201).header('etag', etag(l.version)).send(lessonOut(l, personen, { write: true }));
  });

  app.patch('/v1/lessons-learned/:id', {
    schema: {
      tags: [TAG_LESSONS], summary: 'Lesson Learned ändern', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('AbschlussLessonPatch'),
      response: { 200: Type.Ref('AbschlussLessonLearned') }, description: 'Nur mit `If-Match`; `projekt:write` am Projekt.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const body = req.body as LessonPatchT;
    const vorher = await req.tx(tx => lessonSichtbar(tx, id));
    await req.need('projekt:write', projektOrt(vorher.projekt_id));
    const who = actorOf(req);
    const { l, personen } = await req.tx(async tx => {
      const b = await lessonSichtbar(tx, id);
      if (b.version !== version) throw preconditionFailed(b.version);
      if (!(await store.lessonAendern(tx, id, version, body.text ?? b.text, body.kategorie ?? b.kategorie))) throw preconditionFailed(b.version);
      const neu = (await store.lesson(tx, id))!;
      await record(tx, who, { action: 'lessons_learned.updated', resourceType: 'lessons_learned', resourceId: id, data: { before: { ...snapshot(b), text: b.text }, after: { ...snapshot(neu), text: neu.text } }, event: snapshot(neu) });
      return { l: neu, personen: await store.personen(tx, neu.created_by ? [neu.created_by] : []) };
    });
    reply.header('etag', etag(l.version));
    return lessonOut(l, personen, { write: true });
  });

  app.delete('/v1/lessons-learned/:id', {
    schema: {
      tags: [TAG_LESSONS], summary: 'Lesson Learned löschen', params: IdParams, headers: IfMatchHeaders,
      response: { 204: Type.Null({ description: 'Gelöscht' }) }, description: 'Nur mit `If-Match`; `projekt:write` am Projekt.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const vorher = await req.tx(tx => lessonSichtbar(tx, id));
    await req.need('projekt:write', projektOrt(vorher.projekt_id));
    const who = actorOf(req);
    await req.tx(async tx => {
      const b = await lessonSichtbar(tx, id);
      if (b.version !== version || !(await store.lessonLoeschen(tx, id, version))) throw preconditionFailed(b.version);
      await record(tx, who, { action: 'lessons_learned.deleted', resourceType: 'lessons_learned', resourceId: id, data: snapshot(b), event: { id } });
    });
    return reply.code(204).send();
  });
}

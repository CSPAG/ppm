/**
 * Routen des Quartalsreportings an den VR (BC ZM.03.02, PC.04.02; UC-012 Schritte 3–6, A1; UC-006 A4; Kernablauf K6
 * Schritte 11–14; AP-E6-4) nach dem Muster der Handlungsfelder: Rechte über `req.need`, Lesesicht über `req.tx`,
 * Fähigkeiten `can`, ETag/If-Match (412), Audit und Ereignis in derselben Transaktion. Lesen mit `ziel:read`, alles
 * Weitere mit `quartalsbericht:write` (UE); Aufträge des VR erledigt die verantwortliche Person.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, forbidden, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { traktandum } from '../sitzung/index.ts';
import { MIME, vorlage, type Format } from '../vorlage/index.ts';
import { ART_AUFGABE, bezugQuartal, inhaltErzeugen, istVorbei, link, quartalLabel, zeitraum } from './quartal.ts';
import { dateiname, quartalDokument } from './quartal-dokument.ts';
import {
  ABSCHNITTE, DokumentQuery, QuartalsInhalt, Quartalsbericht, QuartalsberichtListe, QuartalsberichtParams, QuartalsberichtPatch, VrAuftrag, VrAuftragIn,
  VrRueckmeldungIn, VrWeiterleitung, VrWeiterleitungIn, VrWeiterleitungListe, VrWeiterleitungQuery, type KommentareOut, type QuartalsberichtOut,
  type VrAuftragOut,
} from './quartal-schemas.ts';
import * as store from './quartal-store.ts';

export const TAG_QUARTAL = 'Quartalsreporting';
const SCHREIBEN = 'quartalsbericht:write';
/** Aufgabe je Auftrag des VR an die verantwortliche Person (UC-012 Schritt 6). */
const ART_AUFTRAG = 'quartalsreporting.auftrag';

const auftragOut = (a: store.AuftragRow): VrAuftragOut => ({ id: a.id, text: a.text, verantwortlich: a.verantwortlich, termin: a.termin, erledigtAt: a.erledigt_at?.toISOString() ?? null });
const snap = (b: store.BerichtRow) => ({ id: b.id, quartal: b.quartal, stand: b.stand, version: b.version });
const kommentareVoll = (k: Partial<KommentareOut>): KommentareOut => Object.fromEntries(ABSCHNITTE.map(a => [a, k[a] ?? ''])) as KommentareOut;

/**
 * Lesen mit `ziel:read` oder `quartalsbericht:write`; sonst mit `sitzung:read` an einem Portfolio (A-67): Welche Gremien
 * den Bericht ab «traktandiert» sehen, entscheidet die Lesesicht (331) am festgehaltenen Portfolio des Traktandums.
 * Liefert, ob die Person die Ziele der Organisation liest.
 */
async function lesend(req: FastifyRequest): Promise<boolean> {
  if (await req.can('ziel:read') || await req.can(SCHREIBEN)) return true;
  await req.needSomewhere('sitzung:read');
  return false;
}

/**
 * Bericht nicht sichtbar: 404 für Lesende der Ziele und für Mitglieder des heutigen PRAT (noch nicht traktandiert),
 * sonst 403. Entscheidet nur die Antwort, nie den Zugriff; den gibt allein das festgehaltene Portfolio (331).
 */
async function nichtSichtbar(req: FastifyRequest, tx: Tx, ziele: boolean): Promise<never> {
  if (ziele) throw notFound('Quartalsreporting');
  const prat = await store.portfolioA(tx);
  if (prat && await req.can('sitzung:read', { type: 'portfolio', id: prat })) throw notFound('Quartalsreporting');
  throw forbidden();
}

async function berichtOut(req: FastifyRequest, tx: Tx, b: store.BerichtRow): Promise<QuartalsberichtOut> {
  const schreiben = await req.can(SCHREIBEN);
  return {
    id: b.id, quartal: b.quartal, stand: b.stand, erzeugtAt: b.erzeugt_at.toISOString(), traktandiertAt: b.traktandiert_at?.toISOString() ?? null,
    verabschiedetAt: b.verabschiedet_at?.toISOString() ?? null, version: b.version, inhalt: b.inhalt as unknown as QuartalsberichtOut['inhalt'],
    kommentare: kommentareVoll(b.kommentare), rueckmeldungPrat: b.rueckmeldung_prat, vrRueckmeldung: b.vr_rueckmeldung,
    vrRueckmeldungAt: b.vr_rueckmeldung_at?.toISOString() ?? null, auftraege: (await store.auftraege(tx, b.id)).map(auftragOut),
    can: {
      erzeugen: schreiben && b.stand === 'in_arbeit', bearbeiten: schreiben && b.stand === 'in_arbeit',
      traktandieren: schreiben && b.stand === 'in_arbeit', rueckmeldung: schreiben && b.stand === 'verabschiedet',
    },
  };
}

/** Bericht für eine Handlung: vorhanden (404), gesperrt, Version per If-Match (412), Stand passend (409). */
async function laden(tx: Tx, quartal: string, version: number, staende: readonly store.Stand[], text: string): Promise<store.BerichtRow> {
  await store.sperren(tx, quartal);
  const b = await store.bericht(tx, quartal);
  if (!b) throw notFound('Quartalsreporting');
  if (b.version !== version) throw preconditionFailed(b.version);
  if (!staende.includes(b.stand)) throw conflict(text, { reason: 'stand', stand: b.stand });
  return b;
}

export function registerQuartalRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [QuartalsInhalt, VrAuftrag, Quartalsbericht, QuartalsberichtListe, QuartalsberichtPatch, VrRueckmeldungIn, VrAuftragIn, VrWeiterleitung, VrWeiterleitungListe, VrWeiterleitungIn]) app.addSchema(s);

  const antwort = async (req: FastifyRequest, reply: { header(k: string, v: string): unknown }, tx: Tx, quartal: string) => {
    const b = (await store.bericht(tx, quartal))!;
    reply.header('etag', etag(b.version));
    return berichtOut(req, tx, b);
  };

  app.get('/v1/quartalsberichte', {
    schema: { tags: [TAG_QUARTAL], summary: 'Quartalsreportings', description: 'Erzeugte Quartalsreportings mit Stand, neuestes zuerst.', response: { 200: Type.Ref('QuartalsberichtListe') } },
  }, async req => {
    await lesend(req);
    const rows = await req.tx(tx => store.liste(tx));
    return { items: rows.map(r => ({ id: r.id, quartal: r.quartal, stand: r.stand, erzeugtAt: r.erzeugt_at.toISOString(), verabschiedetAt: r.verabschiedet_at?.toISOString() ?? null })) };
  });

  app.get('/v1/quartalsberichte/:quartal', {
    schema: { tags: [TAG_QUARTAL], summary: 'Quartalsreporting eines Quartals', description: 'Bericht mit Inhalt bei Erzeugung, Kommentaren, Rückmeldungen und Aufträgen des VR; 404, solange er nicht erzeugt ist. Recht `ziel:read` oder `quartalsbericht:write`; Mitglieder des PRAT (`sitzung:read` am Portfolio der Kategorie A) ab «traktandiert» (A-67), sonst 404.', params: QuartalsberichtParams, response: { 200: Type.Ref('Quartalsbericht') } },
  }, async (req, reply) => {
    const { quartal } = req.params as { quartal: string };
    const ziele = await lesend(req);
    return req.tx(async tx => {
      if (!(await store.bericht(tx, quartal))) await nichtSichtbar(req, tx, ziele);
      return antwort(req, reply, tx, quartal);
    });
  });

  app.post('/v1/quartalsberichte/:quartal/erzeugen', {
    schema: {
      tags: [TAG_QUARTAL], summary: 'Bericht erstellen', params: QuartalsberichtParams, headers: IdempotencyHeaders, response: { 200: Type.Ref('Quartalsbericht'), 201: Type.Ref('Quartalsbericht') },
      description: 'Entwurf aus Zielerreichung, Portfolioberichten des letzten Quartalsmonats und den an den VR weitergeleiteten Geschäften (UC-012 Schritt 3); im Stand «in Arbeit» neu erzeugen, die Kommentare bleiben. Erst nach Quartalsende (sonst 409); Hinweise bei unvollständiger Zielerreichung oder fehlendem Portfoliobericht (K6 Z4).',
    },
  }, async (req, reply) => {
    const { quartal } = req.params as { quartal: string };
    await req.need(SCHREIBEN);
    const who = actorOf(req);
    return req.tx(async tx => {
      if (!istVorbei(quartal, await store.heute(tx))) throw conflict(`Das Quartal ${quartalLabel(quartal)} läuft noch. Das Quartalsreporting entsteht nach Quartalsende.`, { reason: 'quartal' });
      await store.sperren(tx, quartal);
      const vorher = await store.bericht(tx, quartal);
      if (vorher && vorher.stand !== 'in_arbeit') throw conflict(`Das Quartalsreporting ${quartalLabel(quartal)} ist ${vorher.stand === 'traktandiert' ? 'traktandiert' : 'verabschiedet'} und bleibt so.`, { reason: 'stand', stand: vorher.stand });
      const inhalt = await inhaltErzeugen(tx, quartal);
      const id = vorher ? (await store.erneuern(tx, vorher.id, inhalt), vorher.id) : await store.anlegen(tx, quartal, inhalt);
      const b = (await store.bericht(tx, quartal))!;
      await record(tx, who, { action: vorher ? 'quartalsbericht.regenerated' : 'quartalsbericht.created', resourceType: 'quartalsbericht', resourceId: id, data: { ...snap(b), hinweise: inhalt.hinweise.length }, event: snap(b) });
      reply.code(vorher ? 200 : 201);
      return antwort(req, reply, tx, quartal);
    });
  });

  app.patch('/v1/quartalsberichte/:quartal', {
    schema: { tags: [TAG_QUARTAL], summary: 'Kommentare ergänzen', description: 'Kommentar der UE je Abschnitt (UC-012 Schritt 4); nur «in Arbeit», nur mit `If-Match`.', params: QuartalsberichtParams, headers: IfMatchHeaders, body: Type.Ref('QuartalsberichtPatch'), response: { 200: Type.Ref('Quartalsbericht') } },
  }, async (req, reply) => {
    const { quartal } = req.params as { quartal: string };
    const version = requireIfMatch(req);
    await req.need(SCHREIBEN);
    const kommentare = Object.fromEntries(Object.entries((req.body as { kommentare: Partial<KommentareOut> }).kommentare).map(([k, v]) => [k, (v ?? '').trim()]));
    const who = actorOf(req);
    return req.tx(async tx => {
      const b = await laden(tx, quartal, version, ['in_arbeit'], 'Das Quartalsreporting ist traktandiert oder verabschiedet; Kommentare lassen sich nicht mehr ändern.');
      if (!(await store.kommentareSetzen(tx, b.id, version, kommentare))) throw preconditionFailed(b.version);
      await record(tx, who, { action: 'quartalsbericht.commented', resourceType: 'quartalsbericht', resourceId: b.id, data: { quartal, abschnitte: Object.keys(kommentare) } });
      return antwort(req, reply, tx, quartal);
    });
  });

  app.post('/v1/quartalsberichte/:quartal/traktandieren', {
    schema: {
      tags: [TAG_QUARTAL], summary: 'Im PRAT traktandieren', params: QuartalsberichtParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), response: { 200: Type.Ref('Quartalsbericht') },
      description: 'Vorschlag der Art «Quartalsreporting» für die nächste Sitzung des entscheidenden Gremiums des Portfolios der Kategorie A (PRAT, UC-012 Schritt 4); Stand «traktandiert», Aufgabe «Quartalsreporting erstellen» erledigt. Ohne Portfolio A oder Gremium 409. Nur mit `If-Match`.',
    },
  }, async (req, reply) => {
    const { quartal } = req.params as { quartal: string };
    const version = requireIfMatch(req);
    await req.need(SCHREIBEN);
    const who = actorOf(req);
    return req.tx(async tx => {
      const b = await laden(tx, quartal, version, ['in_arbeit'], 'Das Quartalsreporting ist bereits traktandiert oder verabschiedet.');
      const portfolioId = await store.portfolioA(tx);
      if (!portfolioId) throw conflict('Es gibt kein Portfolio der Kategorie A mit PRAT. Die UE erfasst es unter Administration › Portfolios und Gremien.');
      await traktandum.vorschlagen(tx, {
        art: 'quartalsreporting', bezug: { typ: 'quartalsbericht', id: b.id }, portfolioId,
        titel: `Quartalsreporting ${quartalLabel(quartal)}`, antrag: 'Verabschiedung des Quartalsreportings zuhanden des VR',
      });
      if (!(await store.standSetzen(tx, b.id, 'traktandiert', { version, gremiumPortfolioId: portfolioId }))) throw preconditionFailed(b.version);
      await aufgabe.erledigen(tx, { art: ART_AUFGABE, bezug: bezugQuartal(quartal) });
      await record(tx, who, { action: 'quartalsbericht.scheduled', resourceType: 'quartalsbericht', resourceId: b.id, data: snap(b), event: { ...snap(b), stand: 'traktandiert' } });
      return antwort(req, reply, tx, quartal);
    });
  });

  app.get('/v1/quartalsberichte/:quartal/dokument', {
    schema: {
      tags: [TAG_QUARTAL], summary: 'Quartalsreporting als Dokument', params: QuartalsberichtParams, querystring: DokumentQuery,
      description: 'Bericht als PDF oder Word für den VR über die Dokumentausgabe (Modul `vorlage`); Kopfzeile «Intern · enthält Personendaten» (G12). Der Export ist protokolliert.',
      response: { 200: { description: 'Dokument als Datei (Content-Disposition: attachment).', content: { [MIME.pdf]: { schema: { type: 'string', format: 'binary' } }, [MIME.docx]: { schema: { type: 'string', format: 'binary' } } } } },
    },
  }, async (req, reply) => {
    const { quartal } = req.params as { quartal: string };
    const format: Format = (req.query as { format?: Format }).format ?? 'pdf';
    const who = actorOf(req);
    const ziele = await lesend(req);
    const b = await req.tx(async tx => {
      const b = await store.bericht(tx, quartal);
      if (!b) return nichtSichtbar(req, tx, ziele);
      // Export eines Dokuments mit Personendaten im Audit (I-Z3); kein Ereignis
      await record(tx, who, { action: 'quartalsbericht.exported', resourceType: 'quartalsbericht', resourceId: b.id, data: { quartal, format } });
      return b;
    });
    return reply.header('content-type', MIME[format]).header('content-disposition', `attachment; filename="${dateiname(quartal, format)}"`)
      .header('cache-control', 'private, no-store').send(vorlage.setzen(quartalDokument(b), format));
  });

  app.put('/v1/quartalsberichte/:quartal/vr-rueckmeldung', {
    schema: { tags: [TAG_QUARTAL], summary: 'Rückmeldung des VR erfassen', description: 'Rückmeldung des VR zum verabschiedeten Bericht (UC-012 Schritt 6); nur «verabschiedet», nur mit `If-Match`.', params: QuartalsberichtParams, headers: IfMatchHeaders, body: Type.Ref('VrRueckmeldungIn'), response: { 200: Type.Ref('Quartalsbericht') } },
  }, async (req, reply) => {
    const { quartal } = req.params as { quartal: string };
    const version = requireIfMatch(req);
    await req.need(SCHREIBEN);
    const text = (req.body as { vrRueckmeldung: string }).vrRueckmeldung;
    const who = actorOf(req);
    return req.tx(async tx => {
      const b = await laden(tx, quartal, version, ['verabschiedet'], 'Rückmeldungen des VR lassen sich erst nach der Verabschiedung im PRAT erfassen.');
      if (!(await store.vrRueckmeldungSetzen(tx, b.id, version, text))) throw preconditionFailed(b.version);
      await record(tx, who, { action: 'quartalsbericht.vr_feedback', resourceType: 'quartalsbericht', resourceId: b.id, data: { quartal }, event: snap(b) });
      return antwort(req, reply, tx, quartal);
    });
  });

  app.post('/v1/quartalsberichte/:quartal/auftraege', {
    schema: { tags: [TAG_QUARTAL], summary: 'Auftrag des VR erfassen', description: 'Auftrag mit verantwortlicher Person und Termin (UC-012 Schritt 6): wird Aufgabe im Eingang der Person. Nur «verabschiedet».', params: QuartalsberichtParams, headers: IdempotencyHeaders, body: Type.Ref('VrAuftragIn'), response: { 201: Type.Ref('VrAuftrag') } },
  }, async (req, reply) => {
    const { quartal } = req.params as { quartal: string };
    await req.need(SCHREIBEN);
    const body = req.body as { text: string; verantwortlich: string; termin?: string | null };
    if (!body.text.trim()) throw invalid('Auftrag fehlt.', [{ path: '/text', message: 'Beschreibe den Auftrag des VR.' }]);
    const who = actorOf(req);
    const a = await req.tx(async tx => {
      await store.sperren(tx, quartal);
      const b = await store.bericht(tx, quartal);
      if (!b) throw notFound('Quartalsreporting');
      if (b.stand !== 'verabschiedet') throw conflict('Aufträge des VR lassen sich erst nach der Verabschiedung im PRAT erfassen.', { reason: 'stand', stand: b.stand });
      if (!(await store.personVorhanden(tx, body.verantwortlich))) throw invalid('Diese Person gibt es nicht.', [{ path: '/verantwortlich', message: 'Diese Person gibt es in der Organisation nicht.' }]);
      const id = await store.auftragAnlegen(tx, b.id, { text: body.text, verantwortlich: body.verantwortlich, termin: body.termin ?? null });
      await aufgabe.oeffnen(tx, {
        art: ART_AUFTRAG, bezug: { typ: 'vr_auftrag', id }, empfaenger: { person: body.verantwortlich },
        titel: `Auftrag des VR: ${body.text.trim().slice(0, 120)}`, kontext: `Quartalsreporting ${quartalLabel(quartal)}`, link: link(quartal),
        frist: body.termin ? { datum: body.termin, art: 'kalendertage' } : null,
      });
      const a = (await store.auftrag(tx, id))!;
      await record(tx, who, { action: 'quartalsbericht.order_created', resourceType: 'quartalsbericht', resourceId: b.id, data: { quartal, auftrag: auftragOut(a) }, event: { id: b.id, quartal, auftragId: id } });
      return a;
    });
    return reply.code(201).send(auftragOut(a));
  });

  app.post('/v1/vr-auftraege/:id/erledigen', {
    schema: { tags: [TAG_QUARTAL], summary: 'Auftrag des VR erledigt melden', description: 'Die verantwortliche Person oder die UE meldet den Auftrag erledigt; die Aufgabe im Eingang schliesst.', params: IdParams, headers: IdempotencyHeaders, response: { 200: Type.Ref('VrAuftrag') } },
  }, async req => {
    const { id } = req.params as { id: string };
    const p = req.requirePrincipal();
    const who = actorOf(req);
    const vorher = await req.tx(tx => store.auftrag(tx, id));
    if (!vorher) throw notFound('Auftrag');
    if (vorher.verantwortlich !== p.principalId) await req.need(SCHREIBEN);
    return req.tx(async tx => {
      if (!(await store.auftragErledigen(tx, id))) throw conflict('Der Auftrag ist bereits erledigt.');
      await aufgabe.erledigen(tx, { art: ART_AUFTRAG, bezug: { typ: 'vr_auftrag', id } });
      const a = (await store.auftrag(tx, id))!;
      await record(tx, who, { action: 'quartalsbericht.order_done', resourceType: 'quartalsbericht', resourceId: a.quartalsbericht_id, data: { auftragId: id }, event: { id: a.quartalsbericht_id, auftragId: id } });
      return auftragOut(a);
    });
  });

  // ---------------------------------------------------------------- Weiterleitungen an den VR (UC-006 A4, A-03)

  app.get('/v1/vr-weiterleitungen', {
    schema: { tags: [TAG_QUARTAL], summary: 'Weiterleitungen an den VR', description: 'Im Gremium zur Weiterleitung an den VR markierte Geschäfte mit Sitzung im Quartal (UC-006 A4), mit ausserordentlicher Weiterleitung (A-03).', querystring: VrWeiterleitungQuery, response: { 200: Type.Ref('VrWeiterleitungListe') } },
  }, async req => {
    const { quartal } = req.query as { quartal: string };
    await req.need('ziel:read');
    const { von, bis } = zeitraum(quartal);
    const rows = await req.tx(tx => store.weiterleitungen(tx, von, bis));
    return { items: rows.map(w => ({ entscheidId: w.entscheid_id, datum: w.datum, gremium: w.gremium, titel: w.titel, ergebnis: w.ergebnis, ausserordentlichAm: w.weitergeleitet_am, bemerkung: w.bemerkung })) };
  });

  app.post('/v1/vr-weiterleitungen', {
    schema: { tags: [TAG_QUARTAL], summary: 'Ausserordentliche Weiterleitung erfassen', description: 'Die UE hält fest, dass ein zur Weiterleitung markiertes Geschäft ausserhalb des Quartalsreportings an den VR ging (A-03, K03). Nur für Entscheide mit «an den VR» (sonst 422); je Entscheid einmal (409).', headers: IdempotencyHeaders, body: Type.Ref('VrWeiterleitungIn'), response: { 204: Type.Null({ description: 'Erfasst' }) } },
  }, async (req, reply) => {
    await req.need(SCHREIBEN);
    const body = req.body as { entscheidId: string; weitergeleitetAm?: string; bemerkung?: string };
    const who = actorOf(req);
    await req.tx(async tx => {
      const e = await store.entscheidAnVr(tx, body.entscheidId);
      if (!e) throw notFound('Entscheid');
      if (!e.an_vr) throw invalid('Das Geschäft ist nicht zur Weiterleitung an den VR markiert.', [{ path: '/entscheidId', message: 'Markiere die Weiterleitung beim Entscheid (UC-006 A4).' }]);
      const am = body.weitergeleitetAm ?? await store.heute(tx);
      if (!(await store.weiterleitungAnlegen(tx, body.entscheidId, am, body.bemerkung ?? ''))) throw conflict('Die Weiterleitung ist bereits erfasst.');
      await record(tx, who, { action: 'vr_weiterleitung.created', resourceType: 'entscheid', resourceId: body.entscheidId, data: { weitergeleitetAm: am, bemerkung: body.bemerkung ?? '' }, event: { entscheidId: body.entscheidId, weitergeleitetAm: am } });
    });
    return reply.code(204).send();
  });

  app.delete('/v1/vr-weiterleitungen/:id', {
    schema: { tags: [TAG_QUARTAL], summary: 'Ausserordentliche Weiterleitung entfernen', description: 'Erfassung zurücknehmen; `id` ist der Entscheid.', params: IdParams, response: { 204: Type.Null({ description: 'Entfernt' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need(SCHREIBEN);
    const who = actorOf(req);
    await req.tx(async tx => {
      if (!(await store.weiterleitungEntfernen(tx, id))) throw notFound('Weiterleitung');
      await record(tx, who, { action: 'vr_weiterleitung.deleted', resourceType: 'entscheid', resourceId: id, data: {}, event: { entscheidId: id } });
    });
    return reply.code(204).send();
  });
}

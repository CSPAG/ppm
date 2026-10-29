/**
 * Routen des Änderungsantrags (AP-E3-4; UC-007; fachmodell.md 5: `POST …/aenderung/entscheiden`): Zusammenfassung für
 * den Sponsor mit Wirkung und Entscheid (K2 Schritt 9), «Änderung einreichen» der PL (Schritt 3) und Entscheid des SP
 * (Schritt 4, A1, A2). Muster der Handlungsfelder: Lesesicht über `req.tx`, Rechte am Projekt, `can`, ETag/If-Match,
 * Audit und Ereignis in derselben Transaktion.
 *
 * Der SP hat `vertrag:decide`, aber weder `vertrag:write` noch `projekt:write`: Nach der Prüfung seines Rechts läuft der
 * Entscheid in voller Sicht (`fullTx`), als Systemverhalten des Ablaufs (wie Quality-Check und Baseline).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, etag, IdParams, IfMatchHeaders, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx } from '@vollholz/platform';
import { aktuellesPhasenmodell } from '../phasenmodell/index.ts';
import { fullTx } from '../../platform.ts';
import { einreichen, entscheiden, entscheidVon, uebernehmen, vorabUebernommen, wirkung } from './aenderung.ts';
import { Aenderung, AenderungEntscheid, type AenderungEntscheidIn, type AenderungOut } from './aenderung-schemas.ts';
import { STAND_TEXT, type Phasenmodell } from './entwurf.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';
import { versionVermerke } from './vermerk.ts';

const projektOrt = (id: string) => ({ type: 'projekt', id });
const aenderbar = (p: store.ProjektKopf) => p.lebenszyklus === 'aktiv' || p.lebenszyklus === 'sistiert';

/** Änderungsantrag und Projekt unter der Lesesicht, sonst 404 (fremde, unbekannte und andere Anlässe gleich). */
async function sichtbar(tx: Tx, id: string): Promise<{ v: store.VersionRow; p: store.ProjektKopf }> {
  const v = await store.version(tx, id);
  const p = v && v.anlass === 'aenderung' ? await store.projekt(tx, v.projekt_id) : null;
  if (!v || !p) throw notFound('Änderungsantrag');
  return { v, p };
}

export function registerAenderungRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Aenderung, AenderungEntscheid]) app.addSchema(s);
  const voll = <T>(req: FastifyRequest, fn: (tx: Tx) => Promise<T>) => fullTx(deps.db, req.requirePrincipal().tenantId, fn);
  /** Phasenmodell in Kraft (Kapitelwirkung, Pflichtangaben): Konfiguration der Organisation, in voller Sicht gelesen. */
  const modell = (req: FastifyRequest): Promise<Phasenmodell> => voll(req, tx => aktuellesPhasenmodell(tx));

  async function ausgabe(req: FastifyRequest, tx: Tx, v: store.VersionRow, p: store.ProjektKopf, m: Phasenmodell): Promise<AenderungOut> {
    const w = await wirkung(tx, v.id, m);
    const e = await entscheidVon(tx, v.id);
    const basis = v.basis_version_id ? await store.version(tx, v.basis_version_id) : null;
    // nach einer vorab übernommenen Änderung entscheidet der SP nachträglich (UC-007 A3.2)
    const nachtrag = vorabUebernommen(v, e) && !e?.entscheid;
    const offen = (v.stand === 'in_pruefung' || nachtrag) && aenderbar(p) && await req.can('vertrag:decide', projektOrt(p.id));
    return {
      versionId: v.id, projektId: p.id, nummer: v.nummer, basisVersionId: v.basis_version_id, basisNummer: basis?.nummer ?? null, stand: v.stand,
      begruendung: v.begruendung, eingereichtAt: v.eingereicht_at, wirkung: w,
      entscheid: e?.entscheid && e.entschieden_at ? { ergebnis: e.entscheid, begruendung: e.entscheid_begruendung, at: e.entschieden_at, personId: e.entschieden_by } : null,
      version: v.version,
      can: {
        einreichen: v.stand === 'in_arbeit' && aenderbar(p) && await req.can('vertrag:write', projektOrt(p.id)),
        freigeben: offen && !w.prat, ablehnen: offen, anPrat: offen && w.prat,
        uebernehmen: (v.stand === 'in_pruefung' || v.stand === 'traktandiert') && aenderbar(p) && await req.can('vertrag:write', projektOrt(p.id)),
      },
      vermerke: await versionVermerke(tx, v),
    };
  }

  app.get('/v1/vertragsversionen/:id/aenderung', {
    schema: {
      tags: [TAG], summary: 'Änderungsantrag', params: IdParams, response: { 200: Type.Ref('VertragAenderung') },
      description: 'Zusammenfassung des Änderungsantrags für den Sponsor (K2 Schritt 9, UC-007 Schritt 4): Begründung, Baseline, Wirkung auf Scope, Budget oder Ressourcen '
        + '(dann gibt der PRAT frei, A1) und Entscheid. Hauptänderungen und Vergleich unter `…/hauptaenderungen` und `…/vergleich`. `ETag` der Version.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { v, p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:read', projektOrt(p.id));
    const m = await modell(req);
    const out = await req.tx(tx => ausgabe(req, tx, v, p, m));
    reply.header('etag', etag(v.version));
    return out;
  });

  app.post('/v1/vertragsversionen/:id/aenderung/einreichen', {
    schema: {
      tags: [TAG], summary: 'Änderung einreichen', params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('VertragAenderung') },
      description: 'Änderungsantrag «in Arbeit» beim Sponsor einreichen (UC-007 Schritt 3, kein Quality-Check): Pflichtangaben der Phase erfüllt (sonst 422 mit `/kapitel/<nr>/<feld>`), '
        + 'mindestens ein Kapitel geändert, Sponsor in der Projektorganisation (sonst 409). Der SP erhält die Aufgabe «Änderung entscheiden». `If-Match` Pflicht.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const { v, p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('vertrag:write', projektOrt(p.id));
    const who = actorOf(req);
    const m = await modell(req);
    const out = await req.tx(async tx => {
      if (v.stand !== 'in_arbeit' || !aenderbar(p)) throw conflict(`Version ${v.nummer} ist ${STAND_TEXT[v.stand]} und kann nicht eingereicht werden.`, { reason: 'stand', stand: v.stand });
      if (v.version !== erwartet) throw preconditionFailed(v.version);
      if (!(await einreichen(tx, who, { version: v, projekt: p, erwartet, modell: m }))) throw preconditionFailed(v.version + 1);
      return ausgabe(req, tx, (await store.version(tx, id))!, p, m);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/vertragsversionen/:id/aenderung/uebernehmen', {
    schema: {
      tags: [TAG], summary: 'Änderung vor dem Entscheid übernehmen', params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('VertragAenderung') },
      description: 'UC-007 A3 (A-74): Die Projektleitung setzt die eingereichte Änderung als Baseline, bevor Projektauftraggeber:in bzw. PRAT entschieden haben; '
        + 'das Register wird nachgeführt, die Version trägt den Vermerk «nicht freigegeben», Aufgabe bzw. Traktandum bleiben offen. Der spätere Entscheid ersetzt '
        + 'den Vermerk; eine Ablehnung bleibt an der Baseline sichtbar. `vertrag:write`; `If-Match` Pflicht.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const { p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('vertrag:write', projektOrt(p.id));
    if (!aenderbar(p)) throw conflict(`Das Projekt ${p.nummer} kann nur noch gelesen werden.`, { reason: 'lebenszyklus', lebenszyklus: p.lebenszyklus });
    const who = actorOf(req);
    const m = await modell(req);
    await voll(req, async tx => {
      const r = (await store.version(tx, id))!;
      if (!(await uebernehmen(tx, who, { version: r, projekt: p, erwartet }))) throw preconditionFailed(r.version);
    });
    const out = await req.tx(async tx => ausgabe(req, tx, (await store.version(tx, id))!, p, m));
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/vertragsversionen/:id/aenderung/entscheiden', {
    schema: {
      tags: [TAG], summary: 'Änderung entscheiden', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('VertragAenderungEntscheid'),
      response: { 200: Type.Ref('VertragAenderung') },
      description: 'Entscheid des Sponsors (`vertrag:decide`; UC-007 Schritt 4, A1, A2): `freigegeben` setzt die Version als Baseline und führt das Register nach – bei Wirkung auf Scope, '
        + 'Budget oder Ressourcen gesperrt (409 `prat`); `an_prat` schlägt das Traktandum «Änderung» dem entscheidenden Gremium vor (nur mit Wirkung); `abgelehnt` mit Begründung (Pflicht), '
        + 'die Baseline bleibt. Die Projektleitung wird informiert. `If-Match` Pflicht.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const { v, p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('vertrag:decide', projektOrt(p.id));
    if (!aenderbar(p)) throw conflict(`Das Projekt ${p.nummer} kann nur noch gelesen werden.`, { reason: 'lebenszyklus', lebenszyklus: p.lebenszyklus });
    const body = req.body as AenderungEntscheidIn;
    const who = actorOf(req);
    const person = req.requirePrincipal().principalId;
    const m = await modell(req);
    await voll(req, async tx => {
      const r = (await store.version(tx, id))!;
      if (r.version !== erwartet) throw preconditionFailed(r.version);
      const ok = await entscheiden(tx, who, { version: r, projekt: p, erwartet, person, modell: m, entscheid: body.ergebnis, begruendung: body.begruendung ?? '' });
      if (!ok) throw preconditionFailed(r.version + 1);
    });
    const out = await req.tx(async tx => ausgabe(req, tx, (await store.version(tx, id))!, p, m));
    reply.header('etag', etag(out.version));
    return out;
  });
}

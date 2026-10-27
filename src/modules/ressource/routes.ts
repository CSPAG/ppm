/**
 * Routen des Kapazitätsangebots und der Auslastung (BC RK.01.01, RK.02.04; UC-009 Schritte 1–2, 5) nach dem Muster der
 * Handlungsfelder: Rechte über `req.need` an der Organisation, Lesesicht über `req.tx`, Fähigkeiten `can`, Version je
 * Zelle (412), Audit und Ereignis in derselben Transaktion.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, invalid, notFound, preconditionFailed, type Deps } from '@vollholz/platform';
import { codewertAktiv } from '../stammdaten/index.ts';
import { record } from '../../platform.ts';
import { berechnen, szenarioLesen } from './auslastung.ts';
import { monateZwischen, plusMonate } from './rechnung.ts';
import {
  Auslastung, AuslastungQuery, AuslastungZelle, Kapazitaet, KapazitaetGespeichert, KapazitaetPut, KapazitaetZelle, ZeitraumQuery,
  type AuslastungOut, type KapazitaetPutIn, type KapazitaetZelleOut,
} from './schemas.ts';
import * as store from './store.ts';

export const TAG = 'Ressourcen';

/** Längster Zeitraum einer Abfrage (fünf Jahre). */
const MAX_MONATE = 60;

/** Zeitraum «JJJJ-MM»; ohne Angabe der laufende Monat und die elf folgenden. */
function zeitraum(q: { von?: string; bis?: string }): { von: string; bis: string } {
  const jetzt = new Date();
  const heute = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}`;
  const von = q.von ?? (q.bis ? plusMonate(q.bis, -11) : heute);
  const bis = q.bis ?? plusMonate(von, 11);
  if (bis < von) throw invalid('Der Zeitraum endet vor seinem Beginn.', [{ path: '/bis', message: 'nicht vor «von»' }]);
  if (monateZwischen(von, bis) >= MAX_MONATE) throw invalid(`Der Zeitraum umfasst höchstens ${MAX_MONATE} Monate.`, [{ path: '/bis', message: `höchstens ${MAX_MONATE} Monate ab «von»` }]);
  return { von, bis };
}

const zelle = (r: store.ZelleRow): KapazitaetZelleOut => ({ rolle: r.rolle, monat: r.monat, fte: r.fte, version: r.version });
const capabilities = async (req: FastifyRequest) => ({ write: await req.can('ressource:write') });

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [KapazitaetZelle, Kapazitaet, KapazitaetPut, KapazitaetGespeichert, AuslastungZelle, Auslastung]) app.addSchema(s);

  app.get('/v1/kapazitaet', {
    schema: { tags: [TAG], summary: 'Kapazitätsangebot lesen', description: 'Angebot je Rolle (Pool, A-20) und Monat im Zeitraum (UC-009 Schritt 1); ohne Zeitraum der laufende Monat und die elf folgenden, höchstens 60 Monate.', querystring: ZeitraumQuery, response: { 200: Type.Ref('Kapazitaet') } },
  }, async req => {
    await req.need('ressource:read');
    const { von, bis } = zeitraum(req.query as { von?: string; bis?: string });
    const rows = await req.tx(tx => store.list(tx, von, bis));
    return { von, bis, zellen: rows.map(zelle), can: await capabilities(req) };
  });

  app.put('/v1/kapazitaet', {
    schema: {
      tags: [TAG], summary: 'Kapazitätsangebot festlegen',
      description: 'Mehrere Zellen auf einmal (Raster mit automatischem Speichern, UC-009 Schritt 2). Hat eine Zelle schon ein Angebot, ist ihre gelesene `version` Pflicht (sonst 412 mit der aktuellen Version); `fte: null` entfernt das Angebot. Die Rolle muss ein aktiver Codewert der Codetabelle `ressourcenrolle` sein (422). Alles oder nichts.',
      body: Type.Ref('KapazitaetPut'), response: { 200: Type.Ref('KapazitaetGespeichert') },
    },
  }, async req => {
    await req.need('ressource:write');
    const body = req.body as KapazitaetPutIn;
    const schluessel = body.zellen.map(z => `${z.rolle}|${z.monat}`);
    if (new Set(schluessel).size !== schluessel.length) throw invalid('Jede Zelle darf nur einmal vorkommen.', [{ path: '/zellen', message: 'Rolle und Monat doppelt' }]);
    const who = actorOf(req);
    const zellen = await req.tx(async tx => {
      const out: KapazitaetZelleOut[] = [];
      const geprueft = new Map<string, boolean>();
      for (const [i, z] of body.zellen.entries()) {
        const vorher = await store.get(tx, z.rolle, z.monat);
        if (vorher && z.version !== vorher.version) throw preconditionFailed(vorher.version);
        if (!vorher && z.version !== undefined) throw preconditionFailed(0);
        if (z.fte === null) {
          if (!vorher) { out.push({ rolle: z.rolle, monat: z.monat, fte: null, version: null }); continue; }
          if (!(await store.remove(tx, vorher.id, vorher.version))) throw preconditionFailed(vorher.version);
          await record(tx, who, { action: 'kapazitaet.deleted', resourceType: 'kapazitaet', resourceId: vorher.id, data: zelle(vorher), event: { id: vorher.id, rolle: z.rolle, monat: z.monat } });
          out.push({ rolle: z.rolle, monat: z.monat, fte: null, version: null });
          continue;
        }
        if (!geprueft.has(z.rolle)) geprueft.set(z.rolle, await codewertAktiv(tx, 'ressourcenrolle', z.rolle));
        if (!geprueft.get(z.rolle)) throw invalid(`Die Rolle «${z.rolle}» gibt es nicht oder sie ist deaktiviert.`, [{ path: `/zellen/${i}/rolle`, message: 'kein aktiver Codewert der Codetabelle «Rolle des Ressourcenbedarfs»' }]);
        if (vorher && vorher.fte === z.fte) { out.push(zelle(vorher)); continue; }
        const r = vorher ? await store.update(tx, vorher.id, vorher.version, z.fte) : await store.create(tx, z.rolle, z.monat, z.fte);
        if (!r) throw preconditionFailed(vorher!.version);
        await record(tx, who, {
          action: vorher ? 'kapazitaet.updated' : 'kapazitaet.created', resourceType: 'kapazitaet', resourceId: r.id,
          data: vorher ? { before: zelle(vorher), after: zelle(r) } : zelle(r), event: { id: r.id, ...zelle(r) },
        });
        out.push(zelle(r));
      }
      return out;
    });
    return { zellen };
  });

  app.get('/v1/auslastung', {
    schema: {
      tags: [TAG], summary: 'Auslastung analysieren',
      description: 'Angebot gegen den Bedarf in FTE je Rolle und Monat (UC-009 Schritt 5): Engpässe (überbucht, ohne Angebot) und freie Kapazität, mit den Beiträgen je Projekt. Gezählt wird der Bedarf in FTE × Monate der Projekte, die die Person sieht; Bedarf nur als Grösse S/M/L zählt nicht (A-20). Mit `szenario` die Auslastung eines Portfolioszenarios (UC-008 Schritt 5; unbekannt: 404).',
      querystring: AuslastungQuery, response: { 200: Type.Ref('Auslastung') },
    },
  }, async (req): Promise<AuslastungOut> => {
    await req.need('ressource:read');
    const q = req.query as { von?: string; bis?: string; szenario?: string };
    const { von, bis } = zeitraum(q);
    return req.tx(async tx => {
      const szenario = q.szenario ? await szenarioLesen(tx, q.szenario) : null;
      if (q.szenario && !szenario) throw notFound('Szenario');
      const e = await berechnen(tx, von, bis, szenario?.positionen);
      const ids = [...new Set(e.rollen.flatMap(r => r.zellen.flatMap(z => z.beitraege.map(b => b.projektId))))];
      return {
        von, bis, monate: e.monate, szenario: szenario && { id: szenario.id, name: szenario.name },
        rollen: e.rollen, projekte: await store.projekte(tx, ids), engpaesse: e.engpaesse,
      };
    });
  });
}

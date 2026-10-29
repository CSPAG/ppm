/**
 * Abschluss der Periode (UC-005 Schritt 5, A3; Kernablauf K1; AP-E1-2): ungeprüfte Berichte zählen mit dem Vermerk
 * «nicht geprüft» (A-74, keine Sperre), Stand je Projekt mit «nicht gemeldet» und den Werten der Vorperiode (A-11),
 * Periode gesperrt (Z9, A-37). Dazu die Aufgaben
 * der UE (docs/fachmodell.md 4.2): «Statusberichte prüfen» beim ersten Einreichen der Periode, «Periode abschliessen»
 * am Stichtag (Job), und die Folgen des erneuten Einreichens nach einer Rückfrage (A2.2).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { actorOf, conflict, etag, IfMatchHeaders, preconditionFailed, requireIfMatch, type Actor, type Deps, type JobDefinition, type Tx } from '@vollholz/platform';
import { enqueue, record } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { laufendePeriode } from './bericht.ts';
import { folgen } from './folgen.ts';
import { eingereichterBericht, fristen, monat, PERIODE_ABGESCHLOSSEN } from './pruefung.ts';
import { berichtBezug, linkMonatsabschluss, rechteVon, TAG_MONATSABSCHLUSS } from './pruefung-routes.ts';
import { PeriodeParams } from './pruefung-schemas.ts';
import * as pstore from './pruefung-store.ts';
import { uebersicht } from './pruefung-uebersicht.ts';
import * as store from './store.ts';

const BEZUG = (periode: string) => ({ typ: 'periode', id: periode });

/** Kennung der Periode im Audit (Spalte uuid): «2026-10» → 00000000-0000-0000-0000-000000202610, lesbar und fest. */
export const periodeKennung = (periode: string) => `00000000-0000-0000-0000-000000${periode.replace('-', '')}`;

/** Sammelaufgabe der UE je Periode (K1 Einstieg, I-B3): offen ab dem ersten Einreichen, erledigt mit dem Abschluss. */
async function pruefaufgabe(tx: Tx, periode: string): Promise<void> {
  await aufgabe.oeffnen(tx, {
    art: 'statusbericht.pruefen',
    bezug: BEZUG(periode),
    empfaenger: { recht: 'statusbericht:review' },
    titel: `Statusberichte ${monat(periode)} prüfen`,
    kontext: 'Eingereichte Berichte der Periode',
    link: linkMonatsabschluss(periode, 'eingereicht'),
    frist: { datum: (await fristen(tx, periode)).abschlussBis, art: 'kalendertage' },
  });
}

/** Aufgabe «Periode abschliessen» (Fachmodell 4.2: Job am 25., Frist Monatsende). */
async function abschlussaufgabe(tx: Tx, periode: string, abschlussBis: string): Promise<void> {
  await aufgabe.oeffnen(tx, {
    art: 'periode.abschliessen',
    bezug: BEZUG(periode),
    empfaenger: { recht: 'periode:close' },
    titel: `Periode ${monat(periode, true)} abschliessen`,
    kontext: 'Monatsabschluss',
    link: linkMonatsabschluss(periode),
    frist: { datum: abschlussBis, art: 'kalendertage' },
  });
}

export const PERIODE_FAELLIG = 'statusbericht.periode_faellig';

/**
 * Job am Stichtag (A-26, Q8 Kap. 8.4): öffnet «Periode abschliessen», solange die Periode offen ist. Eingereiht beim
 * ersten Einreichen der Periode; vor dem Stichtag reiht er sich auf den Stichtag ein (Stichtag aus dem Phasenmodell in
 * Kraft, ohne Phasenmodell sofort).
 */
export const periodeFaelligJob: JobDefinition<{ periode: string }> = {
  kind: PERIODE_FAELLIG,
  async run(ctx, p) {
    await ctx.tx(async tx => {
      if ((await store.periodeStand(tx, p.periode)) === 'abgeschlossen') return;
      const f = await fristen(tx, p.periode);
      if (f.stichtag && (await pstore.heute(tx)) < f.stichtag) {
        await enqueue(tx, PERIODE_FAELLIG, { periode: p.periode }, { runAt: await pstore.tagesbeginn(tx, f.stichtag), dedupeKey: `${p.periode}:stichtag` });
        return;
      }
      await abschlussaufgabe(tx, p.periode, f.abschlussBis);
    });
  },
};

/** Folgen des Einreichens (über `folgen` von AP-E1-1, in dessen Transaktion): Rückfrage beantwortet, Aufgaben nachgeführt. */
export function registriereFolgen(): void {
  folgen.beimEinreichen(async (tx: Tx, r: store.Row, _who: Actor) => {
    // Rückfrage beantwortet (UC-005 A2.2): Aufgabe der PL erledigt, der Bericht ist wieder «eingereicht»
    if (await pstore.rueckfragenBeantworten(tx, r.id)) {
      await aufgabe.erledigen(tx, { art: 'statusbericht.rueckfrage', bezug: { typ: 'statusbericht', id: r.id } });
    }
    // Eingeforderter Bericht ist da (UC-005 A1)
    await aufgabe.erledigen(tx, { art: 'statusbericht.erstellen', bezug: berichtBezug(r.projekt_id, r.periode) });
    // Sammelaufgabe der UE (erneut) öffnen (UC-005 Ausgangslage, A2.2) und den Job zum Stichtag einreihen
    await pruefaufgabe(tx, r.periode);
    await enqueue(tx, PERIODE_FAELLIG, { periode: r.periode }, { dedupeKey: r.periode });
  });
}

export function registerAbschlussRoutes(app: FastifyInstance, _deps: Deps): void {
  app.post('/v1/perioden/:periode/abschliessen', {
    schema: {
      tags: [TAG_MONATSABSCHLUSS], summary: 'Periode abschliessen',
      description: 'Abschluss (UC-005 Schritt 5, A3; Recht `periode:close`): eingereichte, ungeprüfte Berichte zählen mit ihren Werten und dem Vermerk «nicht geprüft»; die Aufgabe «Statusberichte prüfen» bleibt offen, bis sie bestätigt sind (A-74). Für jedes berichtspflichtige Projekt ohne geprüften Bericht gelten die Werte der Vorperiode mit dem Vermerk «nicht gemeldet» (A-11); danach ist die Periode gesperrt, ein späterer Bericht zählt für die nächste (A-37). Optional `If-Match` mit der Version der Periode aus dem Kopf (`W/"0"`, solange es sie nicht gibt).',
      params: PeriodeParams, headers: Type.Partial(IfMatchHeaders), response: { 200: Type.Ref('Periodenstand') },
    },
  }, async (req, reply) => {
    const { periode } = req.params as { periode: string };
    // If-Match optional: der Abschluss prüft den Stand selbst; mit Version zusätzlich gegen gleichzeitige Änderung
    const version = req.headers['if-match'] !== undefined ? requireIfMatch(req) : null;
    await req.need('periode:close');
    const who = actorOf(req);
    const rechte = rechteVon(req);
    const kopf = await req.tx(async tx => {
      if (periode > (await laufendePeriode(tx))) throw conflict(`Die Periode ${periode} hat noch nicht begonnen.`, { reason: 'zukunft' });
      let p = await pstore.periode(tx, periode, { sperren: true });
      if (version !== null && (p?.version ?? 0) !== version) throw preconditionFailed(p?.version ?? 0);
      if (p?.stand === 'abgeschlossen') throw conflict(PERIODE_ABGESCHLOSSEN, { reason: 'periode' });
      const rows = await pstore.zeilen(tx, periode);
      if (!p) {
        await store.periodeSichern(tx, periode);
        p = (await pstore.periode(tx, periode, { sperren: true }))!;
      }

      let gemeldet = 0;
      let ungeprueft = 0;
      for (const z of rows) {
        const vor = await pstore.vorstand(tx, z.projekt_id, periode);
        const statusVorperiode = vor?.status ?? z.vor_status;
        // geprüft oder eingereicht (mit Vermerk «nicht geprüft», A-74): die Werte des Berichts
        if (z.stand === 'geprueft' || z.stand === 'eingereicht') {
          gemeldet++;
          if (z.stand === 'eingereicht') ungeprueft++;
          await pstore.dashboardZeile(tx, periode, {
            projektId: z.projekt_id, statusberichtId: z.bericht_id, status: z.status, trend: z.trend, phase: z.phase ?? z.projekt_phase,
            abschlussPer: z.abschluss_per, naechsterMeilenstein: z.naechster_meilenstein ?? '', werteAus: periode, statusVorperiode,
          });
          continue;
        }
        // Nicht gemeldet (UC-005 A3, A-11): Werte der Vorperiode – letzter Stand bei Abschluss, sonst letzter eingereichter Bericht
        const werte = vor
          ? { status: vor.status, trend: vor.trend, phase: vor.phase, abschlussPer: vor.abschluss_per, naechsterMeilenstein: vor.naechster_meilenstein, werteAus: vor.werte_aus }
          : z.vor_periode
            ? { status: z.vor_status, trend: z.vor_trend, phase: z.vor_phase ?? z.projekt_phase, abschlussPer: z.vor_abschluss_per, naechsterMeilenstein: z.vor_naechster_meilenstein ?? '', werteAus: z.vor_periode }
            : { status: null, trend: null, phase: z.projekt_phase, abschlussPer: null, naechsterMeilenstein: '', werteAus: null };
        await pstore.dashboardZeile(tx, periode, { projektId: z.projekt_id, statusberichtId: null, ...werte, statusVorperiode });
        // Offene Aufgaben der Projektleitung zur Periode entfallen (A-37: ein späterer Bericht zählt für die nächste)
        if (z.bericht_id && eingereichterBericht(z)) await aufgabe.entfallen(tx, { art: 'statusbericht.rueckfrage', bezug: { typ: 'statusbericht', id: z.bericht_id } });
        await aufgabe.entfallen(tx, { art: 'statusbericht.erstellen', bezug: berichtBezug(z.projekt_id, periode) });
      }

      const n = await pstore.abschliessen(tx, periode, p.version);
      if (!n) throw preconditionFailed(p.version);
      // die Prüfaufgabe bleibt offen, bis die ungeprüften Berichte bestätigt sind (A-74)
      if (!ungeprueft) await aufgabe.erledigen(tx, { art: 'statusbericht.pruefen', bezug: BEZUG(periode) });
      await aufgabe.erledigen(tx, { art: 'periode.abschliessen', bezug: BEZUG(periode) });
      const daten = { periode, projekte: rows.length, gemeldet, ungeprueft, nichtGemeldet: rows.length - gemeldet, version: n.version };
      await record(tx, who, { action: 'periode.closed', resourceType: 'periode', resourceId: periodeKennung(periode), data: daten, event: daten });
      return (await uebersicht(tx, periode, rechte)).kopf;
    });
    reply.header('etag', etag(kopf.version));
    return kopf;
  });
}

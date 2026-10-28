/**
 * Berichtsaufgabe und Mitteilung «kritisch» (fachmodell.md 4.2, 2.14; UC-004 Ausgangslage, A2.2; K1; A-07, A-08, A-26):
 * Aufgabe je Projektleitung ab dem Tag `bericht_aufgabe` mit Frist `bericht_stichtag` aus dem Phasenmodell in Kraft,
 * nur für aktive Projekte in P0–P3 eines Portfolios mit Pflichten; Einreichen erledigt, Zurückziehen öffnet wieder;
 * «kritisch» informiert den Sponsor. Vorbelegung des nächsten Meilensteins aus dem Meilensteinplan.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { app as ppm } from '../../src/app.ts';
import { full } from './harness.ts';
import { grant, login, person, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

const PERIODE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);
const VOLL = {
  trend: 'gleichbleibend',
  abweichung: Object.fromEntries(['inhalt', 'termin', 'ressourcen', 'budget'].map(d => [d, { stufe: 'keine', kommentar: '' }])),
};
const log = { info() {}, warn() {}, error(o: object, m: string) { throw new Error(`${m} ${JSON.stringify(o)}`); } };

describe('Berichtsaufgabe und Mitteilung «kritisch»', () => {
  let api: TestApi;
  let T = '';
  let pl: Record<string, string>;
  let plId = '', spId = '';
  const projekt: Record<string, string> = {};

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const task = ppm.modules.flatMap(m => m.tasks ?? []).find(t => t.name === 'statusbericht.berichtsaufgaben')!;
  const lauf = () => task.run({ db: api.t.worker, log } as unknown as Parameters<typeof task.run>[0]);
  const aufgaben = () => full(api.t.runtime, T, async tx => (await tx.query<{ bezug_id: string; empfaenger_person: string; stand: string; titel: string; kontext: string; link: string; frist: string; frist_art: string }>(
    "SELECT bezug_id, empfaenger_person, stand, titel, kontext, link, to_char(frist, 'YYYY-MM-DD') AS frist, frist_art FROM ppm.aufgabe WHERE art = 'statusbericht.erstellen' ORDER BY created_at, bezug_id")).rows);

  before(async () => {
    api = await testApi();
    const ue = await login(api, 'demo', 'u-ue', 'ue');
    const adm = await login(api, 'demo', 'u-adm', 'org-admin');
    T = ue.tenantId;
    // Phasenmodell nach Vorgabe in Kraft; Tag der Aufgabe auf den 1., damit der Test an jedem Tag des Monats gilt
    const c = await call('POST', '/v1/phasenmodelle', { authorization: ue.authorization }, { quelle: 'vorgabe' });
    assert.equal(c.statusCode, 201, c.body);
    const k = await call('POST', `/v1/phasenmodelle/${c.json().id}/in-kraft-setzen`, { authorization: adm.authorization, 'if-match': c.headers.etag as string });
    assert.equal(k.statusCode, 200, k.body);
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.frist SET wert = 1 WHERE schluessel = 'bericht_aufgabe'"));

    const p = await login(api, 'demo', 'u-pl', null);
    plId = p.principalId;
    pl = { authorization: p.authorization };
    spId = await person(api, T, 'u-sp');
    await full(api.t.runtime, T, async tx => {
      const pf = async (k: string, pflichten: boolean) => (await tx.query<{ id: string }>(
        "INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, $2, $3, $3, $4) RETURNING id", [T, pflichten ? 'A' : 'C', k, pflichten])).rows[0]!.id;
      const a = await pf('transformation', true), c = await pf('dir', false);
      for (const [nr, portfolio, phase, lz] of [['2026-001', a, 'P1', 'aktiv'], ['2026-002', c, 'P1', 'aktiv'], ['2026-003', a, 'P4', 'aktiv'], ['2026-004', a, 'P2', 'sistiert']] as const) {
        const id = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, lebenszyklus) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [T, nr, `Projekt ${nr}`, portfolio, phase, lz])).rows[0]!.id;
        projekt[nr] = id;
        await tx.query("INSERT INTO ppm.projekt_person (tenant_id, projekt_id, person_id, funktion) VALUES ($1, $2, $3, 'pl'), ($1, $2, $4, 'sp')", [T, id, plId, spId]);
      }
      await tx.query(
        `INSERT INTO ppm.meilenstein (tenant_id, projekt_id, phase, art, text, termin_baseline, termin_aktuell, erreicht_am) VALUES
           ($1, $2, 'P1', 'meilenstein', 'Konzept abgenommen', '2026-01-31', NULL, '2026-02-03'),
           ($1, $2, 'P2', 'meilenstein', 'Pilot gestartet', '2027-03-31', '2027-04-15', NULL),
           ($1, $2, 'P2', 'kommunikation', 'Newsletter', '2026-01-15', NULL, NULL),
           ($1, $2, 'P3', 'meilenstein', 'Rollout', '2027-09-30', NULL, NULL)`, [T, projekt['2026-001']]);
    });
    await grant(api, T, `user:${plId}`, 'pl', { type: 'projekt', id: projekt['2026-001'] });
  });
  after(async () => { await api?.close(); });

  test('Aufgabe je Projektleitung nur für Projekte mit Berichtspflicht, idempotent (A-07, A-08, A-26)', async () => {
    await lauf();
    await lauf();
    const a = await aufgaben();
    assert.equal(a.length, 1, JSON.stringify(a));
    const stichtag = `${PERIODE}-25`;
    assert.deepEqual(a[0], {
      bezug_id: `${projekt['2026-001']}/${PERIODE}`, empfaenger_person: plId, stand: 'offen',
      titel: `Statusbericht ${['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][Number(PERIODE.slice(5)) - 1]} erstellen`,
      kontext: '2026-001 Projekt 2026-001 · als PL', link: `/projekte/2026-001/bericht?periode=${PERIODE}`, frist: stichtag, frist_art: 'kalendertage',
    });
    const e = (await call('GET', '/v1/eingang', pl)).json();
    assert.ok(e.items.some((x: { titel: string }) => x.titel === a[0]!.titel), 'im Eingang der PL');
  });

  test('Vorbelegung: nächster Meilenstein aus dem Plan (K1 Schritt 7)', async () => {
    const b = (await call('GET', `/v1/projekte/${projekt['2026-001']}/berichte/${PERIODE}`, pl)).json();
    assert.equal(b.naechsterMeilenstein, 'Pilot gestartet (15.04.2027)');
  });

  test('Einreichen erledigt die Aufgabe, «kritisch» informiert den Sponsor; Zurückziehen öffnet sie wieder', async () => {
    const url = `/v1/projekte/${projekt['2026-001']}/berichte/${PERIODE}`;
    const s = await call('PUT', url, { ...pl, 'if-match': 'W/"0"' }, { ...VOLL, status: 'kritisch', begruendung: 'Lieferverzug', massnahme: 'Zweiter Lieferant' });
    assert.equal(s.statusCode, 200, s.body);
    const e = await call('POST', `${url}/einreichen`, { ...pl, 'if-match': 'W/"1"' });
    assert.equal(e.statusCode, 200, e.body);
    assert.deepEqual((await aufgaben()).map(x => x.stand), ['erledigt']);
    await lauf();
    assert.deepEqual((await aufgaben()).map(x => x.stand), ['erledigt'], 'eingereicht: keine neue Aufgabe');
    const m = await full(api.t.runtime, T, async tx => (await tx.query<{ empfaenger_person: string; text: string; link: string }>(
      'SELECT empfaenger_person, text, link FROM ppm.mitteilung WHERE bezug_id = $1', [e.json().id])).rows);
    assert.equal(m.length, 1);
    assert.equal(m[0]!.empfaenger_person, spId);
    assert.match(m[0]!.text, /^2026-001 Projekt 2026-001 ist im Statusbericht \S+ kritisch\. Begründung: Lieferverzug Massnahme: Zweiter Lieferant$/);
    assert.equal(m[0]!.link, `/projekte/2026-001/bericht?periode=${PERIODE}`);

    const z = await call('POST', `${url}/zurueckziehen`, { ...pl, 'if-match': 'W/"2"' });
    assert.equal(z.statusCode, 200, z.body);
    // Job mit voller Sicht (wie der Worker)
    const job = ppm.modules.flatMap(m => m.jobs ?? []).find(j => j.kind === 'statusbericht.berichtsaufgabe_oeffnen')!;
    const offen = await full(api.t.runtime, T, async tx => (await tx.query<{ payload: { projektId: string } }>("SELECT payload FROM ppm.job WHERE kind = 'statusbericht.berichtsaufgabe_oeffnen' AND status = 'queued'")).rows);
    assert.deepEqual(offen.map(j => j.payload), [{ projektId: projekt['2026-001'] }]);
    await job.run({ tenantId: T, tx: <R>(fn: (tx: never) => Promise<R>) => full(api.t.worker, T, fn as never) } as never, offen[0]!.payload);
    assert.deepEqual((await aufgaben()).map(x => x.stand), ['erledigt', 'offen']);
  });
});

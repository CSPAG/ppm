/**
 * Aufgabe «Zielerreichung erfassen» (fachmodell.md 4.2; BC ZM.03.01, UC-012 Schritte 1–2; AP-E6-3 PR 2): nach
 * Quartalsende eine Sammelaufgabe für das Recht `zielerreichung:write` mit Fortschritt, idempotent; erledigt mit dem
 * letzten erfassten Ziel, wieder offen nach dem Entfernen eines Stands; ältere Quartale öffnen keine Aufgabe.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { app as ppm } from '../../src/app.ts';
import { full } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

/** Zuletzt abgeschlossenes Quartal nach Schweizer Zeit. */
const QUARTAL = (() => {
  const [j, m] = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).split('-').map(Number) as [number, number];
  const q = Math.floor((m - 1) / 3) + 1;
  return q === 1 ? `${j - 1}-Q4` : `${j}-Q${q - 1}`;
})();
const log = { info() {}, warn() {}, error(o: object, m: string) { throw new Error(`${m} ${JSON.stringify(o)}`); } };

describe('Aufgabe «Zielerreichung erfassen»', () => {
  let api: TestApi;
  let T = '';
  let gl: Record<string, string>, leser: Record<string, string>;
  const ziele: string[] = [];

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const task = ppm.modules.flatMap(m => m.tasks ?? []).find(t => t.name === 'ziel.zielerreichung_aufgaben')!;
  const lauf = () => task.run({ db: api.t.worker, log } as unknown as Parameters<typeof task.run>[0]);
  const aufgaben = () => full(api.t.runtime, T, async tx => (await tx.query<{ bezug_id: string; stand: string; titel: string; kontext: string; link: string; empfaenger_recht: string; frist: string | null }>(
    "SELECT bezug_id, stand, titel, kontext, link, empfaenger_recht, frist::text FROM ppm.aufgabe WHERE art = 'zielerreichung.erfassen' ORDER BY created_at")).rows);

  before(async () => {
    api = await testApi();
    const g = await login(api, 'demo', 'u-gl', 'gl');
    T = g.tenantId;
    gl = { authorization: g.authorization };
    leser = { authorization: (await login(api, 'demo', 'u-leser', 'leser')).authorization };
  });
  after(async () => { await api?.close(); });

  test('ohne Ziele keine Aufgabe', async () => {
    await lauf();
    assert.deepEqual(await aufgaben(), []);
  });

  test('nach Quartalsende eine Sammelaufgabe mit Fortschritt, idempotent; im Eingang der GL, nicht der Leserin', async () => {
    const h = (await call('POST', '/v1/handlungsfelder', gl, { label: 'Patientenorientierung', position: 1 })).json().id as string;
    for (const nr of ['1.1', '1.2']) {
      const z = await call('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: h, nummer: nr, text: `Ziel ${nr}` });
      assert.equal(z.statusCode, 201, z.body);
      ziele.push(z.json().id);
    }
    await lauf();
    await lauf();
    const [jahr, q] = QUARTAL.split('-') as [string, string];
    assert.deepEqual(await aufgaben(), [{
      bezug_id: QUARTAL, stand: 'offen', titel: `Zielerreichung ${q} ${jahr} erfassen`, kontext: '0 von 2 Zielen nachgeführt',
      link: `/ziele/${jahr}/zielerreichung?quartal=${q.toLowerCase()}`, empfaenger_recht: 'zielerreichung:write', frist: null,
    }]);
    const e = (await call('GET', '/v1/eingang', gl)).json();
    assert.ok(e.items.some((x: { titel: string }) => x.titel === `Zielerreichung ${q} ${jahr} erfassen`));
    const l = (await call('GET', '/v1/eingang', leser)).json();
    assert.ok(!l.items.some((x: { titel: string }) => x.titel.startsWith('Zielerreichung')));
  });

  test('Erfassen führt den Fortschritt nach, das letzte Ziel erledigt; Entfernen öffnet wieder', async () => {
    const a = await call('POST', `/v1/zielerreichung/${QUARTAL}`, gl, { zielTyp: 'strategisch', zielId: ziele[0], stand: '72 %' });
    assert.equal(a.statusCode, 201, a.body);
    assert.deepEqual((await aufgaben()).map(x => [x.stand, x.kontext]), [['offen', '1 von 2 Zielen nachgeführt']]);
    const b = await call('POST', `/v1/zielerreichung/${QUARTAL}`, gl, { zielTyp: 'strategisch', zielId: ziele[1], stand: '40 %' });
    assert.equal(b.statusCode, 201, b.body);
    assert.deepEqual((await aufgaben()).map(x => x.stand), ['erledigt']);
    await lauf();
    assert.deepEqual((await aufgaben()).map(x => x.stand), ['erledigt'], 'vollständig: keine neue Aufgabe');

    const d = await call('DELETE', `/v1/zielerreichung/${QUARTAL}/${b.json().id}`, { ...gl, 'if-match': 'W/"1"' });
    assert.equal(d.statusCode, 204, d.body);
    assert.deepEqual((await aufgaben()).map(x => [x.stand, x.kontext]), [['erledigt', '1 von 2 Zielen nachgeführt'], ['offen', '1 von 2 Zielen nachgeführt']]);
  });

  test('Erfassen in einem älteren Quartal öffnet keine Aufgabe', async () => {
    const [jahr] = QUARTAL.split('-').map(Number) as [number];
    const alt = `${jahr - 1}-Q1`;
    const r = await call('POST', `/v1/zielerreichung/${alt}`, gl, { zielTyp: 'strategisch', zielId: ziele[0], stand: '10 %' });
    assert.equal(r.statusCode, 201, r.body);
    assert.ok(!(await aufgaben()).some(x => x.bezug_id === alt));
  });
});

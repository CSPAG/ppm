/**
 * Toleranzen im Projektvertrag (A-10, K11; fachmodell.md 2.x `toleranz`: «Vertrag kann übersteuern»): Kap. 7 erfasst
 * die Übersteuerung je Dimension, sie gilt ab der Baseline; sonst gilt der Standard des Phasenmodells. Lese-Schnittstelle
 * `vertrag.toleranzen` und `GET /v1/projekte/:id/toleranzen`.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { systemActor } from '@vollholz/platform';
import { vertrag } from '../../src/modules/vertrag/index.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, tenant } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

type H = Record<string, string>;

describe('Toleranzen im Projektvertrag', () => {
  let api: TestApi;
  let T: string;
  const p: Record<'a' | 'b', string> = { a: '', b: '' };
  let entwurf = '';
  const h: Record<string, H> = {};

  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });
  const gueltig = async (who: string, id: string) => {
    const r = await call(who, 'GET', `/v1/projekte/${id}/toleranzen`);
    assert.equal(r.statusCode, 200, r.body);
    return (r.json().toleranzen as { dimension: string; wert: number | null; einheit: string | null; quelle: string | null }[]).map(t => [t.dimension, t.wert, t.einheit, t.quelle]);
  };

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'toleranz', 'Toleranz', true) RETURNING id", [T])).rows[0]!.id;
      for (const [k, nr] of [['a', '2026-001'], ['b', '2026-002']] as const) {
        p[k] = (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, $2, $2, $3, 'P1') RETURNING id", [T, nr, pf])).rows[0]!.id;
      }
    });
    for (const [sub, rolle] of [['adm', 'org-admin'], ['ue', 'alle-fuehren']] as const) h[sub] = { authorization: (await login(api, 'acme', sub, rolle)).authorization };
    const pl = await login(api, 'acme', 'pl', null);
    await grant(api, T, `user:${pl.principalId}`, 'projekt-fuehren', { type: 'projekt', id: p.a });
    h.pl = { authorization: pl.authorization };
    h.fremd = { authorization: (await login(api, 'acme', 'fremd', null)).authorization };

    // Standard im Phasenmodell in Kraft: Termin 20 Kalendertage, Kosten 10 %, Umfang ohne Toleranz
    const m = await call('ue', 'POST', '/v1/phasenmodelle', {});
    assert.equal(m.statusCode, 201, m.body);
    const e = await call('ue', 'PATCH', `/v1/phasenmodelle/${m.json().id}`, {
      toleranzen: [{ dimension: 'termin', wert: 20, einheit: 'kalendertage' }, { dimension: 'kosten', wert: 10, einheit: 'prozent' }],
    }, { 'if-match': m.headers.etag as string });
    assert.equal(e.statusCode, 200, e.body);
    const k = await call('adm', 'POST', `/v1/phasenmodelle/${m.json().id}/in-kraft-setzen`, undefined, { 'if-match': e.headers.etag as string });
    assert.equal(k.statusCode, 200, k.body);

    const v = await call('pl', 'POST', `/v1/projekte/${p.a}/vertrag/entwuerfe`, { anlass: 'initial' });
    assert.equal(v.statusCode, 201, v.body);
    entwurf = v.json().version.id;
  });
  after(async () => { await api?.close(); });

  test('ohne Vertrag gilt der Standard des Phasenmodells; ohne Wert keine Toleranz', async () => {
    assert.deepEqual(await gueltig('pl', p.a), [['termin', 20, 'kalendertage', 'phasenmodell'], ['kosten', 10, 'prozent', 'phasenmodell'], ['umfang', null, null, null]]);
  });

  test('Kap. 7 erfasst die Übersteuerung je Dimension; doppelte Dimension 422; im Entwurf gilt noch der Standard', async () => {
    const g = await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/7`);
    assert.equal(g.statusCode, 200, g.body);
    const inhalt = g.json().inhalt;
    const doppelt = await call('pl', 'PUT', `/v1/vertragsversionen/${entwurf}/kapitel/7`, {
      inhalt: { ...inhalt, toleranzen: [{ dimension: 'kosten', wert: 5, einheit: 'prozent' }, { dimension: 'kosten', wert: 6, einheit: 'prozent' }] },
    }, { 'if-match': g.headers.etag as string });
    assert.equal(doppelt.statusCode, 422, doppelt.body);
    assert.deepEqual(doppelt.json().errors.map((x: { path: string }) => x.path), ['/inhalt/toleranzen/1/dimension']);
    const falsch = await call('pl', 'PUT', `/v1/vertragsversionen/${entwurf}/kapitel/7`, {
      inhalt: { ...inhalt, toleranzen: [{ dimension: 'budget', wert: 5, einheit: 'prozent' }] },
    }, { 'if-match': g.headers.etag as string });
    assert.equal(falsch.statusCode, 422, falsch.body);

    const ok = await call('pl', 'PUT', `/v1/vertragsversionen/${entwurf}/kapitel/7`, {
      inhalt: { ...inhalt, toleranzen: [{ dimension: 'kosten', wert: 5, einheit: 'prozent' }, { dimension: 'umfang', wert: 15, einheit: 'prozent' }] },
    }, { 'if-match': g.headers.etag as string });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.deepEqual(ok.json().inhalt.toleranzen.map((t: { dimension: string }) => t.dimension), ['kosten', 'umfang']);
    // Gilt ab der Baseline
    assert.deepEqual((await gueltig('pl', p.a))[1], ['kosten', 10, 'prozent', 'phasenmodell']);
  });

  test('ab der Baseline gilt der Vertrag je Dimension, sonst der Standard; Lese-Schnittstelle für mehrere Projekte', async () => {
    await full(api.t.runtime, T, async tx => {
      await tx.query("UPDATE ppm.vertrag_version SET stand = 'traktandiert' WHERE id = $1", [entwurf]);
      await vertrag.baselineSetzen(tx, systemActor('system'), entwurf);
    });
    assert.deepEqual(await gueltig('pl', p.a), [['termin', 20, 'kalendertage', 'phasenmodell'], ['kosten', 5, 'prozent', 'vertrag'], ['umfang', 15, 'prozent', 'vertrag']]);

    const alle = await full(api.t.runtime, T, tx => vertrag.toleranzen(tx, [p.a, p.b]));
    assert.deepEqual(alle.get(p.a)!.map(t => t.quelle), ['phasenmodell', 'vertrag', 'vertrag']);
    assert.deepEqual(alle.get(p.b)!.map(t => [t.dimension, t.wert, t.quelle]), [['termin', 20, 'phasenmodell'], ['kosten', 10, 'phasenmodell'], ['umfang', null, null]]);
  });

  test('Rechte: lesen mit projekt:read am Projekt; ohne Recht nicht', async () => {
    assert.notEqual((await call('fremd', 'GET', `/v1/projekte/${p.a}/toleranzen`)).statusCode, 200);
    assert.equal((await call('pl', 'GET', `/v1/projekte/${p.b}/toleranzen`)).statusCode, 403);
    assert.equal((await call('ue', 'GET', `/v1/projekte/${p.b}/toleranzen`)).statusCode, 200);
  });
});

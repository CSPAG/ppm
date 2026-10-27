/**
 * Portfolios und Gremien (BC AM.02.04; UC-017 Schritt 4, A1): Pflichten je Kategorie (A-07, A-08), ein entscheidendes
 * Gremium je Portfolio (A-45), SNS-VR als externes Gremium (A-02), Gremienweg je Gate mit «via SNS-VR» (Abnahme
 * AP-E0-5, Q8 Kap. 5.1, UC-006 A1), Sitzungstermine, Rechte (portfolio:read, portfolio:admin), ETag und Audit.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { full, skipDb } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';
import { entscheidendesGremium, gremienwegFuerGate, sitzungstermine } from '../../src/modules/portfolio/index.ts';

const skip = await skipDb();

describe('Portfolios und Gremien', { skip }, () => {
  let api: TestApi;
  let ue: Record<string, string>, gl: Record<string, string>, nobody: Record<string, string>;
  let tenantId: string;

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    tenantId = u.tenantId;
    ue = { authorization: u.authorization };
    gl = { authorization: (await login(api, 'demo', 'u-gl', 'gl')).authorization };
    nobody = { authorization: (await login(api, 'demo', 'u-nobody', null)).authorization };
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const created = async (url: string, payload: unknown) => {
    const r = await call('POST', url, ue, payload);
    assert.equal(r.statusCode, 201, r.body);
    return r.json();
  };

  /** Governance nach PM-Handbuch (Q8 Kap. 5.1, 7): A mit PRAT und SNS-VR, B mit GLPA, C mit Direktion. */
  async function governance(suffix: string) {
    const a = await created('/v1/portfolios', { kategorie: 'A', schluessel: `transformation${suffix}`, name: 'Transformationsprogramm' });
    const b = await created('/v1/portfolios', { kategorie: 'B', schluessel: `geschaeftsleitung${suffix}`, name: 'Geschäftsleitung' });
    const c = await created('/v1/portfolios', { kategorie: 'C', schluessel: `dti${suffix}`, name: 'Direktion DTI' });
    const prat = await created('/v1/gremien', { portfolioId: a.id, kuerzel: `prat${suffix}`, name: 'Programmausschuss Transformation', art: 'entscheidend', rhythmus: 'monatlich' });
    const sns = await created('/v1/gremien', { portfolioId: a.id, kuerzel: `sns-vr${suffix}`, name: 'SNS-VR', art: 'extern' });
    const glpa = await created('/v1/gremien', { portfolioId: b.id, kuerzel: `glpa${suffix}`, name: 'GL Portfolio Ausschuss', art: 'entscheidend' });
    return { a, b, c, prat, sns, glpa };
  }

  test('Pflichten folgen der Kategorie; Kategorie und Schlüssel sind fest', async () => {
    const { a, b, c } = await governance('-1');
    assert.deepEqual([a.pflichten, b.pflichten, c.pflichten], [true, true, false]);
    assert.deepEqual(a.can, { admin: true });
    assert.equal(a.version, 1);

    const g = await call('GET', `/v1/portfolios/${a.id}`, gl);
    assert.equal(g.statusCode, 200);
    assert.deepEqual(g.json().can, { admin: false });
    assert.equal(g.headers.etag, 'W/"1"');

    const fest = await call('PATCH', `/v1/portfolios/${a.id}`, { ...ue, 'if-match': 'W/"1"' }, { kategorie: 'C' });
    assert.equal(fest.statusCode, 422, 'Kategorie nicht änderbar');
    const p = await call('PATCH', `/v1/portfolios/${a.id}`, { ...ue, 'if-match': 'W/"1"' }, { name: ' Transformation ' });
    assert.equal(p.statusCode, 200, p.body);
    assert.deepEqual([p.json().name, p.json().version, p.json().pflichten], ['Transformation', 2, true]);
    assert.equal((await call('PATCH', `/v1/portfolios/${a.id}`, { ...ue, 'if-match': 'W/"1"' }, { name: 'Alt' })).statusCode, 412);

    // Direktion nur bei Kategorie C (A-23)
    const dir = '00000000-0000-4000-8000-000000000001';
    assert.equal((await call('POST', '/v1/portfolios', ue, { kategorie: 'B', schluessel: 'b-dir', name: 'B', orgEinheitId: dir })).statusCode, 422);
    const pc = await call('PATCH', `/v1/portfolios/${c.id}`, { ...ue, 'if-match': 'W/"1"' }, { orgEinheitId: dir });
    assert.equal(pc.json().orgEinheitId, dir);

    assert.equal((await call('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'transformation-1', name: 'Doppelt' })).statusCode, 409);
  });

  test('ein entscheidendes Gremium je Portfolio, SNS-VR extern', async () => {
    const { a, prat, sns } = await governance('-2');
    assert.deepEqual([prat.art, sns.art, prat.rhythmus], ['entscheidend', 'extern', 'monatlich']);
    const zweites = await call('POST', '/v1/gremien', ue, { portfolioId: a.id, kuerzel: 'prat-zwei', name: 'Zweiter', art: 'entscheidend' });
    assert.equal(zweites.statusCode, 409, 'A-45');
    const list = (await call('GET', `/v1/gremien?portfolio=${a.id}`, gl)).json();
    assert.deepEqual(list.items.map((g: { kuerzel: string }) => g.kuerzel), ['prat-2', 'sns-vr-2']);
    await full(api.t.runtime, tenantId, async tx => {
      assert.equal((await entscheidendesGremium(tx, a.id))?.id, prat.id);
    });
  });

  test('Abnahme: «via SNS-VR» aus dem Gremienweg ableitbar', async () => {
    const { a, b, c, prat, sns, glpa } = await governance('-3');
    // A: PRAT entscheidet; in P0 und P1 bis zur Freigabe von P2 zusätzlich SNS-VR (Q8 Kap. 5.1)
    const schritte = [
      { gate: 'EINTRITT_P0', gremiumId: prat.id, zusaetzlichGremiumId: sns.id },
      { gate: 'P0_P1', gremiumId: prat.id, zusaetzlichGremiumId: sns.id },
      { gate: 'P1_P2', gremiumId: prat.id, zusaetzlichGremiumId: sns.id },
      { gate: 'P2_P3', gremiumId: prat.id },
      { gate: 'P3_P4', gremiumId: prat.id, zusaetzlichGremiumId: null },
      { gate: 'EXIT_P4', gremiumId: prat.id },
    ];
    assert.equal((await call('PUT', `/v1/portfolios/${a.id}/gremienweg`, ue, { schritte })).statusCode, 428);
    const w = await call('PUT', `/v1/portfolios/${a.id}/gremienweg`, { ...ue, 'if-match': 'W/"1"' }, { schritte: [...schritte].reverse() });
    assert.equal(w.statusCode, 200, w.body);
    assert.equal(w.headers.etag, 'W/"2"');
    const weg = w.json();
    assert.deepEqual(weg.schritte.map((s: { gate: string; gremium: { kuerzel: string }; viaSns: boolean }) => [s.gate, s.gremium.kuerzel, s.viaSns]), [
      ['EINTRITT_P0', 'prat-3', true], ['P0_P1', 'prat-3', true], ['P1_P2', 'prat-3', true],
      ['P2_P3', 'prat-3', false], ['P3_P4', 'prat-3', false], ['EXIT_P4', 'prat-3', false],
    ]);
    assert.equal(weg.schritte[0].zusaetzlich.name, 'SNS-VR');
    assert.equal((await call('GET', `/v1/portfolios/${a.id}`, gl)).json().version, 2, 'Gremienweg erhöht die Version des Portfolios');
    assert.equal((await call('PUT', `/v1/portfolios/${a.id}/gremienweg`, { ...ue, 'if-match': 'W/"1"' }, { schritte })).statusCode, 412);

    // B: GLPA ohne SNS-VR (Q8 Kap. 7)
    const wb = await call('PUT', `/v1/portfolios/${b.id}/gremienweg`, { ...ue, 'if-match': 'W/"1"' }, { schritte: [{ gate: 'P1_P2', gremiumId: glpa.id }] });
    assert.equal(wb.statusCode, 200, wb.body);

    // Schnittstelle für sitzung und vertrag
    await full(api.t.runtime, tenantId, async tx => {
      const p1 = await gremienwegFuerGate(tx, a.id, 'P1_P2');
      assert.deepEqual([p1?.gremium.id, p1?.zusaetzlich?.id, p1?.viaSns], [prat.id, sns.id, true]);
      assert.equal((await gremienwegFuerGate(tx, a.id, 'P2_P3'))?.viaSns, false);
      assert.deepEqual([(await gremienwegFuerGate(tx, b.id, 'P1_P2'))?.gremium.kuerzel, (await gremienwegFuerGate(tx, b.id, 'P1_P2'))?.viaSns], ['glpa-3', false]);
      // C ohne Pflicht-Gates (A-08): kein Gremienweg
      assert.equal(await gremienwegFuerGate(tx, c.id, 'P0_P1'), null);
    });

    // Regeln des Gremienwegs (fachmodell.md 2.4)
    const put = (body: unknown, version: number) => call('PUT', `/v1/portfolios/${a.id}/gremienweg`, { ...ue, 'if-match': `W/"${version}"` }, body);
    const fehler = async (body: unknown) => {
      const r = await put(body, 2);
      assert.equal(r.statusCode, 422, r.body);
      return r.json().errors.map((e: { path: string }) => e.path);
    };
    assert.deepEqual(await fehler({ schritte: [{ gate: 'P0_P1', gremiumId: sns.id }] }), ['/schritte/0/gremiumId'], 'externes Gremium entscheidet nicht');
    assert.deepEqual(await fehler({ schritte: [{ gate: 'P0_P1', gremiumId: prat.id, zusaetzlichGremiumId: glpa.id }] }), ['/schritte/0/zusaetzlichGremiumId'], 'Gremium eines anderen Portfolios');
    assert.deepEqual(await fehler({ schritte: [{ gate: 'P0_P1', gremiumId: prat.id }, { gate: 'P0_P1', gremiumId: prat.id }] }), ['/schritte/1/gate']);
    assert.equal((await put({ schritte: [{ gate: 'P5', gremiumId: prat.id }] }, 2)).statusCode, 422);

    // Gremium im Gremienweg: weder löschen noch Art ändern
    assert.equal((await call('DELETE', `/v1/gremien/${sns.id}`, { ...ue, 'if-match': 'W/"1"' })).statusCode, 409);
    assert.equal((await call('PATCH', `/v1/gremien/${prat.id}`, { ...ue, 'if-match': 'W/"1"' }, { art: 'extern' })).statusCode, 409);
    const leer = await put({ schritte: [] }, 2);
    assert.equal(leer.statusCode, 200, leer.body);
    assert.deepEqual(leer.json().schritte, []);
    assert.equal((await call('DELETE', `/v1/gremien/${sns.id}`, { ...ue, 'if-match': 'W/"1"' })).statusCode, 204);
  });

  test('Sitzungstermine je Gremium', async () => {
    const { prat } = await governance('-4');
    for (const datum of ['2026-12-16', '2026-11-18']) await created(`/v1/gremien/${prat.id}/termine`, { datum });
    assert.equal((await call('POST', `/v1/gremien/${prat.id}/termine`, ue, { datum: '2026-11-18' })).statusCode, 409);
    assert.equal((await call('POST', `/v1/gremien/${prat.id}/termine`, ue, { datum: '2026-02-30' })).statusCode, 422);
    const t = await call('GET', `/v1/gremien/${prat.id}/termine`, gl);
    assert.equal(t.statusCode, 200);
    assert.deepEqual(t.json().items.map((x: { datum: string }) => x.datum), ['2026-11-18', '2026-12-16']);
    assert.deepEqual((await call('GET', `/v1/gremien/${prat.id}/termine?von=2026-12-01`, gl)).json().items.map((x: { datum: string }) => x.datum), ['2026-12-16']);
    await full(api.t.runtime, tenantId, async tx => {
      assert.deepEqual(await sitzungstermine(tx, prat.id, { bis: '2026-11-30' }), ['2026-11-18']);
    });
    assert.equal((await call('DELETE', `/v1/gremien/${prat.id}/termine/2026-11-18`, gl)).statusCode, 403);
    assert.equal((await call('DELETE', `/v1/gremien/${prat.id}/termine/2026-11-18`, ue)).statusCode, 204);
    assert.equal((await call('DELETE', `/v1/gremien/${prat.id}/termine/2026-11-18`, ue)).statusCode, 404);
  });

  test('Rechte: lesen mit portfolio:read, pflegen mit portfolio:admin; Löschen nur ohne Gremien', async () => {
    const { b, glpa } = await governance('-5');
    assert.equal((await call('GET', '/v1/portfolios', nobody)).statusCode, 403);
    assert.equal((await call('POST', '/v1/portfolios', gl, { kategorie: 'A', schluessel: 'gl', name: 'GL' })).statusCode, 403);
    assert.equal((await call('POST', '/v1/gremien', gl, { portfolioId: b.id, kuerzel: 'gl', name: 'GL', art: 'extern' })).statusCode, 403);
    assert.equal((await call('GET', '/v1/gremien', gl)).statusCode, 200);

    assert.equal((await call('DELETE', `/v1/portfolios/${b.id}`, { ...ue, 'if-match': 'W/"1"' })).statusCode, 409);
    assert.equal((await call('DELETE', `/v1/gremien/${glpa.id}`, { ...ue, 'if-match': 'W/"1"' })).statusCode, 204);
    assert.equal((await call('DELETE', `/v1/portfolios/${b.id}`, { ...ue, 'if-match': 'W/"1"' })).statusCode, 204);
    assert.equal((await call('GET', `/v1/portfolios/${b.id}`, ue)).statusCode, 404);

    const audit = await full(api.t.runtime, tenantId, async tx =>
      (await tx.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE resource_id IN ($1, $2) ORDER BY id", [b.id, glpa.id])).rows.map(r => r.action));
    assert.deepEqual(audit, ['portfolio.created', 'gremium.created', 'gremium.deleted', 'portfolio.deleted']);
  });

  test('Liste mit Cursor', async () => {
    const first = (await call('GET', '/v1/portfolios?limit=2', gl)).json();
    assert.equal(first.items.length, 2);
    assert.ok(first.nextCursor);
    const rest = (await call('GET', `/v1/portfolios?limit=200&cursor=${first.nextCursor}`, gl)).json();
    const alle = (await call('GET', '/v1/portfolios?limit=200', gl)).json().items;
    assert.deepEqual([...first.items, ...rest.items].map((p: { id: string }) => p.id), alle.map((p: { id: string }) => p.id));
    assert.deepEqual(alle.map((p: { kategorie: string }) => p.kategorie), [...alle.map((p: { kategorie: string }) => p.kategorie)].sort());
  });
});

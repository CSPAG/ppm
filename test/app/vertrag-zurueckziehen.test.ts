/**
 * Projektvertrag zurückziehen (DM.02.04; UC-002 A4; K2 Schritt 6): Der Sponsor zieht das Vorhaben mit Begründung zurück.
 * Vertrag und Projekt sind danach «zurückgezogen», offene Aufgaben zum Vertrag entfallen, ein noch nicht versendetes
 * Gate-Traktandum wird zurückgenommen (versendet: 409), die Unternehmensentwicklung erhält eine Mitteilung. Rechte,
 * Begründung, If-Match und Audit.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { login, person, testApi, type TestApi } from './api.ts';
import { full, skipDb } from './harness.ts';

const skip = await skipDb();

type H = Record<string, string>;

describe('Projektvertrag: zurückziehen', { skip }, () => {
  let api: TestApi;
  let T = '';
  const h: Record<string, H> = {};
  const id: Record<string, string> = {};
  const pj: Record<'a' | 'b' | 'c', { id: string; nummer: string }> = { a: { id: '', nummer: '' }, b: { id: '', nummer: '' }, c: { id: '', nummer: '' } };

  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (who: string, method: string, url: string, payload?: unknown, headers: H = {}, status = 200) => {
    const r = await call(who, method, url, payload, headers);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return { body: r.json(), etag: r.headers.etag as string };
  };
  const sys = <R>(fn: Parameters<typeof full<R>>[2]) => full(api.t.runtime, T, fn);
  const lebenszyklus = (p: string) => sys(async tx => (await tx.query<{ lebenszyklus: string }>('SELECT lebenszyklus FROM ppm.projekt WHERE id = $1', [p])).rows[0]!.lebenszyklus);
  const aufgaben = (bezug: string) => sys(async tx => (await tx.query<{ art: string; stand: string }>(
    'SELECT art, stand FROM ppm.aufgabe WHERE bezug_id = $1 ORDER BY art, created_at', [bezug])).rows);
  const traktanden = (p: string) => sys(async tx => (await tx.query<{ id: string; stand: string }>(
    "SELECT id, stand FROM ppm.traktandum WHERE projekt_id = $1 AND art = 'gate'", [p])).rows);

  /** Erster Entwurf, eingereicht; liefert Version und ETag. */
  async function eingereicht(p: string): Promise<{ v: string; etag: string }> {
    const e = await ok('pl', 'POST', `/v1/projekte/${p}/vertrag/entwuerfe`, { anlass: 'initial' }, {}, 201);
    const r = await ok('pl', 'POST', `/v1/vertragsversionen/${e.body.version.id}/einreichen`, undefined, { 'if-match': e.etag });
    return { v: e.body.version.id, etag: r.etag };
  }
  /** Quality-Check bestätigen, SP, PL und CTL unterzeichnen: traktandiert beim PRAT (UC-002 Schritte 9–10). */
  async function traktandiert(p: string): Promise<{ v: string; etag: string }> {
    const { v, etag } = await eingereicht(p);
    await ok('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': etag });
    for (const who of ['sp', 'pl', 'ctl']) {
      const q = await ok(who, 'GET', `/v1/vertragsversionen/${v}/pruefung`);
      await ok(who, 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': q.etag });
    }
    const r = await ok('sp', 'GET', `/v1/vertragsversionen/${v}`);
    assert.equal(r.body.version.stand, 'traktandiert');
    return { v, etag: r.etag };
  }

  before(async () => {
    api = await testApi();
    const ue = await login(api, 'acme', 'z-ue', 'ue');
    T = ue.tenantId;
    id.ue = ue.principalId;
    h.ue = { authorization: ue.authorization };
    h.adm = { authorization: (await login(api, 'acme', 'z-adm', 'org-admin')).authorization };
    for (const f of ['sp', 'pl', 'ctl']) {
      id[f] = await person(api, T, `z-${f}`);
      h[f] = { authorization: (await login(api, 'acme', `z-${f}`, 'antragsteller')).authorization };
    }
    const m = await ok('ue', 'POST', '/v1/phasenmodelle', {}, {}, 201);
    await ok('adm', 'POST', `/v1/phasenmodelle/${m.body.id}/in-kraft-setzen`, undefined, { 'if-match': m.etag });
    const portfolio = (await ok('ue', 'POST', '/v1/portfolios', { kategorie: 'A', schluessel: 'rueckzug', name: 'Rückzug' }, {}, 201)).body.id;
    const prat = (await ok('ue', 'POST', '/v1/gremien', { portfolioId: portfolio, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, {}, 201)).body.id;
    await ok('ue', 'PUT', `/v1/portfolios/${portfolio}/gremienweg`, { schritte: [{ gate: 'P0_P1', gremiumId: prat }] }, { 'if-match': 'W/"1"' });
    for (const k of ['a', 'b', 'c'] as const) {
      const p = (await ok('ue', 'POST', '/v1/projekte', { name: `Vorhaben ${k.toUpperCase()}`, portfolioId: portfolio, phase: 'P0' }, {}, 201)).body;
      pj[k] = { id: p.id, nummer: p.nummer };
      await ok('ue', 'PUT', `/v1/projekte/${p.id}/organisation`, { mitglieder: [
        { personId: id.sp, funktion: 'sp', akv: '' }, { personId: id.pl, funktion: 'pl', akv: '' }, { personId: id.ctl, funktion: 'ctl', akv: '' },
      ] }, { 'if-match': 'W/"0"' });
    }
  });
  after(async () => { await api?.close(); });

  test('in Prüfung: nur der Sponsor mit Begründung; Vertrag und Projekt zurückgezogen, Quality-Check entfällt (UC-002 A4.1)', async () => {
    const { v, etag } = await eingereicht(pj.a.id);
    assert.equal((await ok('sp', 'GET', `/v1/vertragsversionen/${v}`)).body.version.can.zurueckziehen, true);
    assert.equal((await ok('pl', 'GET', `/v1/vertragsversionen/${v}`)).body.version.can.zurueckziehen, false);

    const url = `/v1/vertragsversionen/${v}/zurueckziehen`;
    assert.equal((await call('pl', 'POST', url, { begruendung: 'x' }, { 'if-match': etag })).statusCode, 403, 'nur vertrag:decide');
    assert.equal((await call('sp', 'POST', url, { begruendung: '  ' }, { 'if-match': etag })).statusCode, 422, 'Begründung fehlt');
    assert.equal((await call('sp', 'POST', url, { begruendung: 'x' })).statusCode, 428);
    assert.equal((await call('sp', 'POST', url, { begruendung: 'x' }, { 'if-match': 'W/"99"' })).statusCode, 412);

    const r = await ok('sp', 'POST', url, { begruendung: 'Strategie geändert, das Vorhaben entfällt.' }, { 'if-match': etag });
    assert.deepEqual([r.body.version.stand, r.body.version.can], ['zurueckgezogen', { write: false, einreichen: false, zurueckziehen: false }]);
    assert.equal(await lebenszyklus(pj.a.id), 'zurueckgezogen');
    assert.deepEqual(await aufgaben(v), [{ art: 'vertrag.quality_check', stand: 'entfallen' }]);
    const audit = await sys(async tx => (await tx.query<{ action: string; begruendung: string | null }>(
      "SELECT action, data->>'begruendung' AS begruendung FROM ppm.audit_log WHERE resource_id IN ($1, $2) AND action IN ('vertrag.withdrawn', 'projekt.withdrawn') ORDER BY action",
      [v, pj.a.id])).rows);
    assert.deepEqual(audit, [
      { action: 'projekt.withdrawn', begruendung: 'Strategie geändert, das Vorhaben entfällt.' },
      { action: 'vertrag.withdrawn', begruendung: 'Strategie geändert, das Vorhaben entfällt.' },
    ]);
    // Endzustand: kein zweites Zurückziehen, kein Bearbeiten
    assert.equal((await call('sp', 'POST', url, { begruendung: 'x' }, { 'if-match': r.etag })).statusCode, 409);
    assert.equal((await call('pl', 'POST', `/v1/projekte/${pj.a.id}/vertrag/entwuerfe`, { anlass: 'initial' })).statusCode, 409);
  });

  test('traktandiert: Gate-Traktandum zurückgenommen, Unterschriften bleiben, UE informiert', async () => {
    const { v, etag } = await traktandiert(pj.b.id);
    assert.equal((await traktanden(pj.b.id)).length, 1);
    await ok('sp', 'POST', `/v1/vertragsversionen/${v}/zurueckziehen`, { begruendung: 'Finanzierung fehlt' }, { 'if-match': etag });
    assert.deepEqual(await traktanden(pj.b.id), []);
    const a = await sys(async tx => (await tx.query<{ stand: string; traktandum_id: string | null }>('SELECT stand, traktandum_id FROM ppm.gate_antrag WHERE version_id = $1', [v])).rows[0]);
    assert.deepEqual(a, { stand: 'in_arbeit', traktandum_id: null });
    const p = await ok('pl', 'GET', `/v1/vertragsversionen/${v}/pruefung`);
    assert.equal(p.body.qualityChecks.length, 1, 'Verlauf bleibt');
    const mitteilungen = await sys(async tx => (await tx.query<{ empfaenger_person: string; text: string }>(
      "SELECT empfaenger_person, text FROM ppm.mitteilung WHERE bezug_typ = 'projekt' AND bezug_id = $1", [pj.b.id])).rows);
    assert.deepEqual(mitteilungen, [{ empfaenger_person: id.ue, text: `Der Sponsor hat das Projekt ${pj.b.nummer} Vorhaben B zurückgezogen: Finanzierung fehlt` }]);
    assert.equal(await lebenszyklus(pj.b.id), 'zurueckgezogen');
  });

  test('Traktandenliste versendet: 409, das Gremium entscheidet', async () => {
    const { v, etag } = await traktandiert(pj.c.id);
    const [t] = await traktanden(pj.c.id);
    await sys(tx => tx.query('UPDATE ppm.traktandum SET versendet_at = now() WHERE id = $1', [t!.id]));
    const r = await call('sp', 'POST', `/v1/vertragsversionen/${v}/zurueckziehen`, { begruendung: 'zu spät' }, { 'if-match': etag });
    assert.equal(r.statusCode, 409, r.body);
    assert.equal(r.json().reason, 'traktandiert');
    assert.equal(await lebenszyklus(pj.c.id), 'aktiv');
  });
});

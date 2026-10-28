/**
 * Register je Projekt (AP-E0-6, docs/fachmodell.md 2.6): Abnahme «Beträge nur für Rollen mit finanzen:read» (Lesesicht
 * und API, UX-OF-12, A-33) und «Abhängigkeit beidseitig sichtbar» (UC-002 Schritt 5); dazu ETag/If-Match, Endzustand
 * lesend (UC-015 Schritt 6), Ressourcenbedarf (A-20), KPI-Werte ab P2 (PC.03.03), Meldung (A-22), Portfoliorisiken.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { Principal } from '@vollholz/iam';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, skipDb, tenant } from './harness.ts';

const skip = await skipDb();

type Ort = { type: 'org' } | { type: 'portfolio' | 'projekt'; id: string };

describe('Projektdaten', { skip }, () => {
  let api: TestApi;
  let T: string;
  let pf: string, pfC: string;
  const projekt: Record<'x' | 'y' | 'z', string> = { x: '', y: '', z: '' };
  const h: Record<string, Record<string, string>> = {};

  /** Person mit Rollen an Orten; liefert Header. */
  async function person(sub: string, rollen: [string, Ort][]): Promise<Record<string, string>> {
    const l = await login(api, 'acme', sub, null);
    for (const [rolle, ort] of rollen) await grant(api, T, `user:${l.principalId}`, rolle, ort);
    return { authorization: l.authorization };
  }
  const call = (who: string, method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      pfC = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'C', 'dti', 'Direktion', false) RETURNING id", [T])).rows[0]!.id;
      for (const [k, nr, p, phase] of [['x', '2026-001', pf, 'P1'], ['y', '2026-002', pf, 'P2'], ['z', '2026-003', pfC, 'P0']] as const) {
        projekt[k] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, $2, $2, $3, $4) RETURNING id', [T, nr, p, phase])).rows[0]!.id;
      }
    });
    h.ue = await person('ue', [['ue', { type: 'org' }]]);
    h.gl = await person('gl', [['gl', { type: 'org' }]]);
    h.rm = await person('rm', [['rm', { type: 'org' }]]);
    h.gremium = await person('gremium', [['gremium', { type: 'portfolio', id: pf }]]);
    h.plx = await person('pl-x', [['pl', { type: 'projekt', id: projekt.x }]]);
    h.ply = await person('pl-y', [['pl', { type: 'projekt', id: projekt.y }]]);
    h.ctly = await person('ctl-y', [['ctl', { type: 'projekt', id: projekt.y }]]);
    h.ktx = await person('kt-x', [['kt', { type: 'projekt', id: projekt.x }]]);
  });
  after(async () => { await api?.close(); });

  test('Beträge nur für Rollen mit finanzen:read (A-33): API und Lesesicht', async () => {
    const k = await call('plx', 'POST', `/v1/projekte/${projekt.x}/kosten`, { phase: 'P1', art: 'capex', text: 'Server', lieferant: 'Acme AG', prognose: 120000.5 });
    assert.equal(k.statusCode, 201, k.body);
    assert.deepEqual([k.json().prognose, k.json().budgetBaseline, k.json().ist, k.json().can.write], [120000.5, null, null, true]);
    await call('ue', 'POST', `/v1/projekte/${projekt.z}/kosten`, { phase: 'P0', art: 'opex', text: 'Studie', prognose: 5000 });

    // Wer welche Kosten über die API sieht (fachmodell.md 3.3): Kernteam und RM nie, Gremium nur im eigenen Portfolio (403)
    const soll: Record<string, Record<'x' | 'z', number>> = {
      ue: { x: 200, z: 200 }, gl: { x: 200, z: 200 }, gremium: { x: 200, z: 403 }, plx: { x: 200, z: 403 },
      ktx: { x: 403, z: 403 }, rm: { x: 403, z: 403 },
    };
    for (const [wer, erwartet] of Object.entries(soll)) {
      for (const p of ['x', 'z'] as const) {
        const r = await call(wer, 'GET', `/v1/projekte/${projekt[p]}/kosten`);
        assert.equal(r.statusCode, erwartet[p], `${wer} ${p}: ${r.body}`);
        if (r.statusCode !== 200) assert.ok(!r.body.includes('120000'), `${wer}: kein Betrag im Fehler`);
      }
    }
    // Lesesicht direkt: auch ohne Route sieht das Kernteam keine Kostenzeile, sehr wohl aber das Projekt und die übrigen Register
    const sicht = async (sub: string) => {
      const p = await full(api.t.runtime, T, async tx => (await tx.query<{ id: string }>('SELECT id FROM ppm.principal WHERE subject = $1', [sub])).rows[0]!.id);
      const wer = { tenantId: T, tenantAlias: 'acme', principalId: p, kind: 'user', subject: sub, name: sub, email: null, clientId: null, groups: [], subjects: [`user:${p}`, 'org:members'], scopes: [], platformAdmin: false, binding: null } as unknown as Principal;
      return api.iam.tx(wer, async tx => (await tx.query<{ n: number; p: number }>(
        'SELECT (SELECT count(*)::int FROM ppm.kosten) AS n, (SELECT count(*)::int FROM ppm.projekt) AS p')).rows[0]!);
    };
    assert.deepEqual(await sicht('kt-x'), { n: 0, p: 1 });
    assert.deepEqual(await sicht('rm'), { n: 0, p: 3 });
    assert.deepEqual(await sicht('pl-x'), { n: 1, p: 1 });
    assert.deepEqual(await sicht('gremium'), { n: 1, p: 2 });
    assert.deepEqual(await sicht('gl'), { n: 2, p: 3 });
    // Ändern nur mit projekt:write; die Kontrolle (CTL) sieht Beträge, pflegt sie aber nicht
    assert.equal((await call('ctly', 'POST', `/v1/projekte/${projekt.y}/kosten`, { phase: 'P2', art: 'opex', text: 'x' })).statusCode, 403);
    assert.equal((await call('ctly', 'GET', `/v1/projekte/${projekt.y}/kosten`)).json().can.write, false);
  });

  test('Abhängigkeit beidseitig sichtbar (UC-002 Schritt 5), gepflegt beim erfassenden Projekt', async () => {
    // PL von X sieht Y nicht und kann es darum nicht wählen (404 wie unbekannt)
    assert.equal((await call('plx', 'POST', `/v1/projekte/${projekt.x}/abhaengigkeiten`, { zuProjektId: projekt.y, text: 'Schnittstelle' })).statusCode, 404);
    assert.equal((await call('ue', 'POST', `/v1/projekte/${projekt.x}/abhaengigkeiten`, { zuProjektId: projekt.x, text: 'selbst' })).statusCode, 422);
    const a = await call('ue', 'POST', `/v1/projekte/${projekt.x}/abhaengigkeiten`, { zuProjektId: projekt.y, text: 'Gemeinsame Schnittstelle', ansprechperson: 'L. Brunner' });
    assert.equal(a.statusCode, 201, a.body);
    assert.deepEqual([a.json().richtung, a.json().anderesProjekt?.nummer], ['ausgehend', '2026-002']);
    assert.equal((await call('ue', 'POST', `/v1/projekte/${projekt.x}/abhaengigkeiten`, { zuProjektId: projekt.y, text: 'doppelt' })).statusCode, 409);

    const x = (await call('plx', 'GET', `/v1/projekte/${projekt.x}/abhaengigkeiten`)).json();
    assert.deepEqual(x.items.map((i: { richtung: string; text: string; anderesProjekt: unknown; can: { write: boolean } }) => [i.richtung, i.text, i.anderesProjekt, i.can.write]),
      [['ausgehend', 'Gemeinsame Schnittstelle', null, true]], 'PL X: ausgehend, Y unsichtbar');
    const y = (await call('ply', 'GET', `/v1/projekte/${projekt.y}/abhaengigkeiten`)).json();
    assert.deepEqual(y.items.map((i: { richtung: string; ansprechperson: string; anderesProjekt: unknown; can: { write: boolean } }) => [i.richtung, i.ansprechperson, i.anderesProjekt, i.can.write]),
      [['eingehend', 'L. Brunner', null, false]], 'PL Y: eingehend, nur lesend');
    const ue = (await call('ue', 'GET', `/v1/projekte/${projekt.y}/abhaengigkeiten`)).json();
    assert.equal(ue.items[0].anderesProjekt.nummer, '2026-001');
    // Beim anderen Projekt nicht änderbar (gehört zu X)
    assert.equal((await call('ue', 'PATCH', `/v1/projekte/${projekt.y}/abhaengigkeiten/${a.json().id}`, { text: 'x' }, { 'if-match': 'W/"1"' })).statusCode, 404);
    const p = await call('plx', 'PATCH', `/v1/projekte/${projekt.x}/abhaengigkeiten/${a.json().id}`, { text: 'Schnittstelle Labor' }, { 'if-match': 'W/"1"' });
    assert.equal(p.statusCode, 200, p.body);
    assert.equal(p.headers.etag, 'W/"2"');
  });

  test('Meilensteine: Anlegen, Ändern mit If-Match (412), Filter, Baseline nur lesend, Endzustand lesend', async () => {
    const base = `/v1/projekte/${projekt.x}/meilensteine`;
    const m = await call('plx', 'POST', base, { phase: 'P1', art: 'meilenstein', text: 'Konzept abgenommen', terminAktuell: '2026-12-15', abnahme: 'gremium' });
    assert.equal(m.statusCode, 201, m.body);
    assert.deepEqual([m.json().terminAktuell, m.json().terminBaseline, m.json().abgenommenAm, m.headers.etag], ['2026-12-15', null, null, 'W/"1"']);
    await call('plx', 'POST', base, { phase: 'P1', art: 'kommunikation', text: 'Info-Anlass', adressat: 'Pflege', ziel: 'Akzeptanz' });
    assert.equal((await call('plx', 'POST', base, { phase: 'P1', art: 'meilenstein', text: 'x', terminBaseline: '2026-01-01' })).statusCode, 422, 'Baseline nicht über die API');
    assert.equal((await call('ktx', 'POST', base, { phase: 'P1', art: 'meilenstein', text: 'x' })).statusCode, 403);
    const nurKom = (await call('ktx', 'GET', `${base}?art=kommunikation`)).json();
    assert.deepEqual([nurKom.items.length, nurKom.items[0].adressat, nurKom.can.write], [1, 'Pflege', false]);

    const url = `${base}/${m.json().id}`;
    assert.equal((await call('plx', 'PATCH', url, { erreichtAm: '2026-12-10' })).statusCode, 428);
    assert.equal((await call('plx', 'PATCH', url, { erreichtAm: '2026-12-10' }, { 'if-match': 'W/"7"' })).statusCode, 412);
    const p = await call('plx', 'PATCH', url, { erreichtAm: '2026-12-10' }, { 'if-match': 'W/"1"' });
    assert.deepEqual([p.statusCode, p.json().erreichtAm, p.json().version], [200, '2026-12-10', 2]);

    // Seiten mit Cursor
    const s1 = (await call('plx', 'GET', `${base}?limit=1`)).json();
    const s2 = (await call('plx', 'GET', `${base}?limit=1&cursor=${encodeURIComponent(s1.nextCursor)}`)).json();
    assert.deepEqual([s1.items.length, s2.items.length, s2.nextCursor], [1, 1, null]);
    assert.notEqual(s1.items[0].id, s2.items[0].id);

    // Endzustand: lesend (409), Lesen bleibt möglich
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.projekt SET lebenszyklus = 'abgebrochen' WHERE id = $1", [projekt.x]));
    try {
      const r = await call('plx', 'PATCH', url, { text: 'neu' }, { 'if-match': 'W/"2"' });
      assert.equal(r.statusCode, 409, r.body);
      assert.equal(r.headers['content-type'], 'application/problem+json; charset=utf-8');
      assert.equal((await call('plx', 'DELETE', url, undefined, { 'if-match': 'W/"2"' })).statusCode, 409);
      const l = (await call('plx', 'GET', base)).json();
      assert.equal(l.can.write, false);
    } finally {
      await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.projekt SET lebenszyklus = 'aktiv' WHERE id = $1", [projekt.x]));
    }
    assert.equal((await call('plx', 'DELETE', url, undefined, { 'if-match': 'W/"2"' })).statusCode, 204);
  });

  test('Ressourcenbedarf: Grösse oder FTE × Monate je Rolle und Phase (A-20)', async () => {
    const base = `/v1/projekte/${projekt.x}/ressourcenbedarf`;
    assert.equal((await call('plx', 'POST', base, { phase: 'P1', rolle: 'pl', groesse: 'M' })).statusCode, 201);
    const f = await call('plx', 'POST', base, { phase: 'P2', rolle: 'pl', fte: 0.8, vonMonat: '2026-11', bisMonat: '2027-04' });
    assert.deepEqual([f.statusCode, f.json().fte, f.json().monate, f.json().gedeckt], [201, 0.8, 6, false]);
    const beides = await call('plx', 'POST', base, { phase: 'P3', rolle: 'pl', groesse: 'S', fte: 1, vonMonat: '2026-11', bisMonat: '2026-12' });
    assert.equal(beides.statusCode, 422, beides.body);
    assert.match(beides.json().errors[0].message, /Grösse/);
    assert.equal((await call('plx', 'POST', base, { phase: 'P3', rolle: 'ctl', fte: 1, vonMonat: '2027-01', bisMonat: '2026-12' })).statusCode, 422);
    assert.equal((await call('plx', 'POST', base, { phase: 'P1', rolle: 'pl', groesse: 'L' })).statusCode, 409, 'je Rolle und Phase ein Eintrag');
    // Wechsel von Grösse zu FTE in einem Schritt
    const g = (await call('plx', 'GET', `${base}?phase=P1`)).json().items[0];
    const w = await call('plx', 'PATCH', `${base}/${g.id}`, { groesse: null, fte: 1, vonMonat: '2026-11', bisMonat: '2026-11' }, { 'if-match': `W/"${g.version}"` });
    assert.deepEqual([w.statusCode, w.json().groesse, w.json().monate], [200, null, 1]);
  });

  test('KPIs und Werte: Werte ab P2 mit kpi:write (PL, CTL), Neuanlage mit W/"0"', async () => {
    const kx = (await call('plx', 'POST', `/v1/projekte/${projekt.x}/kpis`, { art: 'klinisch', text: 'Wartezeit', einheit: 'Tage', zielwert: '≤ 5' })).json();
    const r = await call('plx', 'PUT', `/v1/projekte/${projekt.x}/kpis/${kx.id}/werte/2026-10`, { wert: 7 }, { 'if-match': 'W/"0"' });
    assert.deepEqual([r.statusCode, r.json().detail?.includes('P2')], [409, true], 'P1: noch keine Werte');

    const ky = await call('ply', 'POST', `/v1/projekte/${projekt.y}/kpis`, { art: 'projekt', text: 'Durchlaufzeit' });
    assert.equal(ky.statusCode, 201, ky.body);
    assert.equal((await call('ctly', 'POST', `/v1/projekte/${projekt.y}/kpis`, { art: 'projekt', text: 'x' })).statusCode, 403, 'CTL legt keine KPIs an');
    const url = `/v1/projekte/${projekt.y}/kpis/${ky.json().id}/werte/2026-10`;
    const n = await call('ctly', 'PUT', url, { wert: 12.5, kommentar: 'Messung Oktober' }, { 'if-match': 'W/"0"' });
    assert.deepEqual([n.statusCode, n.json().wert, n.headers.etag], [200, 12.5, 'W/"1"'], n.body);
    assert.equal((await call('ctly', 'PUT', url, { wert: 1 }, { 'if-match': 'W/"0"' })).statusCode, 412, 'schon erfasst');
    assert.equal((await call('ply', 'PUT', url, { wert: 11 }, { 'if-match': 'W/"1"' })).json().version, 2);
    const liste = (await call('gremium', 'GET', `/v1/projekte/${projekt.y}/kpis/${ky.json().id}/werte`)).json();
    assert.deepEqual([liste.items.map((w: { wert: number }) => w.wert), liste.can.write], [[11], false]);
    // KPI eines anderen Projekts unter dieser Adresse: 404
    assert.equal((await call('ue', 'GET', `/v1/projekte/${projekt.y}/kpis/${kx.id}/werte`)).statusCode, 404);
  });

  test('Meldung an ICT bzw. Infrastruktur (RK.02.06, A-22): im System, mit Audit und Ereignis', async () => {
    const m = await call('plx', 'POST', `/v1/projekte/${projekt.x}/meldungen`, { stelle: 'dti', text: '20 zusätzliche Arbeitsplätze' });
    assert.equal(m.statusCode, 201, m.body);
    assert.equal(m.json().stelle, 'dti');
    const l = (await call('ktx', 'GET', `/v1/projekte/${projekt.x}/meldungen`)).json();
    assert.deepEqual([l.items.length, l.can.write], [1, false]);
    const ereignis = await full(api.t.runtime, T, async tx => (await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM ppm.audit_log WHERE action = 'meldung.created' AND resource_id = $1", [m.json().id])).rows[0]!.n);
    assert.equal(ereignis, 1);
  });

  test('Portfoliorisiken (PC.02.01): lesen mit projekt:read am Portfolio, pflegen nur an der Organisation', async () => {
    const base = `/v1/portfolios/${pf}/risiken`;
    const r = await call('ue', 'POST', base, { text: 'Fachkräftemangel', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch', massnahme: 'Pool aufbauen' });
    assert.equal(r.statusCode, 201, r.body);
    assert.deepEqual([r.json().portfolioId, r.json().projektId], [pf, null]);
    assert.equal((await call('plx', 'POST', base, { text: 'x', wahrscheinlichkeit: 'tief', auswirkung: 'tief' })).statusCode, 403);
    const g = (await call('gremium', 'GET', base)).json();
    assert.deepEqual([g.items.length, g.can.write], [1, false]);
    assert.equal((await call('gremium', 'GET', `/v1/portfolios/${pfC}/risiken`)).statusCode, 403);
    // Projektrisiken erscheinen nicht unter dem Portfolio
    await call('plx', 'POST', `/v1/projekte/${projekt.x}/risiken`, { text: 'Lieferverzug', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch' });
    assert.equal((await call('ue', 'GET', base)).json().items.length, 1);
    const u = await call('ue', 'PATCH', `${base}/${r.json().id}`, { massnahmeStand: 'umgesetzt' }, { 'if-match': 'W/"1"' });
    assert.deepEqual([u.statusCode, u.json().massnahmeStand], [200, 'umgesetzt']);
  });

  test('Kosten: Prognose ohne Wert bleibt ohne Wert (nicht 0 durch die Typumwandlung der Eingabe)', async () => {
    const ohne = await call('plx', 'POST', `/v1/projekte/${projekt.x}/kosten`, { phase: 'P1', art: 'opex', text: 'Lizenz', prognose: null });
    assert.equal(ohne.statusCode, 201, ohne.body);
    assert.equal(ohne.json().prognose, null);
  });
});

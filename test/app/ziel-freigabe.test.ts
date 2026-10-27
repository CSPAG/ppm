/**
 * Freigabe der Jahresziele und Roadmap (BC ZM.02.02, PP.04.03; UC-011 Schritte 6–8, A2; K6; AP-E6-2): Zusammenfassung
 * vor der Vorlage, Sperre ohne Metrik (Abnahme), Vorlegen mit Sperre der Jahresziele, Freigabe erfassen (in Kraft bzw.
 * Anpassungen mit Aufgabe an die GL), Roadmap mit Vorschau, Publizieren und Lesen für alle angemeldeten Personen.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { full, skipDb } from './harness.ts';
import { login, person, testApi, type TestApi } from './api.ts';

const skip = await skipDb();

describe('Freigabe der Jahresziele und Roadmap', { skip }, () => {
  let api: TestApi;
  let gl: Record<string, string>, ue: Record<string, string>, leser: Record<string, string>, ohneZiele: Record<string, string>;
  let tenantId = '';
  let ziel21 = '', ziel31 = '', felder: string[] = [];
  const projekt: Record<string, string> = {};

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const version = async (jahr: number) => (await call('GET', `/v1/ziele/${jahr}/vorlage`, gl)).json().version as number;
  const eingang = async (h: Record<string, string>) => ((await call('GET', '/v1/eingang', h)).json().items as { titel: string; kontext: string | null }[]);

  before(async () => {
    api = await testApi();
    const e = await login(api, 'demo', 'u-gl', 'gl');
    tenantId = e.tenantId;
    gl = { authorization: e.authorization };
    ue = { authorization: (await login(api, 'demo', 'u-ue', 'ue')).authorization };
    leser = { authorization: (await login(api, 'demo', 'u-leser', 'leser')).authorization };
    ohneZiele = { authorization: (await login(api, 'demo', 'u-kt', 'antragsteller')).authorization };
    felder = [
      (await call('POST', '/v1/handlungsfelder', gl, { label: 'Wirtschaftlichkeit', position: 1 })).json().id,
      (await call('POST', '/v1/handlungsfelder', gl, { label: 'Innovation', position: 2 })).json().id,
    ];
    ziel21 = (await call('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: felder[0], nummer: '2.1', text: 'Kosten senken' })).json().id;
    ziel31 = (await call('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: felder[1], nummer: '3.1', text: 'Digital werden' })).json().id;
    await full(api.t.runtime, tenantId, async tx => {
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [tenantId])).rows[0]!.id;
      for (const [nr, vertraulich] of [['2027-001', false], ['2027-002', true]] as const) {
        projekt[nr] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, vertraulich) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [tenantId, nr, `Projekt ${nr}`, pf, vertraulich])).rows[0]!.id;
      }
    });
  });
  after(async () => { await api?.close(); });

  test('Zusammenfassung je Handlungsfeld mit Vorjahr; Jahresziel ohne Metrik sperrt die Vorlage (Abnahme AP-E6-2)', async () => {
    // Vorjahr 2026 mit einem Jahresziel unter 2.1
    await call('POST', '/v1/ziele/2026', gl, {});
    await call('POST', '/v1/jahresziele', gl, { jahr: 2026, strategischesZielId: ziel21, text: 'Alt', metrik: 'm', zielwert: 'w' });

    await call('POST', '/v1/ziele/2027', gl, { vorlageBis: '2026-11-15' });
    assert.equal((await call('POST', '/v1/ziele/2027/vorlegen', { ...gl, 'if-match': `W/"${await version(2027)}"` })).json().reason, 'leer', 'ohne Jahresziele');

    const a = (await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel21, text: 'Einkauf bündeln', metrik: 'Anteil', zielwert: '60 %' })).json();
    await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel21, text: 'Lager reduzieren', metrik: 'Lagerwert' });
    await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel31, text: 'Portal einführen' });
    await call('POST', '/v1/hauptaktivitaeten', gl, { jahreszielId: a.id, text: 'Rahmenverträge', verantwortlich: await person(api, tenantId, 'Anna Muster') });

    const v = (await call('GET', '/v1/ziele/2027/vorlage', leser)).json();
    assert.deepEqual([v.anzahl, v.anzahlVorjahr, v.stand], [3, 1, 'in_arbeit']);
    assert.deepEqual(v.jeHandlungsfeld.map((f: { label: string; anzahl: number; anzahlVorjahr: number }) => [f.label, f.anzahl, f.anzahlVorjahr]),
      [['Wirtschaftlichkeit', 2, 1], ['Innovation', 1, 0]]);
    assert.deepEqual(v.ohneMetrik.map((x: { nummer: string }) => x.nummer), ['2.1.2', '3.1.1']);
    assert.deepEqual(v.can, { vorlegen: false, freigabe: false }, 'Leser:in legt nicht vor');
    assert.equal((await call('GET', '/v1/ziele/2027/vorlage', gl)).json().can.vorlegen, true);

    const r = await call('POST', '/v1/ziele/2027/vorlegen', { ...gl, 'if-match': `W/"${v.version}"` });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().reason, 'metrik_fehlt');
    assert.equal(r.json().detail, 'Metrik fehlt: 2 Jahresziele haben keine Metrik oder keinen Zielwert (2.1.2, 3.1.1). Ergänzen Sie Metrik und Zielwert.');
    assert.equal((await call('GET', '/v1/ziele/2027', gl)).json().zieljahr.stand, 'in_arbeit', 'nichts vorgelegt');
  });

  test('Vorlegen sperrt die Jahresziele und erledigt die Aufgabe; nur GL legt vor, nur UE erfasst die Freigabe', async () => {
    for (const j of (await call('GET', '/v1/jahresziele?jahr=2027', gl)).json().items as { id: string; version: number; metrik: string; zielwert: string }[]) {
      if (!j.metrik || !j.zielwert) assert.equal((await call('PATCH', `/v1/jahresziele/${j.id}`, { ...gl, 'if-match': `W/"${j.version}"` }, { metrik: j.metrik || 'Kennzahl', zielwert: '1' })).statusCode, 200);
    }
    assert.ok((await eingang(gl)).some(x => x.titel === 'Jahresziele 2027 vervollständigen'));
    assert.equal((await call('POST', '/v1/ziele/2027/vorlegen', { ...leser, 'if-match': `W/"${await version(2027)}"` })).statusCode, 403);
    assert.equal((await call('POST', '/v1/ziele/2027/vorlegen', { ...gl, 'if-match': 'W/"99"' })).statusCode, 412);

    const r = await call('POST', '/v1/ziele/2027/vorlegen', { ...gl, 'if-match': `W/"${await version(2027)}"` });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().stand, typeof r.json().vorgelegtAt, r.json().can.write], ['zur_freigabe', 'string', false]);
    assert.ok(!(await eingang(gl)).some(x => x.titel === 'Jahresziele 2027 vervollständigen'), 'Aufgabe erledigt');

    // gesperrt bis zum Entscheid (K6 Z9)
    const jz = (await call('GET', '/v1/jahresziele?jahr=2027', gl)).json().items[0];
    assert.equal((await call('PATCH', `/v1/jahresziele/${jz.id}`, { ...gl, 'if-match': `W/"${jz.version}"` }, { text: 'neu' })).statusCode, 409);
    assert.equal((await call('POST', '/v1/ziele/2027/vorlegen', { ...gl, 'if-match': `W/"${await version(2027)}"` })).statusCode, 409, 'schon vorgelegt');

    // Freigabe erfassen: nur ziel:freigabe (UE), nicht die GL
    assert.equal((await call('POST', '/v1/ziele/2027/freigabe', { ...gl, 'if-match': `W/"${await version(2027)}"` }, { entscheid: 'freigegeben', datum: '2026-12-01' })).statusCode, 403);
    assert.equal((await call('GET', '/v1/ziele/2027/vorlage', ue)).json().can.freigabe, true);
  });

  test('Anpassungen verlangt (A2): zurück auf «in Arbeit», Aufgabe an die GL; danach Freigabe setzt in Kraft', async () => {
    const ohneText = await call('POST', '/v1/ziele/2027/freigabe', { ...ue, 'if-match': `W/"${await version(2027)}"` }, { entscheid: 'anpassungen', datum: '2026-12-01' });
    assert.equal(ohneText.statusCode, 422);
    const a = await call('POST', '/v1/ziele/2027/freigabe', { ...ue, 'if-match': `W/"${await version(2027)}"` }, { entscheid: 'anpassungen', datum: '2026-12-01', text: ' Ziel 3.1.1 schärfen ' });
    assert.equal(a.statusCode, 200, a.body);
    assert.deepEqual([a.json().stand, a.json().freigabeText, a.json().freigabeAt], ['in_arbeit', 'Ziel 3.1.1 schärfen', null]);
    const aufgabe = (await eingang(gl)).find(x => x.titel === 'Jahresziele 2027 anpassen');
    assert.equal(aufgabe?.kontext, 'Der VR verlangt Anpassungen (Entscheid 01.12.2026)');
    assert.ok(!(await eingang(leser)).some(x => x.titel === 'Jahresziele 2027 anpassen'));

    assert.equal((await call('POST', '/v1/ziele/2027/vorlegen', { ...gl, 'if-match': `W/"${await version(2027)}"` })).statusCode, 200);
    assert.ok(!(await eingang(gl)).some(x => x.titel === 'Jahresziele 2027 anpassen'), 'mit der Vorlage erledigt');
    const f = await call('POST', '/v1/ziele/2027/freigabe', { ...ue, 'if-match': `W/"${await version(2027)}"` }, { entscheid: 'freigegeben', datum: '2026-12-15', text: 'einstimmig' });
    assert.equal(f.statusCode, 200, f.body);
    assert.equal(f.json().stand, 'in_kraft');
    assert.match(f.json().freigabeAt, /^2026-12-1[45]T/);
    assert.equal((await call('POST', '/v1/ziele/2027/freigabe', { ...ue, 'if-match': `W/"${await version(2027)}"` }, { entscheid: 'freigegeben', datum: '2026-12-15' })).statusCode, 409, 'nicht mehr zur Freigabe');

    const rows = await full(api.t.runtime, tenantId, async tx => (await tx.query("SELECT action FROM ppm.audit_log WHERE resource_type = 'zieljahr' ORDER BY id")).rows.map(r => r.action));
    assert.deepEqual(rows.filter((x: string) => x !== 'zieljahr.created' && x !== 'zieljahr.updated'),
      ['zieljahr.submitted', 'zieljahr.changes_requested', 'zieljahr.submitted', 'zieljahr.approved']);
  });

  test('Roadmap: erst nach Freigabe publizieren, Vorschau, lesbar für alle Angemeldeten, ohne vertrauliche Projekte', async () => {
    const jz = (await call('GET', '/v1/jahresziele?jahr=2027', gl)).json().items[0];
    // Zuordnung über die Datenbank (Projekte sind für die GL nur teilweise sichtbar)
    await full(api.t.runtime, tenantId, async tx => {
      for (const nr of ['2027-001', '2027-002']) {
        await tx.query('INSERT INTO ppm.ziel_projekt (tenant_id, projekt_id, strategisches_ziel_id, jahresziel_id) VALUES ($1, $2, $3, $4)', [tenantId, projekt[nr], ziel21, jz.id]);
      }
    });
    assert.equal((await call('POST', '/v1/roadmap/2026', ue)).statusCode, 409, 'Jahresziele 2026 nicht in Kraft');
    assert.equal((await call('POST', '/v1/roadmap/2027', gl)).statusCode, 403, 'publizieren nur ziel:freigabe');
    assert.equal((await call('GET', '/v1/roadmap/2027', leser)).statusCode, 404, 'noch nicht publiziert');

    const vorschau = (await call('GET', '/v1/roadmap/2027/vorschau', ue)).json();
    assert.deepEqual([vorschau.stand, vorschau.publiziertAt, vorschau.can.publizieren], ['in_kraft', null, true]);

    const p = await call('POST', '/v1/roadmap/2027', ue);
    assert.equal(p.statusCode, 200, p.body);
    assert.equal(p.json().version, 1);
    for (const h of [leser, ohneZiele]) {
      const r = await call('GET', '/v1/roadmap/2027', h);
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().can.publizieren, false);
      const [wirt, inno] = r.json().inhalt.handlungsfelder;
      assert.deepEqual([wirt.label, inno.label], ['Wirtschaftlichkeit', 'Innovation']);
      const j = wirt.ziele[0].jahresziele.find((x: { nummer: string }) => x.nummer === jz.nummer);
      assert.deepEqual(j.projekte.map((x: { nummer: string }) => x.nummer), ['2027-001'], 'vertrauliches Projekt fehlt (A-34)');
    }
    const ha = (await call('GET', '/v1/roadmap/2027', leser)).json().inhalt.handlungsfelder[0].ziele[0].jahresziele.flatMap((x: { hauptaktivitaeten: unknown[] }) => x.hauptaktivitaeten);
    assert.deepEqual(ha, [{ text: 'Rahmenverträge', verantwortlich: 'Anna Muster' }]);

    // erneut publizieren ersetzt den Stand
    assert.equal((await call('POST', '/v1/roadmap/2027', ue)).json().version, 2);
    assert.deepEqual((await call('GET', '/v1/roadmap', ohneZiele)).json().items.map((x: { jahr: number; version: number }) => [x.jahr, x.version]), [[2027, 2]]);
  });
});

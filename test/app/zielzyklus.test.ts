/**
 * Zielzyklus (BC ZM.02.01, ZM.02.03, ZM.02.04, PP.02.05; UC-011 Schritte 1–5; Kernablauf K6; AP-E6-1): Zielzyklus
 * starten, Jahresziele mit Nummer, Metrik und Zielwert, Hauptaktivitäten mit Verantwortlichen, Prüfbericht, Sperre ab
 * «zur Freigabe», Zuordnung der Projekte in beide Richtungen (K6-2), Lesesicht der Projekte, Rechte, Audit und Ereignis.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { full } from './harness.ts';
import { login, person, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

describe('Zielzyklus', () => {
  let api: TestApi;
  let gl: Record<string, string>, leser: Record<string, string>, ue: Record<string, string>;
  let tenantId: string;
  let ziel21 = '', ziel22 = '', verantwortlich = '';
  const projekt: Record<string, string> = {};

  before(async () => {
    api = await testApi();
    const e = await login(api, 'demo', 'u-gl', 'alle-fuehren');
    tenantId = e.tenantId;
    gl = { authorization: e.authorization };
    leser = { authorization: (await login(api, 'demo', 'u-leser', 'mitglied')).authorization };
    ue = { authorization: (await login(api, 'demo', 'u-ue', 'alle-fuehren')).authorization };
    verantwortlich = await person(api, tenantId, 'Anna Muster');
    const feld = (await call('POST', '/v1/handlungsfelder', gl, { label: 'Wirtschaftlichkeit', position: 2 })).json().id;
    ziel21 = (await call('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: feld, nummer: '2.1', text: 'Kosten senken' })).json().id;
    ziel22 = (await call('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: feld, nummer: '2.2', text: 'Erlöse sichern' })).json().id;
    await full(api.t.runtime, tenantId, async tx => {
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [tenantId])).rows[0]!.id;
      for (const [nr, vertraulich] of [['2026-014', false], ['2026-015', true]] as const) {
        projekt[nr] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, vertraulich) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [tenantId, nr, `Projekt ${nr}`, pf, vertraulich])).rows[0]!.id;
      }
    });
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });

  test('starten, Jahresziele mit laufender Nummer, Hauptaktivitäten, Prüfbericht (UC-011 Schritte 1, 3–5)', async () => {
    const leer = (await call('GET', '/v1/ziele/2027', gl)).json();
    assert.equal(leer.zieljahr, null, 'Z2 Leer');
    assert.deepEqual(leer.can, { start: true, write: false, zuordnen: true });
    assert.deepEqual(leer.strategischeZiele.map((s: { nummer: string }) => s.nummer), ['2.1', '2.2']);
    assert.equal((await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel21, text: 'x' })).statusCode, 404, 'ohne Zielzyklus');

    const s = await call('POST', '/v1/ziele/2027', gl, { vorlageBis: '2026-11-15' });
    assert.equal(s.statusCode, 201, s.body);
    assert.deepEqual([s.json().jahr, s.json().stand, s.json().vorlageBis, s.json().can.write], [2027, 'in_arbeit', '2026-11-15', true]);
    assert.equal((await call('POST', '/v1/ziele/2027', gl, {})).statusCode, 409);
    const p = await call('PATCH', '/v1/ziele/2027', { ...gl, 'if-match': 'W/"1"' }, { vorlageBis: '2026-11-20' });
    assert.equal(p.statusCode, 200, p.body);
    assert.equal(p.json().vorlageBis, '2026-11-20');
    // Nullable (platform 0.7.0): "" und ungültige Daten 422 statt null; die Webapp schickt für «leer» null (ZielzyklusPage)
    for (const vorlageBis of ['', '2026-13-40', 0]) {
      assert.equal((await call('PATCH', '/v1/ziele/2027', { ...gl, 'if-match': 'W/"2"' }, { vorlageBis })).statusCode, 422, JSON.stringify(vorlageBis));
    }
    // Aufgabe «Jahresziele vervollständigen» im Eingang aller mit ziel:write, Frist = geplante Vorlage (Fachmodell 4.2)
    const eingang = (h: Record<string, string>) => call('GET', '/v1/eingang', h).then(r => (r.json().items as { titel: string; kontext: string | null; link: string; frist: string | null }[])
      .filter(a => a.titel === 'Jahresziele 2027 vervollständigen'));
    const [a1] = await eingang(gl);
    assert.deepEqual([a1?.kontext, a1?.link, a1?.frist], ['Vorlage an den VR bis 20.11.2026', '/ziele/2027', '2026-11-20']);
    assert.deepEqual(await eingang(leser), [], 'nur mit ziel:write');

    const a = await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel21, text: ' Sachkosten um 2 % senken ', metrik: 'Sachkosten', zielwert: '−2 %' });
    assert.equal(a.statusCode, 201, a.body);
    assert.deepEqual([a.json().nummer, a.json().text, a.json().metrik], ['2.1.1', 'Sachkosten um 2 % senken', 'Sachkosten']);
    const b = (await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel21, text: 'Einkauf bündeln' })).json();
    assert.equal(b.nummer, '2.1.2');
    const c = (await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel22, text: 'Tarife sichern', metrik: 'Erlös', zielwert: '±0' })).json();
    assert.equal(c.nummer, '2.2.1');
    assert.equal((await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel22, nummer: '2.2.1', text: 'doppelt' })).statusCode, 409);
    assert.equal((await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: randomUUID(), text: 'x' })).statusCode, 404);

    const h = await call('POST', '/v1/hauptaktivitaeten', gl, { jahreszielId: a.json().id, text: 'Rahmenverträge neu verhandeln', verantwortlich });
    assert.equal(h.statusCode, 201, h.body);
    assert.deepEqual(h.json().verantwortlich, { id: verantwortlich, name: 'Anna Muster' });
    const h2 = (await call('POST', '/v1/hauptaktivitaeten', gl, { jahreszielId: a.json().id, text: 'Lager reduzieren' })).json();
    assert.deepEqual([h.json().position, h2.position], [0, 1]);
    const falsch = await call('POST', '/v1/hauptaktivitaeten', gl, { jahreszielId: a.json().id, text: 'x', verantwortlich: randomUUID() });
    assert.equal(falsch.statusCode, 422, 'nur Personen der Organisation');
    const hp = await call('PATCH', `/v1/hauptaktivitaeten/${h2.id}`, { ...gl, 'if-match': 'W/"1"' }, { verantwortlich, position: 5 });
    assert.equal(hp.statusCode, 200, hp.body);
    assert.equal((await call('GET', `/v1/hauptaktivitaeten?jahresziel=${a.json().id}`, leser)).json().items.length, 2);

    // Metrik nachtragen (ZM.02.04)
    const m = await call('PATCH', `/v1/jahresziele/${b.id}`, { ...gl, 'if-match': 'W/"1"' }, { metrik: 'Anteil gebündelter Einkauf' });
    assert.equal(m.statusCode, 200, m.body);

    const z = (await call('GET', '/v1/ziele/2027', leser)).json();
    assert.deepEqual(z.can, { start: false, write: false, zuordnen: false });
    const s21 = z.strategischeZiele.find((x: { nummer: string }) => x.nummer === '2.1');
    assert.deepEqual(s21.jahresziele.map((j: { nummer: string; hauptaktivitaeten: { text: string }[] }) => [j.nummer, j.hauptaktivitaeten.map(x => x.text)]),
      [['2.1.1', ['Rahmenverträge neu verhandeln', 'Lager reduzieren']], ['2.1.2', []]]);
    // Prüfbericht: Zielwert fehlt bei 2.1.2; ohne Hauptaktivität und Projekt: 2.1.2, 2.2.1
    assert.deepEqual(z.pruefung.ohneMetrik.map((x: { nummer: string }) => x.nummer), ['2.1.2']);
    assert.deepEqual(z.pruefung.ohneUmsetzung.map((x: { nummer: string }) => x.nummer), ['2.1.2', '2.2.1']);

    // Liste mit Cursor
    const l1 = (await call('GET', '/v1/jahresziele?jahr=2027&limit=2', leser)).json();
    assert.deepEqual(l1.items.map((x: { nummer: string }) => x.nummer), ['2.1.1', '2.1.2']);
    const l2 = (await call('GET', `/v1/jahresziele?jahr=2027&limit=2&cursor=${l1.nextCursor}`, leser)).json();
    assert.deepEqual([l2.items.map((x: { nummer: string }) => x.nummer), l2.nextCursor], [['2.2.1'], null]);
    assert.equal((await call('GET', `/v1/jahresziele?jahr=2026&cursor=${l1.nextCursor}`, leser)).statusCode, 422, 'Cursor gilt nur für denselben Filter');
  });

  test('Rechte: Lesende sehen, ändern nicht; ohne Recht 403', async () => {
    const nobody = { authorization: (await login(api, 'demo', 'u-nobody', null)).authorization };
    assert.equal((await call('GET', '/v1/ziele/2027', nobody)).statusCode, 403);
    assert.equal((await call('POST', '/v1/ziele/2029', leser, {})).statusCode, 403);
    assert.equal((await call('POST', '/v1/jahresziele', leser, { jahr: 2027, strategischesZielId: ziel21, text: 'x' })).statusCode, 403);
    assert.equal((await call('POST', `/v1/projekte/${projekt['2026-014']}/ziele`, leser, { strategischesZielId: ziel21 })).statusCode, 403);
  });

  test('Zuordnung Projekt ↔ Ziel in beiden Richtungen mit je einem Schritt (PP.02.05, K6-2)', async () => {
    const jz = (await call('GET', '/v1/jahresziele?jahr=2027', gl)).json().items.find((x: { nummer: string }) => x.nummer === '2.1.1');
    const id = projekt['2026-014']!;
    const z1 = await call('POST', `/v1/projekte/${id}/ziele`, gl, { jahreszielId: jz.id });
    assert.equal(z1.statusCode, 201, z1.body);
    assert.deepEqual([z1.json().strategischesZiel.nummer, z1.json().jahresziel.nummer, z1.json().link], ['2.1', '2.1.1', '/ziele/2027?o=ziel:2.1.1']);
    assert.equal((await call('POST', `/v1/projekte/${id}/ziele`, gl, { jahreszielId: jz.id })).statusCode, 409, 'schon zugeordnet');
    assert.equal((await call('POST', `/v1/projekte/${id}/ziele`, gl, { strategischesZielId: ziel22, jahreszielId: jz.id })).statusCode, 422, 'Widerspruch');
    const z2 = (await call('POST', `/v1/projekte/${id}/ziele`, gl, { strategischesZielId: ziel22 })).json();
    assert.equal(z2.link, '/ziele/strategische-ziele?o=ziel:2.2');
    assert.equal((await call('POST', `/v1/projekte/${randomUUID()}/ziele`, gl, { strategischesZielId: ziel22 })).statusCode, 404);
    // vertrauliches Projekt: «alle Portfolios führen» sieht es und ordnet es zu (Master Entscheid 13)
    assert.equal((await call('POST', `/v1/projekte/${projekt['2026-015']}/ziele`, gl, { strategischesZielId: ziel21 })).statusCode, 201);

    // vom Projekt zum Ziel: ein Aufruf liefert die Adresse des Ziels
    const vonProjekt = (await call('GET', `/v1/projekte/${id}/ziele`, gl)).json();
    assert.deepEqual(vonProjekt.items.map((x: { link: string }) => x.link), ['/ziele/2027?o=ziel:2.1.1', '/ziele/strategische-ziele?o=ziel:2.2']);
    assert.deepEqual(vonProjekt.can, { write: true });
    assert.equal((await call('GET', `/v1/projekte/${id}/ziele`, leser)).statusCode, 404, 'ohne projekt:read unsichtbar');
    // vom Ziel zum Projekt: der Baum nennt die Projektnummer (Adresse /projekte/<nummer>)
    const baum = (await call('GET', '/v1/ziele/2027', gl)).json();
    const s21 = baum.strategischeZiele.find((x: { nummer: string }) => x.nummer === '2.1');
    assert.deepEqual(s21.jahresziele[0].projekte.map((p: { nummer: string }) => p.nummer), ['2026-014']);
    assert.deepEqual(s21.projekte.map((p: { nummer: string }) => p.nummer), ['2026-015'], 'vertrauliches Projekt sichtbar für «alle Portfolios führen» (Master Entscheid 13)');
    assert.deepEqual(baum.strategischeZiele.find((x: { nummer: string }) => x.nummer === '2.2').projekte.map((p: { nummer: string }) => p.nummer), ['2026-014']);
    assert.ok(!baum.pruefung.ohneUmsetzung.some((x: { nummer: string }) => x.nummer === '2.1.1'));
    // die UE sieht es ebenso
    const baumUe = (await call('GET', '/v1/ziele/2027', ue)).json();
    assert.deepEqual(baumUe.strategischeZiele.find((x: { nummer: string }) => x.nummer === '2.1').projekte.map((p: { nummer: string }) => p.nummer), ['2026-015']);

    // Lösen
    assert.equal((await call('DELETE', `/v1/projekte/${id}/ziele/${z2.id}`, gl)).statusCode, 204);
    assert.equal((await call('DELETE', `/v1/projekte/${id}/ziele/${z2.id}`, gl)).statusCode, 404);
  });

  test('Jahresziel löschen: Hauptaktivitäten mit, Projekt bleibt beim strategischen Ziel', async () => {
    const jz = (await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel22, text: 'Wegwerf' })).json();
    const ha = (await call('POST', '/v1/hauptaktivitaeten', gl, { jahreszielId: jz.id, text: 'Wegwerf' })).json();
    const zp = (await call('POST', `/v1/projekte/${projekt['2026-014']}/ziele`, gl, { jahreszielId: jz.id })).json();
    assert.equal((await call('DELETE', `/v1/jahresziele/${jz.id}`, { ...gl, 'if-match': 'W/"2"' })).statusCode, 412);
    const d = await call('DELETE', `/v1/jahresziele/${jz.id}`, { ...gl, 'if-match': 'W/"1"' });
    assert.equal(d.statusCode, 204, d.body);
    assert.equal((await call('GET', `/v1/hauptaktivitaeten/${ha.id}`, gl)).statusCode, 404);
    const ziele = (await call('GET', `/v1/projekte/${projekt['2026-014']}/ziele`, gl)).json().items as { id: string; jahresziel: unknown; strategischesZiel: { nummer: string } }[];
    const bleibt = ziele.find(x => x.id === zp.id)!;
    assert.deepEqual([bleibt.jahresziel, bleibt.strategischesZiel.nummer], [null, '2.2']);
    // strategisches Ziel mit Jahreszielen lässt sich nicht löschen
    const s = (await call('GET', `/v1/strategische-ziele/${ziel21}`, gl));
    assert.equal((await call('DELETE', `/v1/strategische-ziele/${ziel21}`, { ...gl, 'if-match': s.headers.etag as string })).statusCode, 409);
  });

  test('ab «zur Freigabe» gesperrt (UC-011 Schritt 6, K6 Z9)', async () => {
    await call('POST', '/v1/ziele/2030', gl, {});
    const jz = (await call('POST', '/v1/jahresziele', gl, { jahr: 2030, strategischesZielId: ziel21, text: 'Gesperrt', metrik: 'm', zielwert: 'w' })).json();
    const ha = (await call('POST', '/v1/hauptaktivitaeten', gl, { jahreszielId: jz.id, text: 'Gesperrt' })).json();
    // Vorlegen setzt AP-E6-2; hier direkt
    await full(api.t.runtime, tenantId, tx => tx.query("UPDATE ppm.zieljahr SET stand = 'zur_freigabe' WHERE tenant_id = $1 AND jahr = 2030", [tenantId]));
    const r = await call('PATCH', `/v1/jahresziele/${jz.id}`, { ...gl, 'if-match': 'W/"1"' }, { text: 'neu' });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().reason, 'gesperrt');
    assert.match(r.json().detail, /Jahresziele 2030 liegen dem VR zur Freigabe vor/);
    assert.equal((await call('POST', '/v1/jahresziele', gl, { jahr: 2030, strategischesZielId: ziel21, text: 'x' })).statusCode, 409);
    assert.equal((await call('DELETE', `/v1/jahresziele/${jz.id}`, { ...gl, 'if-match': 'W/"1"' })).statusCode, 409);
    assert.equal((await call('POST', '/v1/hauptaktivitaeten', gl, { jahreszielId: jz.id, text: 'x' })).statusCode, 409);
    assert.equal((await call('PATCH', `/v1/hauptaktivitaeten/${ha.id}`, { ...gl, 'if-match': 'W/"1"' }, { text: 'x' })).statusCode, 409);
    assert.equal((await call('PATCH', '/v1/ziele/2030', { ...gl, 'if-match': 'W/"2"' }, { vorlageBis: null })).statusCode, 409);
    const z = (await call('GET', '/v1/ziele/2030', gl)).json();
    assert.deepEqual([z.zieljahr.stand, z.zieljahr.can.write, z.can.write], ['zur_freigabe', false, false]);
  });

  test('Audit und Ereignis in derselben Transaktion', async () => {
    const r = await call('POST', '/v1/jahresziele', { ...gl, 'x-request-id': 'req-jz' }, { jahr: 2027, strategischesZielId: ziel22, text: 'Mit Audit' });
    const id = r.json().id;
    const rows = await full(api.t.runtime, tenantId, async tx => ({
      audit: (await tx.query('SELECT action, correlation_id FROM ppm.audit_log WHERE resource_id = $1', [id])).rows,
      events: (await tx.query('SELECT type, subject FROM ppm.outbox_event WHERE subject = $1', [`jahresziel/${id}`])).rows,
    }));
    assert.deepEqual(rows.audit, [{ action: 'jahresziel.created', correlation_id: 'req-jz' }]);
    assert.deepEqual(rows.events, [{ type: 'jahresziel.created', subject: `jahresziel/${id}` }]);
  });
});

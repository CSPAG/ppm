/**
 * Zugang entziehen mit Neubesetzung (AM.01.01, UC-016 A1; Fachmodell 4.2): Vorschau mit Rollen und offenen Aufgaben,
 * Entziehen über den Baukasten (Mitgliedschaft und Tupel), Aufgabe «Rollen von ‹Person› neu besetzen» bei der
 * Administration, Stand der Rollen aus den Tupeln, Wiederaufnahme nach einem Fehler und Rechte.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { KeycloakFake } from '@vollholz/iam-testkit';
import { aufgabe } from '../../src/modules/eingang/index.ts';
import { full, skipDb } from './harness.ts';
import { grant, login, testApi, type TestApi } from './api.ts';

const skip = await skipDb();

describe('Zugang entziehen und Neubesetzung', { skip }, () => {
  let api: TestApi;
  let kc: KeycloakFake;
  let tenantId: string;
  type P = { h: Record<string, string>; id: string; sub: string };
  let adm: P, pl: P, nachfolge: P, leser: P;
  let mk: (name: string, role: string | null) => Promise<P>;
  const projekt = randomUUID();
  const portfolio = randomUUID();

  before(async () => {
    kc = new KeycloakFake();
    const org = kc.org('demo');
    api = await testApi({
      KEYCLOAK_MGMT_CLIENT_ID: 'ppm-admin', KEYCLOAK_MGMT_CLIENT_SECRET: 'geheim', KEYCLOAK_MGMT_URL: 'http://keycloak.test/admin/realms/test',
      KEYCLOAK_MGMT_INVITE_MIN_TIME: '0',
    }, { keycloakFetch: kc.fetch });
    mk = async (name: string, role: string | null) => {
      // Keycloak-IDs sind UUIDs (Audit des Baukastens); der Name steht im Principal
      const sub = randomUUID();
      const l = await login(api, 'demo', sub, role);
      tenantId = l.tenantId;
      await full(api.t.runtime, tenantId, tx => tx.query('UPDATE ppm.principal SET display_name = $1 WHERE id = $2', [name, l.principalId]));
      kc.member(org, kc.user(name, { id: sub, email: `${name}@demo.test` }));
      return { h: { authorization: l.authorization }, id: l.principalId, sub };
    };
    adm = await mk('u-adm', 'org-admin');
    pl = await mk('u-pl', 'leser');
    nachfolge = await mk('u-nachfolge', 'leser');
    leser = await mk('u-leser', 'leser');
    await grant(api, tenantId, `user:${pl.id}`, 'pl', { type: 'projekt', id: projekt });
    await grant(api, tenantId, `user:${pl.id}`, 'gremium', { type: 'portfolio', id: portfolio });
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const sys = <T>(fn: Parameters<typeof full<T>>[2]) => full(api.t.runtime, tenantId, fn);

  test('nur mit «Mitglieder und Rollen verwalten»; nicht sich selbst', async () => {
    assert.equal((await call('GET', `/v1/zugaenge/${pl.id}`, leser.h)).statusCode, 403);
    assert.equal((await call('POST', `/v1/zugaenge/${pl.id}/entziehen`, leser.h)).statusCode, 403);
    assert.equal((await call('GET', '/v1/neubesetzungen', leser.h)).statusCode, 403);
    assert.equal((await call('GET', `/v1/zugaenge/${randomUUID()}`, adm.h)).statusCode, 404);
    const selbst = await call('GET', `/v1/zugaenge/${adm.id}`, adm.h);
    assert.equal(selbst.json().can.entziehen, false);
    assert.equal((await call('POST', `/v1/zugaenge/${adm.id}/entziehen`, adm.h)).statusCode, 403);
  });

  test('Vorschau, Entziehen, Aufgabe der Administration und Stand der Rollen (UC-016 A1.1)', async () => {
    await sys(tx => aufgabe.oeffnen(tx, { art: 'statusbericht.erstellen', bezug: { typ: 'periode', id: '2026-10' }, empfaenger: { person: pl.id }, titel: 'Statusbericht Oktober erstellen', link: '/projekte/x/bericht', frist: { datum: '2026-10-25', art: 'kalendertage' } }));

    const v = await call('GET', `/v1/zugaenge/${pl.id}`, adm.h);
    assert.equal(v.statusCode, 200, v.body);
    const vb = v.json();
    assert.deepEqual(vb.orgRollen.map((r: { rolle: string }) => r.rolle), ['leser']);
    assert.deepEqual(vb.rollen.map((r: { ort: { typ: string }; rolle: string }) => `${r.ort.typ}:${r.rolle}`), ['portfolio:gremium', 'projekt:pl']);
    assert.equal(vb.rollen.find((r: { rolle: string }) => r.rolle === 'pl').rolleName.length > 2, true);
    assert.deepEqual(vb.aufgaben.map((a: { titel: string }) => a.titel), ['Statusbericht Oktober erstellen']);
    assert.equal(vb.can.entziehen, true);

    const e = await call('POST', `/v1/zugaenge/${pl.id}/entziehen`, adm.h);
    assert.equal(e.statusCode, 201, e.body);
    const { neubesetzung: id, rollen, aufgaben } = e.json();
    assert.deepEqual([rollen, aufgaben], [2, 1]);
    // Zugang gesperrt: nicht mehr Mitglied in Keycloak, keine Tupel
    assert.equal([...kc.orgMembers.values()].some(m => m.has(pl.sub)), false);
    assert.equal(await sys(async tx => (await tx.query("SELECT count(*)::int AS n FROM ppm.authz_tuple WHERE subject = $1", [`user:${pl.id}`])).rows[0].n), 0);

    // Aufgabe der Administration im Eingang
    const ein = (await call('GET', '/v1/eingang', adm.h)).json().items;
    const a = ein.find((x: { art: string }) => x.art === 'zugang.neu_besetzen');
    assert.ok(a, JSON.stringify(ein));
    assert.equal(a.titel, 'Rollen von u-pl neu besetzen');
    assert.equal(a.kontext, '2 Rollen · 1 offene Aufgabe');
    assert.equal(a.link, `/administration/neubesetzungen/${id}`);
    assert.equal(a.can.erledigen, true);
    assert.equal((await call('GET', '/v1/eingang', leser.h)).json().items.some((x: { art: string }) => x.art === 'zugang.neu_besetzen'), false);

    // Detail: Rollen offen, bis jemand sie am Ort wieder hat
    let d = (await call('GET', `/v1/neubesetzungen/${id}`, adm.h)).json();
    assert.deepEqual(d.rollen.map((r: { rolle: string; besetzt: boolean }) => [r.rolle, r.besetzt]), [['gremium', false], ['pl', false]]);
    assert.deepEqual(d.aufgaben.map((x: { titel: string }) => x.titel), ['Statusbericht Oktober erstellen']);
    assert.deepEqual([d.neubesetzung.person.name, d.neubesetzung.rollen, d.neubesetzung.offeneRollen, d.neubesetzung.erledigt, d.neubesetzung.entzogenVon.id], ['u-pl', 2, 2, false, adm.id]);
    await grant(api, tenantId, `user:${nachfolge.id}`, 'pl', { type: 'projekt', id: projekt });
    d = (await call('GET', `/v1/neubesetzungen/${id}`, adm.h)).json();
    assert.deepEqual(d.rollen.map((r: { rolle: string; besetzt: boolean }) => [r.rolle, r.besetzt]), [['gremium', false], ['pl', true]]);
    assert.equal(d.neubesetzung.offeneRollen, 1);

    // Liste: offen bis zum Erledigen im Eingang
    assert.deepEqual((await call('GET', '/v1/neubesetzungen?offen=true', adm.h)).json().items.map((x: { id: string }) => x.id), [id]);
    assert.equal((await call('POST', `/v1/eingang/aufgaben/${a.id}/erledigen`, adm.h)).statusCode, 200);
    assert.deepEqual((await call('GET', '/v1/neubesetzungen?offen=true', adm.h)).json().items, []);
    assert.equal((await call('GET', '/v1/neubesetzungen', adm.h)).json().items[0].erledigt, true);

    // Audit
    const log = await sys(async tx => (await tx.query("SELECT action FROM ppm.audit_log WHERE resource_id = $1 ORDER BY id", [id])).rows.map(r => r.action));
    assert.deepEqual(log, ['neubesetzung.created']);
    // Einmal entzogen: nicht mehr zu sehen
    assert.equal((await call('GET', `/v1/zugaenge/${pl.id}`, adm.h)).statusCode, 404);
  });

  test('ohne Rollen und Aufgaben: entzogen, keine Aufgabe; geliehene Rollen der Vertretung zählen nicht', async () => {
    const o = await mk('u-ohne', 'leser');
    const ohne = { principalId: o.id };
    // Vertretung einer Person mit Rolle sp am Projekt: befristete Rolle der Vertretung
    const vertreten = await mk('u-vertreten', 'leser');
    await grant(api, tenantId, `user:${vertreten.id}`, 'sp', { type: 'projekt', id: projekt });
    const heute = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
    const s = await call('POST', '/v1/stellvertretungen', vertreten.h, { vertreter: ohne.principalId, von: heute, bis: heute });
    assert.equal(s.statusCode, 201, s.body);
    assert.equal(await sys(async tx => (await tx.query("SELECT count(*)::int AS n FROM ppm.authz_tuple WHERE subject = $1 AND relation = 'sp'", [`user:${ohne.principalId}`])).rows[0].n), 1);
    const v = (await call('GET', `/v1/zugaenge/${ohne.principalId}`, adm.h)).json();
    assert.deepEqual(v.rollen, []);
    const e = await call('POST', `/v1/zugaenge/${ohne.principalId}/entziehen`, adm.h);
    assert.equal(e.statusCode, 201, e.body);
    assert.deepEqual([e.json().rollen, e.json().aufgaben], [0, 0]);
    const ein = (await call('GET', '/v1/eingang', adm.h)).json().items;
    assert.equal(ein.some((x: { bezug: { id: string } }) => x.bezug.id === e.json().neubesetzung), false);
    assert.equal((await call('GET', `/v1/neubesetzungen/${e.json().neubesetzung}`, adm.h)).json().neubesetzung.erledigt, true);
  });

  test('Fehler im Baukasten: nichts entzogen; der nächste Versuch nimmt es wieder auf', async () => {
    const w = await mk('u-wieder', 'leser');
    const p = { principalId: w.id };
    await grant(api, tenantId, `user:${p.principalId}`, 'kt', { type: 'projekt', id: projekt });
    kc.fail.push({ re: /^DELETE \/organizations\/.*\/members\//, status: 500 });
    const e1 = await call('POST', `/v1/zugaenge/${p.principalId}/entziehen`, adm.h);
    assert.ok(e1.statusCode >= 500, e1.body);
    kc.fail.length = 0;
    // Tupel noch da, Neubesetzung nur vorbereitet (nicht in der Liste)
    assert.equal((await call('GET', `/v1/zugaenge/${p.principalId}`, adm.h)).json().rollen.length, 1);
    const vorher = (await call('GET', '/v1/neubesetzungen', adm.h)).json().items.length;
    const e2 = await call('POST', `/v1/zugaenge/${p.principalId}/entziehen`, adm.h);
    assert.equal(e2.statusCode, 201, e2.body);
    assert.equal(e2.json().rollen, 1);
    assert.equal((await call('GET', '/v1/neubesetzungen', adm.h)).json().items.length, vorher + 1);
  });
});

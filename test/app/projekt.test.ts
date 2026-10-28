/**
 * Modul Projekte (AP-E0-4; BC PP.04.04, UC-002 Schritt 2, UC-014 A1, UC-016 Schritt 2): Anlegen mit Nummer «JJJJ-NNN»
 * (A-47), Ändern mit ETag, Lebenszyklus mit lesenden Endzuständen, Projektorganisation mit Tupeln – Abnahme: eine
 * Projektrolle wirkt nur im eigenen Projekt –, «vertraulich» (A-34), Filter, Cursor und Kopf.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { systemActor } from '@vollholz/platform';
import { projekt as aktionen } from '../../src/modules/projekt/index.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

type H = Record<string, string>;
interface Person { h: H; id: string }

describe('Projekte', () => {
  let api: TestApi;
  let T: string;
  let ue: Person, pl: Person, sp: Person, kt: Person, ctl: Person, gremiumC: Person, direktionC: Person, ohne: Person;
  const portfolio: Record<'a' | 'c', string> = { a: '', c: '' };
  const jahr = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', year: 'numeric' }).format(new Date());

  const call = (method: string, url: string, headers: H, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const wer = async (sub: string, role: string | null): Promise<Person> => {
    const l = await login(api, 'insel', sub, role);
    T = l.tenantId;
    return { h: { authorization: l.authorization }, id: l.principalId };
  };
  const anlegen = async (body: Record<string, unknown>, h: H = ue.h) => {
    const r = await call('POST', '/v1/projekte', h, { portfolioId: portfolio.a, ...body });
    assert.equal(r.statusCode, 201, r.body);
    return r.json();
  };
  const organisation = (id: string, version: number, mitglieder: unknown[], h: H = ue.h) =>
    call('PUT', `/v1/projekte/${id}/organisation`, { ...h, 'if-match': `W/"${version}"` }, { mitglieder });

  before(async () => {
    api = await testApi();
    ue = await wer('u-ue', 'ue');
    pl = await wer('u-pl', null);
    sp = await wer('u-sp', null);
    kt = await wer('u-kt', null);
    ctl = await wer('u-ctl', null);
    ohne = await wer('u-ohne', null);
    gremiumC = await wer('u-gremium-c', null);
    direktionC = await wer('u-direktion-c', null);
    await full(api.t.runtime, T, async tx => {
      for (const k of ['a', 'c'] as const) {
        portfolio[k] = (await tx.query<{ id: string }>(
          "INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [T, k.toUpperCase(), k === 'a' ? 'transformation' : 'dir-x', k === 'a' ? 'Transformation' : 'Direktion X', k === 'a'])).rows[0]!.id;
      }
    });
    await grant(api, T, `user:${gremiumC.id}`, 'gremium', { type: 'portfolio', id: portfolio.c });
    await grant(api, T, `user:${direktionC.id}`, 'direktion', { type: 'portfolio', id: portfolio.c });
  });
  after(async () => { await api?.close(); });

  test('anlegen: Nummer «JJJJ-NNN» fortlaufend je Jahr, auch über Projekte, die die Person nicht sieht (A-47)', async () => {
    const a = await anlegen({ name: '  Digitale Patientenaufnahme ' });
    assert.match(a.nummer, new RegExp(`^${jahr}-\\d{3}$`));
    assert.deepEqual([a.name, a.phase, a.lebenszyklus, a.vertraulich, a.version, a.rollen], ['Digitale Patientenaufnahme', 'P0', 'aktiv', false, 1, []]);
    assert.deepEqual(a.portfolio, { schluessel: 'transformation', name: 'Transformation', kategorie: 'A' });
    assert.deepEqual(a.can, { write: true, organisation: true });

    // Direktion C legt in ihrem Portfolio an; sie sieht die Projekte in A nicht, die Nummer zählt sie trotzdem
    const c = await anlegen({ name: 'Direktionsprojekt', portfolioId: portfolio.c }, direktionC.h);
    assert.equal(Number(c.nummer.split('-')[1]), Number(a.nummer.split('-')[1]) + 1);
    assert.deepEqual(c.can, { write: false, organisation: false });
    const sichtbar = (await call('GET', '/v1/projekte', direktionC.h)).json().items.map((x: { nummer: string }) => x.nummer);
    assert.deepEqual(sichtbar, [c.nummer]);

    // nicht im eigenen Portfolio: kein Recht
    assert.equal((await call('POST', '/v1/projekte', direktionC.h, { name: 'X', portfolioId: portfolio.a })).statusCode, 403);
    // vertraulich anlegen, das die Direktion danach nicht sehen dürfte: abgewiesen, nichts angelegt
    const v = await call('POST', '/v1/projekte', direktionC.h, { name: 'Geheim', portfolioId: portfolio.c, vertraulich: true });
    assert.equal(v.statusCode, 409, v.body);
    assert.equal((await call('GET', `/v1/projekte?q=Geheim`, ue.h)).json().items.length, 0);
    // ungültige Eingaben
    assert.equal((await call('POST', '/v1/projekte', ue.h, { name: '', portfolioId: portfolio.a })).statusCode, 422);
    assert.equal((await call('POST', '/v1/projekte', ue.h, { name: 'X', portfolioId: portfolio.a, phase: 'P9' })).statusCode, 422);
  });

  test('ändern mit ETag; Endzustand ist lesend (UC-015 Schritt 6)', async () => {
    const p = await anlegen({ name: 'Ändern' });
    assert.equal((await call('PATCH', `/v1/projekte/${p.id}`, ue.h, { name: 'x' })).statusCode, 428);
    const r = await call('PATCH', `/v1/projekte/${p.id}`, { ...ue.h, 'if-match': 'W/"1"' }, { name: ' Neu ', vertraulich: true });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().name, r.json().vertraulich, r.json().version, r.headers.etag], ['Neu', true, 2, 'W/"2"']);
    assert.equal((await call('PATCH', `/v1/projekte/${p.id}`, { ...ue.h, 'if-match': 'W/"1"' }, { name: 'Alt' })).statusCode, 412);

    await full(api.t.runtime, T, tx => aktionen.lebenszyklusWechseln(tx, systemActor('system'), p.id, 'abgeschlossen'));
    const g = (await call('GET', `/v1/projekte/${p.id}`, ue.h)).json();
    assert.deepEqual([g.lebenszyklus, g.can], ['abgeschlossen', { write: false, organisation: false }]);
    const z = await call('PATCH', `/v1/projekte/${p.id}`, { ...ue.h, 'if-match': `W/"${g.version}"` }, { name: 'Zu spät' });
    assert.equal(z.statusCode, 409, z.body);
    assert.match(z.json().detail, /abgeschlossen und kann nur noch gelesen werden/);
    assert.equal((await organisation(p.id, 0, [])).statusCode, 409);

    // Verlauf: Anlegen, Ändern, Abschluss
    const v = await full(api.t.runtime, T, async tx => (await tx.query<{ version: number; lebenszyklus: string; name: string }>(
      'SELECT version, lebenszyklus, name FROM ppm.projekt_version WHERE projekt_id = $1 ORDER BY version', [p.id])).rows);
    assert.deepEqual(v.map(x => [x.version, x.name, x.lebenszyklus]), [[1, 'Ändern', 'aktiv'], [2, 'Neu', 'aktiv'], [3, 'Neu', 'abgeschlossen']]);
  });

  test('Lebenszyklus: nur erlaubte Übergänge; Phase nachführen', async () => {
    const p = await anlegen({ name: 'Zyklus' });
    const wechsel = (ziel: 'aktiv' | 'sistiert' | 'abgebrochen' | 'abgeschlossen' | 'zurueckgezogen') =>
      full(api.t.runtime, T, tx => aktionen.lebenszyklusWechseln(tx, systemActor('system'), p.id, ziel)).then(r => r.lebenszyklus, (e: { status?: number }) => e.status);
    assert.equal(await wechsel('aktiv'), 409);
    assert.equal(await wechsel('sistiert'), 'sistiert');
    assert.equal(await wechsel('abgeschlossen'), 409);
    assert.equal(await wechsel('aktiv'), 'aktiv');
    const ph = await full(api.t.runtime, T, tx => aktionen.phaseSetzen(tx, systemActor('system'), p.id, 'P1'));
    assert.equal(ph.phase, 'P1');
    assert.equal(await wechsel('zurueckgezogen'), 'zurueckgezogen');
    assert.equal(await wechsel('aktiv'), 409);
    await assert.rejects(full(api.t.runtime, T, tx => aktionen.phaseSetzen(tx, systemActor('system'), p.id, 'P2')), { status: 409 });
  });

  test('Projektorganisation setzt Rollen am Projekt; eine Projektrolle wirkt nur im eigenen Projekt (Abnahme)', async () => {
    const eigenes = await anlegen({ name: 'Eigenes Projekt' });
    const fremdes = await anlegen({ name: 'Fremdes Projekt' });
    // ohne Rolle sehen PL, SP, KT nichts
    for (const p of [pl, sp, kt]) {
      assert.equal((await call('GET', `/v1/projekte/${eigenes.id}`, p.h)).statusCode, 403);
      assert.equal((await call('GET', '/v1/projekte', p.h)).statusCode, 403);
    }

    const o = await organisation(eigenes.id, 0, [
      { personId: sp.id, funktion: 'sp', akv: ' Auftrag, Budget ' },
      { personId: pl.id, funktion: 'pl', akv: 'Führt das Projekt' },
      { personId: ctl.id, funktion: 'ctl' },
      { personId: kt.id, funktion: 'kt', akv: 'Fachbereich' },
      { personId: ohne.id, funktion: 'koalition' },
    ]);
    assert.equal(o.statusCode, 200, o.body);
    assert.equal(o.headers.etag, 'W/"1"');
    assert.deepEqual(o.json().mitglieder.map((m: { funktion: string; akv: string }) => [m.funktion, m.akv]),
      [['sp', 'Auftrag, Budget'], ['koalition', ''], ['pl', 'Führt das Projekt'], ['ctl', ''], ['kt', 'Fachbereich']]);
    const tupel = await full(api.t.runtime, T, async tx => (await tx.query<{ s: string; r: string }>(
      "SELECT subject AS s, relation AS r FROM ppm.authz_tuple WHERE object_type = 'projekt' AND object_id = $1 ORDER BY relation", [eigenes.id])).rows);
    assert.deepEqual(tupel.map(t => [t.r, t.s]), [['ctl', `user:${ctl.id}`], ['kt', `user:${kt.id}`], ['pl', `user:${pl.id}`], ['sp', `user:${sp.id}`]]);

    // eigenes Projekt: lesen alle Rollen, ändern nur PL, Organisation PL und SP; Koalition ohne Rolle (A-04)
    const lesen = async (p: Person, id: string) => (await call('GET', `/v1/projekte/${id}`, p.h)).statusCode;
    for (const p of [pl, sp, ctl, kt]) assert.equal(await lesen(p, eigenes.id), 200);
    assert.equal(await lesen(ohne, eigenes.id), 403);
    assert.deepEqual((await call('GET', `/v1/projekte/${eigenes.id}`, pl.h)).json().can, { write: true, organisation: true });
    assert.deepEqual((await call('GET', `/v1/projekte/${eigenes.id}`, sp.h)).json().can, { write: false, organisation: true });
    assert.deepEqual((await call('GET', `/v1/projekte/${eigenes.id}`, kt.h)).json().can, { write: false, organisation: false });
    assert.equal((await call('PATCH', `/v1/projekte/${eigenes.id}`, { ...pl.h, 'if-match': 'W/"1"' }, { name: 'Eigenes Projekt (PL)' })).statusCode, 200);
    assert.equal((await call('PATCH', `/v1/projekte/${eigenes.id}`, { ...sp.h, 'if-match': 'W/"2"' }, { name: 'SP' })).statusCode, 403);
    assert.equal((await call('PATCH', `/v1/projekte/${eigenes.id}`, { ...kt.h, 'if-match': 'W/"2"' }, { name: 'KT' })).statusCode, 403);

    // fremdes Projekt: keine Wirkung
    for (const p of [pl, sp, ctl, kt]) {
      assert.equal(await lesen(p, fremdes.id), 403);
      assert.equal((await call('PATCH', `/v1/projekte/${fremdes.id}`, { ...p.h, 'if-match': 'W/"1"' }, { name: 'x' })).statusCode, 403);
      assert.equal((await organisation(fremdes.id, 0, [{ personId: p.id, funktion: 'pl' }], p.h)).statusCode, 403);
      const liste = (await call('GET', '/v1/projekte', p.h)).json().items.map((x: { id: string }) => x.id);
      assert.deepEqual(liste, [eigenes.id]);
    }

    // Rollen in der Liste und Filter «rolle»
    const meine = (await call('GET', '/v1/projekte?rolle=pl', pl.h)).json().items;
    assert.deepEqual(meine.map((x: { id: string; rollen: string[]; projektleitung: string; sponsor: string; controlling: string }) => [x.id, x.rollen, x.projektleitung, x.sponsor, x.controlling]),
      [[eigenes.id, ['pl'], pl.id, sp.id, ctl.id]]);
    assert.deepEqual((await call('GET', '/v1/projekte?rolle=sp', pl.h)).json().items, []);
    assert.deepEqual((await call('GET', '/v1/projekte/kopf', kt.h)).json(), {
      projekte: [{ id: eigenes.id, nummer: eigenes.nummer, name: 'Eigenes Projekt (PL)', phase: 'P0', lebenszyklus: 'aktiv', rollen: ['kt'] }], anzahl: 1,
    });

    // SP wechselt die Projektleitung: alte PL verliert die Rolle sofort, neue erhält sie
    const stale = await organisation(eigenes.id, 0, [], sp.h);
    assert.equal(stale.statusCode, 412);
    const w = await organisation(eigenes.id, 1, [{ personId: sp.id, funktion: 'sp' }, { personId: ctl.id, funktion: 'pl' }, { personId: kt.id, funktion: 'kt' }], sp.h);
    assert.equal(w.statusCode, 200, w.body);
    assert.equal(w.json().version, 2);
    assert.equal(await lesen(pl, eigenes.id), 403);
    assert.deepEqual((await call('GET', `/v1/projekte/${eigenes.id}`, ctl.h)).json().can, { write: true, organisation: true });
    // die Organisation festzulegen ist eine Fachaktion: die Rolle darf an Personen gehen, die selbst weniger haben (fachmodell.md 3.3)
    assert.deepEqual((await call('GET', `/v1/projekte/${eigenes.id}/organisation`, kt.h)).json().can, { write: false });
  });

  test('Projektorganisation: Prüfung der Eingaben', async () => {
    const p = await anlegen({ name: 'Prüfung' });
    const zwei = await organisation(p.id, 0, [{ personId: pl.id, funktion: 'pl' }, { personId: sp.id, funktion: 'pl' }]);
    assert.equal(zwei.statusCode, 422, zwei.body);
    assert.deepEqual(zwei.json().errors.map((e: { path: string }) => e.path), ['/mitglieder/1/funktion']);
    const doppelt = await organisation(p.id, 0, [{ personId: kt.id, funktion: 'kt' }, { personId: kt.id, funktion: 'kt' }]);
    assert.deepEqual(doppelt.json().errors.map((e: { path: string }) => e.path), ['/mitglieder/1']);
    const unbekannt = await organisation(p.id, 0, [{ personId: '00000000-0000-4000-8000-000000000000', funktion: 'kt' }]);
    assert.deepEqual([unbekannt.statusCode, unbekannt.json().errors[0].path], [422, '/mitglieder/0/personId']);
    // nichts gespeichert, keine Tupel
    assert.equal((await call('GET', `/v1/projekte/${p.id}/organisation`, ue.h)).json().version, 0);
    // zwei Funktionen derselben Person sind zulässig (PL im Kernteam)
    assert.equal((await organisation(p.id, 0, [{ personId: pl.id, funktion: 'pl' }, { personId: pl.id, funktion: 'kt' }])).statusCode, 200);
  });

  test('vertraulich: nur Projektrollen, UE und Gremium des Portfolios (A-34)', async () => {
    const p = await anlegen({ name: 'Reorganisation', portfolioId: portfolio.c, vertraulich: true });
    assert.equal((await organisation(p.id, 0, [{ personId: kt.id, funktion: 'kt' }])).statusCode, 200);
    const sieht = async (x: Person) => (await call('GET', `/v1/projekte?nummer=${p.nummer}`, x.h)).json().items.length === 1;
    assert.equal(await sieht(ue), true);
    assert.equal(await sieht(gremiumC), true);
    assert.equal(await sieht(kt), true);
    assert.equal(await sieht(direktionC), false);
    // Direktion: Recht am Portfolio, das vertrauliche Projekt bleibt aber unsichtbar wie ein unbekanntes
    assert.equal((await call('GET', `/v1/projekte/${p.id}`, direktionC.h)).statusCode, 404);
  });

  test('Liste: Filter und Cursor', async () => {
    for (let i = 0; i < 3; i++) await anlegen({ name: `Serie ${i}`, phase: 'P2' });
    const alle = (await call('GET', '/v1/projekte?q=Serie', ue.h)).json().items;
    assert.equal(alle.length, 3);
    const s1 = (await call('GET', '/v1/projekte?q=Serie&limit=2', ue.h)).json();
    assert.equal(s1.items.length, 2);
    const s2 = (await call('GET', `/v1/projekte?q=Serie&limit=2&cursor=${encodeURIComponent(s1.nextCursor)}`, ue.h)).json();
    assert.deepEqual([...s1.items, ...s2.items].map((x: { nummer: string }) => x.nummer), alle.map((x: { nummer: string }) => x.nummer));
    assert.equal(s2.nextCursor, null);
    // Cursor gilt nur für dieselben Filter
    assert.equal((await call('GET', `/v1/projekte?q=Serie&phase=P2&cursor=${encodeURIComponent(s1.nextCursor)}`, ue.h)).statusCode, 422);
    assert.equal((await call('GET', '/v1/projekte?phase=P2&portfolio=transformation', ue.h)).json().items.length, 3);
    assert.equal((await call('GET', '/v1/projekte?phase=P2&portfolio=dir-x', ue.h)).json().items.length, 0);
    assert.equal((await call('GET', `/v1/projekte?nummer=${alle[1].nummer}`, ue.h)).json().items[0].id, alle[1].id);
    const beendet = (await call('GET', '/v1/projekte?lebenszyklus=abgeschlossen&lebenszyklus=zurueckgezogen', ue.h)).json().items;
    assert.ok(beendet.length >= 2 && beendet.every((x: { lebenszyklus: string }) => ['abgeschlossen', 'zurueckgezogen'].includes(x.lebenszyklus)));
  });
});

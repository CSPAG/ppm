/**
 * Personal- und Abwesenheitsdaten aus dem HR-System (AP-E7-2; BC RK.01.02, UC-009 Schritt 1): Lieferung prüfen und je
 * Rolle und Monat zusammenfassen (ohne Datenbank), Übernahme über die Schnittstelle «HR-System › Personal» mit einem
 * lokalen HTTP-Server als HR-System (A-54), Kapazität laut HR neben dem festgelegten Angebot, Vorrang des Festgelegten
 * in der Auslastung, ein Lauf ersetzt die gelieferten Monate, unbekannte Rolle bricht den Lauf ab, Rechte.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { mitHr, personalLesen } from '../../src/modules/ressource/hr.ts';
import { login, testApi, type TestApi } from './api.ts';
import { skipDb } from './harness.ts';

describe('HR-Lieferung (ohne Datenbank)', () => {
  test('je Rolle und Monat: Pensum minus Abwesenheit, Personen gezählt; Fehler mit Eintrag', () => {
    const z = personalLesen(JSON.stringify({ personen: [
      { personalnummer: 'P-1', rolle: 'pl', monat: '2027-01', fte: 1, abwesend: 0.25 },
      { personalnummer: 'P-2', rolle: 'pl', monat: '2027-01', fte: '0.8' },
      { personalnummer: 'P-1', rolle: 'pl', monat: '2027-02', fte: 1 },
      { personalnummer: 3, rolle: 'arch', monat: '2027-01', fte: 0.5, abwesend: 0.5 },
    ] }));
    assert.deepEqual(z, [
      { rolle: 'pl', monat: '2027-01', fte: 1.55, abwesend: 0.25, personen: 2 },
      { rolle: 'pl', monat: '2027-02', fte: 1, abwesend: 0, personen: 1 },
      { rolle: 'arch', monat: '2027-01', fte: 0, abwesend: 0.5, personen: 1 },
    ]);
    assert.throws(() => personalLesen('kein json'), /keine gültige JSON-Antwort/);
    assert.throws(() => personalLesen('{"x":1}'), /Liste von Personen/);
    assert.throws(() => personalLesen('[{"personalnummer":"P","rolle":"pl","monat":"2027-13","fte":1}]'), /Eintrag 1: Monat/);
    assert.throws(() => personalLesen('[{"personalnummer":"P","rolle":"pl","monat":"2027-01","fte":1,"abwesend":2}]'), /Eintrag 1: Abwesenheit/);
    assert.throws(() => personalLesen('[{"rolle":"pl","monat":"2027-01","fte":1}]'), /Eintrag 1: Personalnummer/);
  });

  test('Vorrang des festgelegten Angebots, HR füllt Lücken', () => {
    const a = mitHr([{ rolle: 'pl', monat: '2027-01', fte: 3 }], [{ rolle: 'pl', monat: '2027-01', fte: 1.55, abwesend: 0, personen: 2 }, { rolle: 'pl', monat: '2027-02', fte: 1, abwesend: 0, personen: 1 }]);
    assert.deepEqual(a, [{ rolle: 'pl', monat: '2027-01', fte: 3 }, { rolle: 'pl', monat: '2027-02', fte: 1 }]);
  });
});

const skip = await skipDb();

describe('Personal- und Abwesenheitsdaten über die Schnittstelle', { skip }, () => {
  let api: TestApi;
  let server: Server;
  let basis = '';
  let hrAntwort = '[]';
  const h: Record<string, Record<string, string>> = {};
  const call = (who: string, method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });
  let schnittstelle = '';
  const lauf = async () => (await call('adm', 'POST', `/v1/schnittstellen/${schnittstelle}/starten`)).json();

  before(async () => {
    server = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }).end(hrAntwort); });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    basis = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    api = await testApi();
    for (const [sub, rolle] of [['adm', 'org-admin'], ['rm', 'rm'], ['ue', 'ue'], ['antrag', 'antragsteller']] as const) {
      h[sub] = { authorization: (await login(api, 'acme', `hr-${sub}`, rolle)).authorization };
    }
    for (const [schluessel, label] of [['pl', 'Projektleitung'], ['arch', 'Architektur']]) {
      const w = await call('adm', 'POST', '/v1/codetabellen/ressourcenrolle/werte', { schluessel, label });
      assert.equal(w.statusCode, 201, w.body);
    }
    const s = await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'hr', daten: 'personal', rhythmus: 'monatlich', adresse: `${basis}/personal` });
    assert.equal(s.statusCode, 201, s.body);
    schnittstelle = s.json().schnittstelle.id;
  });
  after(async () => {
    await api?.close();
    await new Promise(r => server.close(r));
  });

  test('Übernahme je Rolle und Monat; Kapazität laut HR; das festgelegte Angebot hat in der Auslastung Vorrang (UC-009 Schritte 1–2)', async () => {
    hrAntwort = JSON.stringify([
      { personalnummer: 'P-1', rolle: 'pl', monat: '2027-01', fte: 1, abwesend: 0.25 },
      { personalnummer: 'P-2', rolle: 'pl', monat: '2027-01', fte: 0.8 },
      { personalnummer: 'P-1', rolle: 'pl', monat: '2027-02', fte: 1 },
      { personalnummer: 'P-3', rolle: 'arch', monat: '2027-01', fte: 1 },
    ]);
    const l = await lauf();
    assert.deepEqual([l.stand, l.umfang, l.fehler], ['erfolgreich', 3, null]);

    const hr = (await call('rm', 'GET', '/v1/kapazitaet/hr?von=2027-01&bis=2027-03')).json();
    assert.deepEqual(hr.zellen, [
      { rolle: 'arch', monat: '2027-01', fte: 1, abwesend: 0, personen: 1 },
      { rolle: 'pl', monat: '2027-01', fte: 1.55, abwesend: 0.25, personen: 2 },
      { rolle: 'pl', monat: '2027-02', fte: 1, abwesend: 0, personen: 1 },
    ]);
    assert.ok(hr.uebernommenAt);
    // das festgelegte Angebot bleibt, wie es ist
    assert.deepEqual((await call('rm', 'GET', '/v1/kapazitaet?von=2027-01&bis=2027-03')).json().zellen, []);

    // RM legt für Januar «pl» 3 FTE fest: Vorrang; Februar und «arch» aus HR
    assert.equal((await call('rm', 'PUT', '/v1/kapazitaet', { zellen: [{ rolle: 'pl', monat: '2027-01', fte: 3 }] })).statusCode, 200);
    const a = (await call('rm', 'GET', '/v1/auslastung?von=2027-01&bis=2027-02')).json();
    const angebot = Object.fromEntries(a.rollen.map((r: { rolle: string; zellen: { angebot: number | null }[] }) => [r.rolle, r.zellen.map(z => z.angebot)]));
    assert.deepEqual(angebot, { arch: [1, null], pl: [3, 1] });
  });

  test('ein Lauf ersetzt die gelieferten Monate; unbekannte Rolle bricht ab, ohne etwas zu ändern', async () => {
    hrAntwort = JSON.stringify([{ personalnummer: 'P-1', rolle: 'pl', monat: '2027-02', fte: 0.6 }]);
    assert.equal((await lauf()).stand, 'erfolgreich');
    const hr = (await call('rm', 'GET', '/v1/kapazitaet/hr?von=2027-01&bis=2027-03')).json();
    assert.deepEqual(hr.zellen.map((z: { rolle: string; monat: string; fte: number }) => `${z.rolle} ${z.monat} ${z.fte}`), ['arch 2027-01 1', 'pl 2027-01 1.55', 'pl 2027-02 0.6']);

    hrAntwort = JSON.stringify([{ personalnummer: 'P-9', rolle: 'gibtsnicht', monat: '2027-01', fte: 1 }]);
    const f = await lauf();
    assert.equal(f.stand, 'fehlgeschlagen');
    assert.match(f.fehler, /Rolle «gibtsnicht»/);
    assert.equal((await call('rm', 'GET', '/v1/kapazitaet/hr?von=2027-01&bis=2027-01')).json().zellen.length, 2, 'unverändert');
  });

  test('Rechte: lesen mit ressource:read (UE, RM); Antragstellende nicht', async () => {
    assert.equal((await call('ue', 'GET', '/v1/kapazitaet/hr')).statusCode, 200);
    assert.equal((await call('antrag', 'GET', '/v1/kapazitaet/hr')).statusCode, 403);
    assert.equal((await call('rm', 'GET', '/v1/kapazitaet/hr?von=2027-05&bis=2027-01')).statusCode, 422);
  });
});

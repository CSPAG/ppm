/**
 * Kapazitätsangebot und Auslastung (AP-E5-4; BC RK.01.01, RK.02.04; UC-009 Schritte 1–2, 5): Angebot je Rolle und Monat
 * mit Version je Zelle, Auslastung aus dem Ressourcenbedarf (FTE × Monate je Rolle und Phase, Pool = Rolle, A-20),
 * Engpässe je Quartal, Sichtbarkeit nach Lesesicht, Rechte, Auslastung je Szenario (Schnittstelle für AP-E5-3).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { auslastung as auslastungModul } from '../../src/modules/ressource/index.ts';
import { auslastung, monate, nachSzenario, type Bedarf } from '../../src/modules/ressource/rechnung.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, skipDb, tenant } from './harness.ts';

const b = (projektId: string, rolle: string, fte: number, vonMonat: string, bisMonat: string, phase = 'P2'): Bedarf =>
  ({ id: `${projektId}-${rolle}-${phase}`, projektId, phase, rolle, fte, vonMonat, bisMonat, gedeckt: false });

describe('Auslastung rechnen (ohne Datenbank)', () => {
  test('Monate über den Jahreswechsel', () => {
    assert.deepEqual(monate('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  test('Lage je Zelle, Beiträge, Engpass je Quartal mit dem Monat der grössten Überbuchung', () => {
    const e = auslastung('2027-04', '2027-06',
      [{ rolle: 'pl', monat: '2027-04', fte: 5 }, { rolle: 'pl', monat: '2027-05', fte: 5 }, { rolle: 'pl', monat: '2027-06', fte: 5 }, { rolle: 'ctl', monat: '2027-04', fte: 1 }],
      [b('a', 'pl', 3, '2027-01', '2027-06'), b('b', 'pl', 2, '2027-05', '2027-06'), b('c', 'pl', 2.5, '2027-06', '2027-09'), b('a', 'kernteam', 1, '2027-04', '2027-04')]);
    assert.deepEqual(e.rollen.map(r => r.rolle), ['ctl', 'kernteam', 'pl']);
    const pl = e.rollen.find(r => r.rolle === 'pl')!.zellen;
    assert.deepEqual(pl.map(z => [z.monat, z.angebot, z.bedarf, z.frei, z.lage]), [
      ['2027-04', 5, 3, 2, 'frei'], ['2027-05', 5, 5, 0, 'ausgelastet'], ['2027-06', 5, 7.5, -2.5, 'ueberbucht'],
    ]);
    assert.deepEqual(pl[2]!.beitraege.map(x => x.projektId), ['a', 'b', 'c']);
    assert.deepEqual(e.rollen.find(r => r.rolle === 'ctl')!.zellen.map(z => z.lage), ['frei', 'leer', 'leer']);
    // «Kapazität Q2 2027: 7,5 FTE Projektleitung statt höchstens 5,0 … 3 betroffene Projekte» (darstellung.md)
    assert.deepEqual(e.engpaesse, [
      { rolle: 'kernteam', quartal: '2027-Q2', monat: '2027-04', bedarf: 1, angebot: 0, projekte: 1 },
      { rolle: 'pl', quartal: '2027-Q2', monat: '2027-06', bedarf: 7.5, angebot: 5, projekte: 3 },
    ]);
  });

  test('Summen ohne Rundungsfehler; Rollen nur mit Bedarf ausserhalb fehlen', () => {
    const e = auslastung('2027-01', '2027-01', [{ rolle: 'pl', monat: '2027-01', fte: 0.3 }],
      [b('a', 'pl', 0.1, '2027-01', '2027-01'), b('b', 'pl', 0.2, '2027-01', '2027-01'), b('c', 'ctl', 1, '2028-01', '2028-01')]);
    assert.deepEqual(e.rollen.map(r => [r.rolle, r.zellen[0]!.bedarf, r.zellen[0]!.lage]), [['pl', 0.3, 'ausgelastet']]);
  });

  test('Szenario: inaktive Projekte fallen weg, der Start verschiebt den ganzen Bedarf, übrige bleiben', () => {
    const bedarfe = [b('a', 'pl', 1, '2027-01', '2027-03', 'P1'), b('a', 'pl', 2, '2027-04', '2027-06', 'P2'), b('b', 'pl', 1, '2027-01', '2027-01'), b('c', 'pl', 1, '2027-02', '2027-02')];
    const s = nachSzenario(bedarfe, [{ projektId: 'a', aktiv: true, startMonat: '2027-11' }, { projektId: 'b', aktiv: false, startMonat: null }]);
    assert.deepEqual(s.map(x => `${x.projektId}:${x.vonMonat}–${x.bisMonat}`), ['a:2027-11–2028-01', 'a:2028-02–2028-04', 'c:2027-02–2027-02']);
  });
});

const skip = await skipDb();

describe('Kapazität und Auslastung (API)', { skip }, () => {
  let api: TestApi;
  let T: string;
  let pf: string;
  const projekt: Record<'x' | 'y' | 'geheim', string> = { x: '', y: '', geheim: '' };
  const h: Record<string, Record<string, string>> = {};

  async function person(sub: string, rolle: string, ort: { type: 'org' } | { type: 'projekt'; id: string } = { type: 'org' }): Promise<Record<string, string>> {
    const l = await login(api, 'acme', sub, null);
    await grant(api, T, `user:${l.principalId}`, rolle, ort);
    return { authorization: l.authorization };
  }
  const call = (who: string, method: string, url: string, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: h[who], ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      for (const [k, nr, vertraulich] of [['x', '2026-001', false], ['y', '2026-002', false], ['geheim', '2026-003', true]] as const) {
        projekt[k] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, vertraulich) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [T, nr, `Projekt ${k}`, pf, 'P2', vertraulich])).rows[0]!.id;
      }
      for (const [s, l] of [['projektleitung', 'Projektleitung'], ['ctl', 'CTL'], ['alt', 'Alt']]) {
        await tx.query("INSERT INTO ppm.codewert (tenant_id, codetabelle, schluessel, label, aktiv) VALUES ($1, 'ressourcenrolle', $2, $3, $4)", [T, s, l, s !== 'alt']);
      }
      // Bedarf in FTE × Monate (RK.02.05) und nur als Grösse (RK.02.01, zählt nicht)
      const bedarf = "INSERT INTO ppm.ressourcenbedarf (tenant_id, projekt_id, phase, rolle, fte, von_monat, bis_monat) VALUES ($1, $2, $3, $4, $5, $6, $7)";
      await tx.query(bedarf, [T, projekt.x, 'P2', 'projektleitung', 3, '2027-01', '2027-06']);
      await tx.query(bedarf, [T, projekt.y, 'P2', 'projektleitung', 2.5, '2027-04', '2027-12']);
      await tx.query(bedarf, [T, projekt.geheim, 'P2', 'projektleitung', 1, '2027-01', '2027-12']);
      await tx.query("INSERT INTO ppm.ressourcenbedarf (tenant_id, projekt_id, phase, rolle, groesse) VALUES ($1, $2, 'P3', 'ctl', 'L')", [T, projekt.x]);
    });
    h.rm = await person('rm', 'rm');
    h.ue = await person('ue', 'ue');
    h.gl = await person('gl', 'gl');
    h.pl = await person('pl', 'pl', { type: 'projekt', id: projekt.x });
    h.admin = await person('admin', 'org-admin');
  });
  after(async () => { await api?.close(); });

  test('Angebot festlegen (UC-009 Schritt 2): Raster mit Version je Zelle, entfernen, Rolle aus der Codetabelle', async () => {
    const leer = await call('rm', 'GET', '/v1/kapazitaet?von=2027-04&bis=2027-06');
    assert.equal(leer.statusCode, 200, leer.body);
    assert.deepEqual(leer.json(), { von: '2027-04', bis: '2027-06', zellen: [], can: { write: true } });

    const zellen = monate('2027-04', '2027-06').map(monat => ({ rolle: 'projektleitung', monat, fte: 5 }));
    const p = await call('rm', 'PUT', '/v1/kapazitaet', { zellen });
    assert.equal(p.statusCode, 200, p.body);
    assert.deepEqual(p.json().zellen.map((z: { fte: number; version: number }) => [z.fte, z.version]), [[5, 1], [5, 1], [5, 1]]);

    // vorhandene Zelle ohne bzw. mit alter Version: 412, nichts gespeichert (alles oder nichts)
    const ohne = await call('rm', 'PUT', '/v1/kapazitaet', { zellen: [{ rolle: 'ctl', monat: '2027-04', fte: 1 }, { rolle: 'projektleitung', monat: '2027-04', fte: 6 }] });
    assert.equal(ohne.statusCode, 412);
    assert.equal(ohne.json().currentVersion, 1);
    assert.deepEqual((await call('rm', 'GET', '/v1/kapazitaet?von=2027-04&bis=2027-04')).json().zellen.map((z: { rolle: string }) => z.rolle), ['projektleitung']);

    const neu = await call('rm', 'PUT', '/v1/kapazitaet', { zellen: [{ rolle: 'projektleitung', monat: '2027-04', fte: 6, version: 1 }, { rolle: 'projektleitung', monat: '2027-05', fte: null, version: 1 }, { rolle: 'ctl', monat: '2027-04', fte: 0.8 }] });
    assert.equal(neu.statusCode, 200, neu.body);
    assert.deepEqual(neu.json().zellen, [
      { rolle: 'projektleitung', monat: '2027-04', fte: 6, version: 2 }, { rolle: 'projektleitung', monat: '2027-05', fte: null, version: null }, { rolle: 'ctl', monat: '2027-04', fte: 0.8, version: 1 },
    ]);
    assert.equal((await call('rm', 'PUT', '/v1/kapazitaet', { zellen: [{ rolle: 'projektleitung', monat: '2027-04', fte: 6, version: 1 }] })).statusCode, 412);
    assert.equal((await call('rm', 'PUT', '/v1/kapazitaet', { zellen: [{ rolle: 'projektleitung', monat: '2027-05', fte: 5 }] })).statusCode, 200, 'entfernte Zelle neu');
    // 0 bleibt 0 (Angebot null FTE), nicht null durch die Typumwandlung
    const null0 = await call('rm', 'PUT', '/v1/kapazitaet', { zellen: [{ rolle: 'ctl', monat: '2027-04', fte: 0, version: 1 }] });
    assert.equal(null0.statusCode, 200, null0.body);
    assert.deepEqual(null0.json().zellen, [{ rolle: 'ctl', monat: '2027-04', fte: 0, version: 2 }]);

    // deaktivierte oder unbekannte Rolle, doppelte Zelle, falscher Monat, Zeitraum zu lang: 422
    for (const zellen of [[{ rolle: 'alt', monat: '2027-04', fte: 1 }], [{ rolle: 'gibts_nicht', monat: '2027-04', fte: 1 }],
      [{ rolle: 'ctl', monat: '2027-07', fte: 1 }, { rolle: 'ctl', monat: '2027-07', fte: 2 }], [{ rolle: 'ctl', monat: '2027-13', fte: 1 }], [{ rolle: 'ctl', monat: '2027-07', fte: -1 }]]) {
      assert.equal((await call('rm', 'PUT', '/v1/kapazitaet', { zellen })).statusCode, 422, JSON.stringify(zellen));
    }
    assert.equal((await call('rm', 'GET', '/v1/kapazitaet?von=2027-04&bis=2027-03')).statusCode, 422);
    assert.equal((await call('rm', 'GET', '/v1/kapazitaet?von=2027-01&bis=2032-01')).statusCode, 422, 'mehr als 60 Monate');
    assert.equal((await call('rm', 'GET', '/v1/kapazitaet?von=2027-01&bis=2031-12')).statusCode, 200, '60 Monate');

    // Audit und Ereignis je Zelle
    const audit = await full(api.t.runtime, T, async tx => (await tx.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE action LIKE 'kapazitaet.%' ORDER BY seq")).rows.map(r => r.action));
    assert.deepEqual(audit, ['kapazitaet.created', 'kapazitaet.created', 'kapazitaet.created', 'kapazitaet.updated', 'kapazitaet.deleted', 'kapazitaet.created', 'kapazitaet.created', 'kapazitaet.updated']);
  });

  test('Rechte: lesen mit ressource:read (RM, UE), pflegen nur mit ressource:write (RM)', async () => {
    assert.equal((await call('ue', 'GET', '/v1/kapazitaet')).json().can.write, false);
    assert.equal((await call('ue', 'PUT', '/v1/kapazitaet', { zellen: [{ rolle: 'ctl', monat: '2027-08', fte: 1 }] })).statusCode, 403);
    for (const who of ['gl', 'pl']) {
      assert.equal((await call(who, 'GET', '/v1/kapazitaet')).statusCode, 403, who);
      assert.equal((await call(who, 'GET', '/v1/auslastung')).statusCode, 403, who);
    }
  });

  test('Auslastung (UC-009 Schritt 5): Angebot gegen Bedarf je Rolle und Monat, Engpässe, Beiträge, Lesesicht', async () => {
    const r = await call('rm', 'GET', '/v1/auslastung?von=2027-04&bis=2027-06');
    assert.equal(r.statusCode, 200, r.body);
    const a = r.json();
    assert.deepEqual(a.monate, ['2027-04', '2027-05', '2027-06']);
    assert.equal(a.szenario, null);
    // Grösse L (ctl) ohne FTE zählt nicht; ctl erscheint wegen des Angebots
    assert.deepEqual(a.rollen.map((x: { rolle: string }) => x.rolle), ['ctl', 'projektleitung']);
    const pl = a.rollen[1].zellen as { angebot: number; bedarf: number; lage: string; beitraege: { projektId: string }[] }[];
    // RM sieht das vertrauliche Projekt nicht (Lesesicht, A-34): 3 + 2,5 FTE
    assert.deepEqual(pl.map(z => [z.angebot, z.bedarf, z.lage]), [[6, 5.5, 'frei'], [5, 5.5, 'ueberbucht'], [5, 5.5, 'ueberbucht']]);
    assert.deepEqual(a.projekte.map((p: { nummer: string }) => p.nummer), ['2026-001', '2026-002']);
    assert.deepEqual(a.engpaesse, [{ rolle: 'projektleitung', quartal: '2027-Q2', monat: '2027-05', bedarf: 5.5, angebot: 5, projekte: 2 }]);

    // UE sieht vertrauliche Projekte nicht ohne projekt:vertraulich; org-admin hat alle Rechte
    const admin = (await call('admin', 'GET', '/v1/auslastung?von=2027-04&bis=2027-04')).json();
    assert.equal(admin.rollen.find((x: { rolle: string }) => x.rolle === 'projektleitung').zellen[0].bedarf, 6.5);

    // ohne Zeitraum: laufender Monat und die elf folgenden
    assert.equal((await call('rm', 'GET', '/v1/auslastung')).json().monate.length, 12);
  });

  test('Auslastung je Szenario: Quelle der Priorisierung (AP-E5-3), unbekanntes Szenario 404', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    assert.equal((await call('rm', 'GET', `/v1/auslastung?szenario=${id}`)).statusCode, 404);
    auslastungModul.szenarioQuelleSetzen(async (_tx, sid) => (sid === id
      ? { id, name: 'Variante B', positionen: [{ projektId: projekt.x, aktiv: false, startMonat: null }, { projektId: projekt.y, aktiv: true, startMonat: '2027-05' }] }
      : null));
    try {
      const s = (await call('rm', 'GET', `/v1/auslastung?von=2027-04&bis=2027-05&szenario=${id}`)).json();
      assert.deepEqual(s.szenario, { id, name: 'Variante B' });
      const pl = s.rollen.find((x: { rolle: string }) => x.rolle === 'projektleitung').zellen;
      assert.deepEqual(pl.map((z: { bedarf: number }) => z.bedarf), [0, 2.5], 'x fällt weg, y beginnt einen Monat später');
      assert.equal((await call('rm', 'GET', `/v1/auslastung?szenario=00000000-0000-4000-8000-000000000002`)).statusCode, 404);
    } finally {
      auslastungModul.szenarioQuelleSetzen(null);
    }
  });
});

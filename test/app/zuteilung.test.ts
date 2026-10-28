/**
 * Bedarfsliste, Zuteilung und Konflikte (AP-E7-2; BC RK.02.02, RK.02.03; UC-009 Schritte 3–4, A1, A2). Abnahme:
 * Zuteilung einzelner Personen nur für RM, UE, die Person selbst und die Projektleitung des eigenen Projekts
 * (darstellung.md), in der API und in der Lesesicht. Dazu: Deckung und «gedeckt» im Register, Mitteilungen an Person und
 * Projektleitung, Konflikte nach Priorität, Lücke melden, Sammelaufgaben. Projekte, die nicht mehr aktiv sind, zählen
 * nicht (UC-015 Schritt 6, A1.2).
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { prioritaetQuelleSetzen } from '../../src/modules/ressource/index.ts';
import { aufgabenNachfuehren } from '../../src/modules/ressource/zuteilung.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, tenant } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

describe('Zuteilung (AP-E7-2)', () => {
  let api: TestApi;
  let T: string;
  const projekt: Record<'x' | 'y', string> = { x: '', y: '' };
  const h: Record<string, Record<string, string>> = {};
  const id: Record<string, string> = {};
  let bedarfX = '', bedarfY = '';

  async function person(sub: string, rolle: string | null, ort?: { type: 'projekt'; id: string }) {
    const l = await login(api, 'acme', sub, ort ? null : rolle);
    if (ort && rolle) await grant(api, T, `user:${l.principalId}`, rolle, ort);
    h[sub] = { authorization: l.authorization };
    id[sub] = l.principalId;
  }
  const call = (who: string, method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      for (const [k, nr] of [['x', '2026-001'], ['y', '2026-002']] as const) {
        projekt[k] = (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, $2, $2, $3, 'P2') RETURNING id", [T, nr, pf])).rows[0]!.id;
      }
    });
    await person('rm', 'rm');
    await person('ue', 'ue');
    await person('gl', 'gl');
    await person('pl-x', 'pl', { type: 'projekt', id: projekt.x });
    await person('pl-y', 'pl', { type: 'projekt', id: projekt.y });
    await person('anna', null);
    await person('ben', null);
    // Projektleitung in der Projektorganisation (für Mitteilungen)
    await full(api.t.runtime, T, async tx => {
      for (const k of ['x', 'y'] as const) await tx.query("INSERT INTO ppm.projekt_person (tenant_id, projekt_id, person_id, funktion) VALUES ($1, $2, $3, 'pl')", [T, projekt[k], id[`pl-${k}`]]);
    });
    const b = async (p: string, fte: number) => (await call('ue', 'POST', `/v1/projekte/${p}/ressourcenbedarf`, { phase: 'P2', rolle: 'ctl', fte, vonMonat: '2027-01', bisMonat: '2027-03' })).json().id as string;
    bedarfX = await b(projekt.x, 1);
    bedarfY = await b(projekt.y, 0.5);
    // Angebot der Rolle: 1,6 FTE im Januar (Pool)
    await full(api.t.runtime, T, tx => tx.query("INSERT INTO ppm.kapazitaet (tenant_id, rolle, monat, fte) VALUES ($1, 'ctl', '2027-01', 1.6)", [T]));
  });
  after(async () => { prioritaetQuelleSetzen(null); await api?.close(); });

  test('Bedarfsliste: offen, Rechte (RM, UE lesen; nur RM teilt zu)', async () => {
    const l = await call('rm', 'GET', '/v1/bedarfe');
    assert.equal(l.statusCode, 200, l.body);
    assert.deepEqual(l.json().items.map((b: { projekt: { nummer: string }; stand: string; benoetigt: number }) => [b.projekt.nummer, b.stand, b.benoetigt]), [['2026-001', 'offen', 3], ['2026-002', 'offen', 1.5]]);
    assert.deepEqual([l.json().anzahl.offen, l.json().can.write], [2, true]);
    assert.equal((await call('ue', 'GET', '/v1/bedarfe')).json().can.write, false);
    assert.equal((await call('gl', 'GET', '/v1/bedarfe')).statusCode, 403);
    assert.equal((await call('ue', 'POST', `/v1/bedarfe/${bedarfX}/zuteilungen`, { personId: id.anna, fte: 0.5 })).statusCode, 403);
  });

  test('Zuteilen deckt den Bedarf, führt «gedeckt» im Register nach und informiert Person und Projektleitung', async () => {
    const z1 = await call('rm', 'POST', `/v1/bedarfe/${bedarfX}/zuteilungen`, { personId: id.anna, fte: 0.5 });
    assert.equal(z1.statusCode, 201, z1.body);
    assert.deepEqual([z1.json().bedarf.stand, z1.json().bedarf.zugeteilt, z1.json().zuteilungen.length], ['teilweise', 1.5, 3]);
    const z2 = await call('rm', 'POST', `/v1/bedarfe/${bedarfX}/zuteilungen`, { personId: id.ben, fte: 0.5 });
    assert.equal(z2.json().bedarf.stand, 'gedeckt');
    const reg = (await call('pl-x', 'GET', `/v1/projekte/${projekt.x}/ressourcenbedarf`)).json().items[0];
    assert.equal(reg.gedeckt, true, 'Register: gedeckt');
    // doppelt, ausserhalb des Bedarfs
    assert.equal((await call('rm', 'POST', `/v1/bedarfe/${bedarfX}/zuteilungen`, { personId: id.ben, fte: 0.5, vonMonat: '2027-02', bisMonat: '2027-02' })).statusCode, 409);
    assert.equal((await call('rm', 'POST', `/v1/bedarfe/${bedarfX}/zuteilungen`, { personId: id.ben, fte: 0.5, vonMonat: '2027-04', bisMonat: '2027-04' })).statusCode, 422);
    const m = await full(api.t.runtime, T, async tx => (await tx.query<{ empfaenger_person: string }>(
      "SELECT empfaenger_person FROM ppm.mitteilung WHERE bezug_typ = 'ressourcenbedarf' AND bezug_id = $1", [bedarfX])).rows.map(r => r.empfaenger_person));
    assert.deepEqual([m.filter(x => x === id.anna).length, m.filter(x => x === id['pl-x']).length, m.filter(x => x === id['pl-y']).length], [1, 2, 0]);
  });

  test('Abnahme: Zuteilung einzelner Personen nur für RM, UE, die Person selbst und die Projektleitung des Projekts', async () => {
    const sieht = async (who: string) => (await call(who, 'GET', `/v1/zuteilungen?projekt=${projekt.x}`)).json().items?.length ?? 0;
    assert.equal(await sieht('rm'), 6);
    assert.equal(await sieht('ue'), 6);
    assert.equal(await sieht('pl-x'), 6);
    assert.equal((await call('pl-y', 'GET', `/v1/zuteilungen?projekt=${projekt.x}`)).statusCode, 403, 'PL eines anderen Projekts sieht das Projekt nicht');
    assert.equal(await sieht('gl'), 0, 'GL sieht das Projekt, aber keine Personen');
    const ich = (await call('anna', 'GET', '/v1/zuteilungen?person=ich')).json().items;
    assert.deepEqual([ich.length, ich.every((z: { personId: string }) => z.personId === id.anna)], [3, true]);
    assert.equal((await call('anna', 'GET', `/v1/zuteilungen?person=${id.ben}`)).statusCode, 403);
    // Lesesicht direkt: ohne Recht keine Zeile
    const zeilen = async (sub: string) => api.iam.tx({ tenantId: T, principalId: id[sub], kind: 'user', subject: sub, subjects: [`user:${id[sub]}`, 'org:members'], scopes: [], groups: [] } as never,
      async tx => (await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM ppm.zuteilung')).rows[0]!.n);
    assert.deepEqual([await zeilen('rm'), await zeilen('anna'), await zeilen('pl-x'), await zeilen('pl-y'), await zeilen('gl')], [6, 3, 6, 0, 0]);
  });

  test('Konflikt: Person über einer Stelle und Pool über dem Angebot, Beteiligte nach Priorität; Auflösen per Anteil', async () => {
    prioritaetQuelleSetzen(async (_tx, ids) => new Map(ids.map(p => [p, { rang: p === projekt.y ? 1 : 2, quelle: 'Rangfolge Test' }])));
    const z = await call('rm', 'POST', `/v1/bedarfe/${bedarfY}/zuteilungen`, { personId: id.anna, fte: 0.75, vonMonat: '2027-01', bisMonat: '2027-01' });
    assert.equal(z.statusCode, 201, z.body);
    const k = z.json().konflikte as { art: string; summe: number; grenze: number; beteiligte: { projekt: { nummer: string } }[] }[];
    assert.deepEqual(k.map(x => [x.art, x.summe, x.grenze]), [['person', 1.25, 1], ['pool', 1.75, 1.6]]);
    assert.deepEqual(k[0]!.beteiligte.map(b => b.projekt.nummer), ['2026-002', '2026-001'], 'höchste Priorität zuerst');
    const liste = (await call('ue', 'GET', '/v1/zuteilungen/konflikte?von=2027-01&bis=2027-03')).json();
    assert.deepEqual([liste.items.length, liste.prioritaetVorhanden], [2, true]);
    const offen = await full(api.t.runtime, T, async tx => (await tx.query("SELECT titel FROM ppm.aufgabe WHERE art = 'konflikt.aufloesen' AND stand = 'offen'")).rows);
    assert.equal(offen.length, 1);

    // Auflösen: Anteil von Anna im Projekt X (tiefere Priorität) auf 0,25
    const zx = (await call('rm', 'GET', `/v1/bedarfe/${bedarfX}`)).json().zuteilungen.find((x: { personId: string; monat: string }) => x.personId === id.anna && x.monat === '2027-01');
    assert.equal((await call('rm', 'PATCH', `/v1/zuteilungen/${zx.id}`, { fte: 0.25 }, { 'if-match': 'W/"7"' })).statusCode, 412);
    const p = await call('rm', 'PATCH', `/v1/zuteilungen/${zx.id}`, { fte: 0.25 }, { 'if-match': `W/"${zx.version}"` });
    assert.equal(p.statusCode, 200, p.body);
    assert.deepEqual([p.json().bedarf.stand, p.json().konflikte.map((x: { art: string }) => x.art)], ['teilweise', []]);
    const erledigt = await full(api.t.runtime, T, async tx => (await tx.query("SELECT stand FROM ppm.aufgabe WHERE art = 'konflikt.aufloesen'")).rows.map(r => r.stand));
    assert.deepEqual(erledigt, ['erledigt']);
  });

  test('Lücke melden: ungedeckt, sichtbar für alle, die das Projekt sehen; zurücknehmen; Sammelaufgabe «Bedarf decken»', async () => {
    const l = await call('rm', 'PUT', `/v1/bedarfe/${bedarfY}/luecke`, { text: 'Keine CTL frei bis April' });
    assert.equal(l.statusCode, 200, l.body);
    assert.deepEqual([l.json().stand, l.json().luecke.text], ['ungedeckt', 'Keine CTL frei bis April']);
    const sicht = await full(api.t.runtime, T, async tx => (await tx.query('SELECT count(*)::int AS n FROM ppm.zuteilung_luecke')).rows[0].n);
    assert.equal(sicht, 1);
    const n = await full(api.t.runtime, T, tx => aufgabenNachfuehren(tx));
    assert.equal(n.offen, 1, 'X teilweise gedeckt, Y als Lücke gemeldet');
    const d = await call('rm', 'DELETE', `/v1/bedarfe/${bedarfY}/luecke`);
    assert.deepEqual([d.statusCode, d.json().stand], [200, 'teilweise']);
    // gedeckter Bedarf: keine Lücke
    const zx = (await call('rm', 'GET', `/v1/bedarfe/${bedarfX}`)).json().zuteilungen.find((x: { personId: string; monat: string }) => x.personId === id.anna && x.monat === '2027-01');
    await call('rm', 'PATCH', `/v1/zuteilungen/${zx.id}`, { fte: 0.5 }, { 'if-match': `W/"${zx.version}"` });
    assert.equal((await call('rm', 'PUT', `/v1/bedarfe/${bedarfX}/luecke`, { text: 'x' })).statusCode, 409);
  });

  test('Personen mit freier Kapazität je Monat des Bedarfs', async () => {
    const r = await call('rm', 'GET', `/v1/bedarfe/${bedarfY}/personen?limit=50`);
    assert.equal(r.statusCode, 200, r.body);
    const anna = r.json().items.find((p: { id: string }) => p.id === id.anna);
    assert.deepEqual(anna.monate.map((m: { monat: string; zugeteilt: number; frei: number }) => [m.monat, m.zugeteilt, m.frei]), [['2027-01', 1.25, -0.25], ['2027-02', 0.5, 0.5], ['2027-03', 0.5, 0.5]]);
  });

  test('Projekt nicht mehr aktiv (UC-015 Schritt 6, A1.2): Bedarf und Zuteilungen zählen nicht, nichts wird gelöscht; Wiederaufnahme zählt wieder', async () => {
    const lebenszyklus = (lz: string) => full(api.t.runtime, T, tx => tx.query('UPDATE ppm.projekt SET lebenszyklus = $2 WHERE id = $1', [projekt.y, lz]));
    const bedarfJan = async () => (await call('rm', 'GET', '/v1/auslastung?von=2027-01&bis=2027-01')).json().rollen.find((x: { rolle: string }) => x.rolle === 'ctl').zellen[0].bedarf;
    const konflikte = async () => (await call('rm', 'GET', '/v1/zuteilungen/konflikte?von=2027-01&bis=2027-03')).json().items.map((k: { art: string }) => k.art);
    const annaJan = async () => (await call('rm', 'GET', `/v1/bedarfe/${bedarfX}/personen?limit=50`)).json().items.find((p: { id: string }) => p.id === id.anna).monate[0].zugeteilt;
    // Zuteilungen der Person, gelesen von RM (sieht die Projekte); wer das Projekt nicht sieht, sieht seinen Lebenszyklus nicht
    const eigene = async () => (await call('rm', 'GET', `/v1/zuteilungen?person=${id.anna}`)).json().items.length;
    // Ausgang: Anna und Pool im Januar mit 0,5 (X) und 0,75 (Y) überbucht
    assert.deepEqual([await bedarfJan(), await konflikte(), await annaJan(), await eigene()], [1.5, ['person', 'pool'], 1.25, 4]);
    const zy = (await call('rm', 'GET', `/v1/bedarfe/${bedarfY}`)).json().zuteilungen[0];

    await lebenszyklus('sistiert');
    const liste = (await call('rm', 'GET', '/v1/bedarfe')).json();
    assert.deepEqual(liste.items.map((b: { projekt: { nummer: string } }) => b.projekt.nummer), ['2026-001'], 'Bedarfsliste ohne Y');
    assert.deepEqual([await bedarfJan(), await konflikte(), await annaJan(), await eigene()], [1, [], 0.5, 3]);
    const zuteilen = await call('rm', 'POST', `/v1/bedarfe/${bedarfY}/zuteilungen`, { personId: id.ben, fte: 0.25 });
    assert.deepEqual([zuteilen.statusCode, zuteilen.json().reason], [409, 'lebenszyklus']);
    assert.equal((await call('rm', 'PATCH', `/v1/zuteilungen/${zy.id}`, { fte: 0.5 }, { 'if-match': `W/"${zy.version}"` })).statusCode, 409);
    assert.equal((await call('rm', 'PUT', `/v1/bedarfe/${bedarfY}/luecke`, { text: 'x' })).statusCode, 409);
    // Projektleitung sieht die Zuteilungen ihres Projekts weiter; Aufgaben ohne Y
    assert.equal((await call('pl-y', 'GET', `/v1/zuteilungen?projekt=${projekt.y}`)).json().items.length, 1);
    assert.equal((await full(api.t.runtime, T, tx => aufgabenNachfuehren(tx))).konflikte, 0);

    // Wiederaufnahme: Bedarf und Zuteilungen zählen wieder (Annahme: nur nicht zählen, nichts löschen)
    await lebenszyklus('aktiv');
    assert.deepEqual([await bedarfJan(), await konflikte(), await annaJan()], [1.5, ['person', 'pool'], 1.25]);

    // Sistiert: Zuteilung entfernen bleibt möglich und führt «gedeckt» nach, damit es nach der Wiederaufnahme stimmt
    const gedecktY = () => full(api.t.runtime, T, async tx => (await tx.query('SELECT gedeckt FROM ppm.ressourcenbedarf WHERE id = $1', [bedarfY])).rows[0].gedeckt);
    const zb = await call('rm', 'POST', `/v1/bedarfe/${bedarfY}/zuteilungen`, { personId: id.ben, fte: 0.5 });
    assert.equal(zb.statusCode, 201, zb.body);
    assert.equal(await gedecktY(), true);
    await lebenszyklus('sistiert');
    for (const z of [zy, ...zb.json().zuteilungen]) {
      const d = await call('rm', 'DELETE', `/v1/zuteilungen/${z.id}`, undefined, { 'if-match': `W/"${z.version}"` });
      assert.equal(d.statusCode, 204, d.body);
    }
    assert.equal(await gedecktY(), false);
    await lebenszyklus('aktiv');
    assert.equal((await call('rm', 'GET', `/v1/bedarfe/${bedarfY}`)).json().bedarf.stand, 'offen');
  });
});

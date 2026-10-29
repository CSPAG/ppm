/**
 * Priorisierungsentscheid (AP-E5-5; UC-008 Schritte 7–8, A2; K5 Schritte 7–8). Abnahme: Der Antrag (Szenario) kommt als
 * Traktandum der Art `priorisierung` ins Gremium; ohne Folgeentscheid je laufendem Projekt unter der Wasserlinie kein
 * Traktandum (K5: «Der Entscheid verlangt für jedes laufende Projekt unter der Wasserlinie einen Folgeentscheid»); der
 * Entscheid in der Sitzung macht Rang und Start zum Ist-Stand, das Szenario «entschieden», informiert Sponsoren und
 * Projektleitungen und leitet Sistieren und Abbrechen ein (Aufgabe an die PL). Ein neues Szenario übernimmt den Start.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { login, person, testApi, type TestApi } from './api.ts';
import { full } from './harness.ts';
import { heute } from '../../src/modules/sitzung/format.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

type H = Record<string, string>;

function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('Priorisierungsentscheid', () => {
  let api: TestApi;
  let tenantId = '';
  let ue: H, adm: H;
  let pf = '', sp = '', pl = '';
  const p: Record<'a' | 'b' | 'c' | 'd', string> = { a: '', b: '', c: '', d: '' };
  const termin = mittwochIn(28);

  const call = (method: string, url: string, headers: H, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (method: string, url: string, headers: H, payload?: unknown, status = 200) => {
    const r = await call(method, url, headers, payload);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return r;
  };
  const mit = (h: H, etag: string): H => ({ ...h, 'if-match': etag });
  const sys = <T>(fn: Parameters<typeof full<T>>[2]) => full(api.t.runtime, tenantId, fn);

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'alle-fuehren');
    tenantId = u.tenantId; ue = { authorization: u.authorization };
    adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };
    [sp, pl] = [await person(api, tenantId, 'u-sp'), await person(api, tenantId, 'u-pl')];
    const pm = await ok('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' }, 201);
    await ok('POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, mit(adm, pm.headers.etag as string));
    pf = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'transformation', name: 'Transformation' }, 201)).json().id;
    const prat = (await ok('POST', '/v1/gremien', ue, { portfolioId: pf, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, 201)).json().id;
    await ok('POST', `/v1/gremien/${prat}/termine`, ue, { datum: termin }, 201);
    await sys(async tx => {
      const neu = (nr: string, phase: string) => tx.query<{ id: string }>(
        "INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, lebenszyklus) VALUES ($1, $2, $2, $3, $4, 'aktiv') RETURNING id", [tenantId, nr, pf, phase]).then(r => r.rows[0]!.id);
      // a, b, c laufend (P2, P1, P3), d in der Initialisierung (P0); Kosten 400k, 400k, 300k, 300k gegen Rahmen 1 Mio.
      p.a = await neu('2026-001', 'P2'); p.b = await neu('2026-002', 'P1'); p.c = await neu('2026-003', 'P3'); p.d = await neu('2026-004', 'P0');
      for (const [id, betrag] of [[p.a, 400000], [p.b, 400000], [p.c, 300000], [p.d, 300000]] as const) {
        await tx.query("INSERT INTO ppm.kosten (tenant_id, projekt_id, phase, art, text, prognose) VALUES ($1, $2, 'P2', 'capex', 'x', $3)", [tenantId, id, betrag]);
      }
      for (const id of Object.values(p)) {
        await tx.query("INSERT INTO ppm.projekt_person (tenant_id, projekt_id, person_id, funktion) VALUES ($1, $2, $3, 'sp'), ($1, $2, $4, 'pl')", [tenantId, id, sp, pl]);
      }
      await tx.query("INSERT INTO ppm.rangfolge (tenant_id, portfolio_id, projekt_id, rang, stand) VALUES ($1, $2, $3, 1, 'entschieden'), ($1, $2, $4, 2, 'entschieden'), ($1, $2, $5, 3, 'entschieden'), ($1, $2, $6, 4, 'entschieden')",
        [tenantId, pf, p.a, p.b, p.c, p.d]);
    });
    const m = (await ok('POST', '/v1/bewertungsmodelle', ue, {}, 201)).json();
    const k = await ok('PATCH', `/v1/bewertungsmodelle/${m.id}`, mit(ue, 'W/"1"'), { budgetrahmen: [{ portfolioId: pf, betrag: 1000000 }] });
    await ok('POST', `/v1/bewertungsmodelle/${m.id}/in-kraft-setzen`, mit(ue, k.headers.etag as string), { beschluss: 'PRAT' });
  });
  after(async () => { await api?.close(); });

  test('Antrag mit Folgeentscheiden traktandieren, Entscheid in der Sitzung übernimmt den Ist-Stand', async () => {
    // Szenario: d vor c → a 400k, b 800k, d 1.1 Mio. → Wasserlinie bei d; d (P0) und c (P3) darunter, laufend nur c
    let s = (await ok('POST', `/v1/portfolios/${pf}/szenarien`, ue, { name: 'B: Initialisierung vorziehen' }, 201)).json();
    s = (await ok('PUT', `/v1/szenarien/${s.id}/positionen`, mit(ue, 'W/"1"'), { positionen: [{ projektId: p.a }, { projektId: p.b, startMonat: '2027-04' }, { projektId: p.d }, { projektId: p.c }] })).json();
    assert.deepEqual(s.positionen.map((x: { nummer: string; ueberWasserlinie: boolean }) => [x.nummer, x.ueberWasserlinie]), [['2026-001', true], ['2026-002', true], ['2026-004', false], ['2026-003', false]]);
    let e = await ok('GET', `/v1/szenarien/${s.id}/entscheid`, ue);
    assert.deepEqual(e.json().unterWasserlinie.map((x: { nummer: string; folge: string | null }) => [x.nummer, x.folge]), [['2026-003', null]], 'nur laufende Projekte (ab P1)');
    assert.equal(e.json().traktandierbar, false);
    assert.equal((await call('POST', `/v1/szenarien/${s.id}/traktandieren`, mit(ue, e.headers.etag as string))).statusCode, 409, 'nicht als Antrag gewählt');
    const a = await ok('POST', `/v1/szenarien/${s.id}/beantragen`, mit(ue, `W/"${s.version}"`), {});
    const ohne = await call('POST', `/v1/szenarien/${s.id}/traktandieren`, mit(ue, a.headers.etag as string));
    assert.equal(ohne.statusCode, 409, ohne.body);
    assert.equal(ohne.json().reason, 'folge_fehlt');
    assert.match(ohne.json().detail ?? ohne.json().title, /Folgeentscheid fehlt: 1 laufendes Projekt liegt unter der Wasserlinie .*\(2026-003\)/);
    assert.equal((await call('PUT', `/v1/szenarien/${s.id}/folgen`, mit(ue, a.headers.etag as string), { folgen: [{ projektId: p.d, folge: 'sistieren' }] })).statusCode, 422, 'd ist nicht laufend');
    e = await ok('PUT', `/v1/szenarien/${s.id}/folgen`, mit(ue, a.headers.etag as string), { folgen: [{ projektId: p.c, folge: 'sistieren', begruendung: 'Kapazität fehlt' }] });
    assert.deepEqual([e.json().traktandierbar, e.json().unterWasserlinie[0].folge], [true, 'sistieren']);
    const t = (await ok('POST', `/v1/szenarien/${s.id}/traktandieren`, mit(ue, e.headers.etag as string))).json();
    assert.equal(t.titel, 'Priorisierung Transformation: Szenario «B: Initialisierung vorziehen»');
    assert.equal(t.antrag, 'Szenario «B: Initialisierung vorziehen» als Ist-Stand wählen: Rang und Start von 4 Projekten, 2 Projekte unter der Wasserlinie.');

    // Sitzung: aufnehmen, versenden, starten, Entscheid «Szenario gewählt»
    const ss = (await ok('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin }, 201)).json();
    let v = (await ok('POST', `/v1/sitzungen/${ss.id}/traktanden`, ue, { vorschlagId: t.traktandumId })).json();
    v = (await ok('POST', `/v1/sitzungen/${ss.id}/versenden`, mit(ue, `W/"${v.version}"`))).json();
    await ok('POST', `/v1/sitzungen/${ss.id}/starten`, mit(ue, `W/"${v.version}"`));
    // versendet: Folgeentscheide und Antrag sind fest bis zum Entscheid
    const vers = await ok('GET', `/v1/szenarien/${s.id}/entscheid`, ue);
    assert.equal(vers.json().traktandiert, true);
    const fest = await call('PUT', `/v1/szenarien/${s.id}/folgen`, mit(ue, vers.headers.etag as string), { folgen: [{ projektId: p.c, folge: 'abbrechen' }] });
    assert.deepEqual([fest.statusCode, fest.json().reason], [409, 'versendet']);
    const anderes = (await ok('POST', `/v1/portfolios/${pf}/szenarien`, ue, { name: 'Z' }, 201)).json();
    const ersetzt = await call('POST', `/v1/szenarien/${anderes.id}/beantragen`, mit(ue, 'W/"1"'), {});
    assert.deepEqual([ersetzt.statusCode, ersetzt.json().reason], [409, 'versendet']);
    await ok('POST', `/v1/szenarien/${anderes.id}/verwerfen`, mit(ue, 'W/"1"'));
    await ok('PUT', `/v1/traktanden/${t.traktandumId}/entscheid`, ue, { ergebnis: 'szenario_gewaehlt', begruendung: 'Initialisierung hat Vorrang' });

    const ist = await sys(async tx => (await tx.query<{ projekt_id: string; rang: number; start_monat: string | null }>(
      "SELECT projekt_id, rang, start_monat FROM ppm.rangfolge WHERE portfolio_id = $1 AND stand = 'entschieden' ORDER BY rang", [pf])).rows);
    assert.deepEqual(ist.map(r => [r.projekt_id, r.rang, r.start_monat]), [[p.a, 1, null], [p.b, 2, '2027-04'], [p.d, 3, null], [p.c, 4, null]]);
    assert.equal((await ok('GET', `/v1/szenarien/${s.id}`, ue)).json().stand, 'entschieden');
    const auf = await sys(async tx => (await tx.query<{ art: string; empfaenger_person: string; titel: string }>(
      "SELECT art, empfaenger_person, titel FROM ppm.aufgabe WHERE art LIKE 'priorisierung.%' AND stand = 'offen'")).rows);
    assert.deepEqual(auf.map(x => [x.art, x.empfaenger_person, x.titel]), [['priorisierung.sistieren', pl, 'Sistierung von 2026-003 2026-003 einleiten']]);
    const mt = await sys(async tx => (await tx.query<{ text: string }>('SELECT text FROM ppm.mitteilung WHERE empfaenger_person = $1 ORDER BY created_at', [pl])).rows.map(r => r.text));
    assert.ok(mt.some(x => x === 'Priorisierung Transformation: Das Gremium hat das Szenario «B: Initialisierung vorziehen» gewählt. Rang oder Start ändern sich für 2026-002, 2026-004, 2026-003.'), mt.join('\n'));
    assert.ok(mt.some(x => x === 'Priorisierung Transformation: 2026-003 2026-003 liegt unter der Wasserlinie. Entscheid des Gremiums: Sistieren.'), mt.join('\n'));
    const audit = await sys(async tx => (await tx.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE action IN ('szenario.consequences_proposed', 'szenario.scheduled', 'szenario.decided', 'szenario.decision_corrected') ORDER BY seq")).rows.map(x => x.action));
    assert.deepEqual(audit, ['szenario.consequences_proposed', 'szenario.scheduled', 'szenario.decided']);

    // Korrektur in der Sitzung (A-30): der übernommene Ist-Stand bleibt, auch wenn sich Daten inzwischen ändern
    await sys(tx => tx.query("UPDATE ppm.kosten SET prognose = 5000000 WHERE projekt_id = $1", [p.a]));
    const ent = await sys(async tx => (await tx.query<{ version: number }>('SELECT version FROM ppm.entscheid WHERE traktandum_id = $1', [t.traktandumId])).rows[0]!);
    await ok('PUT', `/v1/traktanden/${t.traktandumId}/entscheid`, mit(ue, `W/"${ent.version}"`), { ergebnis: 'szenario_gewaehlt', begruendung: 'Initialisierung hat Vorrang (präzisiert)' });
    const nachher = await sys(async tx => (await tx.query<{ projekt_id: string }>(
      "SELECT projekt_id FROM ppm.rangfolge WHERE portfolio_id = $1 AND stand = 'entschieden' ORDER BY rang", [pf])).rows.map(r => r.projekt_id));
    assert.deepEqual(nachher, [p.a, p.b, p.d, p.c]);
    await sys(tx => tx.query("UPDATE ppm.kosten SET prognose = 400000 WHERE projekt_id = $1", [p.a]));

    // ein neues Szenario kopiert den neuen Ist-Stand mit Start
    const neu = (await ok('POST', `/v1/portfolios/${pf}/szenarien`, ue, { name: 'C' }, 201)).json();
    assert.deepEqual(neu.positionen.map((x: { nummer: string; startMonat: string | null }) => [x.nummer, x.startMonat]), [['2026-001', null], ['2026-002', '2027-04'], ['2026-004', null], ['2026-003', null]]);
  });

  test('Ein neuer Antrag nimmt das noch nicht versendete Traktandum des bisherigen zurück', async () => {
    const x = (await ok('POST', `/v1/portfolios/${pf}/szenarien`, ue, { name: 'D' }, 201)).json();
    const a = await ok('POST', `/v1/szenarien/${x.id}/beantragen`, mit(ue, 'W/"1"'), {});
    const f = await ok('PUT', `/v1/szenarien/${x.id}/folgen`, mit(ue, a.headers.etag as string), { folgen: [{ projektId: p.c, folge: 'zurueckstellen' }] });
    await ok('POST', `/v1/szenarien/${x.id}/traktandieren`, mit(ue, f.headers.etag as string));
    const offen = () => sys(async tx => (await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM ppm.traktandum WHERE art = 'priorisierung' AND bezug_id = $1", [x.id])).rows[0]!.n);
    assert.equal(await offen(), 1);
    const y = (await ok('POST', `/v1/portfolios/${pf}/szenarien`, ue, { name: 'E' }, 201)).json();
    await ok('POST', `/v1/szenarien/${y.id}/beantragen`, mit(ue, 'W/"1"'), {});
    assert.equal(await offen(), 0);
  });
});

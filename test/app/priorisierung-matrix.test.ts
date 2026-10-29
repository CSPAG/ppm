/**
 * Portfolio-Matrix und Rangfolge (AP-E5-2; BC PP.03.04, PP.02.02, PP.02.03; UC-008 Schritte 1, 3–4): Nutzen und Risiko
 * aus der Bewertung nach der angezeigten Zuordnung (A-39, ohne Score A-01), Felder nach Q6 F9, Ressourcenbedarf, Kosten
 * nur mit finanzen:read (A-33), Abhängigkeiten als Linien, Rangfolge als Entwurf mit If-Match, Rechte.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { achse, feld, ressourcen } from '../../src/modules/priorisierung/matrix.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, tenant } from './harness.ts';

describe('Einordnung in die Matrix (ohne Datenbank)', () => {
  const b = (o: Record<string, 'hoch' | 'mittel' | 'tief'>) => new Map(Object.entries(o));
  test('Durchschnitt je Achse, Grenze bei mittel, fehlende Bewertung', () => {
    assert.deepEqual(achse(['a', 'b'], b({ a: 'hoch', b: 'mittel' })), { wert: 2.5, stufe: 'hoch', bewertet: 2, von: 2 });
    assert.deepEqual(achse(['a', 'b', 'c'], b({ a: 'tief', b: 'mittel' })), { wert: 1.5, stufe: 'tief', bewertet: 2, von: 3 });
    assert.deepEqual(achse(['a', 'b'], b({ a: 'hoch', b: 'tief' })), { wert: 2, stufe: 'grenze', bewertet: 2, von: 2 });
    assert.deepEqual(achse(['a'], b({})), { wert: null, stufe: null, bewertet: 0, von: 1 });
    assert.deepEqual(achse([], b({ a: 'hoch' })), { wert: null, stufe: null, bewertet: 0, von: 0 });
  });
  test('Felder nach Q6 F9; auf der Grenze oder unbewertet kein Feld', () => {
    const a = (stufe: 'hoch' | 'tief' | 'grenze' | null) => ({ wert: 0, stufe, bewertet: 1, von: 1 });
    assert.equal(feld(a('hoch'), a('hoch')), 'priorisieren');
    assert.equal(feld(a('hoch'), a('tief')), 'rasch_umsetzen');
    assert.equal(feld(a('tief'), a('tief')), 'opportunistisch');
    assert.equal(feld(a('tief'), a('hoch')), 'hinterfragen');
    assert.equal(feld(a('grenze'), a('hoch')), null);
    assert.equal(feld(a(null), a('hoch')), null);
  });
  test('Ressourcen: FTE × Monate und grösste Grösse', () => {
    assert.deepEqual(ressourcen([{ fte: 0.5, vonMonat: '2026-11', bisMonat: '2027-02' }, { fte: 1, vonMonat: '2027-01', bisMonat: '2027-01' }, { groesse: 'S' }, { groesse: 'L' }]), { fteMonate: 3, groesse: 'L' });
    assert.deepEqual(ressourcen([]), { fteMonate: null, groesse: null });
  });
});

// Tests mit Datenbank: ohne Konfiguration einzeln übersprungen, konfiguriert und nicht erreichbar scheitert der Lauf
const db = dbTests(await postgresSkip());

db.describe('Matrix und Rangfolge (API)', () => {
  let api: TestApi;
  let T: string;
  let pf: string, pfB: string;
  const p: Record<'a' | 'b' | 'c' | 'd' | 'z', string> = { a: '', b: '', c: '', d: '', z: '' };
  const h: Record<string, Record<string, string>> = {};

  async function person(sub: string, rolle: string, ort: { type: 'org' } | { type: 'portfolio'; id: string } = { type: 'org' }) {
    const l = await login(api, 'acme', sub, null);
    await grant(api, T, `user:${l.principalId}`, rolle, ort);
    return { authorization: l.authorization };
  }
  const call = (who: string, method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  db.before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      pfB = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'B', 'gl', 'Geschäftsleitung', true) RETURNING id", [T])).rows[0]!.id;
      const neu = (nr: string, portfolio: string, lz = 'aktiv') => tx.query<{ id: string }>(
        'INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, lebenszyklus) VALUES ($1, $2, $2, $3, $4, $5) RETURNING id', [T, nr, portfolio, 'P1', lz]).then(r => r.rows[0]!.id);
      p.a = await neu('2026-001', pf); p.b = await neu('2026-002', pf); p.c = await neu('2026-003', pf); p.d = await neu('2026-004', pf, 'abgeschlossen');
      p.z = await neu('2026-010', pfB);
      // Register: Ressourcenbedarf, Kosten, Abhängigkeit a → b (a braucht b)
      await tx.query("INSERT INTO ppm.ressourcenbedarf (tenant_id, projekt_id, phase, rolle, fte, von_monat, bis_monat) VALUES ($1, $2, 'P2', 'pl', 0.5, '2027-01', '2027-04')", [T, p.a]);
      await tx.query("INSERT INTO ppm.ressourcenbedarf (tenant_id, projekt_id, phase, rolle, groesse) VALUES ($1, $2, 'P3', 'ctl', 'M')", [T, p.a]);
      await tx.query("INSERT INTO ppm.kosten (tenant_id, projekt_id, phase, art, text, prognose) VALUES ($1, $2, 'P1', 'capex', 'Server', 120000), ($1, $2, 'P2', 'opex', 'Betrieb', 30000)", [T, p.a]);
      await tx.query("INSERT INTO ppm.abhaengigkeit (tenant_id, projekt_id, zu_projekt_id, text) VALUES ($1, $2, $3, 'braucht die Plattform'), ($1, $2, $4, 'ausserhalb')", [T, p.a, p.b, p.z]);
    });
    h.ue = await person('ue', 'alle-fuehren');
    h.gremium = await person('gremium', 'gremium', { type: 'portfolio', id: pf });
    h.rm = await person('rm', 'mitglied');
    // Modell in Kraft: zwei Kriterien Nutzen, zwei Risiko, eines ohne Zuordnung
    const m = (await call('ue', 'POST', '/v1/bewertungsmodelle', {})).json();
    const k = await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m.id}`, { kriterien: [
      { schluessel: 'strategie', text: 'Strategiebeitrag', dimension: 'nutzen' }, { schluessel: 'transformation', text: 'Transformationsrelevanz', dimension: 'nutzen' },
      { schluessel: 'komplexitaet', text: 'Komplexität', dimension: 'risiko' }, { schluessel: 'finanzierung', text: 'Finanzierungsbedarf', dimension: 'risiko' },
      { schluessel: 'change', text: 'Change-Aufwand', dimension: null },
    ] }, { 'if-match': 'W/"1"' });
    assert.equal(k.statusCode, 200, k.body);
    assert.equal((await call('ue', 'POST', `/v1/bewertungsmodelle/${m.id}/in-kraft-setzen`, { beschluss: 'PRAT' }, { 'if-match': 'W/"2"' })).statusCode, 200);
    const z = (projektId: string, kriterium: string, einschaetzung: string) => ({ projektId, kriterium, einschaetzung });
    const r = await call('ue', 'PUT', `/v1/portfolios/${pf}/bewertungen`, { zellen: [
      // a: Nutzen 3, Risiko 2.5 → priorisieren; b: Nutzen 2.5, Risiko 1 → rasch umsetzen; c: Nutzen 2 (Grenze), Risiko 3
      z(p.a, 'strategie', 'hoch'), z(p.a, 'transformation', 'hoch'), z(p.a, 'komplexitaet', 'hoch'), z(p.a, 'finanzierung', 'mittel'), z(p.a, 'change', 'tief'),
      z(p.b, 'strategie', 'hoch'), z(p.b, 'transformation', 'mittel'), z(p.b, 'komplexitaet', 'tief'),
      z(p.c, 'strategie', 'hoch'), z(p.c, 'transformation', 'tief'), z(p.c, 'komplexitaet', 'hoch'), z(p.c, 'finanzierung', 'hoch'),
    ] });
    assert.equal(r.statusCode, 200, r.body);
  });
  db.after(async () => { await api?.close(); });

  db.test('Matrix (PP.03.04): Nutzen und Risiko nach Zuordnung, Felder, Ressourcen, Kosten, Abhängigkeiten', async () => {
    const r = await call('ue', 'GET', `/v1/portfolios/${pf}/matrix`);
    assert.equal(r.statusCode, 200, r.body);
    const m = r.json();
    assert.equal(m.modell.nummer, 1);
    assert.deepEqual(m.modell.kriterien.map((k: { schluessel: string; dimension: string | null }) => [k.schluessel, k.dimension]),
      [['strategie', 'nutzen'], ['transformation', 'nutzen'], ['komplexitaet', 'risiko'], ['finanzierung', 'risiko'], ['change', null]]);
    assert.equal(m.kostenSichtbar, true);
    const x = Object.fromEntries(m.projekte.map((q: { nummer: string }) => [q.nummer, q]));
    assert.deepEqual(Object.keys(x), ['2026-001', '2026-002', '2026-003'], 'nur aktive Projekte');
    assert.deepEqual([x['2026-001'].nutzen, x['2026-001'].risiko, x['2026-001'].feld], [{ wert: 3, stufe: 'hoch', bewertet: 2, von: 2 }, { wert: 2.5, stufe: 'hoch', bewertet: 2, von: 2 }, 'priorisieren']);
    assert.deepEqual([x['2026-002'].nutzen.wert, x['2026-002'].risiko, x['2026-002'].feld], [2.5, { wert: 1, stufe: 'tief', bewertet: 1, von: 2 }, 'rasch_umsetzen']);
    assert.deepEqual([x['2026-003'].nutzen.stufe, x['2026-003'].feld], ['grenze', null]);
    assert.deepEqual(x['2026-001'].ressourcen, { fteMonate: 2, groesse: 'M' });
    assert.equal(x['2026-001'].kosten, 150000);
    assert.equal(x['2026-002'].kosten, 0);
    assert.deepEqual(x['2026-001'].abhaengigVon, [p.b], 'nur Abhängigkeiten im Portfolio');
    assert.equal(x['2026-001'].rang, null);
  });

  db.test('Rangfolge (PP.02.02): Entwurf mit Begründung, If-Match, nur aktive Projekte des Portfolios; Rang in der Matrix', async () => {
    const leer = await call('ue', 'GET', `/v1/portfolios/${pf}/rangfolge`);
    assert.deepEqual([leer.json().version, leer.json().entwurf, leer.json().can.write, leer.headers.etag], [0, [], true, 'W/"0"']);
    const put = (body: unknown, v: string) => call('ue', 'PUT', `/v1/portfolios/${pf}/rangfolge`, body, { 'if-match': v });
    assert.equal((await call('ue', 'PUT', `/v1/portfolios/${pf}/rangfolge`, { projekte: [] })).statusCode, 428);
    for (const projekte of [[{ projektId: p.d }], [{ projektId: p.z }], [{ projektId: p.a }, { projektId: p.a }]]) {
      assert.equal((await put({ projekte }, 'W/"0"')).statusCode, 422, JSON.stringify(projekte));
    }
    const r = await put({ projekte: [{ projektId: p.b, begruendung: ' Plattform zuerst ' }, { projektId: p.a }, { projektId: p.c }] }, 'W/"0"');
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json().entwurf, [{ projektId: p.b, rang: 1, begruendung: 'Plattform zuerst' }, { projektId: p.a, rang: 2, begruendung: '' }, { projektId: p.c, rang: 3, begruendung: '' }]);
    assert.equal(r.headers.etag, 'W/"1"');
    assert.equal((await put({ projekte: [] }, 'W/"0"')).statusCode, 412);
    const m = (await call('ue', 'GET', `/v1/portfolios/${pf}/matrix`)).json();
    assert.deepEqual(m.projekte.map((q: { rangEntwurf: number | null; rang: number | null }) => [q.rangEntwurf, q.rang]), [[2, null], [1, null], [3, null]]);
    const z = await put({ projekte: [{ projektId: p.a }] }, 'W/"1"');
    assert.deepEqual([z.json().version, z.json().entwurf.length], [2, 1]);
    const audit = await full(api.t.runtime, T, async tx => (await tx.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE action LIKE 'rangfolge.%' ORDER BY seq")).rows.map(x => x.action));
    assert.deepEqual(audit, ['rangfolge.drafted', 'rangfolge.drafted']);
  });

  db.test('Rechte: Gremium liest Matrix und Rangfolge seines Portfolios, ändert nichts; RM sieht die Priorisierung nicht', async () => {
    const m = await call('gremium', 'GET', `/v1/portfolios/${pf}/matrix`);
    assert.equal(m.statusCode, 200, m.body);
    assert.equal(m.json().modell.nummer, 1, 'Modell lesbar mit Recht am Portfolio');
    assert.equal(m.json().kostenSichtbar, true, 'Gremium hat finanzen:read am Portfolio');
    assert.equal((await call('gremium', 'GET', `/v1/portfolios/${pfB}/matrix`)).statusCode, 403);
    assert.equal((await call('gremium', 'GET', `/v1/portfolios/${pf}/rangfolge`)).json().can.write, false);
    assert.equal((await call('gremium', 'PUT', `/v1/portfolios/${pf}/rangfolge`, { projekte: [] }, { 'if-match': 'W/"2"' })).statusCode, 403);
    assert.equal((await call('rm', 'GET', `/v1/portfolios/${pf}/matrix`)).statusCode, 403);
    assert.equal((await call('ue', 'GET', '/v1/portfolios/00000000-0000-4000-8000-000000000099/matrix')).statusCode, 404);
  });
});

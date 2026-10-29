/**
 * Statusbericht erfassen (BC PS.01.01, UC-004, Kernablauf K1, AP-E1-1): Vorbelegung aus der Vorperiode ohne Status und
 * Trend, Entwurf mit ETag, Pflichtangaben beim Einreichen, «kritisch» mit Begründung und Massnahme (A2), nur lesbar nach
 * dem Einreichen, Rückgängig innert 10 s, Sperren (Periode abgeschlossen, Phase P4, Zukunft), Rechte am Projekt, Audit
 * und Ereignis, Folgen für die Erweiterungen.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { folgen } from '../../src/modules/statusbericht/index.ts';
import { full } from './harness.ts';
import { grant, login, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

/** Laufende Periode und Vormonat nach Schweizer Zeit. */
const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
const PERIODE = heute.slice(0, 7);
const VORPERIODE = (() => { const [j, m] = PERIODE.split('-').map(Number) as [number, number]; return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`; })();
const NAECHSTE = (() => { const [j, m] = PERIODE.split('-').map(Number) as [number, number]; return m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, '0')}`; })();

const VOLL = {
  status: 'im_plan', trend: 'gleichbleibend',
  abweichung: Object.fromEntries(['inhalt', 'termin', 'ressourcen', 'budget'].map(d => [d, { stufe: 'keine', kommentar: '' }])),
};

describe('Statusbericht erfassen', () => {
  let api: TestApi;
  let T = '';
  let pl: Record<string, string>, pl2: Record<string, string>, admin: Record<string, string>, kt: Record<string, string>, fremd: Record<string, string>, ue: Record<string, string>;
  let plId = '';
  const projekt: Record<string, string> = {};
  const eingereicht: string[] = [];

  before(async () => {
    api = await testApi();
    folgen.beimEinreichen(async (_tx, r) => { eingereicht.push(r.id); });
    const u = await login(api, 'demo', 'u-ue', 'alle-fuehren');
    T = u.tenantId;
    ue = { authorization: u.authorization };
    await full(api.t.runtime, T, async tx => {
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      for (const [nr, phase] of [['2026-001', 'P2'], ['2026-002', 'P1'], ['2026-003', 'P4']] as const) {
        projekt[nr] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, $2, $3, $4, $5) RETURNING id', [T, nr, `Projekt ${nr}`, pf, phase])).rows[0]!.id;
      }
    });
    const p = await login(api, 'demo', 'u-pl', null);
    plId = p.principalId;
    pl = { authorization: p.authorization };
    for (const nr of ['2026-001', '2026-003']) await grant(api, T, `user:${p.principalId}`, 'projekt-fuehren', { type: 'projekt', id: projekt[nr] });
    const k = await login(api, 'demo', 'u-kt', null);
    await grant(api, T, `user:${k.principalId}`, 'projekt-mitlesen', { type: 'projekt', id: projekt['2026-001'] });
    kt = { authorization: k.authorization };
    fremd = { authorization: (await login(api, 'demo', 'u-fremd', null)).authorization };
    admin = { authorization: (await login(api, 'demo', 'u-admin', 'org-admin')).authorization };
    const p2 = await login(api, 'demo', 'u-pl2', null);
    await grant(api, T, `user:${p2.principalId}`, 'projekt-fuehren', { type: 'projekt', id: projekt['2026-001'] });
    pl2 = { authorization: p2.authorization };
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const url = (nr: string, periode = PERIODE, nach = '') => `/v1/projekte/${projekt[nr]}/berichte/${periode}${nach}`;

  test('Vorbelegung aus der Vorperiode, ausser Status und Trend (UC-004 Schritt 1, K1)', async () => {
    // Vorperiode: eingereichter Bericht «kritisch» mit Begründung (direkt, wie aus einem früheren Monat)
    await full(api.t.runtime, T, async tx => {
      await tx.query("INSERT INTO ppm.periode (tenant_id, periode) VALUES ($1, $2)", [T, VORPERIODE]);
      await tx.query(
        `INSERT INTO ppm.statusbericht (tenant_id, projekt_id, periode, stand, status, trend, phase, abschluss_per, naechster_meilenstein, abweichung, abhaengigkeiten, entscheide, begruendung, massnahme, entscheid_noetig, eingereicht_at)
         VALUES ($1, $2, $3, 'geprueft', 'kritisch', 'abwaerts', 'P2', '2027-06-30', 'Abnahme Pilot', $4, 'Projekt 2026-002', 'Budget P3', 'Lieferverzug', 'Zweiter Lieferant', true, now())`,
        [T, projekt['2026-001'], VORPERIODE, JSON.stringify({ termin: { stufe: 'gering', kommentar: '+2 Wochen' } })]);
    });
    const g = await call('GET', url('2026-001'), pl);
    assert.equal(g.statusCode, 200, g.body);
    assert.equal(g.headers.etag, 'W/"0"');
    const b = g.json();
    assert.deepEqual([b.id, b.version, b.stand, b.periodeStand, b.phase, b.projektNummer], [null, 0, 'entwurf', 'offen', 'P2', '2026-001']);
    assert.deepEqual([b.status, b.trend, b.entscheidNoetig], [null, null, false], 'Status und Trend jeden Monat bewusst gewählt');
    assert.deepEqual([b.abschlussPer, b.naechsterMeilenstein, b.abhaengigkeiten, b.entscheide, b.begruendung, b.massnahme],
      ['2027-06-30', 'Abnahme Pilot', 'Projekt 2026-002', 'Budget P3', 'Lieferverzug', 'Zweiter Lieferant']);
    assert.deepEqual(b.abweichung.termin, { stufe: 'gering', kommentar: '+2 Wochen' });
    assert.deepEqual(b.abweichung.budget, { stufe: null, kommentar: '' });
    assert.deepEqual(b.vorperiode, { periode: VORPERIODE, status: 'kritisch', trend: 'abwaerts', stand: 'geprueft' });
    assert.deepEqual(b.fehlend.map((f: { feld: string }) => f.feld), ['abweichung.inhalt', 'abweichung.ressourcen', 'abweichung.budget', 'status', 'trend']);
    assert.deepEqual(b.can, { write: true, einreichen: false, zurueckziehen: false, eskalieren: true });

    const k = await call('GET', url('2026-001'), kt);
    assert.equal(k.statusCode, 200);
    assert.deepEqual(k.json().can, { write: false, einreichen: false, zurueckziehen: false, eskalieren: false });
    assert.equal((await call('GET', url('2026-001'), fremd)).statusCode, 403, 'ohne Rolle am Projekt');
  });

  test('Entwurf speichern mit ETag, einreichen mit Pflichtangaben, danach änderbar mit Markierung (A-75)', async () => {
    assert.equal((await call('PUT', url('2026-001'), pl, { trend: 'aufwaerts' })).statusCode, 428);
    assert.equal((await call('PUT', url('2026-001'), { ...kt, 'if-match': 'W/"0"' }, { trend: 'aufwaerts' })).statusCode, 403);
    const c = await call('PUT', url('2026-001'), { ...pl, 'if-match': 'W/"0"', 'x-request-id': 'req-bericht' }, { trend: 'aufwaerts', abhaengigkeiten: '  keine  ' });
    assert.equal(c.statusCode, 200, c.body);
    const b = c.json();
    assert.equal(c.headers.etag, 'W/"1"');
    assert.deepEqual([b.version, b.trend, b.abhaengigkeiten, b.naechsterMeilenstein, b.status], [1, 'aufwaerts', 'keine', 'Abnahme Pilot', null], 'Vorbelegung gespeichert');
    assert.deepEqual(b.can, { write: true, einreichen: true, zurueckziehen: false, eskalieren: true });
    assert.equal((await call('PUT', url('2026-001'), { ...pl, 'if-match': 'W/"0"' }, { trend: 'abwaerts' })).statusCode, 412);

    const leer = await call('POST', url('2026-001', PERIODE, '/einreichen'), { ...pl, 'if-match': 'W/"1"' });
    assert.equal(leer.statusCode, 422, leer.body);
    assert.match(leer.json().detail, /^Angaben fehlen: Beurteilung Inhalt, Beurteilung Ressourcen, Beurteilung Budget und Status sind leer\./);
    assert.deepEqual(leer.json().errors.map((e: { path: string }) => e.path), ['/abweichung/inhalt', '/abweichung/ressourcen', '/abweichung/budget', '/status']);

    // Kritisch verlangt Begründung und Massnahme (A2); die Vorbelegung wird geleert
    const kr = await call('PUT', url('2026-001'), { ...pl, 'if-match': 'W/"1"' }, { ...VOLL, status: 'kritisch', begruendung: '', massnahme: ' ', entscheidNoetig: true });
    assert.equal(kr.statusCode, 200, kr.body);
    assert.deepEqual(kr.json().fehlend.map((f: { feld: string }) => f.feld), ['begruendung', 'massnahme']);
    assert.equal((await call('POST', url('2026-001', PERIODE, '/einreichen'), { ...pl, 'if-match': 'W/"2"' })).statusCode, 422);
    // Zurück auf «im Plan»: «Entscheid des PRAT nötig» entfällt
    const ip = await call('PUT', url('2026-001'), { ...pl, 'if-match': 'W/"2"' }, { status: 'im_plan' });
    assert.equal(ip.json().entscheidNoetig, false);
    assert.deepEqual(ip.json().fehlend, []);

    const e = await call('POST', url('2026-001', PERIODE, '/einreichen'), { ...pl, 'if-match': 'W/"3"', 'x-request-id': 'req-einreichen' });
    assert.equal(e.statusCode, 200, e.body);
    const s = e.json();
    assert.deepEqual([s.stand, s.version, s.eingereichtBy, s.phase], ['eingereicht', 4, plId, 'P2']);
    assert.ok(s.eingereichtAt);
    // nach dem Einreichen bleibt der Bericht änderbar (UC-004 A4, A-75); einreichen und eskalieren nicht mehr
    assert.deepEqual(s.can, { write: true, einreichen: false, zurueckziehen: true, eskalieren: false });
    assert.deepEqual(eingereicht, [s.id], 'Folgen der Erweiterungen in derselben Transaktion');


    const rows = await full(api.t.runtime, T, async tx => ({
      audit: (await tx.query('SELECT action, correlation_id FROM ppm.audit_log WHERE resource_id = $1', [s.id])).rows,
      events: (await tx.query('SELECT type FROM ppm.outbox_event WHERE subject = $1', [`statusbericht/${s.id}`])).rows,
    }));
    assert.deepEqual(rows.audit.map(a => a.action).sort(), ['statusbericht.created', 'statusbericht.submitted', 'statusbericht.updated', 'statusbericht.updated'].sort());
    assert.ok(rows.audit.some(a => a.action === 'statusbericht.submitted' && a.correlation_id === 'req-einreichen'));
    assert.equal(rows.events.filter(x => x.type === 'statusbericht.submitted').length, 1);

    const list = await call('GET', `/v1/projekte/${projekt['2026-001']}/berichte`, kt);
    assert.deepEqual(list.json().items.map((x: { periode: string; stand: string }) => [x.periode, x.stand]), [[PERIODE, 'eingereicht'], [VORPERIODE, 'geprueft']]);

    // Kopfkarte «Meine Projekte»: letzter Bericht und laufende Periode; P4 berichtet nicht; fremdes Projekt entfällt
    const q = ['2026-001', '2026-002', '2026-003'].map(nr => `projektId=${projekt[nr]}`).join('&');
    const st = await call('GET', `/v1/statusberichte/stand?${q}`, pl);
    assert.equal(st.statusCode, 200, st.body);
    const items = st.json().items as { projektId: string; letzter: { periode: string; status: string; trend: string } | null; laufend: { periode: string; stand: string | null } | null }[];
    assert.deepEqual(items.map(i => i.projektId), [projekt['2026-001'], projekt['2026-003']]);
    assert.deepEqual(items[0]!.letzter && [items[0]!.letzter.periode, items[0]!.letzter.status, items[0]!.letzter.trend], [PERIODE, 'im_plan', 'gleichbleibend']);
    assert.deepEqual(items[0]!.laufend && [items[0]!.laufend.periode, items[0]!.laufend.stand], [PERIODE, 'eingereicht']);
    assert.equal(items[1]!.laufend, null, 'P4 berichtet nicht monatlich');
    assert.equal((await call('GET', `/v1/statusberichte/stand?${q}`, fremd)).statusCode, 403);
  });

  test('Rückgängig innert 10 s durch die einreichende Person (K1 Schritt 8)', async () => {
    const r = await call('POST', url('2026-001', PERIODE, '/zurueckziehen'), { ...pl2, 'if-match': 'W/"4"' });
    assert.equal(r.statusCode, 409, 'nur wer eingereicht hat');
    const z = await call('POST', url('2026-001', PERIODE, '/zurueckziehen'), { ...pl, 'if-match': 'W/"4"' });
    assert.equal(z.statusCode, 200, z.body);
    assert.deepEqual([z.json().stand, z.json().eingereichtAt, z.json().version], ['entwurf', null, 5]);
    assert.deepEqual(z.json().can, { write: true, einreichen: true, zurueckziehen: false, eskalieren: true });

    assert.equal((await call('POST', url('2026-001', PERIODE, '/einreichen'), { ...pl, 'if-match': 'W/"5"' })).statusCode, 200);
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.statusbericht SET eingereicht_at = now() - interval '1 minute' WHERE projekt_id = $1 AND periode = $2", [projekt['2026-001'], PERIODE]));
    const spaet = await call('POST', url('2026-001', PERIODE, '/zurueckziehen'), { ...pl, 'if-match': 'W/"7"' });
    assert.equal(spaet.statusCode, 409, spaet.body);
    assert.equal(spaet.json().reason, 'rueckgaengig');
    assert.equal((await call('GET', url('2026-001'), pl)).json().can.zurueckziehen, false);

    // Änderung nach dem Einreichen (UC-004 A4, A-75): gespeichert, markiert, Stand bleibt; zweites Einreichen nicht nötig
    const g = await call('GET', url('2026-001'), pl);
    const n = await call('PUT', url('2026-001'), { ...pl, 'if-match': g.headers.etag as string }, { trend: 'abwaerts' });
    assert.equal(n.statusCode, 200, n.body);
    assert.deepEqual([n.json().stand, n.json().trend, n.json().geaendertNach?.art, n.json().geaendertNach?.text], ['eingereicht', 'abwaerts', 'einreichen', 'geändert nach Einreichen']);
    assert.equal((await call('POST', url('2026-001', PERIODE, '/einreichen'), { ...pl, 'if-match': `W/"${n.json().version}"` })).json().reason, 'stand');
    const v = await call('GET', url('2026-001', PERIODE, '/verlauf'), kt);
    assert.equal(v.statusCode, 200, v.body);
    assert.ok(v.json().items.some((x: { text: string }) => x.text === 'geändert nach Einreichen'));
  });

  test('Sperren: Rolle nur am eigenen Projekt, Phase P4, Zukunft; nach dem Abschluss markiert statt gesperrt', async () => {
    assert.equal((await call('PUT', url('2026-002'), { ...pl, 'if-match': 'W/"0"' }, { trend: 'aufwaerts' })).statusCode, 403, 'Projekt ohne Rolle');
    const p4 = await call('PUT', url('2026-003'), { ...pl, 'if-match': 'W/"0"' }, { trend: 'aufwaerts' });
    assert.equal(p4.statusCode, 409);
    assert.equal(p4.json().reason, 'phase');
    assert.equal((await call('GET', url('2026-003'), pl)).json().can.write, false);
    const z = await call('PUT', url('2026-001', NAECHSTE), { ...pl, 'if-match': 'W/"0"' }, { trend: 'aufwaerts' });
    assert.equal(z.statusCode, 409);
    assert.equal(z.json().reason, 'zukunft');
    assert.equal((await call('GET', `/v1/projekte/${projekt['2026-001']}/berichte/2026-13`, pl)).statusCode, 422);

    // Vorperiode abgeschlossen: Änderung bleibt möglich, markiert «geändert nach Abschluss», geprüft → wieder eingereicht (UC-005 A4, A-75)
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.periode SET stand = 'abgeschlossen', abgeschlossen_at = now() WHERE periode = $1", [VORPERIODE]));
    const vor = await call('GET', url('2026-001', VORPERIODE), pl);
    assert.deepEqual([vor.json().periodeStand, vor.json().can.write], ['abgeschlossen', true]);
    const zu = await call('PUT', url('2026-001', VORPERIODE), { ...pl, 'if-match': vor.headers.etag as string }, { trend: 'aufwaerts' });
    assert.equal(zu.statusCode, 200, zu.body);
    assert.deepEqual([zu.json().geaendertNach?.text, zu.json().stand], ['geändert nach Abschluss', 'eingereicht']);
    assert.ok((await call('GET', url('2026-001', VORPERIODE, '/verlauf'), kt)).json().items.some((x: { text: string }) => x.text === 'geändert nach Abschluss'));
  });

  test('Recht an der Organisation erfasst für jedes Projekt, auch ausserordentlich; wer nur liest, nicht', async () => {
    const lesend = { authorization: (await login(api, 'demo', 'u-lesend', 'alle-lesen')).authorization };
    assert.equal((await call('PUT', url('2026-002'), { ...lesend, 'if-match': 'W/"0"' }, VOLL)).statusCode, 403, 'alle lesen: kein statusbericht:write');
    const u = await call('PUT', url('2026-002'), { ...admin, 'if-match': 'W/"0"' }, { ...VOLL, anlass: 'ausserordentlich' });
    assert.equal(u.statusCode, 200, u.body);
    assert.equal(u.json().anlass, 'ausserordentlich');
  });
});

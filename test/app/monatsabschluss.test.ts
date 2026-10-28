/**
 * Monatsabschluss (BC PS.01.02–04, UC-005, Kernablauf K1, AP-E1-2): Sammelaufgabe der UE beim ersten Einreichen,
 * Posteingang mit Auffälligkeiten (K1-4: 5 in 30 Berichten), Sammelbestätigung ohne auffällige (A-28), Rückfrage und
 * erneutes Einreichen (A2), Einfordern (A1), Sperre des Abschlusses, Abschluss mit «nicht gemeldet» (A3, A-11, A-37),
 * Terminabweichungen (Schritt 4), Job am Stichtag, Rechte.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { JobContext } from '@vollholz/platform';
import { periodeFaelligJob } from '../../src/modules/statusbericht/abschluss.ts';
import { full, skipDb } from './harness.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { testdatenK14, type Testdaten } from './monatsabschluss-testdaten.ts';

const skip = await skipDb();

const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
const PERIODE = heute.slice(0, 7);
const VORPERIODE = (() => { const [j, m] = PERIODE.split('-').map(Number) as [number, number]; return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`; })();

const VOLL = {
  status: 'im_plan', trend: 'gleichbleibend',
  abweichung: Object.fromEntries(['inhalt', 'termin', 'ressourcen', 'budget'].map(d => [d, { stufe: 'keine', kommentar: '' }])),
};

interface Zeile { projektId: string; projektNummer: string; stand: string; version: number; auffaelligkeiten: { art: string }[]; nachRueckfrage: boolean; eingefordertAt: string | null; status: string | null; vorperiode: { status: string | null } | null; can: Record<string, boolean> }

describe('Monatsabschluss', { skip }, () => {
  let api: TestApi;
  let T = '';
  let ue: Record<string, string>, pl: Record<string, string>, gremium: Record<string, string>;
  let daten: Testdaten;
  /** Projekte ausserhalb der 30: 2026-201 (PL reicht über die API ein), 2026-202 (ohne Bericht), 2026-203 (Kategorie C, ohne Pflicht). */
  const p: Record<string, string> = {};

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    T = u.tenantId;
    ue = { authorization: u.authorization };
    let pfA = '';
    await full(api.t.runtime, T, async tx => {
      pfA = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      const pfC = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'C', 'dir', 'Direktion', false) RETURNING id", [T])).rows[0]!.id;
      daten = await testdatenK14(tx, T, PERIODE, VORPERIODE, pfA);
      for (const [nr, pf] of [['2026-201', pfA], ['2026-202', pfA], ['2026-203', pfC]] as const) {
        p[nr] = (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, created_at) VALUES ($1, $2, $3, $4, 'P1', now() - interval '1 year') RETURNING id", [T, nr, `Projekt ${nr}`, pf])).rows[0]!.id;
      }
      // Vorperiode bereits abgeschlossen (die UE arbeitet an der laufenden)
      await tx.query("UPDATE ppm.periode SET stand = 'abgeschlossen', abgeschlossen_at = now() WHERE periode = $1", [VORPERIODE]);
      // Vorperiode von 2026-202: geprüft «kritisch» (Werte für «nicht gemeldet», A-11)
      await tx.query(
        `INSERT INTO ppm.statusbericht (tenant_id, projekt_id, periode, stand, status, trend, phase, abschluss_per, naechster_meilenstein, begruendung, massnahme, eingereicht_at, geprueft_at)
         VALUES ($1, $2, $3, 'geprueft', 'kritisch', 'abwaerts', 'P1', '2027-12-31', 'Konzept', 'Engpass', 'Verstärkung', now() - interval '40 days', now() - interval '35 days')`,
        [T, p['2026-202'], VORPERIODE]);
    });
    const l = await login(api, 'demo', 'u-pl', null);
    for (const nr of ['2026-201', '2026-202']) await grant(api, T, `user:${l.principalId}`, 'pl', { type: 'projekt', id: p[nr]! });
    await grant(api, T, `user:${l.principalId}`, 'pl', { type: 'projekt', id: daten.projekte['2026-104']! });
    pl = { authorization: l.authorization };
    const g = await login(api, 'demo', 'u-gremium', null);
    await grant(api, T, `user:${g.principalId}`, 'gremium', { type: 'portfolio', id: pfA });
    gremium = { authorization: g.authorization };
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const bericht = (id: string, nach = '') => `/v1/projekte/${id}/berichte/${PERIODE}${nach}`;
  const uebersicht = async (q = '') => {
    const r = await call('GET', `/v1/perioden/${PERIODE}${q}`, ue);
    assert.equal(r.statusCode, 200, r.body);
    return r.json() as { kopf: { anzahl: Record<string, number>; abschluss: { moeglich: boolean; sperre: string | null; nichtGemeldet: number }; stand: string; version: number; can: Record<string, boolean> }; items: Zeile[] };
  };
  const zeile = async (id: string) => (await uebersicht()).items.find(i => i.projektId === id)!;
  const aufgaben = async (h: Record<string, string>) => (await call('GET', '/v1/eingang', h)).json().items as { art: string; titel: string; link: string }[];

  test('Erstes Einreichen öffnet die Sammelaufgabe der UE und reiht den Job zum Stichtag ein', async () => {
    assert.ok(!(await aufgaben(ue)).some(a => a.art === 'statusbericht.pruefen'));
    const put = await call('PUT', bericht(p['2026-201']!), { ...pl, 'if-match': 'W/"0"' }, VOLL);
    assert.equal(put.statusCode, 200, put.body);
    const e = await call('POST', bericht(p['2026-201']!, '/einreichen'), { ...pl, 'if-match': 'W/"1"' });
    assert.equal(e.statusCode, 200, e.body);
    const a = (await aufgaben(ue)).filter(x => x.art === 'statusbericht.pruefen');
    assert.equal(a.length, 1);
    assert.match(a[0]!.titel, /^Statusberichte \S+ prüfen$/);
    assert.equal(a[0]!.link, `/portfolio/monatsabschluss?periode=${PERIODE}&stand=eingereicht`);
    assert.ok(!(await aufgaben(pl)).some(x => x.art === 'statusbericht.pruefen'), 'nur mit statusbericht:review');
    const jobs = await full(api.t.runtime, T, tx => tx.query("SELECT payload FROM ppm.job WHERE kind = 'statusbericht.periode_faellig'"));
    assert.deepEqual(jobs.rows.map(r => r.payload), [{ periode: PERIODE }]);
  });

  test('K1-4: Posteingang zeigt die 5 Auffälligkeiten in 30 Berichten zuoberst', async () => {
    const u = await uebersicht();
    assert.deepEqual(u.kopf.anzahl, { projekte: 33 - 1, eingereicht: 31, zurueckgegeben: 0, geprueft: 0, ausstehend: 1, nichtGemeldet: 0, auffaellig: 5 }, 'Kategorie C ohne Bericht zählt nicht');
    const auff = u.items.filter(i => i.auffaelligkeiten.length);
    assert.deepEqual(Object.fromEntries(auff.map(i => [i.projektNummer, i.auffaelligkeiten.map(a => a.art).join()])), daten.auffaellig);
    assert.deepEqual(u.items.slice(0, 5).map(i => i.projektNummer), Object.keys(daten.auffaellig).sort(), 'auffällige zuerst (I-L5)');
    assert.equal(u.items.at(-1)!.stand, 'ausstehend');
    const s = u.items.find(i => i.projektNummer === '2026-104')!;
    assert.deepEqual(s.auffaelligkeiten, [{ art: 'status', von: 'im_plan', nach: 'kritisch' }]);
    assert.deepEqual(u.items.find(i => i.projektNummer === '2026-117')!.auffaelligkeiten, [{ art: 'termin', tage: 21, bezug: 'baseline', text: 'Abnahme' }]);
    assert.deepEqual(u.items.find(i => i.projektNummer === '2026-123')!.auffaelligkeiten, [{ art: 'termin', tage: 62, bezug: 'vorperiode', text: 'Abschluss per' }]);
    assert.deepEqual(u.items.find(i => i.projektNummer === '2026-129')!.auffaelligkeiten, [{ art: 'budget', prozent: 6, phase: 'P2' }]);
    // Filter (I-L1) ändern die Zählung im Kopf nicht
    const f = await uebersicht('?auffaellig=true&stand=eingereicht');
    assert.equal(f.items.length, 5);
    assert.equal(f.kopf.anzahl.eingereicht, 31);
    assert.equal((await uebersicht('?stand=ausstehend')).items[0]!.projektNummer, '2026-202');
  });

  test('Abschluss gesperrt, solange eingereichte Berichte ungeprüft sind', async () => {
    const u = await uebersicht();
    assert.deepEqual([u.kopf.abschluss.moeglich, u.kopf.abschluss.sperre], [false, 'Abschluss: 31 Berichte sind eingereicht, aber nicht geprüft. Prüfe diese zuerst.']);
    const r = await call('POST', `/v1/perioden/${PERIODE}/abschliessen`, ue);
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().reason, 'ungeprueft');
  });

  test('Sammelbestätigung überspringt auffällige Berichte und nennt sie (A-28, I-L4)', async () => {
    const alle = (await uebersicht()).items.map(i => i.projektId);
    const r = await call('POST', `/v1/perioden/${PERIODE}/bestaetigen`, ue, { projekte: [...alle, '00000000-0000-4000-8000-000000000000'] });
    assert.equal(r.statusCode, 200, r.body);
    const e = r.json();
    assert.equal(e.erledigt.length, 26);
    assert.deepEqual(e.uebersprungen.filter((x: { grund: string }) => x.grund === 'auffaellig').map((x: { projektNummer: string }) => x.projektNummer).sort(), Object.keys(daten.auffaellig).sort());
    assert.deepEqual(e.uebersprungen.filter((x: { grund: string }) => x.grund === 'stand').map((x: { projektNummer: string }) => x.projektNummer), ['2026-202']);
    assert.equal(e.unbekannt, 1);
    assert.deepEqual([e.kopf.anzahl.geprueft, e.kopf.anzahl.eingereicht], [26, 5]);
    const audit = await full(api.t.runtime, T, tx => tx.query("SELECT count(*)::int AS n FROM ppm.audit_log WHERE action = 'statusbericht.reviewed'"));
    assert.equal(audit.rows[0]!.n, 26);
  });

  test('Einzeln bestätigen mit ETag und Rückgängig', async () => {
    const z = await zeile(daten.projekte['2026-129']!);
    assert.equal((await call('POST', bericht(z.projektId, '/pruefen'), { ...ue, 'if-match': `W/"${z.version - 1}"` })).statusCode, 412);
    const b = await call('POST', bericht(z.projektId, '/pruefen'), { ...ue, 'if-match': `W/"${z.version}"` });
    assert.equal(b.statusCode, 200, b.body);
    assert.deepEqual([b.json().stand, b.json().can.zuruecknehmen], ['geprueft', true]);
    const zurueck = await call('POST', bericht(z.projektId, '/pruefung-zuruecknehmen'), { ...ue, 'if-match': `W/"${b.json().version}"` });
    assert.equal(zurueck.statusCode, 200, zurueck.body);
    assert.equal(zurueck.json().stand, 'eingereicht');
    const nochmal = await call('POST', bericht(z.projektId, '/pruefen'), { ...ue, 'if-match': `W/"${zurueck.json().version}"` });
    assert.equal(nochmal.statusCode, 200);
    assert.equal((await call('POST', bericht(z.projektId, '/pruefen'), { ...ue, 'if-match': `W/"${nochmal.json().version}"` })).statusCode, 409, 'schon geprüft');
  });

  test('Rückfrage: Bericht zurück an die PL, Aufgabe im Eingang, erneutes Einreichen (A2)', async () => {
    const id = daten.projekte['2026-104']!;
    const z = await zeile(id);
    const leer = await call('POST', bericht(id, '/rueckfragen'), { ...ue, 'if-match': `W/"${z.version}"` }, { text: '   ' });
    assert.equal(leer.statusCode, 422);
    const r = await call('POST', bericht(id, '/rueckfragen'), { ...ue, 'if-match': `W/"${z.version}"` }, { text: 'Warum kritisch? Bitte Massnahme präzisieren.' });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().stand, r.json().rueckfrage.text], ['zurueckgegeben', 'Warum kritisch? Bitte Massnahme präzisieren.']);
    assert.equal((await call('POST', bericht(id, '/rueckfragen'), { ...ue, 'if-match': `W/"${r.json().version}"` }, { text: 'Noch eine' })).statusCode, 409);

    const a = (await aufgaben(pl)).filter(x => x.art === 'statusbericht.rueckfrage');
    assert.equal(a.length, 1);
    assert.match(a[0]!.titel, /^Rückfrage zum Statusbericht \S+ beantworten$/);
    assert.equal(a[0]!.link, `/projekte/2026-104/bericht?periode=${PERIODE}`);
    const rf = await call('GET', bericht(id, '/rueckfragen'), pl);
    assert.equal(rf.statusCode, 200);
    assert.deepEqual(rf.json().items.map((x: { text: string; beantwortetAt: string | null }) => [x.text, x.beantwortetAt]), [['Warum kritisch? Bitte Massnahme präzisieren.', null]]);

    // PL korrigiert und reicht erneut ein (AP-E1-1: zurückgegeben ist bearbeitbar)
    const g = (await call('GET', bericht(id), pl)).json();
    assert.equal(g.stand, 'zurueckgegeben');
    const put = await call('PUT', bericht(id), { ...pl, 'if-match': `W/"${g.version}"` }, { massnahme: 'Zweiter Lieferant ab nächstem Monat' });
    assert.equal(put.statusCode, 200, put.body);
    const e = await call('POST', bericht(id, '/einreichen'), { ...pl, 'if-match': `W/"${put.json().version}"` });
    assert.equal(e.statusCode, 200, e.body);
    assert.ok(!(await aufgaben(pl)).some(x => x.art === 'statusbericht.rueckfrage'), 'Aufgabe erledigt');
    const n = await zeile(id);
    assert.deepEqual([n.stand, n.nachRueckfrage], ['eingereicht', true]);
    assert.ok((await call('GET', bericht(id, '/rueckfragen'), pl)).json().items[0].beantwortetAt);
  });

  test('Einfordern: Erinnerung an die PL, Zeile zeigt «eingefordert am» (A1)', async () => {
    const r = await call('POST', `/v1/perioden/${PERIODE}/einfordern`, ue, { projekte: [p['2026-202'], daten.projekte['2026-101']] });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json().erledigt, [p['2026-202']]);
    assert.deepEqual(r.json().uebersprungen.map((x: { grund: string }) => x.grund), ['stand']);
    assert.ok((await zeile(p['2026-202']!)).eingefordertAt);
    const a = (await aufgaben(pl)).filter(x => x.art === 'statusbericht.erstellen');
    assert.equal(a.length, 1);
    assert.match(a[0]!.titel, /eingefordert$/);
  });

  test('Rechte: PL und Gremium sehen den Monatsabschluss nicht; PL kann nicht prüfen', async () => {
    assert.equal((await call('GET', `/v1/perioden/${PERIODE}`, pl)).statusCode, 403);
    assert.equal((await call('GET', `/v1/perioden/${PERIODE}`, gremium)).statusCode, 403);
    assert.equal((await call('POST', `/v1/perioden/${PERIODE}/abschliessen`, pl)).statusCode, 403);
    const z = await zeile(p['2026-201']!);
    assert.equal((await call('POST', bericht(p['2026-201']!, '/pruefen'), { ...pl, 'if-match': `W/"${z.version}"` })).statusCode, 403);
    assert.equal((await call('GET', '/v1/statusberichte/kopf', pl)).json().pruefen, null);
    const k = (await call('GET', '/v1/statusberichte/kopf', ue)).json().pruefen;
    assert.deepEqual([k.periode, k.eingereicht, k.ausstehend], [PERIODE, 4, 1], '5 auffällige, davon 2026-129 einzeln bestätigt');
  });

  test('Terminabweichungen nach Grösse sortiert (Schritt 4)', async () => {
    const r = await call('GET', `/v1/perioden/${PERIODE}/terminabweichungen`, ue);
    assert.equal(r.statusCode, 200, r.body);
    const t = r.json();
    assert.equal(t.items[0].projektNummer, '2026-117');
    assert.equal(t.items[0].maxTage, 21);
    assert.equal(t.items.length, 30);
    assert.deepEqual(t.ohneBaseline.map((x: { projektNummer: string }) => x.projektNummer), ['2026-201', '2026-202']);
  });

  test('Job am Stichtag öffnet «Periode abschliessen» (ohne Phasenmodell sofort)', async () => {
    const ctx = { tx: <R>(fn: (tx: Parameters<Parameters<JobContext['tx']>[0]>[0]) => Promise<R>) => full(api.t.runtime, T, fn) } as unknown as JobContext;
    await periodeFaelligJob.run(ctx, { periode: PERIODE });
    assert.equal((await aufgaben(ue)).filter(x => x.art === 'periode.abschliessen').length, 1);
  });

  test('Abschluss mit «nicht gemeldet»: Werte der Vorperiode, Periode gesperrt (A3, A-11, A-37)', async () => {
    const offen = (await uebersicht()).items.filter(i => i.stand === 'eingereicht');
    for (const z of offen) assert.equal((await call('POST', bericht(z.projektId, '/pruefen'), { ...ue, 'if-match': `W/"${z.version}"` })).statusCode, 200);
    const k = (await uebersicht()).kopf;
    assert.deepEqual([k.abschluss.moeglich, k.abschluss.nichtGemeldet, k.anzahl.geprueft], [true, 1, 31]);
    assert.equal((await call('POST', `/v1/perioden/${PERIODE}/abschliessen`, { ...ue, 'if-match': `W/"${k.version + 1}"` })).statusCode, 412);
    const r = await call('POST', `/v1/perioden/${PERIODE}/abschliessen`, { ...ue, 'if-match': `W/"${k.version}"` });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().stand, 'abgeschlossen');
    assert.ok(r.json().abgeschlossenBy);

    const u = await uebersicht();
    const ng = u.items.find(i => i.projektId === p['2026-202'])!;
    assert.deepEqual([ng.stand, ng.status, ng.vorperiode?.status], ['nicht_gemeldet', 'kritisch', 'kritisch']);
    assert.equal(u.items.filter(i => i.stand === 'geprueft').length, 31);
    const d = await full(api.t.runtime, T, tx => tx.query<{ gemeldet: boolean; status: string; werte_aus: string; naechster_meilenstein: string }>(
      'SELECT gemeldet, status, werte_aus, naechster_meilenstein FROM ppm.dashboard_zeile WHERE periode = $1 AND projekt_id = $2', [PERIODE, p['2026-202']]));
    assert.deepEqual(d.rows, [{ gemeldet: false, status: 'kritisch', werte_aus: VORPERIODE, naechster_meilenstein: 'Konzept' }]);

    // Aufgaben erledigt bzw. entfallen
    assert.ok(!(await aufgaben(ue)).some(x => x.art === 'statusbericht.pruefen' || x.art === 'periode.abschliessen'));
    assert.ok(!(await aufgaben(pl)).some(x => x.art === 'statusbericht.erstellen'));
    // Gesperrt (Z9): kein Bericht, keine Prüfung, kein zweiter Abschluss
    assert.equal((await call('PUT', bericht(p['2026-202']!), { ...pl, 'if-match': 'W/"0"' }, VOLL)).json().reason, 'periode');
    assert.equal((await call('POST', `/v1/perioden/${PERIODE}/abschliessen`, ue)).statusCode, 409);
    assert.equal((await call('POST', `/v1/perioden/${PERIODE}/bestaetigen`, ue, { projekte: [p['2026-201']] })).statusCode, 409);
    assert.ok(u.items.every(i => !Object.values(i.can).some(Boolean)));
    const audit = await full(api.t.runtime, T, tx => tx.query("SELECT data FROM ppm.audit_log WHERE action = 'periode.closed'"));
    assert.deepEqual([audit.rows[0]!.data.gemeldet, audit.rows[0]!.data.nichtGemeldet], [31, 1]);
  });
});
